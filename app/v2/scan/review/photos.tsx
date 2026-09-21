/**
 * 7b — Review · photos. Step 1 of 4.
 *
 * Shape, top to bottom (docs/v2-design/screens/7b.html):
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  ←   Review your item                          Draft    │
 *   │  STEP 1 OF 4 · PHOTOS                            25%    │
 *   │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁    │
 *   └─────────────────────────────────────────────────────────┘
 *      ●  Photos          ← the rail, so the other three steps
 *      │  Needs a marketplace           have names before you
 *      ○  Details                       reach them
 *      ○  Pricing
 *      ○  Location
 *      ┌───────────────────────────────────────────────┐
 *      │ (1 of 3)                                      │  the large preview
 *      │                                               │
 *      │                             ( ▤ Rearrange )   │
 *      └───────────────────────────────────────────────┘
 *      [▪][▪][▪]  [ + ADD ]
 *      ─────────────────────────────────────────────────
 *      MARKETPLACE  (✦ AI)
 *      Hard to tell from this photo
 *      A closer shot of the nameplate would help…
 *      ( 101LAB · BEST GUESS      Lab and scientific…  ○ )
 *      ( 101MACHINE               Industrial and…      ○ )
 *      ( 101IT                    IT hardware and…     ○ )
 *      Category and currency are set once you choose…
 *   ┌ footer, a flex sibling ─────────────────────────────────┐
 *   │  Save as draft              (      Continue      )      │
 *   └─────────────────────────────────────────────────────────┘
 *
 * ── WHY THE MARKETPLACE QUESTION IS THE CONTENT OF THIS STEP ──────────────
 *
 * The canvas's own fix note: *"The amber warning panel becomes plain body copy
 * under an AI label — the three marketplace options are the content, so they
 * carry the only selected state on screen."*
 *
 * That question is `routingNeedsAsk` (`features/scanner/routing/routingState.ts`)
 * — the shipped, single-home trigger for "the pipeline overwrote or invented
 * the routing verdict, so the seller must be asked". It is derived here through
 * `deriveRoutingState`, never re-implemented, and its two states drive the
 * section (UX_DESIGN_RULES, "Adaptive UI"):
 *
 *   • `ask`       → the heading, the body copy and all three options, with
 *                   NOTHING SELECTED. The AI's guess is badged "Best guess" and
 *                   highlighted, but its radio is empty — plan §2.2's rule, and
 *                   the reason `MarketplaceSheet` is passed `value={null}` in
 *                   this state. The canvas draws the guess pre-selected; that
 *                   would let someone confirm a guess by reflex, so it is the
 *                   one place this screen departs from the drawing.
 *   • `confirmed` → one statement row for the marketplace we already have, and
 *                   a quiet "Change" that reveals the options. Three radios for
 *                   a settled question is a form; a statement is a workflow.
 *
 * Picking one also clears the five category fields
 * (`CLEARED_CATEGORY_DRAFT_FIELDS`) and resets the currency
 * (`defaultCurrencyForSite`) — which is what makes the drawn footnote
 * *"Category and currency are set once you choose"* true rather than decorative.
 * The trees do not overlap between marketplaces, so carrying a 101LAB leaf id
 * into a 101MACHINE listing would submit a silently miscategorised product.
 *
 * ── DATA: real draft, WRITES DEFERRED ─────────────────────────────────────
 *
 * The item under review comes from `useReviewItem()` → `useScanDraft`, which is
 * the same queue the shipped `app/scan/grouped-review.tsx` reads. So this screen
 * meets real photo counts, missing photos, and the routing state a real scan
 * produced.
 *
 * Field edits are held in LOCAL component state (`useDraftEdits`) and merged
 * over the store item for display, so typing and picking respond
 * immediately. `COMMIT_FIELD_EDITS` turns that into a real (device-local,
 * MMKV) save — and it is **ON**. This paragraph claimed it was off until
 * 2026-09-16, while the declaration below read `= true`; the save-as-draft
 * notice inherited that and told sellers their marketplace pick was not stored
 * when `onPickMarketplace` had already committed it.
 *
 * Reordering photos, adding a photo, saving to the server and publishing are
 * all `TODO(v2-writes)` and inert. They stay visible because they are in the
 * drawing and because a wizard that hides its own controls cannot be reviewed —
 * but each one answers with a line saying what it will do, so none of them is a
 * dead button (UX_DESIGN_RULES, "Does every action provide feedback?").
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, ImageIcon, Images } from 'lucide-react-native';

import {
  Chip,
  EmptyState,
  Hairline,
  PickerRow,
  PrimaryAction,
  QuietAction,
  Screen,
  ScrimPill,
  Text,
  Timeline,
  MaterialFill,
} from '@/features/v2/ui';
import {
  CARD_PAD,
  GUTTER,
  MIN_TOUCH,
  SECTION_GAP,
  icon,
  radius,
  scaleW,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';
import {
  MARKETPLACE_OPTIONS,
  defaultCurrencyForSite,
} from '@/features/scanner/constants';
import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  deriveRoutingState,
  signalFromDraft,
} from '@/features/scanner/routing/routingState';
import { useSupportedMarketplaces } from '@/features/scanner/routing/useSupportedMarketplaces';
import type { DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';
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
 * `wizardState.ts` documents it as live. It fires on PICK, not per keystroke:
 * `patchQueuedItem` calls `persistSession` synchronously, so a per-character
 * commit would rewrite the whole MMKV session on every letter. Typed as `boolean` so the
 * guarded branch stays type-checked rather than narrowing to `never`.
 */
const COMMIT_FIELD_EDITS: boolean = true;

/** This screen's position in the four-step rail. */
const STEP = 'photos' as const;

/** Drawn dimensions — pictorial, so they scale with the frame. */
const HERO_HEIGHT = 210;
const THUMB = 66;
/** The radio mark. A drawn dot, deliberately off the icon scale. */
const RADIO = 20;
const RADIO_DOT = 10;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Local primitives (see KIT GAPS in the build report) ────────────────────
//
// The header sheet and the section eyebrow are NOT here: they come from
// `./reviewKit`, the staging file 7d/7e opened for exactly these. Four steps
// with four hand-rolled headers is the drift the kit exists to stop.

/** One 66pt tile in the strip. Selecting it swaps the large preview. */
function PhotoThumb({
  uri,
  index,
  total,
  selected,
  onPress,
}: {
  uri: string;
  index: number;
  total: number;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Photo ${index + 1} of ${total}`}
      style={[
        styles.thumb,
        // flat: a photo tile — the RowThumb rule, ramp the EMPTY tile only.
        { width: scaleW(THUMB), height: scaleW(THUMB), backgroundColor: c.fill },
        selected && { borderWidth: 2, borderColor: c.accent },
        animatedStyle,
      ]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    </AnimatedPressable>
  );
}

/** The dashed-free "ADD" tile that closes the strip. */
function AddPhotoTile({ onPress }: { onPress: () => void }) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Add a photo"
      style={[
        styles.thumb,
        styles.addTile,
        // flat: the ADD tile sits in a strip of photographs.
        { width: scaleW(THUMB), height: scaleW(THUMB), backgroundColor: c.surface },
        animatedStyle,
      ]}
    >
      <Camera size={icon.lg} color={c.inkSubtle} strokeWidth={1.6} />
      <Text variant="eyebrow" color="inkSubtle">
        Add
      </Text>
    </AnimatedPressable>
  );
}

/**
 * One marketplace option.
 *
 * `highlighted` is the AI's guess — a stronger ground and an accent outline —
 * and is deliberately NOT the same thing as `selected`. In the ask state the
 * guess is highlighted with an EMPTY radio, so choosing it is still a choice.
 */
function MarketplaceOption({
  label,
  description,
  bestGuess,
  selected,
  highlighted,
  onPress,
}: {
  label: string;
  description: string;
  bestGuess: boolean;
  selected: boolean;
  highlighted: boolean;
  onPress: () => void;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={
        bestGuess ? `${label}, our best guess. ${description}` : `${label}. ${description}`
      }
      style={[
        styles.option,
        { backgroundColor: highlighted || selected ? c.wash : c.surface },
        (highlighted || selected) && { borderWidth: 1.5, borderColor: c.accent },
        animatedStyle,
      ]}
    >
      <MaterialFill
        role={highlighted || selected ? 'wash' : 'surface'}
        ink="ink"
        radius={radius.md}
      />
      <View style={styles.optionText}>
        <View style={styles.optionTitleRow}>
          <Text variant="action">{label}</Text>
          {/* `Chip` at `sm` is 26pt on `micro` type — the drawn badge exactly. */}
          {bestGuess ? <Chip label="Best guess" tone="accent" /> : null}
        </View>
        <Text variant="caption" color="inkMuted" style={styles.optionSub}>
          {description}
        </Text>
      </View>

      {/*
        A classic radio — an accent ring with a filled core — rather than the
        canvas's `inset 0 0 0 4px #fff`, which renders as a white gap ring and
        would read as a hole on the dark scheme's near-black ground.
      */}
      <View
        style={[
          styles.radio,
          { borderColor: selected ? c.accent : c.inkDisabled, borderWidth: selected ? 2 : 1 },
        ]}
      >
        {/* flat: the dot inside a radio, not the radio. */}
        {selected ? <View style={[styles.radioDot, { backgroundColor: c.accent }]} /> : null}
      </View>
    </AnimatedPressable>
  );
}

// ── Local edit buffer ──────────────────────────────────────────────────────

/** Nothing edited. A module constant so the merge below has a stable identity. */
const NO_EDITS: Partial<DraftItem> = {};

/**
 * Field edits, held on the screen and merged over the store item.
 *
 * Every consumer of the draft on this screen — the marketplace state, the
 * completion line on the rail, the footer — reads the MERGED item, so an
 * uncommitted edit is visible everywhere at once instead of only in the control
 * that made it. That is what stops "picked 101MACHINE" leaving the rail still
 * saying "Needs a marketplace".
 *
 * Keyed by draft id, derived rather than reset in an effect: switching item
 * drops the previous item's edits on the next render with no extra pass.
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

  return { draft, set, dirty: edits !== NO_EDITS };
}

// ── The screen ─────────────────────────────────────────────────────────────

export default function V2ReviewPhotos() {
  const c = useV2Colors();
  const { item, index, total, patch } = useReviewItem();
  const { draft, set, dirty } = useDraftEdits(item);
  const supported = useSupportedMarketplaces();

  /** Which photo the large preview is showing. Pure view state. */
  const [active, setActive] = useState(0);
  /** `Change` on a settled marketplace reveals the three options. */
  const [picking, setPicking] = useState(false);
  const stepIndex = reviewStepIndex(STEP);

  /* Memoised: `stepNeeds` runs the whole `detailSchema` parse, and selecting a
     thumbnail re-renders this screen. */
  const needs = useMemo(() => stepNeeds(draft, STEP), [draft]);

  const timeline = useMemo(
    () => TIMELINE_STEPS.map((s, i) => (i === stepIndex ? { ...s, detail: needs } : s)),
    [stepIndex, needs],
  );

  /**
   * The shipped routing trigger, derived — never re-implemented. `ask` means
   * the pipeline overwrote or invented the marketplace verdict.
   */
  const routing = useMemo(
    () =>
      draft
        ? deriveRoutingState({
            current: draft.marketplace,
            confirmed: draft.marketplaceConfirmed !== false,
            signal: signalFromDraft(draft),
            supported,
          })
        : null,
    [draft, supported],
  );

  /** The AI's routed marketplace. A highlighted guess in `ask`, never a selection. */
  const guess = routing?.suggested ?? null;

  /** Best guess first, then the canvas's order. Same rule as `MarketplaceSheet`. */
  const options = useMemo(() => {
    const available = MARKETPLACE_OPTIONS.filter((o) => supported.includes(o.value));
    return guess
      ? [
          ...available.filter((o) => o.value === guess),
          ...available.filter((o) => o.value !== guess),
        ]
      : available;
  }, [supported, guess]);

  const photos = draft?.photos ?? [];
  const activeIndex = photos.length ? Math.min(active, photos.length - 1) : 0;
  const activePhoto = photos[activeIndex];

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * THE DEFER HELPER LIVED HERE AND IS GONE — 2026-09-21.
   *
   * It answered a control whose write was not wired by printing a sentence,
   * which beat a silent tap but was never shippable: App Review treats a
   * visible control that only explains itself as an unfinished app (Guideline
   * 2.1, App Completeness). Its instruction to itself was "wire the write or
   * drop the affordance; do not ship the sentence."
   *
   * Every one is now wired. This screen's last was Rearrange; the count across
   * all of `app/v2/` is zero, which `v2Inventory` asserts so it cannot creep
   * back in. The notice state went with it — nothing could set it any more, and
   * dead scaffolding reads like a feature someone forgot to finish.
   *
   * ⚠️ Every line of this block starts with `*` on purpose. `v2Inventory`
   * counts the sites by scanning LINES for the helper's name and skips only
   * those beginning with `*` or `//` — so a plain `/* … *\/` block that merely
   * MENTIONS it counts as a live call, and the first draft of this note failed
   * that suite by describing its own removal.
   */

  const onBack = () => {
    haptics.tap();
    router.back();
  };

  const onPickMarketplace = (m: MarketplaceKey) => {
    haptics.tap();
    /*
      Stay open, do NOT collapse to the statement row.

      Answering makes `marketplaceConfirmed` true, which flips
      `deriveRoutingState` from `ask` to `confirmed` in the same render — so
      without this the three options would vanish the instant you touched one
      and you would never see your own radio fill. The collapse is right on the
      NEXT visit, when the question is genuinely settled; it is wrong as the
      acknowledgement of the tap that settled it.
    */
    setPicking(true);
    if (!draft) return;
    const changed = m !== draft.marketplace;
    const next: Partial<DraftItem> = {
      marketplace: m,
      // The seller has now answered, so the submit gate stops blocking on it.
      marketplaceConfirmed: true,
      // The four category trees share no ids, and the currency follows the
      // market — which is exactly what the footnote below promises.
      ...(changed ? CLEARED_CATEGORY_DRAFT_FIELDS : null),
      ...(changed ? { priceCurrency: defaultCurrencyForSite(m) } : null),
    };
    set(next);
    // Device-local only — Zustand + MMKV, no endpoint. Picking a marketplace
    // is a discrete tap with no blur to wait for, so it commits at once.
    if (COMMIT_FIELD_EDITS) patch(next);
  };

  /**
   * WIRED 2026-09-21 — the last control in v2 that explained itself instead of
   * working. It used to say "reordering photos is not wired up in this build".
   *
   * It is a REUSE, not a rebuild. `app/scan/reorder-photos.tsx` already does
   * exactly this and has shipped for months: `mode=edit` reads `draft.photos`,
   * drives `react-native-reorderable-list` (already a dependency, built on the
   * Reanimated + RNGH this app already has), then calls `updatePhotos` and goes
   * back — which lands on this screen. Nothing about it is old-UI-specific
   * except its chrome, and drag-reorder is precisely the interaction the
   * workspace rule says to borrow rather than re-derive.
   *
   * ⚠️ Its one old-UI exit is unreachable from here. That screen bounces to
   * `routes.scanDetail` when the draft has NO photos — but the button above is
   * already hidden below two, so a seller cannot arrive with none. The guard
   * that existed for a cosmetic reason turns out to be the one that keeps this
   * from ejecting anyone into the old UI.
   *
   * TODO(v2-design): the screen itself still wears old-UI tokens, same as the
   * country and category pickers this flow mounts.
   */
  const onRearrange = () => {
    haptics.tap();
    router.push(routes.scanReorderPhotosEdit());
  };

  /**
   * WIRED (not deferred). The camera in `mode=append` shoots into this draft
   * and comes back; `updatePhotos` is a local store action, so nothing here
   * waits on an endpoint.
   *
   * This one could be wired while save-draft and publish could not, because it
   * was never a server write — it only sat next to ones that are.
   */
  const onAddPhoto = () => {
    haptics.tap();
    router.push(routes.v2CameraAppend());
  };

  /**
   * ⚠️ NO `commit()` CALL HERE, AND THAT IS THE POINT — do not add one.
   *
   * The other three review steps open with a flush: `commit()` on 7c,
   * `commitText()` on 7d, `commitAddresses()` on 7e. They need it because they
   * buffer typing and only write through on blur. This step has no text field.
   * The one edit it can make is the marketplace pick, and `onPickMarketplace`
   * above already writes it straight to MMKV on the tap (`COMMIT_FIELD_EDITS`
   * is `true` — it is declared `: boolean` so it does not read as dead code).
   * Inventing a second write for a value that is already stored would be
   * copying the shape of the sibling screens without their reason.
   *
   * ⚠️ AND THIS PRINTED A SENTENCE FOR TWO ROUNDS, like 7c. Round one claimed
   * the marketplace pick "is not stored yet", which was simply untrue. Round
   * two corrected the wording and kept the notice, which left the Guideline 2.1
   * problem untouched: a control that explains itself reads as unfinished, and
   * this screen was doing it while 7d and 7e buzzed and left.
   *
   * Closed 2026-09-16 by matching them. What is left is the haptic and the
   * exit — the honest whole of what this button can do today.
   */
  const saveDraft = useSaveDraft();

  /**
   * WIRED 2026-09-17. Saves to the server as well as the device; all four steps
   * share `useSaveDraft`, so saving here and again on a later step UPDATES the
   * one draft rather than creating a second.
   *
   * No `router.back()` any more. The save is now a real round trip with its own
   * toast, and leaving the screen while it is in flight hid the result — the
   * seller could not tell a save from a failure. They stay put and carry on.
   */
  const onSaveDraft = () => {
    haptics.tap();
    saveDraft.save();
  };

  const onContinue = () => {
    haptics.impact();
    // Nothing is validated away here: a step you have not finished is still a
    // step you can leave. The rail carries what is still missing, and 7e's
    // publish gate is the one place that actually blocks.
    router.push(reviewStepHref('details', index));
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
      <Screen header={headerNoProgress} tabBar={false} testID="v2-review-photos">
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

  // ── Marketplace section ───────────────────────────────────────────────────

  const asking = routing?.kind === 'ask';
  const showOptions = asking || picking;
  const chosen = asking && !dirty ? null : draft.marketplace;
  const settled = MARKETPLACE_OPTIONS.find((o) => o.value === draft.marketplace);

  return (
    <Screen
      header={header}
      tabBar={false}
      contentStyle={styles.body}
      testID="v2-review-photos"
      footer={
        <>
          <View style={styles.footerRow}>
            {/*
              A text-only secondary, not the canvas's outlined pill. Two pills
              side by side need ~324pt of the 342 a 390pt frame has, and on a
              320pt iPhone SE the primary's label wrapped inside a fixed 54pt
              button and clipped. The kit's own rule is the same one: the ONE
              green pill is the primary action and everything else tappable is
              type (`QuietAction`).
            */}
            <QuietAction
              label={saveDraft.isSaving ? 'Saving…' : 'Save as draft'}
              onPress={onSaveDraft}
              disabled={saveDraft.isSaving}
              style={styles.footerQuiet}
              testID="v2-review-photos-save"
            />
            {/*
              "Continue", not "Continue to details" — the rail two blocks up
              names the next step, so the button does not have to, and the short
              label is what keeps this row inside a 320pt frame.
            */}
            <PrimaryAction
              label="Continue"
              onPress={onContinue}
              style={styles.footerPrimary}
              testID="v2-review-photos-continue"
            />
          </View>
        </>
      }
    >
      {/*
        The rail. `live={false}` — nothing is happening on its own here; the
        person is the one moving, so the active dot must not breathe.
      */}
      <View style={styles.timeline}>
        <Timeline steps={timeline} current={stepIndex} live={false} />
      </View>

      <Hairline inset="gutter" />

      {/* ── The large preview ── */}
      <View style={styles.gallery}>
        {/* flat: a photo placeholder. */}
        <View style={[styles.hero, { height: scaleW(HERO_HEIGHT), backgroundColor: c.fill }]}>
          {activePhoto ? (
            <Image
              source={{ uri: activePhoto.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              accessibilityLabel={`Photo ${activeIndex + 1} of ${photos.length}`}
            />
          ) : (
            <ImageIcon size={icon.hero} color={c.inkDisabled} strokeWidth={1.4} />
          )}

          {photos.length ? (
            <ScrimPill
              label={`${activeIndex + 1} of ${photos.length}`}
              style={styles.heroCounter}
            />
          ) : null}

          {/*
            Hidden below two photos: there is nothing to rearrange, and a
            control that can only explain itself is worse than no control.
          */}
          {photos.length > 1 ? (
            <ScrimPill
              label="Rearrange"
              glyph={<Images size={icon.sm} color={c.onScrimPill} strokeWidth={1.8} />}
              onPress={onRearrange}
              accessibilityHint="Change the order buyers see these photos in"
              style={styles.heroAction}
            />
          ) : null}
        </View>

        {photos.length ? (
          <View style={styles.thumbRow}>
            {photos.map((p, i) => (
              <PhotoThumb
                key={p.uri}
                uri={p.uri}
                index={i}
                total={photos.length}
                selected={i === activeIndex}
                onPress={() => {
                  haptics.tap();
                  setActive(i);
                }}
              />
            ))}
            <AddPhotoTile onPress={onAddPhoto} />
          </View>
        ) : (
          <>
            <Text variant="body" color="inkMuted" style={styles.noPhotos}>
              This item has no photos. A listing needs at least one — it is the
              first thing a buyer looks at.
            </Text>
            <View style={styles.thumbRow}>
              <AddPhotoTile onPress={onAddPhoto} />
            </View>
          </>
        )}

        {/*
          `sourceLabel` is the coarse origin of a photo pulled out of a
          spreadsheet or a slide deck ("sheet 仁義廠", "slide 3"). Absent for
          camera captures, which is the common case — so the line appears only
          when there is something true to say.
        */}
        {activePhoto?.sourceLabel ? (
          <Text variant="caption" color="inkSubtle" style={styles.sourceLabel}>
            {`From ${activePhoto.sourceLabel}`}
          </Text>
        ) : null}
      </View>

      <Hairline inset="gutter" />

      {/* ── Marketplace ── */}
      <View style={styles.section}>
        <Eyebrow label="Marketplace" ai />

        {asking ? (
          <>
            <Text variant="h3" style={styles.sectionTitle}>
              {routing?.needsClearerPhoto
                ? 'Hard to tell from this photo'
                : 'Which marketplace is this for?'}
            </Text>
            <Text variant="body" color="inkMuted" style={styles.sectionBody}>
              {routing?.needsClearerPhoto
                ? 'A closer shot of the nameplate would help. You can also just pick the marketplace yourself.'
                : 'We could not settle this one on our own. Pick where it belongs and the rest of the form follows.'}
            </Text>
          </>
        ) : null}

        {showOptions ? (
          options.map((o) => (
            <MarketplaceOption
              key={o.value}
              label={o.label}
              description={o.description}
              bestGuess={o.value === guess}
              selected={o.value === chosen}
              highlighted={o.value === guess && o.value !== chosen}
              onPress={() => onPickMarketplace(o.value)}
            />
          ))
        ) : (
          /*
            Settled: a statement, not a question. Three radios for something
            already decided is a form; this is the workflow reading of the same
            data (UX_DESIGN_RULES, "Adaptive UI").
          */
          <PickerRow
            value={settled?.label ?? draft.marketplace}
            detail={settled?.description ?? 'Where this listing will be published'}
            noun="marketplace"
            // Unreachable: this branch only renders once a marketplace is set.
            emptyTitle="No marketplace yet"
            /*
              No "Change" when there is nothing to change TO.
              `MARKETPLACE_PICKER_ENABLED` is off for this 101lab build, so
              `supported` is one entry and the list behind Change would offer
              the value already shown. A control that costs a tap to say "no
              other option" is worse than no control.
              Re-enable the flag and it comes back, unchanged.
            */
            onChange={
              supported.length > 1
                ? () => {
                    haptics.tap();
                    setPicking(true);
                  }
                : undefined
            }
            testID="v2-review-photos-change-marketplace"
          />
        )}

        {/* Only true when there IS a choice. On a single-marketplace build the
            marketplace was never chosen, so promising that choosing sets the
            category and currency describes a step that does not happen. */}
        {supported.length > 1 ? (
          <Text variant="caption" color="inkSubtle" style={styles.footnote}>
            Category and currency are set once you choose — we will not guess them.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── body ──
  body: { paddingTop: space['6xl'] },
  timeline: { paddingHorizontal: GUTTER, paddingBottom: space['7xl'] },

  gallery: { paddingHorizontal: GUTTER, paddingVertical: space['7xl'] },
  hero: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCounter: { position: 'absolute', top: space['2xl'], left: space['2xl'] },
  heroAction: { position: 'absolute', bottom: space['2xl'], right: space['2xl'] },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xl,
    marginTop: space['2xl'],
  },
  thumb: { borderRadius: radius.md, overflow: 'hidden' },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: space.xxs },
  noPhotos: { marginTop: space['2xl'] },
  sourceLabel: { marginTop: space.xl },

  // ── marketplace ──
  section: { paddingHorizontal: GUTTER, paddingTop: space['7xl'] },
  sectionTitle: { marginBottom: space.md },
  sectionBody: { marginBottom: space['5xl'] },
  option: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    minHeight: MIN_TOUCH,
    paddingVertical: space['3xl'],
    paddingHorizontal: CARD_PAD,
    borderRadius: radius.md,
    marginBottom: space.lg,
  },
  optionText: { flex: 1, minWidth: 0 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  optionSub: { marginTop: space.xs },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDot: { width: RADIO_DOT, height: RADIO_DOT, borderRadius: radius.pill },
  footnote: { marginTop: space.xs, marginBottom: SECTION_GAP },

  // ── empty ──
  emptyState: { paddingHorizontal: GUTTER, paddingTop: SECTION_GAP },
  emptyBody: { marginTop: space.lg, marginBottom: space['3xl'] },

  // ── footer ──
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  footerQuiet: { flexShrink: 0 },
  footerPrimary: { flex: 1 },
});
