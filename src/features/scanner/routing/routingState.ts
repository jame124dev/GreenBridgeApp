import type { SmartItemFields } from '@/features/scanner/smartDetectionTypes';
import type { AiResult, DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';

export type RoutingSource =
  | 'hint'
  | 'vision'
  | 'regex_override'
  | 'low_confidence_fallback';

/**
 * Integration C6 / Decision 2 — ONE enum, the SERVER's. Phase 2 §4.2/§9.1 emit
 * exactly these three. 'llm' was this app's invention (the server never sends
 * it) and 'default_parent' is unreachable once S0-3a gates the default
 * substitution, so both are gone.
 */
export type CategorySource = 'ai' | 'fuzzy' | 'unresolved';

/** Exactly what the wire tells us about routing. Every field may be absent. */
export type RoutingSignal = {
  suggestedMarketplace: MarketplaceKey | null;
  needsClearerPhoto: boolean;
  /**
   * LIVE since S0-2 (wordPressSmart.js:2125). Clamped [0,1], 2 dp, default
   * 0.75. Null only for a persisted pre-S0-2 draft or the analyze path before
   * the backend catches up. ⛔ NEVER compared to a threshold — plan §2.1, and
   * §0.4 explains why that rule is now breakable rather than self-enforcing.
   */
  siteTypeConfidence: number | null;
  siteTypeSource: RoutingSource | null;
  categorySource: CategorySource | null;
};

export type RoutingState = {
  /** 'confirmed' → a statement with a quiet "change". 'ask' → a question. */
  kind: 'confirmed' | 'ask';
  /** The AI's routed marketplace. In 'ask' it is a HIGHLIGHTED GUESS, never a selection. */
  suggested: MarketplaceKey | null;
  /** What the draft/form currently holds. */
  current: MarketplaceKey;
  /** false ⇒ block Submit for this item until the seller chooses. */
  resolved: boolean;
  /** false ⇒ the category must not be presented as an AI answer. */
  prefillCategory: boolean;
  confidence: number | null;
  source: RoutingSource | null;
  /**
   * The server could not read a legible nameplate. Carried verbatim, in BOTH
   * kinds — FIX 1 stopped it forcing `kind: 'ask'` (it is a BRAND/MODEL fact,
   * not a routing one), so it now most often arrives on a CONFIRMED state.
   *
   * Two consumers, both about brand/model rather than the marketplace:
   *   - `routingWhyLine` → `whyNoNameplate` on the confirmed card;
   *   - `IdentityCard`'s per-field hint under BRAND / MODEL.
   * In the ask state it still picks the honest wording — a wide shot of wireless
   * earbuds must not read "We're not sure where this belongs" next to "our best
   * guess is 101IT" when the real problem was the photo.
   */
  needsClearerPhoto: boolean;
};

/**
 * Marketplaces whose category tree cannot currently produce a trustworthy
 * default, per plan §4.1 (both measured live against the WP endpoints):
 *   - machines: 13 flat parents, ZERO subcategories, so `pickDefaultParent`
 *     (controller/wordPressSmart.js:687-692) returns tree[0] = 5300
 *     "Boring & Drilling Machines" — proven shipped on a welding fixture.
 *   - recycle:  ZERO id overlap with the tree the app fetched before M-1, so
 *     every AI recycle id was cleared on arrival.
 *
 * ⚠️ This list is the BELT. The BRACES are `categorySource === 'unresolved'`,
 * which the server itself starts sending with S0-3a, and M-1's recycle-tree
 * fix. It is deliberately conservative and it is NOT permanent policy: once
 * S0-3a and M-1 are both live in a shipped build, revisit whether machines
 * still needs to be here (integration §3, "one assumption invalidation").
 */
const CATEGORY_UNTRUSTED: readonly MarketplaceKey[] = ['101machine', '101recycle'];

/**
 * ⛔ FIX 2 (2026-08-20) — `category_source` values that mean "the MODEL did not
 * pick this", so the ids must not be presented as an AI answer.
 *
 *   - 'unresolved' — the server itself says it could not place the item (S0-3a).
 *   - 'fuzzy'      — the backend's DETERMINISTIC KEYWORD SCORER supplied the ids
 *                    after the model's pick was rejected or absent. MEASURED on
 *                    24 real equipment photos × 3 runs against the DEV backend:
 *                    fuzzy supplied 20 of 71 category picks (28%) and ALL 7 of
 *                    the fuzzy items checked against the tree were WRONG — 0/7.
 *                    A 0%-accuracy fill is worse than an empty required field:
 *                    an empty field asks, a wrong fill lies, and the app was
 *                    badging it with the same green "AI" chip as a real answer.
 *
 * 'ai' and an ABSENT source stay trusted. Do NOT widen this to "anything that is
 * not exactly 'ai'": `categorySource` is null on every persisted pre-S0-2 draft
 * and on any backend that has not caught up, and that would empty their
 * categories too.
 */
const CATEGORY_SOURCE_UNTRUSTED: readonly CategorySource[] = ['unresolved', 'fuzzy'];

/**
 * Sources that mean "the pipeline overwrote or invented the answer", so the
 * seller must be asked. Both are LIVE since S0-2.
 */
const ASK_SOURCES: readonly RoutingSource[] = ['regex_override', 'low_confidence_fallback'];

/**
 * ⛔ blocker (d) — THE ONE HOME for the ask-trigger.
 *
 * Called by `deriveRoutingState` (UI), by `draftFromSmartFields` (the store's
 * persisted answer) and by `app/scan/processing.tsx` (the analyze path). There
 * is no second copy. If you are about to decide "must the seller be asked?"
 * anywhere else, call this instead.
 *
 * ⚠️ NOT the place for `needsClearerPhoto` — FIX 1 removed it from this trigger
 * on purpose (see inside). A caller that wants the unreadable-photo fact reads
 * `signal.needsClearerPhoto` / `RoutingState.needsClearerPhoto` directly and
 * says something about BRAND and MODEL with it, which is what it is about.
 *
 * Pure by construction: `supported` is an argument, so this module imports no
 * MMKV, no axios and no React — which is what lets `scanDraftStore.ts` import
 * it (blocker (e)).
 *
 * Note it does NOT take `confirmed`. "Has the seller already answered?" is a
 * separate question, owned by `deriveRoutingState` and `isRoutingResolved`;
 * this function only answers "is there a question worth asking?".
 */
export function routingNeedsAsk(args: {
  signal: RoutingSignal;
  supported: MarketplaceKey[];
}): boolean {
  const { signal, supported } = args;

  // Only ONE marketplace on offer ⇒ there is no question to ask. A single-
  // marketplace build (or a server list pulled back to one) behaves exactly
  // like 1.0.3. This is also the fail-closed path: `fallbackMarketplaces()`
  // returns one entry.
  if (supported.length <= 1) return false;

  // ⛔ FIX 1 (2026-08-20) — `needsClearerPhoto` DELIBERATELY DOES NOT APPEAR IN
  // THIS FUNCTION. It used to be the first line, `if (signal.needsClearerPhoto)
  // return true;`, and it was the single biggest source of unnecessary questions.
  //
  // WHY IT WAS WRONG. `needs_clearer_photo` is the SERVER saying "I could not
  // read a nameplate". That is a statement about BRAND and MODEL, not about
  // which marketplace an item belongs to. Measured on device (Galaxy S20 FE): a
  // wide desk shot of wireless earbuds came back named "Wireless Earbuds",
  // routed to 101IT, and the card even tagged 101IT as BEST GUESS — while asking
  // the seller where it belonged. The app knew, and asked anyway.
  //
  // MEASURED (24 real equipment photos × 3 runs, DEV backend):
  //   • marketplace routing was 92% accurate (22/24; 64/72 = 88.9% recorded) —
  //     routing is not the weak link and needs no better model;
  //   • `needs_clearer_photo` was true on 9/24 items (37.5%), and being the FIRST
  //     arm it produced almost every ask;
  //   • all 71 observations carried `site_type_source: 'hint'`, so the
  //     ASK_SOURCES arm below never fired in real traffic.
  //
  // The fact is NOT swallowed. It is still carried on the draft and on
  // `RoutingState.needsClearerPhoto`, and it is surfaced where it is actionable:
  // `routingWhyLine` -> `whyNoNameplate` on the confirmed card (reachable for the
  // first time now that such an item stops asking), and a per-field hint under
  // BRAND / MODEL in `IdentityCard`.
  //
  // ⛔ NO CONFIDENCE THRESHOLD gates this, and none may be added: plan §2.1
  // forbids it, and every measured routing error arrived at HIGH confidence, so
  // a cut-off would have caught none of them. `noThreshold` in
  // routingState.test.ts pins that.
  if (signal.siteTypeSource != null && ASK_SOURCES.includes(signal.siteTypeSource)) return true;

  // `suggested === null` is a DEFENSIVE trigger, not the primary one. Plan §2.2
  // rejected it AS THE trigger because every backend path hard-defaults to a
  // valid site type (smartExtractionValidator.js:326-336, :339-345;
  // wordPressSmart.js:1669-1674) so on its own it essentially never fires. It
  // DOES fire when the AI names a marketplace this build does not support —
  // and asking is the right answer then.
  return !(signal.suggestedMarketplace && supported.includes(signal.suggestedMarketplace));
}

/**
 * ⛔ §0.5 OWNER DECISION (APPROVED 2026-08-18) — THE ONE HOME for "may we show
 * the AI's category as an answer?".
 *
 * Called by `deriveRoutingState` (to render "not set"), by
 * `draftFromSmartFields` and `processing.tsx` (to actually CLEAR the fields at
 * draft construction), and by the chip's `onConfirm` (to clear them again on a
 * marketplace change). All four must agree, so there is one function.
 *
 * Why the write matters and the render does not: a machines-routed item arrives
 * carrying a machines category id, so `CategoryConditionCard`'s stale-id effect
 * sees a VALID id and keeps it. Nothing else in the app would ever clear it.
 * Rendering `categoryNotSet` without clearing the field would be a message that
 * contradicts the form.
 */
export function shouldPrefillCategory(args: {
  marketplace: MarketplaceKey;
  signal: RoutingSignal;
}): boolean {
  const { marketplace, signal } = args;
  // FIX 2 — 'unresolved' AND 'fuzzy'. See CATEGORY_SOURCE_UNTRUSTED for the
  // measurement: the keyword scorer supplied 28% of picks at 0/7 accuracy.
  if (signal.categorySource != null && CATEGORY_SOURCE_UNTRUSTED.includes(signal.categorySource)) {
    return false;
  }
  if (CATEGORY_UNTRUSTED.includes(marketplace)) return false;
  return true;
}

/**
 * The exact patch that clears every marketplace-scoped category field.
 *
 * FIVE fields, not one. `categoryId` + `categoryName` are the leaf;
 * `parentCategoryId` + `parentCategoryName` are what the "Other (type brand)"
 * sentinel files under (`buildFormData.ts:34-38` reads them when
 * `categoryId === OTHER_SUBCATEGORY_ID`); `customSubcategory` is the typed
 * brand. Clearing the leaf alone leaves a PREVIOUS marketplace's parent id in
 * the submit payload (`buildFormData.ts:161` single / `:270` grouped) and its
 * name in `category_name` (`:164` / `:271`).
 *
 * TWO constants, because the draft and the form disagree on what "empty" is:
 *   - `DraftItem.categoryId` / `.categoryName` are `string | null` and
 *     `emptyDraft` sets them to **null**. Match that, or a cleared draft is
 *     subtly unlike a fresh one.
 *   - The FORM is `categoryId: z.string().min(1, 'Category is required')`
 *     (schema.ts:23) with `categoryName: z.string().optional()`, and
 *     `draftToFormValues` maps `draft.categoryId ?? ''` (formMapping.ts:168).
 *     `null` there is a `tsc` error.
 * Both read as "missing" to the checklist: `getDraftRequiredStatus` runs the
 * draft through `draftToFormValues` before `detailSchema`, so `null` becomes
 * `''` and fails `.min(1)`.
 *
 * Frozen so the store, the analyze path and both `onConfirm` call sites cannot
 * drift into clearing three of the five.
 */
export const CLEARED_CATEGORY_DRAFT_FIELDS = Object.freeze({
  categoryId: null,
  categoryName: null,
  parentCategoryId: '',
  parentCategoryName: '',
  customSubcategory: '',
}) as Readonly<Pick<
  DraftItem,
  | 'categoryId'
  | 'categoryName'
  | 'parentCategoryId'
  | 'parentCategoryName'
  | 'customSubcategory'
>>;

export const CLEARED_CATEGORY_FORM_FIELDS = Object.freeze({
  categoryId: '',
  categoryName: '',
  parentCategoryId: '',
  parentCategoryName: '',
  customSubcategory: '',
}) as Readonly<{
  categoryId: string;
  categoryName: string;
  parentCategoryId: string;
  parentCategoryName: string;
  customSubcategory: string;
}>;

/**
 * ⛔ M-4 lock 3 — THE ONE HOME for the analyze path's routing patch.
 *
 * The analyze path's half of lock 2, expressed with the SAME two decision
 * functions so the two paths cannot drift. `app/scan/processing.tsx` spreads the
 * result into the `patch()` it builds from the AI response.
 *
 * `marketplace` is patched ONLY when the AI named a marketplace this build
 * actually supports, so an absent or off-list verdict leaves `emptyDraft`'s env
 * default in place rather than clobbering it with a guess — note the key is
 * OMITTED, not set to undefined, because the result is spread over a draft.
 * `marketplaceConfirmed` records whether the chip must ask, and the five
 * category fields are cleared when the routed tree cannot be trusted (§0.5).
 *
 * WHY IT LIVES HERE and not in the route file, where it started: while it was a
 * module-scope helper inside `processing.tsx` it was unreachable from jest (that
 * file needs expo-router, the SSE client and MMKV), so deleting the one spread
 * that calls it removed ALL of lock 3 with the whole suite still green. It is
 * pure — `supported` and `fallbackMarketplace` are ARGUMENTS, exactly as in
 * `routingNeedsAsk` — which is what lets it sit in this import-type-only module
 * (blocker (d)) next to the two decisions it composes, and be unit-tested
 * directly in `src/features/scanner/__tests__/routingState.test.ts`.
 *
 * ⚠️ Do NOT read `supportedNow()` / `getSiteType()` in here. Both are MMKV/expo
 * reads; pulling either in would break blocker (d) and drag the scan store's
 * import graph along with it. The call site does those reads and passes values.
 */
export function routingPatchFromAi(args: {
  ai: AiResult;
  /** `supportedNow()` at the call site. */
  supported: MarketplaceKey[];
  /**
   * The build's OWN marketplace — what the draft will hold when the AI's verdict
   * is absent or rejected. `marketplaceFromSiteType(getSiteType()) ?? '101lab'`
   * at the call site, mirroring the store's lenient wrapper
   * (scanDraftStore.ts:240-242): the STRICT helper returns null for an off-list
   * SITE_TYPE, and this value only picks which tree's category is being judged,
   * so it must never be null.
   */
  fallbackMarketplace: MarketplaceKey;
}): Partial<DraftItem> {
  const { ai, supported, fallbackMarketplace } = args;
  const signal = signalFromAiResult(ai);
  const usable =
    signal.suggestedMarketplace && supported.includes(signal.suggestedMarketplace)
      ? signal.suggestedMarketplace
      : null;
  // Judge the prefill on what the draft will ACTUALLY hold, the same rule lock 2
  // uses. Judging the AI's rejected verdict would clear a category that is fine.
  const marketplace = usable ?? fallbackMarketplace;
  const prefill = shouldPrefillCategory({ marketplace, signal });
  return {
    ...(usable ? { marketplace: usable } : {}),
    marketplaceConfirmed: !routingNeedsAsk({ signal, supported }),
    needsClearerPhoto: signal.needsClearerPhoto,
    siteTypeConfidence: signal.siteTypeConfidence,
    siteTypeSource: signal.siteTypeSource,
    categorySource: signal.categorySource,
    ...(prefill ? {} : CLEARED_CATEGORY_DRAFT_FIELDS),
  };
}

/**
 * The v1 routing decision. THREE states, exactly as plan §2.2:
 *   confirmed + prefill      — "Listing on 101MACHINE — change", category pre-filled
 *   confirmed + no prefill   — marketplace stated, category reads "Not set"
 *   ask                      — a question; nothing pre-selected; Submit blocked
 *
 * ⛔ There is deliberately NO comparison against `siteTypeConfidence`. The
 * number IS on the wire now (S0-2, §0.4) but a threshold would still be
 * calibrated on ZERO logged agreement observations, which is exactly what plan
 * §2.1 rejects. It is carried for DISPLAY only.
 */
export function deriveRoutingState(args: {
  current: MarketplaceKey;
  confirmed: boolean;
  signal: RoutingSignal;
  supported: MarketplaceKey[];
}): RoutingState {
  const { current, confirmed, signal, supported } = args;

  const suggested =
    signal.suggestedMarketplace && supported.includes(signal.suggestedMarketplace)
      ? signal.suggestedMarketplace
      : null;

  // ONE call into the shared trigger. `confirmed` is applied here, not inside
  // it, so the store can ask "was there a question?" without knowing whether
  // the seller has answered yet.
  const mustAsk = !confirmed && routingNeedsAsk({ signal, supported });

  const kind: RoutingState['kind'] = mustAsk ? 'ask' : 'confirmed';

  const prefillCategory =
    kind === 'confirmed' && shouldPrefillCategory({ marketplace: current, signal });

  return {
    kind,
    suggested,
    current,
    resolved: kind === 'confirmed',
    prefillCategory,
    confidence: signal.siteTypeConfidence,
    source: signal.siteTypeSource,
    needsClearerPhoto: signal.needsClearerPhoto,
  };
}

/** Read a persisted draft's routing signal. Absent fields read as "nothing known". */
export function signalFromDraft(draft: DraftItem): RoutingSignal {
  return {
    suggestedMarketplace: draft.ai?.suggestedMarketplace ?? null,
    needsClearerPhoto: draft.needsClearerPhoto === true,
    siteTypeConfidence: draft.siteTypeConfidence ?? null,
    siteTypeSource: draft.siteTypeSource ?? null,
    categorySource: draft.categorySource ?? null,
  };
}

/**
 * The smart-detect mapper's output, as a signal. Used by
 * `scanDraftStore.draftFromSmartFields` so the store never re-derives the
 * trigger from raw fields.
 */
export function signalFromSmartFields(fields: SmartItemFields): RoutingSignal {
  return {
    suggestedMarketplace: fields.suggestedMarketplace ?? null,
    needsClearerPhoto: fields.needsClearerPhoto === true,
    siteTypeConfidence: fields.siteTypeConfidence ?? null,
    siteTypeSource: fields.siteTypeSource ?? null,
    categorySource: fields.categorySource ?? null,
  };
}

/**
 * The analyze path's mapper output, as a signal. Used by
 * `app/scan/processing.tsx` so lock 3 shares lock 2's trigger instead of
 * re-implementing it inline.
 */
export function signalFromAiResult(ai: AiResult): RoutingSignal {
  return {
    suggestedMarketplace: ai.suggestedMarketplace ?? null,
    needsClearerPhoto: ai.needsClearerPhoto === true,
    siteTypeConfidence: ai.siteTypeConfidence ?? null,
    siteTypeSource: ai.siteTypeSource ?? null,
    categorySource: ai.categorySource ?? null,
  };
}

/**
 * Submit gate. Used by `useDetailController.ts` (the C4 guard),
 * `app/scan/detail.tsx` (footer) and `app/scan/grouped-review.tsx` (per-row
 * ready + the pre-flight sweep). Deliberately does NOT take the supported list:
 * a draft that was confirmed stays confirmed even if the server list later
 * shrinks, so a mid-session config change can never orphan work the seller
 * already did.
 */
export function isRoutingResolved(draft: DraftItem): boolean {
  if (draft.marketplaceConfirmed !== false) return true;
  return false;
}

/**
 * The honest "why" line for the confirmed chip (Stitch 4a's WHY block). Built
 * ONLY from fields that are actually on the wire — brand/model come from the
 * nameplate read, `needsClearerPhoto` says the nameplate could not be read.
 * Returns null when we have nothing true to say; the chip then omits the row
 * rather than inventing a rationale.
 */
export function routingWhyLine(
  draft: DraftItem,
): { key: string; identity?: string } | null {
  const identity = [draft.brand, draft.model].filter((s) => !!s && s.trim()).join(' ').trim();
  if (identity) return { key: 'mobile.detail.routing.whyNameplate', identity };
  if (draft.needsClearerPhoto) return { key: 'mobile.detail.routing.whyNoNameplate' };
  return null;
}
