import { create } from 'zustand';

import {
  DEFAULT_OPERATION_STATUS,
  defaultCurrencyForSite,
} from '@/features/scanner/constants';
import { mmkv } from '@/lib/mmkv';
import { getSiteType } from '@/services/scanner/buildFormData';
import { persistPhotosForDraft } from '@/services/upload/persistPhotos';
import type { BatchVisibility } from '@/types/batch';

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
  };
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
  };
}

type ScanDraftState = {
  mode: ListingMode;
  queuedItems: DraftItem[];
  current: DraftItem | null;
  sessionVisibility: BatchVisibility;
  networkSellers: number[];
  editingGroupedItem: boolean;
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
  reset: () => void;
  hasDraft: () => boolean;
};

export const useScanDraft = create<ScanDraftState>((set, get) => ({
  ...defaultSession(),
  editingGroupedItem: false,
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
  reset: () => {
    mmkv.remove(DRAFT_KEY);
    mmkv.remove(PENDING_PHOTOS_KEY);
    set({ ...defaultSession(), pendingPhotos: null, editingGroupedItem: false });
  },
  hasDraft: () => !!get().current || get().queuedItems.length > 0,
}));
