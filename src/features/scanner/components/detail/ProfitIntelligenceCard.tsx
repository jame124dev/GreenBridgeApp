import { Text, View } from 'react-native';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info, TrendingUp } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { convertPrice, formatCurrency } from '@/features/scanner/currencyFx';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { AiPriceTier, AiPrices } from '@/features/scanner/smartDetectionTypes';
import type { SupportedCurrency } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { ICON } from './metrics';

const ECO_TEAL = '#00B289';
const ECO_TEAL_SURFACE = '#E6F7F1';
const MONO_FONT = 'JetBrainsMono_400Regular';

type Props = {
  /**
   * AI-derived tier prices from `mapSmartDetection` / `mapAnalyze`. When the
   * bundle carries BOTH `scrap` and `used`, the card computes the scrap baseline
   * and the potential-profit range live. Anything else — null, or only one of the
   * two tiers — renders the card's "No price estimate" state (M-5). There is no
   * fabricated-fallback path any more.
   */
  aiPrices?: AiPrices | null;
};

type DerivedFigures = {
  /** Canonical USD scrap-value range for display. min===max for point values. */
  scrapUsd: AiPriceTier;
  /** Canonical USD potential-profit range (resale − scrap). */
  profitUsd: AiPriceTier;
};

/**
 * Compute the USD-canonical figures the card displays, or NULL when the AI did
 * not return both a scrap and a used tier.
 *
 * M-5: there is no fabricated fallback any more. The old one rendered
 * $12,500 / $4,200 / 33% — three numbers nobody had measured — with the AI badge
 * hidden, so it read as analysis (SCAN_FLOW_BACKEND.md §3, MULTI_MARKETPLACE_PLAN
 * §1 item 3). Missing tiers now produce an honest empty state.
 *
 * The percent uplift is gone too, and not because of a rendering bug: it was
 * `round(profitMid / scrapMid × 100)` capped at 999, and over 72 real DEV
 * responses the MEDIAN was 999 with 45/72 (63%) hitting the cap
 * (SCAN_FLOW_BACKEND.md:389). A number that is usually its own display ceiling is
 * not information. It comes back when the scrap figure is grounded in something
 * other than the model's guess — a separate project (plan §9).
 */
function deriveFigures(aiPrices: AiPrices | null | undefined): DerivedFigures | null {
  // Require BOTH scrap and used: a used-only or scrap-only bundle cannot produce
  // a profit range at all.
  if (!aiPrices || aiPrices.scrap == null || aiPrices.used == null) return null;
  const scrapSrc = aiPrices.scrap;
  const usedSrc = aiPrices.used;
  // Normalize to USD canonical so the rest of the card (which formats through the
  // current currency pill) stays consistent regardless of the AI's source unit.
  const scrapUsd: AiPriceTier = {
    min: convertPrice(scrapSrc.min, aiPrices.currency, 'USD'),
    max: convertPrice(scrapSrc.max, aiPrices.currency, 'USD'),
  };
  const usedUsd: AiPriceTier = {
    min: convertPrice(usedSrc.min, aiPrices.currency, 'USD'),
    max: convertPrice(usedSrc.max, aiPrices.currency, 'USD'),
  };
  // Lowest possible profit is `used.min - scrap.max`, highest is
  // `used.max - scrap.min`. Floor at 0 so the bottom never reads as a loss.
  return {
    scrapUsd,
    profitUsd: {
      min: Math.max(0, usedUsd.min - scrapUsd.max),
      max: Math.max(0, usedUsd.max - scrapUsd.min),
    },
  };
}

/**
 * Format a USD-canonical price tier for display in the user's currency. A
 * point tier (min === max) renders as a single figure; a true range renders
 * with an en-dash and the prefix on both ends ("$5,000 – $10,000").
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

/**
 * Profit Intelligence card — anchors the seller's pricing decision on the
 * AI-derived scrap floor + the potential uplift over scrapping the item.
 * Renders above PricingCard in detail/grouped-edit. When the AI didn't return
 * tier prices the card says so ("No price estimate") and points the seller at
 * PricingCard below; it no longer invents figures to fill the space (M-5).
 *
 * The card does NOT read `marketplace`. It used to, to render an
 * "AI-suggested marketplace" that was really the seller's own current choice —
 * circular the moment the AI can write that field.
 */
export function ProfitIntelligenceCard({ aiPrices }: Props) {
  const { t } = useTranslation();
  const { watch } = useFormContext<DetailFormInput>();
  const priceCurrency = watch('priceCurrency');

  const figures = deriveFigures(aiPrices);

  // Guarded because `const` cannot be declared inside JSX; `figures` is narrowed
  // to non-null in the branch that renders them, so '' is never displayed.
  const scrapDisplay = figures ? formatTier(figures.scrapUsd, priceCurrency) : '';
  const profitDisplay = figures
    ? formatTier(figures.profitUsd, priceCurrency, { signed: true })
    : '';

  /*
    NO FIGURES → NO CARD.

    M-5 removed a fabricated $12,500 / $4,200 / 33% and put an honest empty
    state in its place, which was right: the fix for an invented number is to
    stop inventing it. But the honest alternative to a made-up figure is
    SILENCE, not a card announcing that there is nothing to say — and this one
    sat on an already text-dense form telling the seller "set your own price
    below" directly above the Price card, which is where they were going
    anyway and which asks for the number itself.

    The anti-fabrication rule is untouched: when the AI returns both a scrap
    and a used tier the card renders exactly as before, badge and all. It only
    disappears in the case where it had nothing to contribute.
  */
  if (figures === null) return null;

  return (
    <View
      className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl"
      style={{ gap: 16 }}
    >
      {/*
        THE HEADER IS FOR A RESULT, SO IT ONLY RENDERS WITH ONE.

        "PROFIT INTELLIGENCE" in mono caps, with a teal badge, above the words
        "No price estimate", spent a branded three-line header announcing that
        there was nothing to announce. On a form that already stacks eight
        bordered cards of caps labels and hint text, the emptiest card was
        drawing the most chrome.

        With no figures the card is now one line. Nothing is lost: "No price
        estimate — set your own below" needs no heading to be understood.
      */}
      {figures === null ? null : (
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: ECO_TEAL_SURFACE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TrendingUp size={ICON.adornment} color={ECO_TEAL} strokeWidth={2.5} />
        </View>
        <Text
          style={{
            fontFamily: MONO_FONT,
            fontSize: 12,
            lineHeight: 16,
            letterSpacing: 0.8,
            color: brand.foreground,
            textTransform: 'uppercase',
          }}
        >
          {t('mobile.detail.profitIntelligence', {
            defaultValue: 'Profit intelligence',
          })}
        </Text>
        {figures ? (
          <View
            className="flex-row items-center bg-brand-primary-accent px-1.5 rounded-xs"
            style={{ gap: 2, paddingVertical: 1 }}
          >
            <MaterialIcons name="auto-awesome" size={ICON.inline} color={brand.primary} />
            <Text className="font-label text-brand-primary" style={{ fontSize: 10 }}>
              {t('mobile.detail.aiBadge', { defaultValue: 'AI' })}
            </Text>
          </View>
        ) : null}
      </View>
      )}

      {figures === null ? (
        /*
          Honest empty state (UX_DESIGN_RULES "Empty states": never a blank or a
          fabricated panel — say what happened and where to go next). The AI
          returned no scrap/used pair for this item, so there is nothing to show
          and PricingCard directly below is where the seller sets the number.

          ── SHAPE TAKEN FROM react-native-reusables (MIT, 2025 Founded Labs) ──
          `ui_git_repo/rnr`, registry file
          `@rnr/registry/src/nativewind/components/ui/alert.tsx` — its Alert:
          icon absolutely positioned top-left, title and description indented
          past it (`pl-6`), tight asymmetric padding (`pt-3.5 pb-2`), title at
          normal weight with `leading-none`, description at `text-sm` muted.

          The FILE was not copied: it renders through `@/registry/...` `Icon`,
          `Text`, `TextClassContext` and `cn`, so vendoring it means four more
          modules to replace what is a ten-line block here. The GEOMETRY is what
          was worth having, and that is what is applied.

          Why it changed at all: at `text-2xl` the headline announced "No price
          estimate" at the same visual weight the card uses for a real figure —
          the loudest thing in the card was the absence of information, and it
          pushed PricingCard, the thing the seller actually needs, further down
          a long form. Now it reads as a note, not a result.
        */
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Info size={ICON.adornment} color={brand.textMuted} strokeWidth={2} />
          <Text className="flex-1 font-sans text-base text-brand-text-muted">
            {t('mobile.detail.profitNoEstimateShort', {
              defaultValue: 'No price estimate — set your own below.',
            })}
          </Text>
        </View>
      ) : (
        /* Stacked stats — side-by-side caused overlap at TWD scale where the
           right column's "+NT$ 132,300" with the up-arrow ran into the left
           column's "NT$ 393,750". Vertical layout is robust at any amount. */
        <View style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text
              style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                lineHeight: 14,
                letterSpacing: 0.6,
                color: brand.textMuted,
                textTransform: 'uppercase',
              }}
            >
              {t('mobile.detail.scrapValueBaseline', {
                defaultValue: 'Scrap value baseline',
              })}
            </Text>
            <Text
              className="font-bold"
              style={{
                fontSize: 22,
                lineHeight: 28,
                color: brand.foreground,
              }}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {scrapDisplay}
            </Text>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: brand.border,
              marginVertical: 2,
            }}
          />

          <View style={{ gap: 4 }}>
            <Text
              style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                lineHeight: 14,
                letterSpacing: 0.6,
                color: brand.textMuted,
                textTransform: 'uppercase',
              }}
            >
              {t('mobile.detail.potentialProfit', {
                defaultValue: 'Potential profit',
              })}
            </Text>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <TrendingUp size={ICON.field} color={ECO_TEAL} strokeWidth={2.5} />
              <Text
                className="font-bold flex-1"
                style={{
                  fontSize: 22,
                  lineHeight: 28,
                  color: ECO_TEAL,
                }}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {profitDisplay}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* M-5: was "Selling on {{marketplace}} could earn you {{percent}}% more than
          scrap value alone." Deleted: the percent hit its own 999 cap in 63% of
          real responses, and `{{marketplace}}` was the seller's own current choice
          dressed up as an AI suggestion. What is left is the one true thing we can
          say about these numbers.

          Gated on `figures` — the disclaimer used to sit OUTSIDE the ternary, so
          the empty state read "No price estimate" and then, two lines below,
          "AI estimate — verify before publishing" about an estimate that does not
          exist. It describes the figures, so it only renders with them. Kept as a
          separate guard rather than a fragment inside the ternary so the diff is
          this block and nothing else; the empty state already carries its own
          next-step line ("Set your own price below"). */}
      {figures !== null && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            backgroundColor: ECO_TEAL_SURFACE,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <Info size={ICON.adornment} color={ECO_TEAL} strokeWidth={2.5} style={{ marginTop: 1 }} />
          <Text
            className="flex-1"
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 18,
              color: brand.foreground,
            }}
          >
            {t('mobile.detail.profitAiEstimate', {
              defaultValue: 'AI estimate — verify before publishing',
            })}
          </Text>
        </View>
      )}
    </View>
  );
}
