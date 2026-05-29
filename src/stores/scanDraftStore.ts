import { create } from 'zustand';

import {
  DEFAULT_OPERATION_STATUS,
  defaultCurrencyForSite,
  marketplaceFromSiteType as strictMarketplaceFromSiteType,
} from '@/features/scanner/constants';
import { mmkv } from '@/lib/mmkv';
import { readCachedLocation } from '@/features/location/pickupStore';
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
  // S1 expansion — the AI already returns these (see SmartProductData in
  // smartDetectionTypes.ts). S4 will plumb the analyze-process-images mapper
  // to populate them; for now they default to empty so existing call sites
  // (mapSmartDetection) compile without forcing every consumer to provide them.
  brand?: string;
  model?: string;
  year?: string;
  weight?: string;
  dimensions?: string;
  co2Emissions?: string;
  grade?: ItemGrade;
  // S5.2: AI may return one or more pickup locations + a country. Both
  // optional — processing.tsx only patches them through when non-empty so
  // it doesn't clobber user input or GPS auto-fill.
  locations?: string[];
  country?: string;
  // W2 (scan_v3): the AI now returns `site_type` (backend prompt change —
  // see audit B3). When the AI's site_type maps to a known MarketplaceKey,
  // we surface it here so processing.tsx can seed `draft.marketplace` from
  // the AI verdict instead of always defaulting to env. Null = AI said
  // nothing useful; caller falls back to env default.
  suggestedMarketplace?: MarketplaceKey | null;
};

export type ScanFlowStep = 'processing' | 'review' | 'detail';

export type ListingMode = 'single' | 'grouped';

// Web parity: extends `QuickListingFormState` in GreenBridgeSeller. Backend
// fields supported by /wp/create-product-direct (see controller/wordPressV2.js):
//   - item_grade        → server-side `grade` meta
//   - weight_per_unit   → float
//   - serial_number     → silently dropped by backend, but web sends it too;
//                         kept for forward-compat when backend lands the field
//   - year / dimensions / co2Emissions → folded into product_content via
//                         appendSpecsToDescription (no separate backend field)
//   - listingDurationDays → no backend field today; captured locally so S5 can
//                         hide the UI per reviewer Note #6 until backend lands
export type ItemGrade = 'A' | 'B' | 'C' | 'D';

// Currency: backend treats `price_currency` as opaque string (controller/
// wordPressV2.js:360 just forwards it to meta). Mobile uses the same 6-list
// the settings module surfaces; widen later only if the backend constrains.
export type SupportedCurrency = 'USD' | 'TWD' | 'HKD' | 'CNY' | 'JPY' | 'THB';

// Drives `allowed_sites[]` at submit (matches web's `marketplaceToAllowedSite`).
export type MarketplaceKey = '101lab' | '101machine' | '101recycle' | '101it';

export type InstallationMode = 'installed' | 'deinstalled';

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
  priceCurrency: SupportedCurrency;
  priceFormat: 'buyNow' | 'offer';
  quantity: number;
  // S5.2: web parity — parallel arrays. `locationCountries[i]` is the country
  // for `locations[i]`. Backend takes a single `country` form key (we ship
  // `locationCountries[0]`) plus repeated `location[]` entries. Singular
  // `location: {address, country}` was the pre-S5.2 shape; `migrateDraft`
  // translates legacy persisted drafts.
  locations: string[];
  locationCountries: string[];
  documents: { uri: string; name: string; mimeType: string }[];
  allowedSites: string[];
  sellerVisible: boolean;
  visibility: BatchVisibility;
  networkSellers: number[];
  // ── S1 expansion (web parity) ─────────────────────────────────────────────
  brand: string;
  model: string;
  year: string;
  weight: string;
  dimensions: string;
  co2Emissions: string;
  grade: ItemGrade;
  serialNumber: string;
  marketplace: MarketplaceKey;
  installation: InstallationMode;
  /** No backend field today — S5 will hide the picker until backend lands. */
  listingDurationDays: number;
};

/**
 * Capture-session GCS state. Photos uploaded once via `/gcs/upload` are
 * tracked by their local `Photo.uri` so we can reuse them for both AI
 * analysis (URL mode) and product creation (gcs_image_paths[]) without
 * re-sending bytes. The map is monotonic within a scan session — adding,
 * removing, or reordering photos doesn't invalidate existing entries; a
 * URI not in the map just signals "needs upload" to the consumer.
 *
 * Cleared on `reset()` and on `setPendingPhotos()` (which starts a fresh
 * capture session). See Docs/GCS_UPLOAD_INTEGRATION_PLAN.md (W5).
 */
export type DraftGcs = {
  sessionId: string;
  objectNameByPhotoUri: Record<string, string>;
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
  /** GCS upload state (W5) — see DraftGcs above. */
  gcs?: DraftGcs | null;
};

function newDraftId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// W2 (scan_v3): now delegates to the strict helper in constants.ts but
// preserves the legacy lenient behavior (unknown → '101lab') so emptyDraft
// and migrateDraft never see a null marketplace. The strict helper is what
// AI mappers use to distinguish "AI said X" from "AI said nothing".
function marketplaceFromSiteType(siteType: string): MarketplaceKey {
  return strictMarketplaceFromSiteType(siteType) ?? '101lab';
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
    locations: [],
    locationCountries: [],
    documents: [],
    allowedSites: [siteType],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
    // S1 — web-parity defaults
    brand: '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: 'A',
    serialNumber: '',
    marketplace: marketplaceFromSiteType(siteType),
    installation: 'deinstalled',
    listingDurationDays: 90,
  };
}

function migrateDraft(d: DraftItem): DraftItem {
  const siteType = getSiteType();

  // S5.2: translate the legacy singular `location: {address, country} | null`
  // into the new parallel arrays if the new fields aren't present. Cast through
  // `unknown` so TS lets us read the old shape that's no longer in the type.
  const legacy = d as unknown as {
    location?: { address?: string; country?: string } | null;
    locations?: string[];
    locationCountries?: string[];
  };
  const legacyAddress = legacy.location?.address?.trim() ?? '';
  const legacyCountry = legacy.location?.country?.trim() ?? '';
  const locations =
    legacy.locations ?? (legacyAddress ? [legacyAddress] : []);
  const locationCountries =
    legacy.locationCountries ?? (legacyAddress ? [legacyCountry] : []);

  return {
    ...d,
    visibility: d.visibility ?? 'PUBLIC',
    networkSellers: d.networkSellers ?? [],
    // S1 backfill — older drafts persisted before these fields existed need
    // sane defaults so the new submit path (which reads them) doesn't NaN.
    brand: d.brand ?? '',
    model: d.model ?? '',
    year: d.year ?? '',
    weight: d.weight ?? '',
    dimensions: d.dimensions ?? '',
    co2Emissions: d.co2Emissions ?? '',
    grade: d.grade ?? 'A',
    serialNumber: d.serialNumber ?? '',
    marketplace: d.marketplace ?? marketplaceFromSiteType(siteType),
    installation: d.installation ?? 'deinstalled',
    listingDurationDays: d.listingDurationDays ?? 90,
    // S5.2 backfill
    locations,
    locationCountries,
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
    gcs: null,
  };
}

function draftFromSmartFields(
  photos: Photo[],
  fields: SmartItemFields,
  visibility: BatchVisibility,
): DraftItem {
  const base = emptyDraft(photos);
  // Pickup location is a DEVICE value (location permission → pickupStore), NOT
  // a backend/AI field. Seed each grouped draft from the cached device location
  // so the review hub reflects the real location and doesn't flag it missing.
  // Empty when nothing is cached yet — LocationCard / manual entry fills it.
  const cachedLoc = readCachedLocation();
  const seededLocations = cachedLoc?.address?.trim()
    ? [cachedLoc.address.trim()]
    : [];
  const seededCountries = seededLocations.length
    ? [cachedLoc?.country ?? '']
    : [];
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
    // Device-sourced pickup location (see seededLocations above).
    locations: seededLocations,
    locationCountries: seededCountries,
    // S4: spec fields plumbed through smart-detect path too.
    brand: fields.brand,
    model: fields.model,
    year: fields.year,
    weight: fields.weight,
    dimensions: fields.dimensions,
    co2Emissions: fields.co2Emissions,
    grade: fields.grade,
    // W2 (scan_v3): seed marketplace from AI suggestion when present.
    // emptyDraft already supplied env-default via base.marketplace; only
    // override when the AI gave a recognized value (non-null).
    marketplace: fields.suggestedMarketplace ?? base.marketplace,
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

// Debounced session persistence — keystrokes in the detail form fire `patch`
// every change; without this, MMKV.set + JSON.stringify of the whole session
// (queued items, mergedSingle, AI blob) runs synchronously on every keypress.
// Any "hard" action (setLastStep, setAi, enqueue, demote, etc.) flushes the
// pending write so a screen transition can never lose an in-flight patch.
let pendingPatchSession: PersistedScan | null = null;
let pendingPatchTimer: ReturnType<typeof setTimeout> | null = null;
const PATCH_DEBOUNCE_MS = 250;

function schedulePatchPersist(session: PersistedScan) {
  pendingPatchSession = session;
  if (pendingPatchTimer) clearTimeout(pendingPatchTimer);
  pendingPatchTimer = setTimeout(() => {
    if (pendingPatchSession) persistSession(pendingPatchSession);
    pendingPatchSession = null;
    pendingPatchTimer = null;
  }, PATCH_DEBOUNCE_MS);
}

function flushPendingPatch() {
  if (pendingPatchTimer) {
    clearTimeout(pendingPatchTimer);
    pendingPatchTimer = null;
  }
  if (pendingPatchSession) {
    persistSession(pendingPatchSession);
    pendingPatchSession = null;
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
    gcs: get().gcs,
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
  // Memory-only handshake between processing and detection screens. Never
  // persisted — a fresh app launch falls back to staged where the user
  // re-runs AI rather than risk applying stale grouping to edited photos.
  pendingDetection: MappedSmartDetection | null;
  hydrated: boolean;
  hydrate: () => void;
  setListingMode: (mode: ListingMode) => void;
  patchSession: (partial: {
    sessionVisibility?: BatchVisibility;
    networkSellers?: number[];
  }) => void;
  setPendingPhotos: (photos: Photo[]) => Promise<void>;
  clearPendingPhotos: () => void;
  setPendingDetection: (mapped: MappedSmartDetection | null) => void;
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
  /**
   * Multi-product wizard write path (multi_product_wizard_plan W3,
   * pre-coding note #2). Pure in-place patch by queue index — does NOT
   * touch `current` or `editingGroupedItem` (those belong to the legacy
   * pop-to-Detail flow which is structurally incompatible with the
   * keep-in-queue wizard). Each step's Save&Next/Previous funnels through
   * here.
   */
  patchQueuedItem: (index: number, patch: Partial<DraftItem>) => void;
  prepareGroupedReview: () => void;
  allItemsForReview: () => DraftItem[];
  applySmartDetection: (
    mapped: MappedSmartDetection,
    sourcePhotos: Photo[],
    forceMode?: ListingMode,
  ) => Promise<ListingMode>;
  collapseToSingleFromSmartDetection: () => Promise<void>;
  /**
   * GCS upload state (W5). Populated by `processing.tsx` after
   * `uploadGcsPhotos` succeeds; consumed by submit (W4.c) to send
   * `gcs_image_paths[]` instead of inline image bytes.
   */
  gcs: DraftGcs | null;
  /** Merge new uri→objectName entries into the GCS map. Replaces the whole
   *  map if the sessionId changes (treat as a new upload session). */
  mergeGcs: (sessionId: string, entries: Record<string, string>) => void;
  clearGcs: () => void;
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
  pendingDetection: null,
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
      // pendingDetection is memory-only; paranoid clear on hydrate.
      pendingDetection: null,
      // GCS map IS persisted as part of PersistedScan — restore as-is. Missing
      // field on legacy drafts → null. See W5.
      gcs: persisted.gcs ?? null,
      hydrated: true,
    });
  },
  setListingMode: (mode) => {
    const next = { ...snapshot(get), mode };
    persistSession(next);
    set({ mode });
  },
  patchSession: (partial) => {
    const next: PersistedScan = { ...snapshot(get), ...partial };
    persistSession(next);
    set(partial);
  },
  setPendingPhotos: async (photos) => {
    const persisted = await persistPhotosForDraft(photos, 'pending');
    mmkv.set(PENDING_PHOTOS_KEY, JSON.stringify(persisted));
    // Any change to the photo set invalidates the prior AI grouping AND any
    // previous GCS upload map (new capture session = unrelated URIs). W5.
    const next: PersistedScan = { ...snapshot(get), gcs: null };
    persistSession(next);
    set({ pendingPhotos: persisted, pendingDetection: null, gcs: null });
  },
  clearPendingPhotos: () => {
    mmkv.remove(PENDING_PHOTOS_KEY);
    const next: PersistedScan = { ...snapshot(get), gcs: null };
    persistSession(next);
    set({ pendingPhotos: null, pendingDetection: null, gcs: null });
  },
  setPendingDetection: (mapped) => {
    set({ pendingDetection: mapped });
  },
  start: async (photos) => {
    const draft = emptyDraft(photos);
    draft.photos = await persistPhotosForDraft(photos, draft.id);
    draft.lastStep = 'processing';
    mmkv.remove(PENDING_PHOTOS_KEY);
    const next: PersistedScan = { ...snapshot(get), current: draft };
    persistSession(next);
    // A fresh AI run can't reuse a previous-set's detection.
    set({ current: draft, pendingPhotos: null, pendingDetection: null });
  },
  updatePhotos: async (photos) => {
    const cur = get().current;
    if (!cur) return;
    flushPendingPatch();
    const persisted = await persistPhotosForDraft(photos, cur.id);
    const next = { ...cur, photos: persisted };
    const session = { ...snapshot(get), current: next };
    persistSession(session);
    // Photos changed on current → any prior detection grouping is stale.
    set({ current: next, pendingDetection: null });
  },
  setAi: (ai) => {
    const cur = get().current;
    if (!cur) return;
    flushPendingPatch();
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
    // Debounced — keystrokes don't synchronously rewrite the whole session.
    schedulePatchPersist(session);
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
    flushPendingPatch();
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
    // Force a debounced patch flush before snapshotting — the in-flight patch
    // belongs in the queued item, not in the next session.
    flushPendingPatch();
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
    // A pending debounced patch on `current` could otherwise win the next
    // flush race and overwrite the queue with a stale snapshot.
    flushPendingPatch();
    const queuedItems = get().queuedItems.filter((i) => i.id !== id);
    const session = { ...snapshot(get), queuedItems };
    persistSession(session);
    set({ queuedItems });
  },
  editQueuedItem: (id) => {
    flushPendingPatch();
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
  patchQueuedItem: (index, patch) => {
    // Multi-product wizard write path — see interface comment. Deliberately
    // does NOT touch `current` or `editingGroupedItem`. The wizard keeps every
    // item in `queuedItems` and edits by index.
    flushPendingPatch();
    const queuedItems = get().queuedItems;
    if (index < 0 || index >= queuedItems.length) return;
    const target = queuedItems[index];
    if (!target) return;
    const next = [...queuedItems];
    next[index] = { ...target, ...patch };
    const session = { ...snapshot(get), queuedItems: next };
    persistSession(session);
    set({ queuedItems: next });
  },
  prepareGroupedReview: () => {
    // Critical: `onReviewGroup` in detail.tsx calls `patch(updated)` immediately
    // before this. Without flushing, the debounced patch fires AFTER we persist
    // the snapshot here and overwrites MMKV with an older session (current still
    // set, queue missing the just-promoted item).
    flushPendingPatch();
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
  applySmartDetection: async (mapped, sourcePhotos, forceMode) => {
    validateMappedDetection(mapped, sourcePhotos.length);

    // The user's choice on the detection screen overrides the AI's suggestion.
    // When forceMode === 'single' but AI returned multiple products, we still
    // route to the merged-single draft (pooled photos), not products[0].
    const effectiveMode: ListingMode = forceMode ?? mapped.mode;

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

    if (effectiveMode === 'single') {
      // forceMode === 'single' over an AI-multi result → use the pooled
      // merged-single draft so the user's "actually one product" choice
      // doesn't silently keep only products[0]'s photo slice.
      const singleCurrent =
        forceMode === 'single' && mapped.mode !== 'single'
          ? mergedSingle
          : queuedItems[0];
      const session: PersistedScan = {
        ...snapshot(get),
        mode: 'single',
        current: singleCurrent,
        queuedItems: [],
        mergedSingle,
        ...meta,
        editingGroupedItem: false,
      };
      persistSession(session);
      set({
        mode: 'single',
        current: singleCurrent,
        queuedItems: [],
        mergedSingle,
        ...meta,
        editingGroupedItem: false,
        // Detection consumed; clear the handshake.
        pendingDetection: null,
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
      // Detection consumed; clear the handshake.
      pendingDetection: null,
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
  gcs: null,
  mergeGcs: (sessionId, entries) => {
    const cur = get().gcs;
    const next: DraftGcs =
      cur && cur.sessionId === sessionId
        ? {
            sessionId,
            objectNameByPhotoUri: { ...cur.objectNameByPhotoUri, ...entries },
          }
        : { sessionId, objectNameByPhotoUri: { ...entries } };
    const session = { ...snapshot(get), gcs: next };
    persistSession(session);
    set({ gcs: next });
  },
  clearGcs: () => {
    const session = { ...snapshot(get), gcs: null };
    persistSession(session);
    set({ gcs: null });
  },
  reset: () => {
    flushPendingPatch();
    mmkv.remove(DRAFT_KEY);
    mmkv.remove(PENDING_PHOTOS_KEY);
    set({
      ...defaultSession(),
      pendingPhotos: null,
      pendingDetection: null,
      editingGroupedItem: false,
      gcs: null,
    });
  },
  hasDraft: () => !!get().current || get().queuedItems.length > 0,
}));
