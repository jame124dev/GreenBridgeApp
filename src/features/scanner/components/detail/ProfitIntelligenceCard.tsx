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

  return (
    <View
      className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl"
      style={{ gap: 16 }}
    >
      {/* Header row: trend icon + mono caps title + optional AI badge */}
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
          <TrendingUp size={16} color={ECO_TEAL} strokeWidth={2.5} />
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
            <MaterialIcons name="auto-awesome" size={11} color={brand.primary} />
            <Text className="font-label text-brand-primary" style={{ fontSize: 10 }}>
              {t('mobile.detail.aiBadge', { defaultValue: 'AI' })}
            </Text>
          </View>
        ) : null}
      </View>

      {figures === null ? (
        /* Honest empty state (UX_DESIGN_RULES "Empty states": never a blank or a
           fabricated panel — say what happened and where to go next). The AI
           returned no scrap/used pair for this item, so there is nothing to show
           and PricingCard directly below is where the seller sets the number. */
        <View style={{ gap: 4 }}>
          <Text className="font-semi text-2xl text-brand-foreground">
            {t('mobile.detail.profitNoEstimate', { defaultValue: 'No price estimate' })}
          </Text>
          <Text className="font-sans text-base text-brand-text-muted" style={{ lineHeight: 18 }}>
            {t('mobile.detail.profitNoEstimateHint', {
              defaultValue:
                'The AI did not return a resale range for this item. Set your own price below.',
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
              <TrendingUp size={20} color={ECO_TEAL} strokeWidth={2.5} />
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
          <Info size={16} color={ECO_TEAL} strokeWidth={2.5} style={{ marginTop: 1 }} />
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
