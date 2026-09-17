/**
 * 6a — Home (selling). The screen the whole redesign is measured against.
 *
 * Shape, top to bottom (docs/v2-design/screens/6a.html):
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [G] GREENBIDZ                            EN   bell•    │
 *   │  Selling   Buying                                       │
 *   │  What are you                                           │
 *   │  selling today?                                         │
 *   │  Point the camera at the nameplate…                     │
 *   │  (  Scan it  )                                          │
 *   │           or type the details                           │
 *   └─────────────────────────────────────────────────────────┘
 *      (  Ask the assistant                              › )     tinted row
 *      [ photo · scrim · FOR SELLERS · Turn idle plant… ]        banner
 *      DRAFTS                                        See all 7
 *      [] Waters Alliance e2695                            2d
 *      ────────────────────────────────────────────────────────
 *      [] HPG-3400RS Solvent Rack                          5d
 *      LIVE LISTINGS                                   See all
 *      [] Agilent 1200 HPLC system                          ›
 *
 * DATA — read real, write later. Drafts come from `useListDrafts`, live
 * listings from `useRecentSubmissions`, the bell from `useLabNotifications`.
 * Nothing here writes: the only mutation-adjacent action is resuming a draft,
 * which is a GET plus a navigation. Titles are AI-written and run past 90
 * characters, so every row title truncates (the `Row` primitive owns that).
 *
 * GUEST MODE stays live. A guest sees the header, the assistant row and the
 * banner; the two account-scoped sections are simply absent, and Scan it /
 * type the details / the bell ask for an account through `requireAuth` at the
 * moment they are reached for — never at the door. The sign-in sheet itself is
 * mounted once in `app/v2/_layout.tsx`, not here.
 *
 * EVERYTHING VISUAL COMES FROM THE KIT. The brand bar, the mode tabs, the
 * tinted row, the banner, the chips and the notes were all local copies in the
 * first pass; they were reported as kit gaps, reconciled into
 * `src/features/v2/ui/`, and this file now composes them.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Camera, ImageIcon, Sparkles } from 'lucide-react-native';

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
import { useScanDraft } from '@/stores/scanDraftStore';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import { openMultiItemDraft } from '@/features/v2/scan/openMultiItemDraft';
import { v2ResumeRoute } from '@/features/v2/scan/v2ResumeRoute';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { useListDrafts } from '@/services/drafts/draftHooks';
import {
  compactAgo,
  draftSubtitle,
  draftTitle,
  listingSubtitle,
  listingTitle,
  photoUri,
  seeAll,
} from '@/features/v2/listings/presentation';
import type { DraftSummary } from '@/services/drafts/draftApi';
import { draftsEnabled } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { useComposer } from '@/features/lab/stores/composerStore';
import { haptics } from '@/lib/haptics';

/** The canvas shows two rows per section — "Drafts and listings are plain rows on white, two each." */
const PREVIEW_ROWS = 2;
/** How many listings to ask for. More than the preview so "See all" can be honest about there being more. */
const LISTINGS_FETCH = 10;


/**
 * The banner photograph. ✅ ARRIVED 2026-09-17.
 *
 * This was `null` for the whole build, with a note that the asset "has to come
 * across from the design canvas". It was in the canvas folder the entire time —
 * `Greenbidz mobile app redesign/uploads/banner-surplus-into-capital.webp`,
 * beside the `.dc.html` files the screens were extracted from.
 *
 * Its absence was not cosmetic. The banner is sized for a photograph, so with a
 * flat ground it rendered 56.4dp of empty dark green above the eyebrow against
 * 26.3dp below the button — a 2.1:1 padding asymmetry that TWO independent
 * fresh-eyes reviews each called out as "a missing background image" and "looks
 * broken, not spacious". The fix was never a padding change; it was this file.
 */
const BANNER_PHOTO = require('../../../../assets/images/v2/banner-surplus-into-capital.webp');

// ── Real-data copy ─────────────────────────────────────────────────────────
//
// MOVED to `src/features/v2/listings/presentation.ts` when the "See all"
// screens landed. Home's two preview rows and the full list are the same row,
// so the wording has to come from one place — a seller who reads
// "AI draft · 3 items" here and something else one tap later is reading two
// different apps. Imported at the top of this file.

// ── The screen ─────────────────────────────────────────────────────────────

function SellingPaneInner() {
  const c = useV2Colors();
  const isGuest = useIsGuest();




  // Account-scoped reads. Both are disabled for a guest, so nothing 401s and
  // nothing is fetched that cannot be shown.
  const showDrafts = !isGuest && draftsEnabled();
  const drafts = useListDrafts({ enabled: showDrafts, retry: 0 });
  const listings = useRecentSubmissions(LISTINGS_FETCH, { enabled: !isGuest });

  // `openMultiItemDraft` — a draft with >1 item has no single-item screen to
  // hydrate into, so it opens the detected-items list instead of failing with
  // "Could not open this draft". See the FOURTH SHAPE note in `useResumeDraft`.
  const { resume, resumingId } = useResumeDraft(v2ResumeRoute, openMultiItemDraft);

  const draftItems = (drafts.data?.drafts ?? []).filter((d) => d.status === 'active');
  const listingItems = listings.data ?? [];


  const onScan = () => {
    haptics.impact();
    /**
     * ⚑ v2's OWN camera — not `launchSellerScan()`.
     *
     * This used to call the shipped `launchSellerScan()`, which ends in
     * `router.push(routes.scanCamera)` — the OLD `/scan/camera`. So the app's
     * single most important action walked a v2 user straight out of v2 and into
     * the previous UI, and the SIX v2 scan screens that exist
     * (`app/v2/scan/camera`, `analyzing`, and the four `review/*` steps) were
     * unreachable from Home. Found by pressing Scan it on the web build,
     * 2026-09-17, and landing on `/scan/camera`.
     *
     * The two things `launchSellerScan` does are kept, deliberately:
     *
     *  1. `requireAuth('sell', …)` — listing IS account-based, so this is one
     *     of the few actions a guest may be stopped on (Guideline 5.1.1(v)),
     *     and it asks here, at the point of use, not at the door.
     *  2. FLUSH-ALWAYS — reset any half-finished scan draft so the flow starts
     *     clean. Same contract as the seller Scan tab; skipping it resumes
     *     someone else's abandoned draft into a fresh scan.
     *
     * `launchSellerScan` itself is NOT changed: it is called from five places
     * in the shipped UI (lab home ×2, lab chat ×2, the chat controller), and
     * those must keep landing in the old flow while the old flow is what they
     * belong to.
     *
     * `push`, not `replace`, so Back returns to Home.
     */
    requireAuth('sell', () => {
      useScanDraft.getState().reset();
      router.push(routes.v2Camera);
    });
  };

  const onTypeDetails = () => {
    haptics.tap();
    // TODO(v2-nav): the v2 manual-entry screen is not drawn; this hands off to
    // the shipped listing-method picker.
    requireAuth('sell', () => router.push(routes.scanListingMethod));
  };

  const onAssistant = () => {
    haptics.tap();
    // 6e. Open to guests by design — the assistant is not an account feature
    // (Guideline 5.1.1(v)); only sending asks for an identity.
    //
    // Set the mode explicitly for the same reason 6b does: it lives in a shared
    // store, so without this the assistant opens in whichever mode the last
    // screen left behind — arriving from Buying would open "what are you
    // selling?" under a seller's thumb.
    useComposer.getState().setMode('sell');
    router.push('/v2/chat');
  };

  const onBanner = () => {
    haptics.tap();
    /**
     * `/v2/browse`, NOT the old `(lab)` tab.
     *
     * The TODO here said "repoint at 6c Browse once it lands" — 6c had already
     * landed, and this was still throwing people out of v2. Both screens render
     * the SAME `MarketplaceWebView` at the SAME path (`/buyer-marketplace`), so
     * the old route showed identical content wrapped in the old tab bar: the
     * chrome changed under you mid-flow for no gain, and once you were in that
     * tab group there was no visible way back to v2.
     *
     * Reported by the user as "it goes into the previous version while using
     * it". They were right, and it was two words in two files.
     */
    router.push('/v2/browse');
  };



  const onDraft = (d: DraftSummary) => {
    // One resume at a time: `resume` is a GET followed by a push, so a second
    // tap while the first is in flight navigates twice.
    if (resumingId) return;
    // Read + navigate only: `resume` GETs the draft and opens its editor.
    requireAuth('draft', () => void resume(d.id));
  };

  const sheet = (
    <>
      
          <Text variant="display">{'What are you\nselling today?'}</Text>
          <Text variant="body" color="inkMuted" style={styles.subline}>
            Point the camera at the nameplate and the listing writes itself.
          </Text>

          <PrimaryAction
            label="Scan it"
            onPress={onScan}
            icon={<Camera size={icon.xl} color={c.onAccent} strokeWidth={1.8} />}
            testID="v2-home-scan"
          />

          <QuietAction
            label="or type the details"
            onPress={onTypeDetails}
            variant="captionMedium"
            style={styles.typeDetails}
          />
        
    </>
  );

  return (
    <PaneShell sheet={sheet} testID="v2-home-selling">
      
          <View style={styles.blockGap} />
          <TintedRow
            title="Ask the assistant"
            subtitle={'"What is my Waters HPLC worth?"'}
            onPress={onAssistant}
            glyph={<Sparkles size={icon.lg} color={c.onAccent} strokeWidth={1.8} />}
          />

          {/*
            GUESTS ONLY. "Turn idle plant into capital / See what sells" is
            acquisition copy — it argues that this app is worth using. That is
            exactly right for someone who has not signed up, and wrong for
            someone with 24 drafts and live listings: it pitches a product they
            already bought, and it used to sit ABOVE their own work, pushing
            DRAFTS below the fold. Seen on device 2026-09-16 signed in, the
            seller had to scroll past the pitch to reach their own drafts.

            Nothing on this screen should outrank a seller's own work, so for an
            account it is not moved — it is gone, and drafts lead. The guest
            keeps it, because a guest's Home is thin (hero, assistant, banner,
            then nothing) and the banner is doing real work there.

            Pinned by `v2Inventory.test.ts` → 'shows the promo banner to guests
            only'. Reopen via `Docs/v2/DECISION-LOG.md`.
          */}
          {isGuest ? (
            <>
              <View style={styles.blockGap} />
              <PromoBanner
                eyebrow="For sellers"
                headline="Turn idle plant into capital"
                actionLabel="See what sells"
                onPress={onBanner}
                // A bundled asset, so it is the module itself — NOT `{ uri }`,
                // which is for a remote URL and renders nothing for a require().
                source={BANNER_PHOTO}
              />
            </>
          ) : null}

          {showDrafts ? (
            <>
              <View style={styles.sectionGap} />
              <SectionHeader
                title="Drafts"
                actionLabel={
                  drafts.isError
                    ? 'Try again'
                    : draftItems.length > PREVIEW_ROWS
                      ? seeAll(draftItems.length, Boolean(drafts.data?.next_cursor))
                      : undefined
                }
                onAction={
                  drafts.isError
                    ? () => void drafts.refetch()
                    : draftItems.length > PREVIEW_ROWS
                      ? () => router.push(routes.v2Drafts)
                      : undefined
                }
              />

              {drafts.isLoading ? (
                <SectionNote>Looking for scans you have not finished…</SectionNote>
              ) : drafts.isError ? (
                <SectionNote>
                  Your drafts did not load. Tap Try again — nothing has been lost.
                </SectionNote>
              ) : draftItems.length === 0 ? (
                <SectionNote>Nothing unfinished. A scan you stop part-way is saved here.</SectionNote>
              ) : (
                draftItems.slice(0, PREVIEW_ROWS).map((d, i) => {
                  const ago = compactAgo(d.updated_at);
                  const title = draftTitle(d);
                  const subtitle = draftSubtitle(d);
                  return (
                    <React.Fragment key={d.id}>
                      {i > 0 ? <Hairline /> : null}
                      <Row
                        title={title}
                        subtitle={subtitle}
                        leading={
                          <RowThumb uri={photoUri(d.thumbnail_object)}>
                            <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                          </RowThumb>
                        }
                        trailing={
                          resumingId === d.id ? (
                            <ActivityIndicator size="small" color={c.accent} />
                          ) : ago ? (
                            <Chip label={ago} tone="accent" />
                          ) : null
                        }
                        // The age chip is inside the row, so it is never
                        // announced on its own — it has to be in the label.
                        accessibilityLabel={ago ? `${title}. ${subtitle}. ${ago}` : undefined}
                        onPress={() => onDraft(d)}
                        testID={`v2-draft-${d.id}`}
                      />
                    </React.Fragment>
                  );
                })
              )}
            </>
          ) : null}

          {!isGuest ? (
            <>
              <View style={styles.sectionGap} />
              <SectionHeader
                title="Live listings"
                actionLabel={
                  listings.isError
                    ? 'Try again'
                    : listingItems.length > PREVIEW_ROWS
                      ? seeAll(listingItems.length, listingItems.length >= LISTINGS_FETCH)
                      : undefined
                }
                onAction={
                  listings.isError
                    ? () => void listings.refetch()
                    : listingItems.length > PREVIEW_ROWS
                      ? () => router.push(routes.v2Listings)
                      : undefined
                }
              />

              {listings.isLoading ? (
                <SectionNote>Fetching what you already have live…</SectionNote>
              ) : listings.isError ? (
                <SectionNote>Your listings did not load. Tap Try again.</SectionNote>
              ) : listingItems.length === 0 ? (
                <SectionNote>
                  Nothing live yet. Anything you publish shows up here with its offers.
                </SectionNote>
              ) : (
                listingItems.slice(0, PREVIEW_ROWS).map((b, i) => (
                  <React.Fragment key={b.batchPk}>
                    {i > 0 ? <Hairline /> : null}
                    <Row
                      title={listingTitle(b)}
                      subtitle={listingSubtitle(b)}
                      leading={
                        <RowThumb uri={photoUri(b.thumbnailUrl)}>
                          <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                        </RowThumb>
                      }
                      trailing={<RowTrailing />}
                      onPress={() => router.push(routes.v2ListingDetail(b.batchPk))}
                      testID={`v2-listing-${b.batchPk}`}
                    />
                  </React.Fragment>
                ))
              )}
            </>
          ) : null}
        

    </PaneShell>
  );
}

const styles = StyleSheet.create({
  // ── header sheet ──
  tabs: { marginBottom: space['6xl'] },
  subline: { maxWidth: 280, marginTop: space.lg, marginBottom: space['6xl'] },
  typeDetails: { marginTop: space['3xl'] },

  // ── body ──
  /** The gutter-sized breath above each inset block (tinted row, banner). */
  blockGap: { height: GUTTER },
  /** The whitespace that makes a section read as a section, with no box. */
  sectionGap: { height: SECTION_GAP },
});

/**
 * Memoised, and it is not a micro-optimisation.
 *
 * `SellingPane` takes no props, so `React.memo` means a page change never
 * re-renders this subtree. Without it, every swipe release called `setPage` on
 * the host, which re-rendered BOTH panes — a JS-thread stall at the exact
 * moment the finger lifts. `dumpsys gfxinfo` showed it as high input latency
 * while frame times themselves looked fine, which is why it felt unresponsive
 * rather than choppy.
 */
export const SellingPane = React.memo(SellingPaneInner);
