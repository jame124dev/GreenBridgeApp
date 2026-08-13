// HomeEmptyState — what a BRAND-NEW account sees under the Home composer.
//
// ⚠️ THE PROBLEM THIS FIXES (owner-reported 2026-08-13).
// Both Home sections hid themselves when they had no data:
//
//   HomeRecentListings:  if (!listings.length && !allDrafts.length) return null;
//   HomeRecentWants:     if (!wants.length) return null;
//
// Sensible for a returning user with nothing to show. But a user who has JUST
// signed up has no listings, no drafts and no wants — so the whole lower half of
// their first screen was blank space. Their first impression of the app was a
// greeting, a text box, and a void: nothing told them what this app is for or
// what to do next.
//
// So the empty case now TEACHES instead of hiding. Deliberately mode-aware,
// because the two answers are completely different:
//   sell → the pitch is the AI ("photograph it, we write the listing")
//   buy  → the pitch is the catalogue, so hand them real searches to tap
//
// UX_DESIGN_RULES: exactly one dominant action per mode; every tappable does
// something real (no decoration); nothing here can be reached without the data
// having actually loaded (callers render this only after loading/error are
// handled), so it never flashes over a spinner.
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Camera, FileText, Search, Sparkles } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';

const greenDarkest = '#14452f';
const buyBlue = '#2563eb';

/** Buy-mode starters. Real queries, not placeholders — tapping one searches. */
const BUY_SUGGESTIONS = [
  { key: 'centrifuge', q: 'centrifuge' },
  { key: 'hplc', q: 'HPLC system' },
  { key: 'microscope', q: 'microscope' },
  { key: 'freezer', q: 'lab freezer' },
  { key: 'incubator', q: 'CO2 incubator' },
  { key: 'balance', q: 'analytical balance' },
] as const;

type Props = {
  mode: 'buy' | 'sell';
  /** Sell: start the photo flow. Gated downstream by launchSellerScan(). */
  onStartListing: () => void;
  /** Buy: run one of the starter searches (sends it as a turn). */
  onSuggestion: (query: string) => void;
};

export function HomeEmptyState({ mode, onStartListing, onSuggestion }: Props) {
  const { t } = useTranslation();

  if (mode === 'sell') {
    return (
      <View className="mt-2xl">
        <View className="rounded-2xl border border-neutral-200 bg-white px-lg py-lg">
          <View className="flex-row items-center gap-sm mb-sm">
            <Sparkles size={18} color={greenDarkest} strokeWidth={2.2} />
            <Text variant="body" tone="primary" className="font-bold" accessibilityRole="header">
              {t('mobile.labHome.empty.sellTitle', {
                defaultValue: 'Turn a photo into a listing',
              })}
            </Text>
          </View>
          <Text variant="bodySm" tone="secondary" className="mb-md">
            {t('mobile.labHome.empty.sellBody', {
              defaultValue:
                'Photograph your equipment and the AI writes the title, specs and description. You review it before anything goes live.',
            })}
          </Text>

          {/* Three steps, so the value is obvious before they commit to a tap. */}
          <View className="gap-sm mb-lg">
            <Step n="1" text={t('mobile.labHome.empty.sellStep1', { defaultValue: 'Take a photo' })} />
            <Step n="2" text={t('mobile.labHome.empty.sellStep2', { defaultValue: 'AI drafts the listing' })} />
            <Step n="3" text={t('mobile.labHome.empty.sellStep3', { defaultValue: 'You check it and publish' })} />
          </View>

          <Pressable
            onPress={() => {
              haptics.impact();
              onStartListing();
            }}
            className="flex-row items-center justify-center gap-sm rounded-xl py-md active:opacity-80"
            style={{ backgroundColor: greenDarkest }}
            accessibilityRole="button"
          >
            <Camera size={18} color="#fff" strokeWidth={2.2} />
            <Text variant="body" className="font-bold" style={{ color: '#fff' }}>
              {t('mobile.labHome.empty.sellCta', { defaultValue: 'Photograph equipment' })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- buy ------------------------------------------------------------------
  return (
    <View className="mt-2xl">
      <View className="flex-row items-center gap-sm mb-sm">
        <Search size={17} color={buyBlue} strokeWidth={2.2} />
        <Text variant="body" tone="primary" className="font-bold" accessibilityRole="header">
          {t('mobile.labHome.empty.buyTitle', { defaultValue: 'Not sure where to start?' })}
        </Text>
      </View>
      <Text variant="bodySm" tone="secondary" className="mb-md">
        {t('mobile.labHome.empty.buyBody', {
          defaultValue: 'Tap one to search, or describe what you need in your own words above.',
        })}
      </Text>

      <View className="flex-row flex-wrap gap-sm">
        {BUY_SUGGESTIONS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => {
              haptics.tap();
              onSuggestion(s.q);
            }}
            className="rounded-full border border-neutral-200 bg-white px-md py-sm active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={s.q}
          >
            <Text variant="bodySm" tone="primary" className="font-semibold">
              {t(`mobile.labHome.empty.suggest.${s.key}`, { defaultValue: s.q })}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-lg flex-row items-start gap-sm">
        <FileText size={15} color="#55665e" strokeWidth={2} />
        <Text variant="caption" tone="secondary" className="flex-1">
          {t('mobile.labHome.empty.buyHint', {
            defaultValue:
              "Can't find it? Tell us what you're looking for and we'll alert you when it's listed.",
          })}
        </Text>
      </View>
    </View>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View className="flex-row items-center gap-sm">
      <View
        className="h-[22px] w-[22px] items-center justify-center rounded-full"
        style={{ backgroundColor: '#e6f2eb' }}
      >
        <Text variant="caption" className="font-bold" style={{ color: greenDarkest }}>
          {n}
        </Text>
      </View>
      <Text variant="bodySm" tone="secondary">
        {text}
      </Text>
    </View>
  );
}
