/**
 * 7c — Review · details. Step 2 of 4.
 *
 * Shape, top to bottom (docs/v2-design/screens/7c.html):
 *
 *   ┌ green wash sheet ───────────────────────────────────────┐
 *   │  ←   Review your item                          Draft    │
 *   │  STEP 2 OF 4 · DETAILS                           50%    │
 *   │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁    │
 *   └─────────────────────────────────────────────────────────┘
 *      ●  Photos                                    the rail
 *      ●  Details
 *      │  Needs a category
 *      ○  Pricing
 *      ○  Location
 *
 *      TITLE  (✦ AI)                              21 / 80
 *      [ Laboratory Centrifuge                            ]
 *
 *      BRAND (✦ AI)            MODEL (✦ AI)
 *      [ e.g. Agilent    ]     [ e.g. HPLC-2000   ]
 *      We could not read the nameplate in your photos…
 *
 *      YEAR (✦ AI)
 *      [ e.g. 2018                                        ]
 *      ─────────────────────────────────────────────────────
 *      DESCRIPTION  (✦ AI)                       127 / 500
 *      [ A laboratory centrifuge. The unit shows signs of  ]
 *      [ general wear…                                     ]
 *      ─────────────────────────────────────────────────────
 *      CATEGORY  (✦ AI)
 *      ( Lab Infrastructure › Centrifugation      Change )
 *
 *      CONDITION
 *      (New) (✓ Used — functional) (For parts) (Waste…)
 *   ┌ footer, a flex sibling ─────────────────────────────────┐
 *   │  Save as draft              (      Continue      )      │
 *   └─────────────────────────────────────────────────────────┘
 *
 * ── WHAT THE AI CHIP IS ALLOWED TO CLAIM ──────────────────────────────────
 *
 * The canvas's fix note: *"Red asterisks are dropped; required is implied by
 * the step, and the AI chip marks what was auto-filled."* So the chip is not
 * decoration — it is a claim about provenance, and it has to be true per field.
 * `aiFilled` below reads `draft.ai`, the mapped model output the scan stored,
 * so a field the seller typed and a field the model wrote look different.
 *
 * CATEGORY is the field where that claim is dangerous, and the codebase already
 * knows why. `routingState.ts`'s FIX 2, measured on 24 real equipment photos ×
 * 3 runs: when `categorySource` is `'fuzzy'` the ids came from the backend's
 * deterministic keyword scorer, not the model — and ALL 7 fuzzy picks checked
 * against the tree were WRONG. Badging those with a green "AI" chip is exactly
 * the bug that note exists to stop, so `categoryIsAi` excludes `'fuzzy'` and
 * `'unresolved'` and the section then asks instead of asserting.
 *
 * ── THE NAMEPLATE LINE ────────────────────────────────────────────────────
 *
 * `needsClearerPhoto` is the server saying "I could not read a NAMEPLATE". It
 * is a statement about BRAND and MODEL — never about routing (FIX 1) — so it
 * lands under that pair, and only while they are still empty. A seller who has
 * already typed them never sees a warning about work they have done.
 *
 * ── DATA: real draft, WRITES DEFERRED ─────────────────────────────────────
 *
 * The field set, the limits and the validation are the shipped ones:
 * `IdentityCard`'s 80-character title, `DESCRIPTION_MAX`, `CONDITION_LABELS`,
 * and `stepNeeds` → `getDraftRequiredStatus` → `detailSchema`, the same
 * predicate the shipped Submit gate enforces. Nothing here is a second copy of
 * a rule.
 *
 * Edits are held in LOCAL component state and merged over the store item, so
 * every counter, every completion line and the rail all read the same value the
 * inputs show. `COMMIT_FIELD_EDITS` then writes that buffer through to the
 * store (Zustand + MMKV) on blur.
 *
 * ⚠️ That flag is **ON**. This paragraph said "it is off" until 2026-09-16,
 * while the declaration sixty lines below read `= true` — and the save-as-draft
 * notice inherited the lie, telling sellers their typing was not stored when it
 * was already on the device. A docblock that contradicts its own constant is
 * worse than no docblock.
 *
 * What is genuinely NOT wired is the SERVER half: saving to the account and
 * publishing are `TODO(v2-writes)` and answer in words rather than doing
 * nothing.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import {
  EmptyState,
  Field,
  Hairline,
  PickerRow,
  PillButton,
  PrimaryAction,
  QuietAction,
  Screen,
  Text,
  Timeline,
} from '@/features/v2/ui';
import {
  CARD_PAD,
  GUTTER,
  MIN_TOUCH,
  SECTION_GAP,
  radius,
  space,
  useV2Colors,
} from '@/theme/v2';
import {
  CONDITION_LABELS,
  MARKETPLACE_OPTIONS,
  OTHER_SUBCATEGORY_ID,
  VALID_CONDITION_KEYS,
  type ConditionKey,
} from '@/features/scanner/constants';
/*
  Two SHIPPED pieces lifted whole, both prop-driven and therefore liftable. See
  `onChangeCategory` for why this is a reuse and not a rebuild.
*/
import {
  CategoryPickerSheet,
  type CategoryPick,
} from '@/features/scanner/components/detail/CategoryPickerSheet';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import type { MarketplaceKey } from '@/stores/scanDraftStore';
import { DESCRIPTION_MAX } from '@/features/scanner/descriptionLimit';
import type { CategorySource } from '@/features/scanner/routing/routingState';
import type { DraftItem } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';

import { Eyebrow, StepHeader } from '@/features/v2/scan/review/reviewKit';
import {
  TIMELINE_STEPS,
  reviewStepHref,
  reviewStepIndex,
  stepNeeds,
  useReviewItem,
} from '@/features/v2/scan/review/wizardState';
import { useSaveDraft } from '@/features/v2/scan/review/useSaveDraft';

/**
 * ON. Commits field edits to the DEVICE-LOCAL scan draft (Zustand + MMKV,
 * no endpoint). Publishing is the deferred write and it lives on 7e.
 *
 * `useReviewItem().patch` is DEVICE-LOCAL (Zustand + MMKV, no network) and
 * `wizardState.ts` documents it as live. It fires from `onBlur` and from
 * Continue, NOT from `onChangeText`: `patchQueuedItem` calls `persistSession`
 * synchronously, so a per-keystroke commit would rewrite the whole MMKV session
 * on every character. Typed as `boolean`
 * so the guarded branch stays type-checked rather than narrowing to `never`.
 */
const COMMIT_FIELD_EDITS: boolean = true;

/** This screen's position in the four-step rail. */
const STEP = 'details' as const;

/**
 * The title limit, from `IdentityCard`'s `maxLength={80}` — the shipped
 * seller-facing cap and what the canvas's "21 / 80" counter is counting
 * against. Not in `detailSchema`, which only requires `.min(1)`.
 */
const TITLE_MAX = 80;

/**
 * `category_source` values that mean the MODEL did not pick this — see FIX 2 in
 * `routingState.ts`. A category from either source must not wear the AI chip.
 */
const CATEGORY_NOT_AI: readonly CategorySource[] = ['fuzzy', 'unresolved'];

/** The condition pill. 40pt drawn; `MIN_TOUCH` is made up with `hitSlop`. */


// ── Local primitives (see KIT GAPS in the build report) ────────────────
//
// The header sheet and the section eyebrow are NOT here: they come from
// `./reviewKit`, the staging file 7d/7e opened for exactly these. Four steps
// with four hand-rolled headers is the drift the kit exists to stop.

/**
 * The "21 / 80" character count, for `Eyebrow`'s trailing slot.
 *
 * Over the limit it turns `danger` AND becomes the only state worth announcing:
 * a screen reader reads a bare "635 / 500" as a fraction, which is exactly the
 * information a sighted user gets from the colour, so under the limit it stays
 * silent. Same treatment the shipped `DescriptionCard` gives it — and the
 * over-limit case is reachable, because a draft persisted before
 * `fitDescription` landed can still hold an AI-written description over 500.
 */
function Counter({ length, max }: { length: number; max: number }) {
  const over = length > max;
  return (
    <Text
      variant="caption"
      color={over ? 'danger' : 'inkSubtle'}
      accessibilityElementsHidden={!over}
      importantForAccessibility={over ? 'yes' : 'no-hide-descendants'}
    >
      {`${length} / ${max}`}
    </Text>
  );
}


// ── Local edit buffer ──────────────────────────────────────────────────────

/** Nothing edited. A module constant so the merge below has a stable identity. */
const NO_EDITS: Partial<DraftItem> = {};

/**
 * Field edits, held on the screen and merged over the store item.
 *
 * Every consumer of the draft here reads the MERGED item, so a typed title
 * moves its own counter AND clears "Needs a title" on the rail in the same
 * render. Keyed by draft id and derived rather than reset in an effect, so
 * switching item drops the previous item's edits on the next render.
 */
function useDraftEdits(item: DraftItem | null) {
  const [box, setBox] = useState<{ id: string | null; edits: Partial<DraftItem> }>({
    id: null,
    edits: NO_EDITS,
  });

  const id = item?.id ?? null;
  const edits = box.id === id ? box.edits : NO_EDITS;

  const draft = useMemo(
    () => (item ? ({ ...item, ...edits } as DraftItem) : null),
    [item, edits],
  );

  const set = useCallback(
    (partial: Partial<DraftItem>) => {
      setBox((prev) => ({
        id,
        edits: { ...(prev.id === id ? prev.edits : NO_EDITS), ...partial },
      }));
    },
    [id],
  );

  return { draft, set, edits, dirty: edits !== NO_EDITS };
}

// ── Copy helpers ───────────────────────────────────────────────────────────

const filled = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * The category as one readable line: "Parent › Leaf".
 *
 * Falls back through what is actually known rather than inventing a name —
 * `categoryName` alone when there is no parent, the "Other (type brand)" the
 * seller typed when the leaf is the sentinel, and `null` when the field is
 * genuinely unset so the section can ask instead of showing an empty row.
 */
function categoryLine(draft: DraftItem): string | null {
  if (!draft.categoryId) return null;
  const parent = draft.parentCategoryName?.trim();

  if (draft.categoryId === OTHER_SUBCATEGORY_ID) {
    const typed = draft.customSubcategory?.trim();
    const leaf = typed ? `Other · ${typed}` : 'Other';
    return parent ? `${parent} › ${leaf}` : leaf;
  }

  const leaf = draft.categoryName?.trim();
  if (!leaf) return parent ?? null;
  // "Metalworking Equipment › Metalworking Equipment" — a flat tree where the
  // parent IS the leaf. One name, not the same name twice.
  return parent && parent !== leaf ? `${parent} › ${leaf}` : leaf;
}

// ── The screen ─────────────────────────────────────────────────────────────

export default function V2ReviewDetails() {
  const { item, index, total, patch } = useReviewItem();
  const { draft, set, edits, dirty } = useDraftEdits(item);

  /** The one line this screen uses to answer an action it cannot yet perform. */
  const [notice, setNotice] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  /**
   * The category tree for THIS item's marketplace. Keyed off the draft so a
   * 101MACHINE item is not offered 101LAB's taxonomy — the same argument the
   * shipped card passes.
   */
  const categories = useLabCategories(draft?.marketplace as MarketplaceKey | undefined);

  const stepIndex = reviewStepIndex(STEP);

  /*
    Memoised on the merged draft: `stepNeeds` runs the whole `detailSchema`
    parse, and this screen re-renders on every keystroke.
  */
  const needs = useMemo(() => stepNeeds(draft, STEP), [draft]);

  const timeline = useMemo(
    () => TIMELINE_STEPS.map((s, i) => (i === stepIndex ? { ...s, detail: needs } : s)),
    [stepIndex, needs],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * An action whose server or store half is not wired yet. It answers in words
   * rather than doing nothing — a silent tap is indistinguishable from a bug.
   *
   * ⚠️ EVERY `defer` CALL MUST GO before v2 ships. `app/v2/` is not reachable
   * from the shipped UI, so these lines exist for review, not for users — but
   * App Review treats a visible control that only explains itself as an
   * unfinished app (Guideline 2.1, App Completeness). Wire the write or drop
   * the affordance; do not ship the sentence.
   */
  const defer = (message: string) => {
    haptics.tap();
    setNotice(message);
  };

  const onBack = () => {
    haptics.tap();
    router.back();
  };

  /**
   * Every field edit funnels through here, so there is exactly one place the
   * deferred commit has to be turned on.
   */
  /**
   * Buffer a change. DOES NOT persist — `commit` does that on blur.
   *
   * Per-keystroke persistence would be wrong here, not just wasteful:
   * `patchQueuedItem` calls `persistSession` synchronously, so every character
   * typed would rewrite the whole MMKV session. The shipped `grouped-edit.tsx`
   * avoids the same trap by patching only on Save.
   */
  const edit = useCallback((partial: Partial<DraftItem>) => set(partial), [set]);

  /**
   * Flush the buffer to the device-local draft.
   *
   * This is NOT a network write — `patch` is Zustand + MMKV and touches no
   * endpoint. Publishing is the deferred write, and it lives on 7e. A wizard
   * whose earlier steps silently discard what you typed cannot be verified on
   * a device at all, which is why this commits rather than staying inert.
   */
  const commit = useCallback(() => {
    if (COMMIT_FIELD_EDITS && dirty) patch(edits);
  }, [dirty, edits, patch]);

  /** Discrete choices (a pill, a picker) have no blur, so they commit at once. */
  const editNow = useCallback(
    (partial: Partial<DraftItem>) => {
      set(partial);
      if (COMMIT_FIELD_EDITS) patch(partial);
    },
    [set, patch],
  );

  const toggleCondition = (key: ConditionKey) => {
    if (!draft) return;
    haptics.tap();
    const has = draft.condition.includes(key);
    editNow({
      condition: has ? draft.condition.filter((k) => k !== key) : [...draft.condition, key],
    });
  };

  /**
   * WIRED 2026-09-17 — it used to print a sentence saying the picker "is a
   * separate screen and is not rebuilt yet".
   *
   * ⚠️ THIS WAS A HARD BLOCK ON PUBLISHING, not a cosmetic gap. `detailSchema`
   * requires a category, so any draft the scan could not place was
   * unpublishable from v2 with no way to fix it — and on this account that is
   * the common shape: both single-item drafts reachable from the drafts list
   * sat on "Needs a category" (checked in the browser, 2026-09-17). Wiring
   * publish without this would have shipped a Submit button no real draft could
   * reach.
   *
   * Reuses the SHIPPED `CategoryPickerSheet` rather than rebuilding it: it is
   * already prop-driven (no react-hook-form, no React Query of its own), which
   * is exactly what makes it liftable. Same compromise, and the same precedent,
   * as the shipped `CountryPicker` this flow already mounts on 7e — old-UI
   * tokens inside a v2 screen, marked `TODO(v2-design)`, because a working
   * control in mixed chrome beats a v2-pure dead end.
   */
  const onChangeCategory = () => {
    haptics.tap();
    setCategoryOpen(true);
  };

  /**
   * The store equivalent of the shipped card's `applyPick`. Four fields move
   * together or the row lies: the leaf id, its parent pair, and the leaf NAME —
   * without the last, an offline `categoryLine` renders the PREVIOUS pick's
   * name beside the new id.
   */
  const applyCategoryPick = (pick: CategoryPick) => {
    const leafName =
      pick.categoryId === OTHER_SUBCATEGORY_ID
        ? ''
        : categories.data?.options.find((o) => o.id === pick.categoryId)?.name ?? '';

    editNow({
      categoryId: pick.categoryId,
      parentCategoryId: pick.parentCategoryId,
      parentCategoryName: pick.parentCategoryName,
      categoryName: leafName,
      // A real leaf leaves "Other" behind — drop any stale typed brand so it
      // cannot be submitted under a category it no longer belongs to.
      ...(pick.categoryId !== OTHER_SUBCATEGORY_ID ? { customSubcategory: '' } : {}),
    });
    setCategoryOpen(false);
  };

  /**
   * ⚠️ THIS ONE PRINTED A SENTENCE FOR TWO ROUNDS, and the first sentence was
   * false on top of being a sentence.
   *
   * Round one said "what you just typed is not stored yet" — but
   * `COMMIT_FIELD_EDITS` is `true` (see its declaration above, where it is
   * annotated `: boolean` precisely so nothing reads it as a dead constant), so
   * `commit()` has already written the buffer to MMKV on blur and `editNow`
   * commits discrete choices the moment they are tapped. The typing WAS
   * stored; only the server copy is missing. Telling a seller their work is
   * lost when it is sitting on the device is the worse of the two possible
   * errors.
   *
   * Round two corrected the wording and kept the notice — which fixed the lie
   * and left the Guideline 2.1 problem exactly where it was. A control that
   * answers in prose still reads as unfinished, and worse, this screen was
   * doing it while its two siblings did not: 7d (`pricing.tsx`) and 7e
   * (`location.tsx`) have always committed, buzzed and left. Four steps that
   * hold edits the same way behaved two different ways, and the seller met
   * both in one pass through the wizard.
   *
   * Closed 2026-09-16 by taking 7d/7e's shape verbatim. The commit is the same
   * one the blur handler runs, so tapping this after typing and tapping it
   * after a blur do the same thing.
   */
  const saveDraft = useSaveDraft();

  /** WIRED 2026-09-17 — see the note on 7b's handler. `commit()` first, so the
   *  snapshot carries text that has been typed but not blurred. */
  const onSaveDraft = () => {
    commit();
    haptics.tap();
    saveDraft.save();
  };

  const onContinue = () => {
    haptics.impact();
    // A step you have not finished is still a step you can leave. The rail
    // carries what is missing; 7e's publish gate is the one place that blocks.
    router.push(reviewStepHref('pricing', index));
  };

  // ── Cold open ─────────────────────────────────────────────────────────────

  /*
    One chrome for all four steps, from `./reviewKit`. It owns the back glyph,
    the title, the draft/position label, `STEP n OF 4 · NAME`, the percent and
    the 3pt track — everything the canvas draws inside the green sheet.
  */
  const header = (
    <StepHeader step={STEP} itemIndex={index} itemTotal={total} onBack={onBack} />
  );

  /**
   * The same header WITHOUT the step counter, percentage and bar.
   *
   * A cold open is not "step N of 4" — there is nothing to be N of. With
   * the progress chrome on, this screen read "75%" above "there is no item
   * to review": the interface claiming progress it has not made.
   */
  const headerNoProgress = (
    <StepHeader step={STEP} itemIndex={index} itemTotal={total} onBack={onBack} progress={false} />
  );

  if (!draft) {
    return (
      <Screen header={headerNoProgress} tabBar={false} testID="v2-review-details">
        <EmptyState
          title="Nothing to review yet"
          body="This is where a scan lands once the AI has read it. Scan an item and the four review steps open with it."
          actionLabel="Scan an item"
          onAction={() => router.replace(routes.v2Camera)}
          secondaryLabel="Back to home"
          onSecondary={() => router.replace(routes.v2Home)}
        />
      </Screen>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const ai = draft.ai;
  /** Per-field provenance. The chip is a claim, so it has to be checkable. */
  const aiFilled = {
    title: filled(ai?.name),
    brand: filled(ai?.brand),
    model: filled(ai?.model),
    year: filled(ai?.year),
    description: filled(ai?.description),
  };

  const categoryIsAi =
    !!draft.categoryId &&
    !!ai?.categoryId &&
    !CATEGORY_NOT_AI.includes((draft.categorySource ?? 'ai') as CategorySource);

  const category = categoryLine(draft);

  const descriptionLength = draft.description.length;
  const descriptionOver = descriptionLength - DESCRIPTION_MAX;

  /*
    The nameplate fact, said where it is ACTIONABLE — one line for the PAIR,
    because brand and model share a row and the same sentence in both columns
    would wrap to three lines twice to say one thing about one photo. Gated on
    the fields still being empty.
  */
  const showNameplateHint =
    draft.needsClearerPhoto === true && (!filled(draft.brand) || !filled(draft.model));

  return (
    <Screen
      header={header}
      tabBar={false}
      contentStyle={styles.body}
      testID="v2-review-details"
      footer={
        <>
          {notice ? (
            <Text
              variant="caption"
              color="inkSubtle"
              style={styles.notice}
              accessibilityLiveRegion="polite"
            >
              {notice}
            </Text>
          ) : null}
          <View style={styles.footerRow}>
            {/*
              A text-only secondary, not the canvas's outlined pill — see 7b's
              footer for the measurement. Two pills side by side clip the
              primary's label on a 320pt frame, and the kit's rule is that the
              one green pill IS the primary action.
            */}
            <QuietAction
              label={saveDraft.isSaving ? 'Saving…' : 'Save as draft'}
              onPress={onSaveDraft}
              disabled={saveDraft.isSaving}
              style={styles.footerQuiet}
              testID="v2-review-details-save"
            />
            {/* The rail names the next step, so the button does not have to. */}
            <PrimaryAction
              label="Continue"
              onPress={onContinue}
              style={styles.footerPrimary}
              testID="v2-review-details-continue"
            />
          </View>
        </>
      }
    >
      {/* `live={false}` — the person is the one moving, so nothing breathes. */}
      <View style={styles.timeline}>
        <Timeline steps={timeline} current={stepIndex} live={false} />
      </View>

      <Hairline inset="gutter" />

      {/* ── Title ── */}
      <View style={styles.section}>
        <Eyebrow
          label="Title"
          ai={aiFilled.title}
          trailing={<Counter length={draft.title.length} max={TITLE_MAX} />}
        />
        {/*
          MULTILINE ON PURPOSE, and the reason is on the device: a single-line
          TextInput on Android scrolls to the caret, so an 80-character
          AI-written title opened showing its MIDDLE — "…solutions Stream
          In-Situ TEM" with the start cut off. The seller could not read what
          they were about to publish. Two lines shows the whole thing.
        */}
        <Field
          accessibilityLabel="Title"
          value={draft.title}
          onChangeText={(title) => edit({ title })}
          onBlur={commit}
          placeholder="e.g. Laboratory centrifuge"
          maxLength={TITLE_MAX}
          multiline
          numberOfLines={2}
          submitBehavior="blurAndSubmit"
          testID="v2-review-details-title"
        />
      </View>

      {/* ── Brand / model ── */}
      <View style={styles.section}>
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <Eyebrow label="Brand" ai={aiFilled.brand} />
            <Field
              accessibilityLabel="Brand"
              value={draft.brand}
              onChangeText={(brand) => edit({ brand })}
          onBlur={commit}
              placeholder="e.g. Agilent"
              testID="v2-review-details-brand"
            />
          </View>
          <View style={styles.pairItem}>
            <Eyebrow label="Model" ai={aiFilled.model} />
            <Field
              accessibilityLabel="Model"
              value={draft.model}
              onChangeText={(model) => edit({ model })}
          onBlur={commit}
              placeholder="e.g. HPLC-2000"
              testID="v2-review-details-model"
            />
          </View>
        </View>

        {showNameplateHint ? (
          <Text variant="caption" color="inkMuted" style={styles.hint}>
            We could not read the nameplate in your photos — add what you know,
            or retake a closer shot.
          </Text>
        ) : null}
      </View>

      {/* ── Year ── */}
      <View style={styles.section}>
        <Eyebrow label="Year" ai={aiFilled.year} />
        <Field
          accessibilityLabel="Year"
          value={draft.year}
          onChangeText={(year) => edit({ year })}
          onBlur={commit}
          placeholder="e.g. 2018"
          keyboardType="number-pad"
          maxLength={4}
          testID="v2-review-details-year"
        />
      </View>

      <View style={styles.divider}>
        <Hairline inset="gutter" />
      </View>

      {/* ── Description ── */}
      <View style={styles.section}>
        <Eyebrow
          label="Description"
          ai={aiFilled.description}
          trailing={<Counter length={descriptionLength} max={DESCRIPTION_MAX} />}
        />
        {/*
          `help` says what to DO, not just that something is wrong. A draft
          persisted before `fitDescription` landed can still hold an AI-written
          description over the limit — the seller did not write it and cannot be
          blamed for it, so the line names the overage as a definite task.
        */}
        <Field
          accessibilityLabel="Description"
          value={draft.description}
          onChangeText={(description) => edit({ description })}
          onBlur={commit}
          placeholder="What it is, what condition it is in, what is included."
          maxLength={DESCRIPTION_MAX}
          multiline
          invalid={descriptionOver > 0}
          help={
            descriptionOver > 0
              ? `${descriptionOver} characters over the ${DESCRIPTION_MAX} limit — please shorten it.`
              : undefined
          }
          testID="v2-review-details-description"
        />
      </View>

      <View style={styles.divider}>
        <Hairline inset="gutter" />
      </View>

      {/* ── Category ── */}
      <View style={styles.section}>
        <Eyebrow label="Category" ai={categoryIsAi} />
        <CategoryRow line={category} onChange={onChangeCategory} />
      </View>

      {/* ── Condition ── */}
      <View style={styles.section}>
        {/* No AI chip: the canvas draws none here, and condition is a judgement
            the seller owns even when the model guessed at it. */}
        <Eyebrow label="Condition" />
        <View style={styles.choiceRow}>
          {VALID_CONDITION_KEYS.map((key) => (
            <PillButton
              key={key}
              label={CONDITION_LABELS[key]}
              selected={draft.condition.includes(key)}
              // Condition is a MULTI-select: `DraftItem.condition` is a
              // string[] and "Waste disposal" / "Demolition" co-occur. A radio
              // role here would tell a screen-reader user that picking one
              // clears the others.
              role="checkbox"
              onPress={() => toggleCondition(key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.tail} />

      {/*
        The shipped picker. Still drawn in old-UI tokens, exactly like the
        `CountryPicker` 7e mounts — TODO(v2-design): it wants the kit. Lifting
        it whole is deliberate: it already handles the accordion, the search,
        the flat-vs-nested tree and the "Other (type brand)" sentinel, and
        re-deriving that would be a week of getting the same edge cases wrong.
      */}
      <CategoryPickerSheet
        visible={categoryOpen}
        categories={categories.data?.categories ?? []}
        loading={categories.isLoading}
        error={categories.isError}
        onRetry={() => {
          void categories.refetch();
        }}
        marketplaceLabel={
          MARKETPLACE_OPTIONS.find((o) => o.value === draft?.marketplace)?.label ?? ''
        }
        value={draft?.categoryId ?? ''}
        parentId={draft?.parentCategoryId ?? ''}
        onSelect={applyCategoryPick}
        onClose={() => setCategoryOpen(false)}
      />
    </Screen>
  );
}

/**
 * The category as a statement plus a quiet "Change".
 *
 * `PickerRow` in the kit now draws this — 7b's settled marketplace uses the
 * same component, which is the point: the two hand-rolled versions had drifted
 * to different type sizes for the same row.
 */
function CategoryRow({ line, onChange }: { line: string | null; onChange: () => void }) {
  return (
    <PickerRow
      value={line}
      noun="category"
      emptyTitle="Not set yet"
      emptyDetail="We could not place this one — a listing needs a category."
      onChange={onChange}
      testID="v2-review-details-change-category"
    />
  );
}

const styles = StyleSheet.create({
  // ── body ──
  body: { paddingTop: space['6xl'] },
  timeline: { paddingHorizontal: GUTTER, paddingBottom: space['7xl'] },
  section: { paddingHorizontal: GUTTER, paddingTop: space['7xl'] },
  divider: { paddingTop: space['7xl'] },
  tail: { height: SECTION_GAP },

  pair: { flexDirection: 'row', gap: space['2xl'] },
  pairItem: { flex: 1, minWidth: 0 },
  hint: { marginTop: space.xl },

  // ── category row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    minHeight: MIN_TOUCH,
    paddingVertical: space['3xl'],
    paddingHorizontal: CARD_PAD,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowSub: { marginTop: space.xs },

  // ── condition ──
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },

  // ── empty ──
  emptyState: { paddingHorizontal: GUTTER, paddingTop: SECTION_GAP },
  emptyBody: { marginTop: space.lg, marginBottom: space['3xl'] },

  // ── footer ──
  notice: { marginBottom: space['2xl'] },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  footerQuiet: { flexShrink: 0 },
  footerPrimary: { flex: 1 },
});
