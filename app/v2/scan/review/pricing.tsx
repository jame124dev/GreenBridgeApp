/**
 * 7d — Review · pricing. Step 3 of 4.
 *
 * Shape, top to bottom (docs/v2-design/screens/7d.html):
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [←]  Review your item                        Draft     │
 *   │  STEP 3 OF 4 · PRICING                          75%     │
 *   │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁      │
 *   └─────────────────────────────────────────────────────────┘
 *   ┌ soft green panel ───────────────────────────────────────┐
 *   │  PROFIT INTELLIGENCE  (AI)                              │
 *   │  SCRAP VALUE BASELINE                                   │
 *   │  USD 50 – USD 100                                       │
 *   │  ─────────────────────────────────────────────────────  │
 *   │  POTENTIAL PROFIT                                       │
 *   │  ↗ +USD 100 – +USD 450                                  │
 *   │  ⓘ AI estimate — verify before publishing.              │
 *   └─────────────────────────────────────────────────────────┘
 *   ─────────────────────────────────────────────────────────
 *   PRICE
 *   ( ✓ Buy now )  ( Make offer )
 *   [ USD  350.00            ]   [ −  1  + ]
 *   CURRENCY  ( ✓ USD ($) )  ( TWD (NT$) )
 *   ─────────────────────────────────────────────────────────
 *   More details                                           ⌄
 *   Optional · weight, size, CO₂, documents
 *   ┌ footer ─────────────────────────────────────────────────┐
 *   │  ( Save as draft )  (  Continue  →  )                   │
 *   └─────────────────────────────────────────────────────────┘
 *
 * ── THE PROFIT PANEL IS THE CANVAS'S, NOT A REDESIGN ─────────────────────
 *
 * There is history on this panel. It was once rebuilt around a single
 * suggested price; the client rejected that and it was reverted. So what is
 * below is the drawing, field for field: a scrap-value BASELINE and a profit
 * RANGE, both as ranges, with the honest disclaimer under them. Specifically
 * NOT here, because the canvas does not draw them:
 *
 *   • no single tappable "suggested price" that fills the field,
 *   • no percentage uplift. The old one was `profitMid / scrapMid × 100`
 *     capped at 999, and over 72 real dev responses the MEDIAN was 999 with
 *     63% at the cap (SCAN_FLOW_BACKEND.md:389). A number that is usually its
 *     own display ceiling is not information.
 *
 * The maths is `ProfitIntelligenceCard.deriveFigures` — the same scrap/used
 * pair, the same USD normalisation, the same `max(0, …)` floor so the bottom
 * of the range never reads as a loss. It is duplicated rather than imported
 * because it is private to that component; hoisting it is a KIT GAP, not a
 * behaviour change.
 *
 * REAL DATA MEANS AN EMPTY STATE. `aiPrices` is null on any manual-entry draft
 * and on any AI response that returned only one tier, so the panel says "No
 * price estimate" and points at the field below rather than inventing figures
 * to fill the space.
 *
 * ── DATA & WRITES ────────────────────────────────────────────────────────
 *
 * Reads the real draft through `wizardState.useReviewItem()` — `queuedItems[i]`
 * for a smart-detect queue, `current` for the single-product path.
 *
 * Field edits are DEVICE-LOCAL (`patchQueuedItem` → Zustand + MMKV, no
 * network). Text fields hold their value in component state and commit on blur
 * and before navigating: `patchQueuedItem` persists the whole session
 * synchronously, so committing per keystroke would rewrite MMKV on every
 * letter. Taps — format, currency, quantity — commit immediately.
 *
 * Anything that leaves the phone is `TODO(v2-writes)` and inert: "Save as
 * draft" (a server draft POST) here, and publish on 7e.
 *
 * ── ONE PRIMARY ACTION, AND IT IS NOT SUBMIT ─────────────────────────────
 *
 * The canvas repeats "Submit listing" in the footer of all four steps. On step
 * 3 of 4 that is a second primary action competing with the step's own — and it
 * skips step 4, where the pickup address (a required field) lives. So the pill
 * here is "Continue" and the publish CTA appears once, on 7e.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronUp, Info, TrendingUp } from 'lucide-react-native';

import {
  PillButton,
  SoftPanel,
  Stepper,
  EmptyState,
  Field,
  Hairline,
  PrimaryAction,
  Row,
  Screen,
  Text,
  Timeline,
} from '@/features/v2/ui';
import { GUTTER, icon, radius, space, useV2Colors } from '@/theme/v2';
import { CURRENCY_OPTIONS } from '@/features/settings/constants';
import { convertPrice, formatCurrency } from '@/features/scanner/currencyFx';
import type { AiPriceTier, AiPrices } from '@/features/scanner/smartDetectionTypes';
import type { SupportedCurrency } from '@/stores/scanDraftStore';
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

const THIS_STEP = 'pricing' as const;
const STEP_INDEX = reviewStepIndex(THIS_STEP);

// ── The panel's figures ────────────────────────────────────────────────────

type DerivedFigures = {
  /** USD-canonical scrap range. `min === max` for a point estimate. */
  scrapUsd: AiPriceTier;
  /** USD-canonical profit range: resale minus scrap, floored at zero. */
  profitUsd: AiPriceTier;
};

/**
 * Mirrors `ProfitIntelligenceCard.deriveFigures` exactly.
 *
 * BOTH tiers are required: a scrap-only or used-only bundle cannot produce a
 * profit range at all, and guessing the missing side is how the old fabricated
 * panel happened. Missing tiers return null and the panel says so.
 */
function deriveFigures(aiPrices: AiPrices | null | undefined): DerivedFigures | null {
  if (!aiPrices || aiPrices.scrap == null || aiPrices.used == null) return null;
  const scrapUsd: AiPriceTier = {
    min: convertPrice(aiPrices.scrap.min, aiPrices.currency, 'USD'),
    max: convertPrice(aiPrices.scrap.max, aiPrices.currency, 'USD'),
  };
  const usedUsd: AiPriceTier = {
    min: convertPrice(aiPrices.used.min, aiPrices.currency, 'USD'),
    max: convertPrice(aiPrices.used.max, aiPrices.currency, 'USD'),
  };
  return {
    scrapUsd,
    // Worst case is `used.min − scrap.max`, best is `used.max − scrap.min`.
    profitUsd: {
      min: Math.max(0, usedUsd.min - scrapUsd.max),
      max: Math.max(0, usedUsd.max - scrapUsd.min),
    },
  };
}

/**
 * A USD-canonical tier in the seller's chosen currency. A point tier renders as
 * one figure; a real range gets the ISO code on both ends.
 *
 * The ISO CODE, not the symbol, is deliberate and predates this screen: "$" is
 * ambiguous across USD/AUD/CAD/SGD on a cross-border marketplace, and the
 * price field right below is labelled the same way.
 */
function formatTier(
  tier: AiPriceTier,
  currency: SupportedCurrency,
  opts?: { signed?: boolean },
): string {
  const lo = formatCurrency(convertPrice(tier.min, 'USD', currency), currency, opts);
  if (tier.min === tier.max) return lo;
  const hi = formatCurrency(convertPrice(tier.max, 'USD', currency), currency, opts);
  return `${lo} – ${hi}`;
}

/** Digits and at most one decimal point. A price field must not accept prose. */
function cleanAmount(text: string): string {
  const stripped = text.replace(/[^0-9.]/g, '');
  const [head, ...rest] = stripped.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}

// ── The screen ─────────────────────────────────────────────────────────────

export default function V2ReviewPricing() {
  const c = useV2Colors();
  const { index, item, total, patch } = useReviewItem();

  /**
   * Text lives here until blur. `patchQueuedItem` writes the whole session to
   * MMKV synchronously, so a keystroke-per-write would be a disk write per
   * letter. Seeded once — a re-render must not yank the caret back to the
   * stored value mid-word.
   */
  const [price, setPrice] = useState(() => item?.pricePerUnit ?? '');
  const [weight, setWeight] = useState(() => item?.weight ?? '');
  const [dimensions, setDimensions] = useState(() => item?.dimensions ?? '');
  const [co2, setCo2] = useState(() => item?.co2Emissions ?? '');
  const [moreOpen, setMoreOpen] = useState(false);

  const figures = useMemo(() => deriveFigures(item?.aiPrices), [item?.aiPrices]);
  const currency: SupportedCurrency = item?.priceCurrency ?? 'USD';
  const buyNow = item?.priceFormat !== 'offer';

  /**
   * Committed together, because they are one edit as far as the draft is
   * concerned. Called on blur and before any navigation, so leaving the screen
   * — forwards, backwards or by the OS back gesture's sibling control — never
   * loses a typed value.
   */
  const commitText = () => {
    if (!item) return;
    patch({
      pricePerUnit: price.trim(),
      weight: weight.trim(),
      dimensions: dimensions.trim(),
      co2Emissions: co2.trim(),
    });
  };

  const onFormat = (next: 'buyNow' | 'offer') => {
    haptics.tap();
    patch({ priceFormat: next });
  };

  /**
   * Switching currency CONVERTS the typed amount rather than reinterpreting the
   * digits — 350 USD becoming 350 TWD silently is an order-of-magnitude error
   * in the seller's own listing. Same behaviour as the shipped `PricingCard`.
   */
  const onCurrency = (next: SupportedCurrency) => {
    if (next === currency) return;
    haptics.tap();
    const numeric = Number(price);
    const converted =
      Number.isFinite(numeric) && numeric > 0
        ? String(convertPrice(numeric, currency, next))
        : price;
    setPrice(converted);
    patch({ priceCurrency: next, pricePerUnit: converted.trim() });
  };

  const onQuantity = (next: number) => {
    haptics.tap();
    patch({ quantity: next });
  };

  const onBack = () => {
    commitText();
    haptics.tap();
    router.back();
  };

  const onContinue = () => {
    commitText();
    haptics.impact();
    router.push(reviewStepHref('location', index));
  };

  const saveDraft = useSaveDraft();

  /** WIRED 2026-09-17 — see the note on 7b's handler. `commitText()` first: it
   *  flushes the debounced price patch the snapshot would otherwise miss. */
  const onSaveDraft = () => {
    commitText();
    haptics.tap();
    saveDraft.save();
  };

  const header = (
    <StepHeader step={THIS_STEP} itemIndex={index} itemTotal={total} onBack={onBack} />
  );

  /**
   * The same header WITHOUT the step counter, percentage and bar.
   *
   * A cold open is not "step N of 4" — there is nothing to be N of. With
   * the progress chrome on, this screen read "75%" above "there is no item
   * to review": the interface claiming progress it has not made.
   */
  const headerNoProgress = (
    <StepHeader step={THIS_STEP} itemIndex={index} itemTotal={total} onBack={onBack} progress={false} />
  );

  // A cold open — deep link, or a restart with nothing persisted. Say so and
  // offer the way out rather than rendering an empty form over no draft.
  if (!item) {
    return (
      <Screen header={headerNoProgress} tabBar={false} testID="v2-review-pricing">
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

  /**
   * The rail's active row carries what this step still wants, or that it is
   * done — read off the draft PLUS the amount not yet committed, so it does
   * not still say "needs a price" while a price is visibly typed in.
   */
  const railSteps = TIMELINE_STEPS.map((s, i) =>
    i === STEP_INDEX
      ? {
          ...s,
          detail:
            stepNeeds({ ...item, pricePerUnit: price.trim() }, THIS_STEP) ??
            'Nothing left on this step',
        }
      : s,
  );

  return (
    <Screen
      header={header}
      tabBar={false}
      testID="v2-review-pricing"
      footer={
        <View style={styles.footer}>
          {/*
            Two pills, one green. `variant="tinted"` is the same 54pt shape on
            `accentWash` — a real body for the secondary action, without a
            second green slab.

            It was `quiet` until 2026-09-03: no fill, a `hairlineStrong`
            outline. That outline measures 1.27:1 on `base` in light and
            1.89:1 in dark, against the 3:1 WCAG asks of a control's visible
            boundary — so the pill shape was not perceivable at all, and next
            to a filled green pill "Save as draft" read as loose text rather
            than the other half of a choice.
          */}
          <PrimaryAction
            label={saveDraft.isSaving ? 'Saving…' : 'Save as draft'}
            onPress={onSaveDraft}
            disabled={saveDraft.isSaving}
            variant="tinted"
            style={styles.footerQuiet}
            testID="v2-review-pricing-save"
          />
          {/*
            "Continue", not "Continue to location" — the rail at the top of the
            body already names the next step, and the short label is what keeps
            this row inside a 320pt frame beside "Save as draft".
          */}
          <PrimaryAction
            label="Continue"
            onPress={onContinue}
            icon={<ArrowRight size={icon.md} color={c.onAccent} strokeWidth={2} />}
            style={styles.footerPrimary}
            testID="v2-review-pricing-continue"
          />
        </View>
      }
    >
      {/*
        The four steps. `live={false}` — nothing is happening on its own here;
        the person is the one moving, and a pulsing dot would claim otherwise.
        It sits on `base` rather than inside the header sheet because the rail's
        connector is `fill`, a ~1.02:1 step against `wash` — invisible there.
      */}
      <View style={styles.timeline}>
        <Timeline steps={railSteps} current={STEP_INDEX} live={false} />
      </View>
      <Hairline inset="gutter" />

      {/* ── Profit intelligence ── */}
      <View style={styles.firstSection}>
        <SoftPanel>
          <Eyebrow label="Profit intelligence" ai={figures !== null} />

          {figures === null ? (
            <>
              <Text variant="h1">No price estimate</Text>
              <Text variant="caption" color="inkMuted" style={styles.panelNote}>
                We did not get a resale range for this item. Set your own price below.
              </Text>
            </>
          ) : (
            <>
              <Text variant="eyebrow" color="inkMuted" style={styles.figureLabel}>
                Scrap value baseline
              </Text>
              <Text variant="h1" numberOfLines={2}>
                {formatTier(figures.scrapUsd, currency)}
              </Text>

              <View style={styles.panelRule}>
                <Hairline strong />
              </View>

              <Text variant="eyebrow" color="inkMuted" style={styles.figureLabel}>
                Potential profit
              </Text>
              <View style={styles.figureRow}>
                <TrendingUp size={icon.xl} color={c.accentInk} strokeWidth={2} />
                <Text variant="h1" color="accentInk" numberOfLines={2} style={styles.figureValue}>
                  {formatTier(figures.profitUsd, currency, { signed: true })}
                </Text>
              </View>

              {/*
                The one true thing we can say about these two numbers. It
                describes the figures, so it renders only with them — the empty
                state carries its own next step instead.
              */}
              <View style={styles.panelFoot}>
                <Info size={icon.md} color={c.inkSubtle} strokeWidth={1.8} />
                <Text variant="caption" color="inkMuted" style={styles.panelFootText}>
                  AI estimate — verify before publishing.
                </Text>
              </View>
            </>
          )}
        </SoftPanel>
      </View>

      <View style={styles.break}>
        <Hairline inset="gutter" />
      </View>

      {/* ── Price ── */}
      <View style={styles.section}>
        <Eyebrow label="Price" />

        <View style={styles.pillRow}>
          <PillButton
            label="Buy now"
            selected={buyNow}
            onPress={() => onFormat('buyNow')}
            accessibilityHint="Buyers pay your asking price"
            testID="v2-review-pricing-buynow"
          />
          <PillButton
            label="Make offer"
            selected={!buyNow}
            onPress={() => onFormat('offer')}
            accessibilityHint="Buyers name a price and you decide"
            testID="v2-review-pricing-offer"
          />
        </View>

        <View style={styles.amountRow}>
          {/*
            Progressive disclosure: an asking price is only meaningful under
            Buy now, and `detailSchema` requires it only there. Under Make offer
            the slot says what happens instead of leaving a hole — the row keeps
            its shape so the stepper does not jump sideways.
          */}
          {buyNow ? (
            <Field
              value={price}
              onChangeText={(t) => setPrice(cleanAmount(t))}
              onBlur={commitText}
              // decimal-pad, not numeric: `numeric` on Android offers a comma
              // on some locales, and the field only accepts a dot.
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0.00"
              returnKeyType="done"
              // The unit belongs to the field, not to the typing. Passing it as
              // `leading` also means it cannot be deleted or mistyped.
              leading={
                <Text variant="action" color="inkMuted">
                  {currency}
                </Text>
              }
              accessibilityLabel={`Asking price per unit, in ${currency}`}
              style={styles.amountField}
              testID="v2-review-pricing-amount"
            />
          ) : (
            <View style={styles.offerNote}>
              <Text variant="caption" color="inkMuted">
                Buyers send you an offer. You set the price when you accept one.
              </Text>
            </View>
          )}

          <Stepper
            value={item.quantity}
            onChange={onQuantity}
            label="Quantity"
            testID="v2-review-pricing-quantity"
          />
        </View>

        {/*
          CURRENCY stays visible under both formats, unlike the shipped card
          which hides it with the amount. The scrap and profit figures directly
          above are denominated in it, so it is never irrelevant on THIS screen.
        */}
        <View style={styles.currencyRow}>
          <Text variant="eyebrow" color="inkMuted" style={styles.currencyLabel}>
            Currency
          </Text>
          {CURRENCY_OPTIONS.map((opt) => (
            <PillButton
              key={opt.value}
              label={opt.label}
              selected={currency === opt.value}
              onPress={() => onCurrency(opt.value)}
              testID={`v2-review-pricing-currency-${opt.value}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.break}>
        <Hairline inset="gutter" />
      </View>

      {/* ── More details, closed by default ── */}
      <Row
        title="More details"
        subtitle="Optional · weight, size, CO₂, documents"
        onPress={() => {
          haptics.tap();
          setMoreOpen((v) => !v);
        }}
        trailing={
          moreOpen ? (
            <ChevronUp size={icon.lg} color={c.inkSubtle} strokeWidth={1.8} />
          ) : (
            <ChevronDown size={icon.lg} color={c.inkSubtle} strokeWidth={1.8} />
          )
        }
        accessibilityLabel={
          moreOpen
            ? 'More details, expanded. Weight, size, CO₂ and documents'
            : 'More details. Optional: weight, size, CO₂ and documents'
        }
        testID="v2-review-pricing-more"
      />

      {moreOpen ? (
        <View style={styles.moreSection}>
          <Field
            label="Weight"
            value={weight}
            onChangeText={setWeight}
            onBlur={commitText}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="e.g. 240"
            help="Kilograms per unit. Buyers use it to quote freight."
            testID="v2-review-pricing-weight"
          />
          <Field
            label="Dimensions"
            value={dimensions}
            onChangeText={setDimensions}
            onBlur={commitText}
            placeholder="e.g. 120 × 60 × 90 cm"
            testID="v2-review-pricing-dimensions"
          />
          <Field
            label="CO₂ emissions"
            value={co2}
            onChangeText={setCo2}
            onBlur={commitText}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="e.g. 1200"
            help="Kilograms saved by reusing this instead of scrapping it."
            testID="v2-review-pricing-co2"
          />
          {/*
            Read-only on purpose. Files are attached on 7b, where the photos and
            the source documents already are; a second attach control here would
            be the duplicate-entry-point trap.
          */}
          <Text variant="caption" color="inkSubtle">
            {item.documents.length === 0
              ? 'No documents attached. Add them with your photos in step 1.'
              : `${item.documents.length} document${item.documents.length === 1 ? '' : 's'} attached.`}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeline: { paddingHorizontal: GUTTER, paddingBottom: space['7xl'] },
  firstSection: { paddingHorizontal: GUTTER, paddingTop: space['7xl'] },
  section: { paddingHorizontal: GUTTER },
  moreSection: { paddingHorizontal: GUTTER, paddingTop: space['4xl'], gap: space['4xl'] },
  break: { marginVertical: space['7xl'] },

  // ── profit panel ──
  figureLabel: { marginBottom: space.sm },
  figureRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  figureValue: { flex: 1, minWidth: 0 },
  panelRule: { marginVertical: space['4xl'] },
  panelNote: { marginTop: space.xs },
  panelFoot: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    marginTop: space['4xl'],
  },
  panelFootText: { flex: 1, minWidth: 0 },

  // ── price ──
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    marginTop: space['3xl'],
  },
  amountField: { flex: 1, minWidth: 0 },
  offerNote: { flex: 1, minWidth: 0 },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space['3xl'],
  },
  currencyLabel: { marginRight: space.xs },

  // ── footer ──
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  footerQuiet: { flexShrink: 0, paddingHorizontal: space['5xl'] },
  footerPrimary: { flex: 1, minWidth: 0, borderRadius: radius.pill },
});
