/**
 * Published — the moment after a seller submits.
 *
 * Shape, top to bottom:
 *
 *   ┌ green wash sheet ───────────────────────────────────────┐
 *   │  (✓)                                                    │
 *   │  Sent for review                                        │
 *   │  Our team checks every listing before it goes live.     │
 *   │  BATCH 6902 · 4 ITEMS                                   │
 *   └─────────────────────────────────────────────────────────┘
 *      What happens next            (timeline, 3 steps)
 *      ( View my listings )         primary
 *      List something else          quiet
 *
 * ── WHY THIS SCREEN EXISTS ────────────────────────────────────────────────
 *
 * Publishing used to `toast.success(...)` and `router.replace('/v2')`. Two
 * problems with that, and the second is the real one:
 *
 *  1. Home is a thin landing for the most significant thing a seller does.
 *  2. **It threw the batch number away.** `useCreateListing` returns
 *     `{ batchPk, batchNumber, productId }` and the grouped mutation returns the
 *     same plus `itemCount`; the v2 `onSuccess` took only a COUNT and discarded
 *     the response. The batch number is what a seller quotes when they ask about
 *     their listing later — losing it is losing the one fact the moment was for.
 *
 * The alternative was `routes.scanSuccess(...)`, which is richer and already
 * carries the batch number — but it is drawn in the OLD chrome, and dropping a
 * seller out of v2 at the most triumphant moment is the complaint that has been
 * raised repeatedly ("it goes back to the previous version").
 *
 * ── NO STEP CHROME ────────────────────────────────────────────────────────
 *
 * Publish is not a numbered step in either spine (`spine.ts`), so this screen
 * sits PAST the flow and draws no step header and no progress. Chrome belonging
 * to a state must not render outside that state.
 *
 * Params are strings — everything through `expo-router` is — so `batchNumber`
 * is rendered as given and never arithmetic'd.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';

import {
  PrimaryAction,
  QuietAction,
  Row,
  Screen,
  SectionHeader,
  Text,
  Timeline,
} from '@/features/v2/ui';
import { icon, radius, space, useV2Colors } from '@/theme/v2';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';

/**
 * One param value, whatever the router hands over.
 *
 * `useLocalSearchParams` is typed `string` here but returns `string | string[]`
 * at RUNTIME — a duplicated query key (`?batchNumber=1&batchNumber=2`, reachable
 * from a deep link or a restored URL) yields an array. `.trim()` on an array
 * throws, which would white-screen someone who has just published: the worst
 * possible moment for a crash, and the generic hides it from `tsc`.
 */
function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

/**
 * The three things that happen after a seller submits, in order.
 *
 * Keys, not strings — and built inside the component rather than at module
 * scope, because a module-level array is evaluated once at import and would
 * freeze whichever language was active then. Switching language with the EN
 * chip would leave this rail in the old one.
 */
const NEXT_STEPS = [
  { key: 'reviewIt', detailKey: 'reviewItDetail' },
  { key: 'goesLive', detailKey: 'goesLiveDetail' },
  { key: 'getOffers', detailKey: 'getOffersDetail' },
] as const;

export default function PublishedScreen() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    batchNumber?: string;
    count?: string;
    titles?: string;
  }>();

  const batchNumber = firstParam(params.batchNumber).trim();
  const count = Number.parseInt(firstParam(params.count) || '1', 10);
  const itemCount = Number.isFinite(count) && count > 0 ? count : 1;

  /**
   * Titles arrive JSON-encoded. A malformed param must not take the screen
   * down — a seller who has just published is the last person who should see a
   * crash, so this degrades to "no list" and the rest of the screen stands.
   */
  const titles = React.useMemo<string[]>(() => {
    // Normalised for the same reason as the two above — an array here would
    // land in `JSON.parse` as "a,b", which throws into the catch rather than
    // crashing, but returns [] for a perfectly good list.
    const raw = firstParam(params.titles);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch {
      return [];
    }
  }, [params.titles]);

  /**
   * The eyebrow is the receipt. It is deliberately assembled from what we
   * actually have: with no batch number it says only the item count rather than
   * printing "BATCH ·" with a hole in it.
   */
  const receipt = [
    batchNumber ? t('mobile.scanv2.published.batch', { number: batchNumber }) : null,
    /**
     * PLURALISED, not a bare "{{count}} items". i18next picks `_one`/`_other`
     * from `count`, and languages here do not agree about plurals at all —
     * Japanese, Thai, Vietnamese and both Chinese variants have no plural form,
     * so their single entry is correct rather than a missing translation.
     *
     * `count` must be a NUMBER; passing a string silently skips the plural
     * resolution and renders the key.
     */
    itemCount > 1 ? t('mobile.scanv2.published.itemCount', { count: itemCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const header = (
    <View>
      {/*
        ⚠️ `accentInk`, NOT `accent`. Measured on this palette: `accent` on
        `accentWash` is 4.23:1 in light but **2.33:1 in dark**, under the 3:1
        WCAG 1.4.11 asks of a meaningful graphic — so the one glyph that says
        "it worked" was a faint green smudge on a faint green disc for anyone in
        dark. `accentInk` is 6.09:1 / 6.03:1. `TabBar.tsx` already documents the
        identical swap for the identical reason.

        It survived a dark-mode device pass because it was eyeballed off a
        screenshot and called legible; nothing measured this pair —
        `v2Contrast.test.ts` only checks accent against the three GROUNDS
        (`base`/`surface`/`wash`), and `accentWash` is not one of them.

        Hidden from assistive tech: it is decorative, and the heading beside it
        already says "Sent for review".
      */}
      {/* flat: a confirmation mark — it reports an outcome, it is not pressed. */}
      <View
        style={[styles.badge, { backgroundColor: c.accentWash }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Check size={icon.xl} color={c.accentInk} strokeWidth={2.2} />
      </View>

      <Text variant="h1">{t('mobile.scanv2.published.title')}</Text>

      <Text variant="body" color="inkMuted" style={styles.sub}>
        {t('mobile.scanv2.published.body')}
      </Text>

      {receipt ? (
        <Text variant="eyebrow" color="accentInk" style={styles.receipt}>
          {receipt}
        </Text>
      ) : null}
    </View>
  );

  /**
   * The actions are the FOOTER, not the end of the scroll.
   *
   * First pass put them inline after the timeline, and on a 2400px device that
   * left roughly the bottom 45% of the screen empty — which reads as broken
   * rather than as minimal, and pushes the primary action into the middle of
   * the screen where it is neither anchored nor comfortably reachable.
   */
  const footer = (
    <View style={styles.footer}>
      <PrimaryAction
        label={t('mobile.scanv2.published.viewListings')}
        onPress={() => {
          haptics.tap();
          router.replace(routes.v2Listings);
        }}
      />
      <QuietAction
        label={t('mobile.scanv2.published.listAnother')}
        onPress={() => {
          haptics.tap();
          router.replace(routes.v2Home);
        }}
      />
    </View>
  );

  return (
    <Screen header={header} footer={footer} tabBar={false} testID="v2-published">
      <SectionHeader title={t('mobile.scanv2.published.nextTitle')} />
      <Timeline
        steps={NEXT_STEPS.map((s) => ({
          label: t(`mobile.scanv2.published.${s.key}`),
          detail: t(`mobile.scanv2.published.${s.detailKey}`),
        }))}
        current={0}
      />

      {/* What was actually submitted. Absent rather than an empty shell when
          there are no titles — a heading over nothing says less than nothing. */}
      {titles.length > 0 ? (
        <View style={styles.batch}>
          <SectionHeader
            title={t(
              titles.length > 1
                ? 'mobile.scanv2.published.inThisBatch'
                : 'mobile.scanv2.published.yourListing',
            )}
          />
          {titles.map((title, i) => (
            <Row key={`${title}-${i}`} title={title} titleLines={2} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space['5xl'],
  },
  sub: { marginTop: space.md, maxWidth: 300 },
  receipt: { marginTop: space['3xl'] },
  footer: { gap: space.lg },
  batch: { marginTop: space['6xl'] },
});
