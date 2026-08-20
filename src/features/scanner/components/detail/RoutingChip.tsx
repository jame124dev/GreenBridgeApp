import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { brand } from '@/constants/theme';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import {
  MARKETPLACE_COLOR,
  logoFor,
  logoWidthFor,
} from '@/features/scanner/marketplaceLogos';
import {
  CLEARED_CATEGORY_FORM_FIELDS,
  deriveRoutingState,
  signalFromDraft,
} from '@/features/scanner/routing/routingState';
import { useSupportedMarketplaces } from '@/features/scanner/routing/useSupportedMarketplaces';
import type { DetailFormInput } from '@/features/scanner/schema';
import { haptics } from '@/lib/haptics';
import type { DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';

import { FieldLabel } from './FieldLabel';
import { MarketplaceSheet } from './MarketplaceSheet';

/**
 * The three display bands for `site_type_confidence`.
 *
 * ⛔ This is the ONLY place in the app that compares the confidence number to
 * anything, and it picks a WORD — it changes no state, blocks nothing and routes
 * nothing. plan §2.1 forbids a behavioural threshold in v1 because any cut-off
 * would be calibrated on zero logged agreement observations. If you are about to
 * write `if (state.confidence > 0.8)` in a branch that decides something, three
 * tests will stop you: marketplaceUnlock's "a low confidence number alone does
 * NOT change any mapped field", and routingState's "never flips the trigger" /
 * "never changes the state".
 */
const CONFIDENCE_BAND = {
  high: { key: 'mobile.detail.routing.confHigh', en: 'High' },
  medium: { key: 'mobile.detail.routing.confMedium', en: 'Medium' },
  low: { key: 'mobile.detail.routing.confLow', en: 'Low' },
} as const;

const band = (c: number): keyof typeof CONFIDENCE_BAND =>
  c >= 0.85 ? 'high' : c >= 0.6 ? 'medium' : 'low';

/**
 * ⛔ The ask CTA's fill lives HERE, in a StyleSheet object passed as an ARRAY —
 * never in a `style={({ pressed }) => …}` callback.
 *
 * WHY (measured, not guessed). NativeWind registers every RN primitive with
 * `cssInterop(Pressable, { className: 'style' })`
 * (react-native-css-interop/dist/runtime/components.js), and because `target`
 * ('style') differs from `source` ('className'), `getNormalizeConfig` also sets
 * `inlineProp: 'style'`. The interop therefore takes over the INLINE style prop
 * too: `collectInlineRules` pushes it as a declaration and `applyRules` merges it
 * with `{ ...declaration }`. Spreading a FUNCTION yields `{}` — so the whole
 * style object is silently replaced by an empty one, and `renderComponent`'s
 * `props = { ...props, ...possiblyAnimatedProps }` then overwrites the original
 * callback with that `{}`. The button rendered with no fill, no padding and no
 * minHeight (measured 23dp on device: just the label's line box) while the child
 * <Text>'s own inline color — an OBJECT, which spreads fine — still applied.
 * White text on the pale amber card: the one CTA in the ask state, invisible.
 *
 * Arrays and objects are safe (`collectInlineRules` recurses arrays and skips
 * falsy entries, and later entries win), which is why `pressed` is now a piece of
 * React state fed by onPressIn/onPressOut rather than a callback argument.
 *
 * `minHeight`, NOT `height` — the TH/VI labels wrap onto two lines.
 *
 * A test holds this down: RoutingChipCtaStyle.test.tsx registers the same
 * cssInterop mapping the runtime does (jest skips it — `wrapJSX` guards the
 * registration with `process.env.NODE_ENV !== 'test'`, which is exactly why the
 * bug shipped past a green suite) and asserts the RESOLVED fill and height.
 */
/**
 * ⛔ EVERY style here is an object referenced from an ARRAY at the call site.
 * Do NOT convert any of these into a `style={({ pressed }) => …}` callback:
 * NativeWind's interop takes over the inline `style` prop and merges it with
 * `{ ...declaration }`, and spreading a FUNCTION yields `{}` — so the whole
 * style silently vanishes at runtime while jest still passes (the interop is not
 * registered when NODE_ENV === 'test'). That is exactly how the ask-state CTA
 * shipped as white text on a pale background, invisible on a real device.
 */
const styles = StyleSheet.create({
  options: { gap: 8, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingRight: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brand.borderStrong,
    backgroundColor: brand.surface,
    overflow: 'hidden',
  },
  optionPressed: { backgroundColor: brand.primarySurface },
  /** Identity as a bar down the leading edge — the marketplace's own colour,
   *  never a filled background, so an option reads as a choice not a status. */
  identityBar: { width: 6, alignSelf: 'stretch' },
  optionText: { flex: 1, minWidth: 0, paddingVertical: 10 },
  /** Fixed footprint so every wordmark starts the text column at the same x —
   *  the three marks differ in width by ~30%, which is what made a bare logo
   *  misalign the rows it sat in. */
  logoTile: {
    width: 76,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: brand.borderStrong,
    backgroundColor: brand.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  /** Confidence as a chip, not a sentence. `overflow: hidden` is what makes the
   *  radius clip on Android when the background sits on the Text itself. */
  confChip: {
    color: brand.primary,
    backgroundColor: brand.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  changeAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  guessTag: {
    color: brand.primary,
    backgroundColor: brand.primarySurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

interface Props {
  draft: DraftItem;
  /**
   * Persist the seller's answer. `detail.tsx` passes
   * `(m) => patch({ marketplace: m, marketplaceConfirmed: true, ...cleared })`;
   * `grouped-edit.tsx` passes the `patchQueuedItem(index, …)` equivalent.
   * The chip does NOT reach into the store itself — one write path per screen.
   */
  onConfirm: (marketplace: MarketplaceKey) => void;
}

/**
 * The routing confirmation, as a chip above IdentityCard (plan §6.1).
 *
 * THREE states, per plan §2.2:
 *   confirmed + prefill    — "WE'LL LIST THIS ON · 101LAB", quiet "Change"
 *   confirmed + no prefill — same, plus "Category: not set — pick one below"
 *   ask                    — a question, NOTHING pre-selected, and an
 *                            instructive CTA that names the action
 *
 * Stitch 4a/4b supply the product logic (the statement, the WHY line, the
 * "we won't guess" promise, the instructive CTA, best-guess-first). Styling is
 * this repo's: the container class is byte-identical to IdentityCard's, and every
 * value comes from `constants/theme.ts` via the `brand-*` Tailwind aliases. The
 * Stitch mocks use a 4/8/16/24/32 spacing scale and nine font sizes that this
 * app does not have; reconciling the two scales is a separate, unapproved task.
 *
 * ⚠️ This component writes `marketplace` ONLY from `onPress` inside the sheet.
 * Never move that into a `watch` effect — see the hydration-race note in
 * useDetailController.
 */
export function RoutingChip({ draft, onConfirm }: Props) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<DetailFormInput>();
  const supported = useSupportedMarketplaces();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Press feedback as STATE, not as a `style={({ pressed }) => …}` argument —
  // see the `styles` note above for why the callback form renders unstyled.
  const [pressedOption, setPressedOption] = useState<MarketplaceKey | null>(null);

  const current = watch('marketplace');
  const state = deriveRoutingState({
    current,
    confirmed: draft.marketplaceConfirmed !== false,
    signal: signalFromDraft(draft),
    supported,
  });

  // One marketplace on offer ⇒ nothing to confirm, nothing to change. The chip
  // disappears entirely and the screen is 1.0.3. This is also the fail-closed
  // path (offline / 404 / cold cache).
  if (supported.length <= 1) return null;

  const labelFor = (m: MarketplaceKey) =>
    MARKETPLACE_OPTIONS.find((o) => o.value === m)?.label ?? m;
  // Integration C7 — Phase 5's ONE description string, ONE key, ONE home.
  const descriptionFor = (m: MarketplaceKey) => {
    const o = MARKETPLACE_OPTIONS.find((x) => x.value === m);
    if (!o) return '';
    return t(`mobile.detail.marketplaceOption.${m}.description`, {
      defaultValue: o.description,
    });
  };

  const pick = (m: MarketplaceKey) => {
    // Identical contract to the pre-unlock MarketplaceCard onPress: a REAL user
    // switch invalidates the marketplace-specific category/subcategory and any
    // "Other" brand. Done here, on the tap — NOT in a watch-effect.
    //
    // ⚠️ blocker (c): these setValue calls are NOT sufficient on the single path.
    // `onConfirm` -> `patch()` gives `current` a new object identity, which
    // re-fires useDetailController's `reset(draftToFormValues(draft))` and writes
    // the STORE's categoryId back over whatever we set here. The store patch in
    // `onConfirm` is what actually clears it. These calls still matter on
    // `grouped-edit.tsx`, which has NO reset effect (its useForm sets
    // defaultValues once), so the form there would otherwise keep showing the
    // old category until Save.
    setValue('marketplace', m, { shouldValidate: false });
    if (m !== current) {
      for (const [k, v] of Object.entries(CLEARED_CATEGORY_FORM_FIELDS)) {
        setValue(k as keyof DetailFormInput, v as never, { shouldValidate: false });
      }
    }
    onConfirm(m);
  };

  const sheet = (
    <MarketplaceSheet
      visible={sheetOpen}
      supported={supported}
      value={state.kind === 'ask' ? null : current}
      suggested={state.suggested}
      onSelect={pick}
      onClose={() => setSheetOpen(false)}
    />
  );

  // ── ASK ──────────────────────────────────────────────────────────────────
  if (state.kind === 'ask') {
    return (
      <View
        className="bg-brand-warning-bg border border-brand-warning-border rounded-sm p-2xl gap-sm"
        accessibilityRole="summary"
      >
        {/* SAY WHICH QUESTION WE ARE ACTUALLY ASKING. Two different things land
            in this one state and they deserve different words. Observed on a
            Galaxy S20 FE: a wide desk shot of wireless earbuds produced
            "We're not sure where this belongs" AND "Our best guess is 101IT" on
            the same card — which reads as a contradiction, because the app plainly
            DID know it was IT. The real problem there was the photo (the item is
            small in a wide frame, so `needsClearerPhoto` fired), not the
            marketplace. Blaming the marketplace made the app look confused about
            something obvious and hid the actionable advice: take a closer photo. */}
        <View className="flex-row items-center gap-1.5">
          <MaterialIcons
            name={state.needsClearerPhoto ? 'photo-camera' : 'help-outline'}
            size={16}
            color={brand.warningText}
          />
          <Text className="font-heading-semi text-3xl text-brand-foreground" style={{ flex: 1 }}>
            {state.needsClearerPhoto
              ? t('mobile.detail.routing.askTitlePhoto', {
                  defaultValue: 'Hard to tell from this photo',
                })
              : t('mobile.detail.routing.askTitle', {
                  defaultValue: "We're not sure where this belongs",
                })}
          </Text>
        </View>

        <Text className="font-sans text-lg text-brand-text-muted">
          {state.needsClearerPhoto
            ? t('mobile.detail.routing.askBodyPhoto', {
                defaultValue:
                  'A closer shot of the nameplate would help. You can also just pick the marketplace yourself.',
              })
            : t('mobile.detail.routing.askBody', {
                defaultValue: "Pick a marketplace and we'll load the right categories.",
              })}
        </Text>

        {/* THE OPTIONS, INLINE — one tap, not two.
            This replaces a "Choose a marketplace to continue" button that opened
            a sheet: the seller had to tap twice to answer a three-way question
            that fits on screen. It also removes the separate "Our best guess is
            101IT." sentence — the guess is now a tag on the row it refers to,
            which is both shorter and actionable.

            NO LOGO IN THESE ROWS, deliberately. All three marketplace marks are
            the same globe + "by GREENBIDZ" with one word changed, so side by side
            they add three identical globes, an illegible sub-line, and — because
            each wordmark is a different width — descriptions that start at a
            different x on every row. Rendered and compared before choosing:
            app_debug/picker-design-compare.png. The identity COLOUR carries the
            distinction and the name is the biggest thing on the row. The real
            logo is used in the confirmed state, where there is exactly one.

            Nothing is pre-selected (approved plan §2.2) so a seller cannot
            confirm a guess by reflex. */}
        <View style={styles.options}>
          {supported.map((m) => {
            const isGuess = state.suggested === m;
            return (
              <Pressable
                key={m}
                onPress={() => pick(m)}
                onPressIn={() => setPressedOption(m)}
                onPressOut={() => setPressedOption(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: false }}
                accessibilityLabel={`${labelFor(m)} — ${descriptionFor(m)}`}
                style={[styles.option, pressedOption === m && styles.optionPressed]}
              >
                <View style={[styles.identityBar, { backgroundColor: MARKETPLACE_COLOR[m] }]} />
                <View style={styles.optionText}>
                  <View className="flex-row items-center gap-xs">
                    <Text
                      className="font-heading-semi text-3xl text-brand-foreground"
                      numberOfLines={1}
                      style={{ flexShrink: 1, minWidth: 0 }}
                    >
                      {labelFor(m)}
                    </Text>
                    {isGuess ? (
                      <Text className="font-label-medium text-sm" style={styles.guessTag}>
                        {t('mobile.detail.routing.bestGuessTag', { defaultValue: 'BEST GUESS' })}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="font-sans text-md text-brand-text-muted" numberOfLines={1}>
                    {descriptionFor(m)}
                  </Text>
                </View>
                <MaterialIcons name="radio-button-unchecked" size={22} color={brand.borderStrong} />
              </Pressable>
            );
          })}
        </View>

        <Text className="font-sans text-md text-brand-text-muted">
          {t('mobile.detail.routing.setOnce', {
            defaultValue: "Category and currency are set once you choose — we won't guess them.",
          })}
        </Text>
      </View>
    );
  }

  // ── CONFIRMED ────────────────────────────────────────────────────────────

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <FieldLabel
        text={t('mobile.detail.routing.willListOn', { defaultValue: "WE'LL LIST THIS ON" })}
        ai
      />

      {/* ONE ROW: [logo tile] [destination + meta] [Change].
          The previous version stacked four full-width rows of equal weight —
          label, logo+description, "AI confidence: High · 100%", "No brand or
          model was legible in the photos." — with "Change" floating unaligned
          against the top. The owner's words: "very low design… not like a
          standard app". Three alternatives were rendered at device scale and
          compared (app_debug/routing-card-variants.png); this is the one that won.

          THE TILE IS THE KEY PART. A fixed 76x48 box gives every marketplace the
          same footprint, so the text column starts at the same x whatever the
          wordmark's width — which is the exact misalignment that made logos
          unusable in the three-up picker. It also gives the mark somewhere to sit
          instead of floating against the card.

          Confidence became a CHIP and the nameplate note became inline metadata,
          because "AI confidence: High · 100%" as a full sentence in body text
          reads like a log line, not a product. */}
      <View className="flex-row items-center gap-sm">
        <View style={styles.logoTile}>
          {logoFor(current) ? (
            <Image
              source={logoFor(current)!}
              style={{ height: 26, width: Math.min(logoWidthFor(current, 26), 64) }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={labelFor(current)}
            />
          ) : (
            /* 101recycle has no mark of its own — its brand colour and short name
               carry the identity instead, in the same footprint. */
            <View className="items-center" accessibilityLabel={labelFor(current)}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: MARKETPLACE_COLOR[current],
                  marginBottom: 3,
                }}
              />
              <Text className="font-label-medium text-sm text-brand-foreground" numberOfLines={1}>
                {labelFor(current)}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            className="font-heading-semi text-2xl text-brand-foreground"
            numberOfLines={1}
          >
            {descriptionFor(current)}
          </Text>
          {/* Confidence and the nameplate caveat share ONE meta line. Both are
              secondary facts about a decision already stated above, so neither
              earns a full-width row of its own. */}
          <View className="flex-row items-center gap-xs" style={{ marginTop: 4 }}>
            {state.confidence != null ? (
              <Text className="font-label-medium text-sm" style={styles.confChip}>
                {t('mobile.detail.routing.confidenceShort', {
                  defaultValue: '{{word}} · {{pct}}%',
                  // Each band keeps its OWN English fallback: a missing
                  // confMedium/confLow key must not render a LOW score as "High".
                  word: t(CONFIDENCE_BAND[band(state.confidence)].key, {
                    defaultValue: CONFIDENCE_BAND[band(state.confidence)].en,
                  }),
                  pct: Math.round(state.confidence * 100),
                })}
              </Text>
            ) : null}
            {/* ⛔ THE NAMEPLATE NOTE IS DELIBERATELY NOT HERE ANY MORE.
                It was truncating to "No brand or mod…", which says nothing, and
                it was DUPLICATE: FIX 1b already puts that exact fact under BRAND
                and MODEL, which are the fields it is about and where a seller can
                act on it. Two copies of one caveat, one of them unreadable, is
                worse than one copy in the right place. `routingWhyLine` is no longer
                used by this component at all; the ask state picks its wording from
                `state.needsClearerPhoto`. */}
          </View>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          hitSlop={12}
          accessibilityLabel={t('mobile.detail.routing.change', { defaultValue: 'Change' })}
          style={styles.changeAction}
        >
          <Text className="font-semi text-lg" style={{ color: brand.primaryDim }}>
            {t('mobile.detail.routing.change', { defaultValue: 'Change' })}
          </Text>
        </Pressable>
      </View>

      {/* "Not set" instead of a guess — plan §2.2 row 3 / §4.1. Says WHY the
          field is empty, so an empty required field reads as a decision rather
          than a bug. The CLEAR itself happens in the store (lock 2 / lock 3 /
          onConfirm); this line is only the explanation. */}
      {!state.prefillCategory && !watch('categoryId') ? (
        <Text className="font-sans text-md" style={{ color: brand.warningText, marginTop: 2 }}>
          {t('mobile.detail.routing.categoryNotSet', {
            defaultValue: 'Category: not set — pick one below. We would rather ask than guess.',
          })}
        </Text>
      ) : null}

      {sheet}
    </View>
  );
}
