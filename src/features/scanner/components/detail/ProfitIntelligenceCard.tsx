import { Text, View } from 'react-native';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info, TrendingUp } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import { convertPrice, formatCurrency } from '@/features/scanner/currencyFx';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { AiPriceTier, AiPrices } from '@/features/scanner/smartDetectionTypes';
import type { SupportedCurrency } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

// Static fallbacks for the case where the AI didn't return tier prices. Both
// are USD canonical — `formatCurrency` converts to the current pill at render
// time so toggling USD↔TWD updates the card in-place. Once we trust the API
// always returns tier prices we can drop these.
const STATIC_SCRAP_BASELINE_USD = 12_500;
const STATIC_POTENTIAL_PROFIT_USD = 4_200;
const STATIC_PROFIT_PERCENT = 33;
// AI-suggested marketplace fallback. The card prefers the seller's current
// `marketplace` choice when no AI hint is available.
const STATIC_SUGGESTED_MARKETPLACE = '101machine' as const;

const ECO_TEAL = '#00B289';
const ECO_TEAL_SURFACE = '#E6F7F1';
const MONO_FONT = 'JetBrainsMono_400Regular';

type Props = {
  /**
   * AI-derived tier prices from `mapSmartDetection` / `mapAnalyze`. When
   * provided AND the bundle has both `scrap` and `used`, the card computes
   * scrap baseline / potential profit / percent uplift live. Missing or
   * incomplete bundles fall back to the static stub so the card never
   * renders half-empty.
   */
  aiPrices?: AiPrices | null;
};

type DerivedFigures = {
  /** Canonical USD scrap-value range for display. min===max for point values. */
  scrapUsd: AiPriceTier;
  /** Canonical USD potential-profit range (sell-on-marketplace − scrap). */
  profitUsd: AiPriceTier;
  /** Integer percent uplift over scrap (midpoint-based). Capped at 999. */
  percent: number;
  /** Marks the card with the "AI" badge in the header. */
  fromAi: boolean;
};

/** Midpoint of a price tier — used for percent calculations. */
function midpoint(t: AiPriceTier): number {
  return (t.min + t.max) / 2;
}

/**
 * Compute the USD-canonical figures the card displays. Pulls from the AI
 * bundle when available; falls back to the static stub. Ranges are preserved
 * end-to-end so the card shows "$5,000 – $10,000" when the AI is uncertain,
 * and collapses to a single figure when the AI returns a point estimate. The
 * percent uplift uses midpoints to keep the insight sentence tidy (one
 * number rather than a range).
 */
function deriveFigures(aiPrices: AiPrices | null | undefined): DerivedFigures {
  // Require BOTH scrap and used to derive — used-only or scrap-only can't
  // power a "you'd make N% more" claim. Fall back to static stub otherwise.
  if (aiPrices && aiPrices.scrap != null && aiPrices.used != null) {
    const scrapSrc = aiPrices.scrap;
    const usedSrc = aiPrices.used;
    // Normalize the source currency to USD canonical so the rest of the card
    // (which formats through the current pill) stays consistent regardless
    // of AI source unit.
    const scrapUsd: AiPriceTier = {
      min: convertPrice(scrapSrc.min, aiPrices.currency, 'USD'),
      max: convertPrice(scrapSrc.max, aiPrices.currency, 'USD'),
    };
    const usedUsd: AiPriceTier = {
      min: convertPrice(usedSrc.min, aiPrices.currency, 'USD'),
      max: convertPrice(usedSrc.max, aiPrices.currency, 'USD'),
    };
    // Profit range bounds: lowest possible profit is `used.min - scrap.max`
    // (worst-case marketplace, best-case scrap); highest possible profit is
    // `used.max - scrap.min`. Floor at 0 so the bottom never reads negative
    // — a "potential profit" can't be a loss in the card's framing.
    const profitUsd: AiPriceTier = {
      min: Math.max(0, usedUsd.min - scrapUsd.max),
      max: Math.max(0, usedUsd.max - scrapUsd.min),
    };
    // Midpoint percent — one number for the insight copy, ignoring the
    // range so the sentence reads naturally.
    const scrapMid = midpoint(scrapUsd);
    const profitMid = midpoint(profitUsd);
    const rawPct = scrapMid > 0 ? Math.round((profitMid / scrapMid) * 100) : 0;
    return {
      scrapUsd,
      profitUsd,
      percent: Math.min(rawPct, 999),
      fromAi: true,
    };
  }
  // Static stub — wrap the point values in a tier so the formatting helper
  // doesn't need to branch on shape.
  const stubScrap: AiPriceTier = {
    min: STATIC_SCRAP_BASELINE_USD,
    max: STATIC_SCRAP_BASELINE_USD,
  };
  const stubProfit: AiPriceTier = {
    min: STATIC_POTENTIAL_PROFIT_USD,
    max: STATIC_POTENTIAL_PROFIT_USD,
  };
  return {
    scrapUsd: stubScrap,
    profitUsd: stubProfit,
    percent: STATIC_PROFIT_PERCENT,
    fromAi: false,
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
 * AI-derived scrap floor + potential uplift on the recommended marketplace.
 * Renders above PricingCard in detail/grouped-edit. When the AI didn't
 * return tier prices, falls back to a static stub so the card still
 * communicates the concept rather than disappearing.
 */
export function ProfitIntelligenceCard({ aiPrices }: Props) {
  const { t } = useTranslation();
  const { watch } = useFormContext<DetailFormInput>();
  const priceCurrency = watch('priceCurrency');
  const marketplace = watch('marketplace');

  const { scrapUsd, profitUsd, percent, fromAi } = deriveFigures(aiPrices);

  const scrapDisplay = formatTier(scrapUsd, priceCurrency);
  const profitDisplay = formatTier(profitUsd, priceCurrency, { signed: true });

  // Prefer the seller's current marketplace selection over the static
  // suggestion — the card stays in sync as they tap a different pill.
  const suggestedKey = marketplace ?? STATIC_SUGGESTED_MARKETPLACE;
  const suggestedLabel =
    MARKETPLACE_OPTIONS.find((m) => m.value === suggestedKey)?.label ??
    String(suggestedKey).toUpperCase();

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
        {fromAi ? (
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

      {/* Stacked stats — side-by-side caused overlap at TWD scale where the
          right column's "+NT$ 132,300" with the up-arrow ran into the left
          column's "NT$ 393,750". Vertical layout is robust at any amount. */}
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

      {/* Info row with the AI-suggested marketplace + percent uplift */}
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
          {t('mobile.detail.profitInsight', {
            defaultValue:
              'Selling on {{marketplace}} could earn you {{percent}}% more than scrap value alone.',
            marketplace: suggestedLabel,
            percent,
          })}
        </Text>
      </View>
    </View>
  );
}
