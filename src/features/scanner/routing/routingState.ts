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
 * Sources that mean "the pipeline overwrote or invented the answer", so the
 * seller must be asked. Both are LIVE since S0-2.
 */
const ASK_SOURCES: readonly RoutingSource[] = ['regex_override', 'low_confidence_fallback'];

/**
 * ⛔ blocker (d) — THE ONE HOME for the ask-trigger.
 *
 * Called by `deriveRoutingState` (UI), by `draftFromSmartFields` (the store's
 * persisted answer) and by `app/scan/processing.tsx` (the analyze path). There
 * is no second copy. If you are about to write `if (fields.needsClearerPhoto)`
 * anywhere else, call this instead.
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

  if (signal.needsClearerPhoto) return true;
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
  if (signal.categorySource === 'unresolved') return false;
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
