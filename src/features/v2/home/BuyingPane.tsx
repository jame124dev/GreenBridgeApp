/**
 * 6b — Home (buying). The other half of 6a, not another page.
 *
 * Shape, top to bottom (docs/v2-design/screens/6b.html):
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [G] GREENBIDZ                            EN   bell•    │
 *   │  Selling   Buying                                       │
 *   │  What are you                                           │
 *   │  looking for?                                           │
 *   │  Type the spec and we watch the market for it.          │
 *   │  (  Type it  )                                          │
 *   │         or browse the open lots                         │
 *   └─────────────────────────────────────────────────────────┘
 *      (  Ask the assistant                              › )     tinted row
 *      [ photo · scrim · FOR BUYERS · Skip the valuation… ]      banner
 *      YOUR WANTS                                     See all 3
 *      [] Shimadzu LC-20                             2 matches
 *      ────────────────────────────────────────────────────────
 *      [] Agilent 1260 Infinity                             ›
 *      MATCHED FOR YOU                                See all 4
 *      [] Shimadzu LC-20AD pump set                         ›
 *
 * ONE SCREEN, TWO MODES. 6a and this file share the header sheet, the brand
 * bar and the Selling/Buying tab row, in the same position, so switching reads
 * as a mode change and not as a page change. The tabs `router.navigate` rather
 * than `push`: navigate pops back to the sibling when it is already in the
 * history, so toggling ten times leaves a two-deep stack instead of eleven.
 *
 * DATA — read real, write later (skill § Data).
 *   `useWants()`               → GET /wtb                  (the saved wants)
 *   `useQueries(wantMatches)`  → GET /wtb/{id}/matches      (one per want)
 * The per-want queries use the SAME keys as 6d Matches and `useMatchesBadge`
 * (`labKeys.wantMatches(id)`), so whichever surface mounts first fills the
 * cache and this one costs no extra round-trips. `useMatches()` was the other
 * candidate for the second section, but it fetches the same rows again under
 * its own key (`labKeys.matches()`) — two identical trips for one screen.
 *
 * Nothing here writes. Creating a want, pausing one and bidding are all
 * `TODO(v2-writes)`; the destinations that are not drawn yet are
 * `TODO(v2-nav)`.
 *
 * GUEST MODE stays live. A guest sees the header, the assistant row and the
 * banner — browsing and the assistant are not account features (Guideline
 * 5.1.1(v)) — and the two account-scoped sections are simply absent rather
 * than being a wall. The wants queries live in a CHILD component so a guest
 * never fires an authenticated GET /wtb, and signing in mounts them fresh
 * instead of changing this component's hook count mid-life. The sign-in sheet
 * itself is mounted once in `app/v2/_layout.tsx`, not here.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { ImageIcon, PenLine, Search, Sparkles } from 'lucide-react-native';

import {
  Chip,
  Hairline,
  PrimaryAction,
  PromoBanner,
  QuietAction,
  Row,
  RowThumb,
  RowTrailing,
  SectionHeader,
  SectionNote,
  Text,
  TintedRow,
} from '@/features/v2/ui';

import { PaneShell } from './PaneShell';
import { GUTTER, SECTION_GAP, icon, space, useV2Colors } from '@/theme/v2';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { useWants } from '@/features/lab/hooks/useWants';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { listWantMatches, type WtbListItem, type WtbMatch } from '@/features/lab/data/wtbApi';
import { priceLabel } from '@/features/lab/data/matchesFromApi';
import { countryLabel } from '@/features/lab/chat/cardKit';
import {
  formatWantDate,
  isActiveStatus,
  matchToProductVM,
  sortMatchesStrongest,
  statusLabel,
} from '@/features/lab/wants/data/wantsView';
import { WTB_ENABLED } from '@/lib/flags';
import { useComposer } from '@/features/lab/stores/composerStore';
import { haptics } from '@/lib/haptics';

/** The canvas shows two rows per section, on both modes of this screen. */
const PREVIEW_ROWS = 2;


/**
 * The banner photograph. The canvas points at
 * `uploads/Skip the valuation- image.avif`, which is not in the repo — the
 * asset has to come across from the design canvas. Until it does the banner
 * falls back to a flat `scrimFallback` ground under the same scrim, so the
 * caption keeps its contrast and the block keeps its place. Same treatment as
 * 6a's seller banner.
 */
const BANNER_PHOTO: string | null = null;

// ── Real-data copy ─────────────────────────────────────────────────────────

/**
 * The line under a want's title: what it is watching for. Composed from
 * whatever the want actually carries — a real want often has only some of it.
 *
 * Deliberately NOT `frequencyLabel` at the end as 6d does. 6d is the wants
 * screen, where the cadence is something you manage; here the line answers
 * "what am I watching for", and a home preview truncates to one line.
 */
function wantCriteria(want: WtbListItem): string {
  const bits: string[] = [];
  const max = Number(want.max_price);
  if (Number.isFinite(max) && max > 0) bits.push(`Under ${priceLabel(max, want.price_currency)}`);
  const where = countryLabel(want.country_wanted);
  if (where) bits.push(where);
  const what = (want.category_name ?? '').trim() || (want.keywords ?? []).filter(Boolean)[0];
  if (what) bits.push(String(what));
  return bits.join(' · ');
}

/**
 * A want that is not alerting: why, and when it was saved. Drawn as
 * "Paused · saved 4 Aug".
 *
 * `statusLabel` rather than a hardcoded "Paused": the API's status set is
 * active / paused / fulfilled / expired / deleted, so a fulfilled or expired
 * want would otherwise sit here claiming to be paused.
 */
function dormantSubtitle(want: WtbListItem): string {
  const saved = formatWantDate(want.created_at);
  return [statusLabel(want.status), saved ? `saved ${saved}` : ''].filter(Boolean).join(' · ');
}

/**
 * The chip on a want row. The canvas says "2 new"; `listWantMatches` carries
 * no seen/unseen marker anywhere, so "new" cannot be derived — saying it would
 * report a months-old match set as if it had just arrived, which is the exact
 * bug `useMatchesBadge` was written to fix. So it counts, and says what it
 * counts.
 */
function matchChip(count: number): string {
  return `${count} match${count === 1 ? '' : 'es'}`;
}

/** Strongest first, by the boosted alert score then the raw one. */
function strength(m: WtbMatch): number {
  return m.boosted_score ?? m.score ?? 0;
}

// ── The account-scoped half ────────────────────────────────────────────────

/**
 * Your wants + Matched for you.
 *
 * A child component, not a branch: its hooks fire authenticated queries, so a
 * guest must never mount it (see the file header). Mounted only when there is
 * a session AND the WTB flag is on.
 */
function BuyerSections({ onAddWant }: { onAddWant: () => void }) {
  const c = useV2Colors();
  const { wants, isLoading, isError, refetch } = useWants();

  // One query per want, on the SAME keys 6d and the tab badge use — this reads
  // their cache rather than re-fetching it.
  const matchQueries = useQueries({
    queries: wants.map((w) => ({
      queryKey: labKeys.wantMatches(w.id),
      queryFn: () => listWantMatches(w.id),
      enabled: WTB_ENABLED,
    })),
  });

  /** want id → its match count, or null while that want's query is in flight. */
  const countById = useMemo(() => {
    const m = new Map<number, number | null>();
    wants.forEach((w, i) => {
      const q = matchQueries[i];
      m.set(w.id, q?.isLoading ? null : (q?.data?.length ?? 0));
    });
    return m;
  }, [wants, matchQueries]);

  /** Alerting wants first; anything dormant sits below, muted, as on 6d. */
  const orderedWants = useMemo(
    () =>
      [...wants].sort(
        (a, b) => Number(!isActiveStatus(a.status)) - Number(!isActiveStatus(b.status)),
      ),
    [wants],
  );

  /**
   * "Matched for you" — every match across the ACTIVE wants, strongest first.
   *
   * Paused wants are excluded on purpose: pausing means "stop telling me", so
   * their matches must not reappear on the home screen. One product can match
   * two wants, so it is shown once, at its strongest — otherwise a two-row
   * preview can be the same machine twice.
   */
  const feed = useMemo(() => {
    const best = new Map<number, WtbMatch>();
    wants.forEach((w, i) => {
      if (!isActiveStatus(w.status)) return;
      for (const m of matchQueries[i]?.data ?? []) {
        const prev = best.get(m.product_id);
        if (!prev || strength(m) > strength(prev)) best.set(m.product_id, m);
      }
    });
    return sortMatchesStrongest([...best.values()]);
  }, [wants, matchQueries]);

  const feedLoading = useMemo(
    () => wants.some((w, i) => isActiveStatus(w.status) && (matchQueries[i]?.isLoading ?? false)),
    [wants, matchQueries],
  );

  // 6d — the wants screen, where a want and all of its matches live.
  const openWants = () => router.push('/v2/matches');

  return (
    <>
      <View style={styles.sectionGap} />
      <SectionHeader
        title="Your wants"
        actionLabel={
          isError ? 'Try again' : wants.length > PREVIEW_ROWS ? `See all ${wants.length}` : undefined
        }
        onAction={
          isError ? () => refetch() : wants.length > PREVIEW_ROWS ? openWants : undefined
        }
      />

      {isLoading ? (
        <SectionNote>Looking for the wants you have saved…</SectionNote>
      ) : isError ? (
        <SectionNote>
          Your wants did not load. Tap Try again — nothing you saved has been lost.
        </SectionNote>
      ) : wants.length === 0 ? (
        <SectionNote actionLabel="Add a want" onAction={onAddWant}>
          Nothing saved yet. Tell us the model and the budget and we watch every new listing for
          you.
        </SectionNote>
      ) : (
        orderedWants.slice(0, PREVIEW_ROWS).map((w, i) => {
          const active = isActiveStatus(w.status);
          const count = countById.get(w.id) ?? null;
          const subtitle = active ? wantCriteria(w) : dormantSubtitle(w);
          const chip = active && count != null && count > 0 ? matchChip(count) : undefined;
          return (
            <React.Fragment key={w.id}>
              {i > 0 ? <Hairline /> : null}
              <Row
                title={w.title}
                subtitle={subtitle || undefined}
                tone={active ? 'default' : 'muted'}
                leading={
                  <RowThumb>
                    {/* A want has no photograph and never will — the canvas's
                        image placeholder would read as one that failed to
                        load. This says "we are watching for this" instead. */}
                    <Search size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                  </RowThumb>
                }
                trailing={chip ? <Chip label={chip} tone="accent" /> : <RowTrailing />}
                // The chip is inside the row, so it is never announced on its
                // own — it has to be in the label.
                accessibilityLabel={
                  chip ? [w.title, subtitle, chip].filter(Boolean).join('. ') : undefined
                }
                onPress={() =>
                  router.push({
                    pathname: '/(lab)/want/[id]',
                    params: { id: String(w.id), title: w.title },
                  })
                }
                testID={`v2-want-${w.id}`}
              />
            </React.Fragment>
          );
        })
      )}

      {/* Nothing to match against until there is a want, so the section is
          absent rather than permanently empty. */}
      {!isError && !isLoading && wants.length > 0 ? (
        <>
          <View style={styles.sectionGap} />
          <SectionHeader
            title="Matched for you"
            actionLabel={feed.length > PREVIEW_ROWS ? `See all ${feed.length}` : undefined}
            onAction={feed.length > PREVIEW_ROWS ? openWants : undefined}
          />

          {feedLoading ? (
            <SectionNote>Checking every new listing against your wants…</SectionNote>
          ) : feed.length === 0 ? (
            <SectionNote>
              Nothing has matched yet. We are still looking, and you will hear the moment something
              fits.
            </SectionNote>
          ) : (
            feed.slice(0, PREVIEW_ROWS).map((m, i) => {
              const vm = matchToProductVM(m);
              // Drawn as "$9,400 · Netherlands · 6d left". The match snapshot
              // carries no auction end time, so condition takes the third
              // slot — the same line 6d shows for the same row.
              const sub = [vm.priceText, vm.country, vm.condition].filter(Boolean).join(' · ');
              return (
                <React.Fragment key={vm.matchId}>
                  {i > 0 ? <Hairline /> : null}
                  <Row
                    title={vm.name}
                    subtitle={sub || undefined}
                    leading={
                      <RowThumb uri={vm.image}>
                        <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                      </RowThumb>
                    }
                    trailing={<RowTrailing />}
                    // TODO(v2-writes): the match detail's bid / contact-seller
                    // actions live on the shipped screen; nothing here writes.
                    onPress={() => router.push(`/(lab)/match/${vm.matchId}`)}
                    testID={`v2-match-${vm.matchId}`}
                  />
                </React.Fragment>
              );
            })
          )}
        </>
      ) : null}
    </>
  );
}

// ── The screen ─────────────────────────────────────────────────────────────

function BuyingPaneInner() {
  const c = useV2Colors();
  const isGuest = useIsGuest();




  const onType = () => {
    haptics.impact();
    // TODO(v2-nav): the v2 want composer is not drawn. Until it is, this hands
    // off to the shipped My Wants screen, which owns the sheet that actually
    // creates a want — the same way 6a's "or type the details" hands off to
    // the shipped listing-method picker. TODO(v2-writes): the create itself
    // stays out of v2 in this pass.
    requireAuth('want', () => router.push('/(lab)/(tabs)/matches'));
  };

  const onBrowse = () => {
    haptics.tap();
    /**
     * `/v2/browse` — 6c has landed, and this was still leaving v2. Same
     * `MarketplaceWebView`, same `/buyer-marketplace` path, so the old route
     * bought nothing and cost the user the v2 chrome plus any way back. See the
     * matching note in `SellingPane`.
     *
     * Open to guests by design — browsing is not an account feature
     * (Guideline 5.1.1(v)).
     */
    router.push('/v2/browse');
  };

  const onAssistant = () => {
    haptics.tap();
    /**
     * `/v2/chat`, matching 6a — this used to push the SHIPPED `/(lab)/chat`,
     * and the result was the sharpest mismatch on the screen: the row you tap
     * reads "Find an LC-20 under $12k", and it opened a page headed
     * **"Sell with AI — What are you selling?"**. A buyer was handed the
     * seller flow by the one control that had just promised to find them a lot.
     *
     * The mode is not a route param — `/v2/chat` reads it from the shared
     * composer store, which is also what the shipped Home composer writes. So
     * the pane sets the mode it IS before navigating, rather than trusting
     * whatever the last screen happened to leave in the store.
     */
    useComposer.getState().setMode('buy');
    router.push('/v2/chat');
  };

  const onBanner = () => {
    haptics.tap();
    // TODO(v2-nav): there is no pricing explainer in the app or on the canvas.
    // "How pricing works" is a question, and the assistant is the one surface
    // that can answer it, so it goes there until an explainer exists.
    //
    // Same destination and mode as this pane's assistant row — it was pushing
    // the shipped `/(lab)/chat`, which opens "Sell with AI" under a banner
    // addressed to buyers.
    useComposer.getState().setMode('buy');
    router.push('/v2/chat');
  };



  const sheet = (
    <>
      <Text variant="display">{'What are you\nlooking for?'}</Text>
      <Text variant="body" color="inkMuted" style={styles.subline}>
        Type the spec and we watch the market for it.
      </Text>

      <PrimaryAction
        label="Type it"
        onPress={onType}
        icon={<PenLine size={icon.xl} color={c.onAccent} strokeWidth={1.8} />}
        testID="v2-buying-type"
      />

      <QuietAction
        label="or browse the open lots"
        onPress={onBrowse}
        variant="captionMedium"
        style={styles.browse}
      />
    </>
  );

  return (
    <PaneShell sheet={sheet} testID="v2-home-buying">
      <View style={styles.blockGap} />
      <TintedRow
        title="Ask the assistant"
        subtitle={'"Find an LC-20 under $12k"'}
        onPress={onAssistant}
        glyph={<Sparkles size={icon.lg} color={c.onAccent} strokeWidth={1.8} />}
      />

      {/*
        GUESTS ONLY — the same call as 6a's banner, for the same reason.
        "Skip the valuation — we price it for you" explains the product to
        someone who is already using it. For an account, wants and matches lead.
      */}
      {isGuest ? (
        <>
          <View style={styles.blockGap} />
          <PromoBanner
            eyebrow="For buyers"
            headline="Skip the valuation — we price it for you"
            actionLabel="How pricing works"
            onPress={onBanner}
            source={BANNER_PHOTO ? { uri: BANNER_PHOTO } : undefined}
          />
        </>
      ) : null}

      {/* Account-scoped. Absent for a guest and absent when wants are switched
          off in this build — the same shape 6a uses for drafts. */}
      {!isGuest && WTB_ENABLED ? <BuyerSections onAddWant={onType} /> : null}

    </PaneShell>
  );
}

const styles = StyleSheet.create({
  // ── header sheet ──
  tabs: { marginBottom: space['6xl'] },
  subline: { maxWidth: 280, marginTop: space.lg, marginBottom: space['6xl'] },
  browse: { marginTop: space['3xl'] },

  // ── body ──
  /** The gutter-sized breath above each inset block (tinted row, banner). */
  blockGap: { height: GUTTER },
  /** The whitespace that makes a section read as a section, with no box. */
  sectionGap: { height: SECTION_GAP },
});

/**
 * Memoised, and it is not a micro-optimisation.
 *
 * `BuyingPane` takes no props, so `React.memo` means a page change never
 * re-renders this subtree. Without it, every swipe release called `setPage` on
 * the host, which re-rendered BOTH panes — a JS-thread stall at the exact
 * moment the finger lifts. `dumpsys gfxinfo` showed it as high input latency
 * while frame times themselves looked fine, which is why it felt unresponsive
 * rather than choppy.
 */
export const BuyingPane = React.memo(BuyingPaneInner);
