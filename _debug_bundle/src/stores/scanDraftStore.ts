import { create } from 'zustand';

import {
  DEFAULT_OPERATION_STATUS,
  defaultCurrencyForSite,
} from '@/features/scanner/constants';
import { mmkv } from '@/lib/mmkv';
import { getSiteType } from '@/services/scanner/buildFormData';
import {
  buildPhotoSlices,
  SmartDetectionApplyError,
  validateMappedDetection,
} from '@/features/scanner/applySmartDetection';
import type { MappedSmartDetection, SmartItemFields } from '@/features/scanner/smartDetectionTypes';
import { persistPhotosForDraft } from '@/services/upload/persistPhotos';
import type { BatchVisibility } from '@/types/batch';

export { SmartDetectionApplyError };

const DRAFT_KEY = 'scan.currentDraft';
const PENDING_PHOTOS_KEY = 'scan.pendingPhotos';

export type Photo = {
  uri: string;
  width: number;
  height: number;
  sizeBytes?: number;
};

export type AiResult = {
  name: string;
  description: string;
  condition: string[];
  operationStatus: string[];
  suggestedPrice: string | null;
  currency: 'USD' | 'TWD';
};

export type ScanFlowStep = 'processing' | 'review' | 'detail';

export type ListingMode = 'single' | 'grouped';

export type DraftItem = {
  id: string;
  photos: Photo[];
  ai: AiResult | null;
  aiSkipped?: boolean;
  lastStep?: ScanFlowStep;
  productId?: number;
  productIds: number[];
  title: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  condition: string[];
  operationStatus: string[];
  pricePerUnit: string;
  priceCurrency: 'USD' | 'TWD';
  priceFormat: 'buyNow' | 'offer';
  quantity: number;
  location: { address: string; country: string } | null;
  documents: { uri: string; name: string; mimeType: string }[];
  allowedSites: string[];
  sellerVisible: boolean;
  visibility: BatchVisibility;
  networkSellers: number[];
};

type PersistedScan = {
  mode: ListingMode;
  queuedItems: DraftItem[];
  current: DraftItem | null;
  sessionVisibility: BatchVisibility;
  networkSellers: number[];
  editingGroupedItem?: boolean;
  /** Full draft for "it's actually one product" (grouped smart-detect only). */
  mergedSingle?: DraftItem | null;
  detectionSummary?: string;
  detectionConfidence?: number;
};

function newDraftId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyDraft(photos: Photo[]): DraftItem {
  const siteType = getSiteType();
  return {
    id: newDraftId(),
    photos,
    ai: null,
    productIds: [],
    title: '',
    description: '',
    categoryId: null,
    categoryName: null,
    condition: [],
    operationStatus: [...DEFAULT_OPERATION_STATUS],
    pricePerUnit: '',
    priceCurrency: defaultCurrencyForSite(siteType),
    priceFormat: 'buyNow',
    quantity: 1,
    location: null,
    documents: [],
    allowedSites: [siteType],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
  };
}

function migrateDraft(d: DraftItem): DraftItem {
  return {
    ...d,
    visibility: d.visibility ?? 'PUBLIC',
    networkSellers: d.networkSellers ?? [],
  };
}

function defaultSession(): PersistedScan {
  return {
    mode: 'single',
    queuedItems: [],
    current: null,
    sessionVisibility: 'PUBLIC',
    networkSellers: [],
    mergedSingle: null,
    detectionSummary: undefined,
    detectionConfidence: undefined,
  };
}

function draftFromSmartFields(
  photos: Photo[],
  fields: SmartItemFields,
  visibility: BatchVisibility,
): DraftItem {
  const base = emptyDraft(photos);
  return {
    ...base,
    title: fields.title,
    description: fields.description,
    categoryId: fields.categoryId,
    categoryName: fields.categoryName,
    condition: fields.condition,
    operationStatus: fields.operationStatus,
    pricePerUnit: fields.pricePerUnit,
    priceFormat: fields.priceFormat,
    priceCurrency: fields.priceCurrency,
    ai: fields.ai,
    aiSkipped: false,
    lastStep: 'detail',
    visibility,
  };
}

async function persistDraftPhotos(draft: DraftItem): Promise<DraftItem> {
  const photos = await persistPhotosForDraft(draft.photos, draft.id);
  return { ...draft, photos };
}

function persistSession(session: PersistedScan) {
  if (session.current || session.queuedItems.length > 0) {
    mmkv.set(DRAFT_KEY, JSON.stringify(session));
  } else {
    mmkv.remove(DRAFT_KEY);
  }
}

function loadPersisted(): PersistedScan {
  const raw = mmkv.getString(DRAFT_KEY);
  if (!raw) return defaultSession();
  try {
    const parsed = JSON.parse(raw) as PersistedScan | DraftItem;
    if ('photos' in parsed && !('current' in parsed)) {
      const legacy = migrateDraft(parsed as DraftItem);
      return {
        mode: 'single',
        queuedItems: [],
        current: legacy,
        sessionVisibility: legacy.visibility ?? 'PUBLIC',
        networkSellers: legacy.networkSellers ?? [],
        editingGroupedItem: false,
        mergedSingle: null,
      };
    }
    const session = parsed as PersistedScan;
    return {
      mode: session.mode ?? 'single',
      queuedItems: (session.queuedItems ?? []).map(migrateDraft),
      current: session.current ? migrateDraft(session.current) : null,
      sessionVisibility: session.sessionVisibility ?? 'PUBLIC',
      networkSellers: session.networkSellers ?? [],
      editingGroupedItem: session.editingGroupedItem ?? false,
      mergedSingle: session.mergedSingle ? migrateDraft(session.mergedSingle) : null,
      detectionSummary: session.detectionSummary,
      detectionConfidence: session.detectionConfidence,
    };
  } catch {
    mmkv.remove(DRAFT_KEY);
    return defaultSession();
  }
}

function snapshot(get: () => ScanDraftState): PersistedScan {
  return {
    mode: get().mode,
    queuedItems: get().queuedItems,
    current: get().current,
    sessionVisibility: get().sessionVisibility,
    networkSellers: get().networkSellers,
    editingGroupedItem: get().editingGroupedItem,
    mergedSingle: get().mergedSingle,
    detectionSummary: get().detectionSummary,
    detectionConfidence: get().detectionConfidence,
  };
}

type ScanDraftState = {
  mode: ListingMode;
  queuedItems: DraftItem[];
  current: DraftItem | null;
  sessionVisibility: BatchVisibility;
  networkSellers: number[];
  editingGroupedItem: boolean;
  mergedSingle: DraftItem | null;
  detectionSummary: string;
  detectionConfidence: number;
  pendingPhotos: Photo[] | null;
  hydrated: boolean;
  hydrate: () => void;
  setListingMode: (mode: ListingMode) => void;
  patchSession: (partial: {
    sessionVisibility?: BatchVisibility;
    networkSellers?: number[];
  }) => void;
  setPendingPhotos: (photos: Photo[]) => Promise<void>;
  clearPendingPhotos: () => void;
  start: (photos: Photo[]) => Promise<void>;
  updatePhotos: (photos: Photo[]) => Promise<void>;
  setAi: (ai: AiResult) => void;
  patch: (partial: Partial<DraftItem>) => void;
  setLastStep: (step: ScanFlowStep) => void;
  addProductId: (productId: number) => void;
  setQueuedItemProductId: (itemId: string, productId: number) => void;
  enqueueCurrentItem: () => void;
  removeQueuedItem: (id: string) => void;
  editQueuedItem: (id: string) => void;
  prepareGroupedReview: () => void;
  saveCurrentToGroupedQueue: () => void;
  allItemsForReview: () => DraftItem[];
  applySmartDetection: (
    mapped: MappedSmartDetection,
    sourcePhotos: Photo[],
  ) => Promise<ListingMode>;
  collapseToSingleFromSmartDetection: () => Promise<void>;
  reset: () => void;
  hasDraft: () => boolean;
};

export const useScanDraft = create<ScanDraftState>((set, get) => ({
  ...defaultSession(),
  editingGroupedItem: false,
  mergedSingle: null,
  detectionSummary: '',
  detectionConfidence: 0,
  pendingPhotos: null,
  hydrated: false,
  hydrate: () => {
    const session = loadPersisted();
    const { editingGroupedItem, ...persisted } = session;
    let pendingPhotos: Photo[] | null = null;
    const pendingRaw = mmkv.getString(PENDING_PHOTOS_KEY);
    if (pendingRaw) {
      try {
        pendingPhotos = JSON.parse(pendingRaw) as Photo[];
      } catch {
        mmkv.remove(PENDING_PHOTOS_KEY);
      }
    }
    set({
      ...persisted,
      editingGroupedItem: editingGroupedItem ?? false,
      pendingPhotos,
      hydrated: true,
    });
  },
  setListingMode: (mode) => {
    const next = { ...snapshot(get), mode };
    persistSession(next);
    set({ mode });
  },
  patchSession: (partial) => {
    const nextState = { ...get(), ...partial };
    persistSession(snapshot(() => nextState as ScanDraftState));
    set(partial);
  },
  setPendingPhotos: async (photos) => {
    const persisted = await persistPhotosForDraft(photos, 'pending');
    mmkv.set(PENDING_PHOTOS_KEY, JSON.stringify(persisted));
    set({ pendingPhotos: persisted });
  },
  clearPendingPhotos: () => {
    mmkv.remove(PENDING_PHOTOS_KEY);
    set({ pendingPhotos: null });
  },
  start: async (photos) => {
    const draft = emptyDraft(photos);
    draft.photos = await persistPhotosForDraft(photos, draft.id);
    draft.lastStep = 'processing';
    mmkv.remove(PENDING_PHOTOS_KEY);
    const next: PersistedScan = { ...snapshot(get), current: draft };
    persistSession(next);
    set({ current: draft, pendingPhotos: null });
  },
  updatePhotos: async (photos) => {
    const cur = get().current;
    if (!cur) return;
    const persisted = await persistPhotosForDraft(photos, cur.id);
    const next = { ...cur, photos: persisted };
    const session = { ...snapshot(get), current: next };
    persistSession(session);
    set({ current: next });
  },
  setAi: (ai) => {
    const cur = get().current;
    if (!cur) return;
    const next = { ...cur, ai, aiSkipped: false };
    const session = { ...snapshot(get), current: next };
    persistSession(session);
    set({ current: next });
  },
  patch: (partial) => {
    const cur = get().current;
    if (!cur) return;
    const next = { ...cur, ...partial };
    const session = { ...snapshot(get), current: next };
    persistSession(session);
    set({ current: next });
  },
  setLastStep: (lastStep) => {
    const cur = get().current;
    if (!cur) return;
    // Short-circuit on identical value — without this, an effect that depends
    // on `draft` and calls setLastStep creates an infinite re-render loop
    // (new object reference each call → draft selector returns new value →
    // effect re-runs → calls setLastStep again).
    if (cur.lastStep === lastStep) return;
    const next = { ...cur, lastStep };
    const session = { ...snapshot(get), current: next };
    persistSession(session);
    set({ current: next });
  },
  addProductId: (productId) => {
    const cur = get().current;
    if (!cur) return;
    const ids = cur.productIds.includes(productId)
      ? cur.productIds
      : [...cur.productIds, productId];
    const next = { ...cur, productId, productIds: ids };
    const session = { ...snapshot(get), current: next };
    persistSession(session);
    set({ current: next });
  },
  setQueuedItemProductId: (itemId, productId) => {
    const queuedItems = get().queuedItems.map((i) => {
      if (i.id !== itemId) return i;
      const productIds = i.productIds.includes(productId)
        ? i.productIds
        : [...i.productIds, productId];
      return { ...i, productId, productIds };
    });
    const session = { ...snapshot(get), queuedItems };
    persistSession(session);
    set({ queuedItems });
  },
  enqueueCurrentItem: () => {
    const cur = get().current;
    if (!cur) return;
    const session: PersistedScan = {
      ...snapshot(get),
      queuedItems: [...get().queuedItems, cur],
      current: null,
      editingGroupedItem: false,
    };
    persistSession(session);
    set({ queuedItems: session.queuedItems, current: null, editingGroupedItem: false });
  },
  saveCurrentToGroupedQueue: () => {
    const cur = get().current;
    if (!cur) return;
    const session: PersistedScan = {
      ...snapshot(get),
      queuedItems: [...get().queuedItems, cur],
      current: null,
      editingGroupedItem: false,
    };
    persistSession(session);
    set({ queuedItems: session.queuedItems, current: null, editingGroupedItem: false });
  },
  removeQueuedItem: (id) => {
    const queuedItems = get().queuedItems.filter((i) => i.id !== id);
    const session = { ...snapshot(get), queuedItems };
    persistSession(session);
    set({ queuedItems });
  },
  editQueuedItem: (id) => {
    const item = get().queuedItems.find((i) => i.id === id);
    if (!item) return;
    const queuedItems = get().queuedItems.filter((i) => i.id !== id);
    const session: PersistedScan = {
      ...snapshot(get),
      queuedItems,
      current: item,
      editingGroupedItem: true,
    };
    persistSession(session);
    set({ queuedItems, current: item, editingGroupedItem: true });
  },
  prepareGroupedReview: () => {
    const cur = get().current;
    const queuedItems = cur ? [...get().queuedItems, cur] : get().queuedItems;
    const session: PersistedScan = {
      ...snapshot(get),
      queuedItems,
      current: null,
      editingGroupedItem: false,
    };
    persistSession(session);
    set({ queuedItems, current: null, editingGroupedItem: false });
  },
  allItemsForReview: () => {
    const { queuedItems, current } = get();
    return current ? [...queuedItems, current] : queuedItems;
  },
  applySmartDetection: async (mapped, sourcePhotos) => {
    validateMappedDetection(mapped, sourcePhotos.length);

    const visibility = get().sessionVisibility;
    const { slices } = buildPhotoSlices(
      sourcePhotos,
      mapped.products.map((p) => p.imageIndexes),
    );

    const queuedItems: DraftItem[] = [];
    for (let i = 0; i < mapped.products.length; i++) {
      const photos = slices[i];
      if (!photos?.length) continue;
      const draft = await persistDraftPhotos(
        draftFromSmartFields(photos, mapped.products[i].fields, visibility),
      );
      queuedItems.push(draft);
    }

    if (!queuedItems.length) {
      throw new SmartDetectionApplyError(
        'Smart detection produced no items with valid photos',
      );
    }

    const mergedSingle = await persistDraftPhotos(
      draftFromSmartFields(sourcePhotos, mapped.mergedSingleFields, visibility),
    );

    const meta = {
      detectionSummary: mapped.meta.summary,
      detectionConfidence: mapped.meta.confidence,
    };

    if (mapped.mode === 'single') {
      const session: PersistedScan = {
        ...snapshot(get),
        mode: 'single',
        current: queuedItems[0],
        queuedItems: [],
        mergedSingle,
        ...meta,
        editingGroupedItem: false,
      };
      persistSession(session);
      set({
        mode: 'single',
        current: queuedItems[0],
        queuedItems: [],
        mergedSingle,
        ...meta,
        editingGroupedItem: false,
      });
      return 'single';
    }

    const session: PersistedScan = {
      ...snapshot(get),
      mode: 'grouped',
      current: null,
      queuedItems,
      mergedSingle,
      ...meta,
      editingGroupedItem: false,
    };
    persistSession(session);
    set({
      mode: 'grouped',
      current: null,
      queuedItems,
      mergedSingle,
      ...meta,
      editingGroupedItem: false,
    });
    return 'grouped';
  },
  collapseToSingleFromSmartDetection: async () => {
    const merged = get().mergedSingle;
    if (!merged) return;
    const session: PersistedScan = {
      ...snapshot(get),
      mode: 'single',
      current: merged,
      queuedItems: [],
      mergedSingle: null,
      detectionSummary: undefined,
      detectionConfidence: undefined,
      editingGroupedItem: false,
    };
    persistSession(session);
    set({
      mode: 'single',
      current: merged,
      queuedItems: [],
      mergedSingle: null,
      detectionSummary: '',
      detectionConfidence: 0,
      editingGroupedItem: false,
    });
  },
  reset: () => {
    mmkv.remove(DRAFT_KEY);
    mmkv.remove(PENDING_PHOTOS_KEY);
    set({ ...defaultSession(), pendingPhotos: null, editingGroupedItem: false });
  },
  hasDraft: () => !!get().current || get().queuedItems.length > 0,
}));
