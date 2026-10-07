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
 *      ┌──────────────────────────────────────────────────────┐
 *      │ [ thumb ]  Waters Alliance e2695              2d      │  card
 *      └──────────────────────────────────────────────────────┘
 *      ┌──────────────────────────────────────────────────────┐
 *      │ [ thumb ]  HPG-3400RS Solvent Rack            5d      │  card
 *      └──────────────────────────────────────────────────────┘
 *      LIVE LISTINGS                                   See all
 *      ┌──────────────────────────────────────────────────────┐
 *      │ [ thumb ]  Agilent 1200 HPLC system      [Live]       │  card
 *      └──────────────────────────────────────────────────────┘
 *
 * ⚠️ DRAFTS/LISTINGS ARE NO LONGER `6a.html`'S "plain rows on white" — moved
 * onto the dashboard's `ListCard` (`@/features/v2/ui/ListCard.tsx`) 2026-09-24
 * on request, to match the seller dashboard's bordered-card look. See that
 * file's docblock for the exact provenance (`seller-bids/seller-bid-card.tsx`'s
 * shape, generalised). This is a deliberate departure from the canvas, not a
 * missed spec line — reopen via `Docs/v2/DECISION-LOG.md` if it needs revisiting.
 * DATA — read real, write later. Drafts come from `useListDrafts`, live
 * listings from `useRecentSubmissions`, the bell from `useLabNotifications`.
 * Nothing here writes: the only mutation-adjacent action is resuming a draft,
 * which is a GET plus a navigation. Titles are AI-written and run past 90
 * characters, so every row title truncates (the `Row` primitive owns that).
 *
 * GUEST MODE stays live. A guest sees the header, the assistant row and the
 * banner; the two account-scoped sections are simply absent. The bell asks for
 * an account through `requireAuth` at the moment it is reached for.
 *
 * Scan it and type the details do NOT — they are open to a guest, matching
 * `nextjs-port`'s gate-at-publish (see the long note on `onScan`). The account
 * is asked for at publish (`usePublishDraft`) and at save-as-draft
 * (`useSaveDraft`), both of which already gated themselves. The sign-in sheet
 * itself is mounted once in `app/v2/_layout.tsx`, not here.
 *
 * EVERYTHING VISUAL COMES FROM THE KIT. The brand bar, the mode tabs, the
 * tinted row, the banner, the chips and the notes were all local copies in the
 * first pass; they were reported as kit gaps, reconciled into
 * `src/features/v2/ui/`, and this file now composes them.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Camera, Sparkles } from 'lucide-react-native';

import {
  Chip,
  ListCard,
  PrimaryAction,
  PromoBanner,
  QuietAction,
  SectionHeader,
  SectionNote,
  Text,
  TintedRow,
} from '@/features/v2/ui';

import { PaneShell } from './PaneShell';
import { GUTTER, SECTION_GAP, icon, space, useV2Colors } from '@/theme/v2';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { SellerStatusCards } from '@/features/v2/seller/SellerStatusCards';
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
  listingMeta,
  listingStatusLabel,
  listingTitle,
  listingTone,
  photoUri,
} from '@/features/v2/listings/presentation';
import type { DraftSummary } from '@/services/drafts/draftApi';
import { draftsEnabled } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { useComposer } from '@/features/lab/stores/composerStore';
import { haptics } from '@/lib/haptics';

/** Two per section, per the canvas — the shape (card, not plain row) changed; the count didn't. */
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
  const { t } = useTranslation();
  const isGuest = useIsGuest();

  /**
   * "See all" / "See all 7" — translated at the call site.
   *
   * This replaced `seeAll()` from `features/v2/listings/presentation.ts`, which
   * built the English inline and had no way to reach a translator. That helper
   * had exactly these two callers, so it was removed rather than left behind as
   * dead code returning a string nothing renders.
   *
   * `hasMore` means the count on screen is not the whole set, so naming a
   * number would be a claim we cannot support — hence the bare "See all".
   */
  const seeAllLabel = (loaded: number, hasMore: boolean): string =>
    hasMore
      ? t('mobile.scanv2.home.seeAll')
      : t('mobile.scanv2.home.seeAllCount', { count: loaded });




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
     * FLUSH-ALWAYS is kept from `launchSellerScan`: reset any half-finished
     * scan draft so the flow starts clean. Same contract as the seller Scan
     * tab; skipping it resumes someone else's abandoned draft into a fresh
     * scan.
     *
     * `launchSellerScan` itself is NOT changed: it is called from five places
     * in the shipped UI (lab home ×2, lab chat ×2, the chat controller), and
     * those must keep landing in the old flow while the old flow is what they
     * belong to.
     *
     * `push`, not `replace`, so Back returns to Home.
     *
     * ── ⚑ NO `requireAuth` HERE — GATE AT PUBLISH ─────────────────────────
     *
     * This used to be wrapped in `requireAuth('sell', …)`, so a guest tapping
     * the app's primary action got a sign-in sheet before seeing anything.
     * `nextjs-port` answers the same question the opposite way and that is the
     * answer we now match: `/sell` is "now a public chooser", `/sell/ai` is
     * `PublicSmartUploadFlow`, and `/valuation` is the Scan V2 flow "running
     * for a guest". Its docblock states the rule — "The visitor is only asked
     * to log in / create an account at the final Publish step
     * (gate-at-publish)". There is no `middleware.ts` in that repo; none of it
     * is protected.
     *
     * The ask has not been removed, it has been MOVED to the two controls that
     * genuinely need an account, both of which already carried their own gate
     * before this change:
     *
     *   · publish  → `usePublishDraft.ts` `requireAuth('sell', …)`
     *   · save as draft → `useSaveDraft.ts` `requireAuth('draft', …)`
     *
     * A guest's draft still lives in `useScanDraft` (Zustand + MMKV) and is
     * still resumable on that device — the mobile counterpart of the web's
     * `guestDraftStore`.
     *
     * ⚠️ The detection engine ALREADY supported this and was simply
     * unreachable: `useSmartDetect.ts:63-71` falls back to the legacy
     * multipart `smartDetect()` when there is no `sellerId`, which is the SAME
     * v1 path the web's public flow uses ("no login, no GCS needed"). Its own
     * comment called a guest "shouldn't happen on a guarded screen, but
     * defensive". Documents remain signed-in-only there, and the web's public
     * lane is images too, so the two surfaces still agree.
     *
     * Guideline 5.1.1(v) gets BETTER, not worse: listing still asks for an
     * account, but browsing-and-valuing no longer does.
     */
    useScanDraft.getState().reset();
    /*
      ⚑ INTAKE, not the camera (changed 2026-09-22).

      "Scan it" used to open the viewfinder directly, which made a lens the
      only way into the flow. The web's equivalent step is an INTAKE that takes
      photos, PDFs and whole inventory spreadsheets through one door — driven
      live at 390px, the same two files that dead-ended on the phone produced a
      priced listing there. A seller holding an XLSX cannot photograph their
      way out of it.

      The camera is one press from the intake and keeps its own route, so 7b's
      ADD tile and `v2CameraAppend` are unaffected.
    */
    /*
      ⚑ THE OLD SCAN FLOW, ON PURPOSE (2026-09-23).

      v2 is the UI everywhere else — Home, drafts, listings, the dashboard — but
      the SCAN is the previous one while the new endpoint is sorted out. Owner:
      *"we use all v2 screens, only the scan flow previous."*

      So this pushes the shipped camera rather than `routes.v2Intake`. The v2
      intake/items/valuation/submit screens still exist and still work; nothing
      routes into them from here until the new endpoint lands.
    */
    router.push(routes.scanCamera);
  };

  const onTypeDetails = () => {
    haptics.tap();
    /*
      ⚑ INTO THE ASSISTANT, SELL MODE (2026-09-25) — mirrors `BuyingPane`'s
      `onType` exactly (owner: *"buying mode type goes in ai chat with buy
      mode"*; this is the sell-mode half of that same pair, 6a to 6b's 6b).

      Used to seed a draft and push the shipped `app/scan/detail.tsx` form
      directly (2026-09-23's fix for a chooser-then-camera detour) — a real
      improvement over the detour, but still a hard exit out of v2 chrome
      into the old form, same as `onScan` was until it moved to the v2
      intake. `onScan` stays on the old flow for now because its target
      (`routes.v2Intake` → review → submit) has a REAL, currently-unwired
      blocker: publish/save is `TODO(v2-writes)` past that point (see
      `app/v2/scan/review/details.tsx`'s own docblock). The assistant has no
      such gap — `/v2/chat` already answers "what am I selling" in words
      today — so there is no reason for this control to leave v2 chrome
      while `onScan` still has to.
    */
    useComposer.getState().setMode('sell');
    router.push('/v2/chat');
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
      
          {/*
            The line break is DELIBERATE and lives in the string, so each
            language chooses its own break point rather than inheriting
            English's. Asserted in `scanv2Keys.test.ts` so a translator cannot
            quietly drop it and reflow the headline.
          */}
          <Text variant="display">{t('mobile.scanv2.home.heading')}</Text>
          <Text variant="body" color="inkMuted" style={styles.subline}>
            {t('mobile.scanv2.home.subline')}
          </Text>

          <PrimaryAction
            label={t('mobile.scanv2.home.scanIt')}
            onPress={onScan}
            icon={<Camera size={icon.xl} color={c.onAccent} strokeWidth={1.8} />}
            testID="v2-home-scan"
          />

          <QuietAction
            label={t('mobile.scanv2.common.typeDetails')}
            onPress={onTypeDetails}
            variant="captionMedium"
            style={styles.typeDetails}
          />
        
    </>
  );

  return (
    <PaneShell sheet={sheet} testID="v2-home-selling">
          {/*
            ⚠️ ABOVE the assistant row and the drafts, because this is the only
            place a seller is told their account is waiting, their email is
            unverified, or their profile is unfinished. Everything below is
            things to DO; this is the reason some of them will not work.

            It renders nothing for guests and for a settled seller, so the
            common case is unchanged — see `SellerStatusCards`.
          */}
          <SellerStatusCards />

          <View style={styles.blockGap} />
          <TintedRow
            title={t('mobile.scanv2.home.askAssistant')}
            subtitle={t('mobile.scanv2.home.askAssistantExample')}
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
                eyebrow={t('mobile.scanv2.home.bannerEyebrow')}
                headline={t('mobile.scanv2.home.bannerHeadline')}
                actionLabel={t('mobile.scanv2.home.bannerAction')}
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
                title={t('mobile.scanv2.home.draftsTitle')}
                actionLabel={
                  drafts.isError
                    ? t('mobile.scanv2.common.tryAgain')
                    : draftItems.length > PREVIEW_ROWS
                      ? seeAllLabel(draftItems.length, Boolean(drafts.data?.next_cursor))
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
              {/*
                `SectionHeader` itself only carries `space.sm` (6pt) below the
                eyebrow — enough for the header's own action link, not enough
                to read as MORE space than the gap between two cards below it
                (`ListCard`'s own `space.xl`, 12pt). Without this, eyebrow →
                first card was TIGHTER than card → card, an inverted rhythm a
                fresh-eyes review caught. `space.md` here brings the total to
                14pt, just over the 12pt between cards.
              */}
              <View style={styles.cardListGap} />

              {drafts.isLoading ? (
                <SectionNote>{t('mobile.scanv2.drafts.loading')}</SectionNote>
              ) : drafts.isError ? (
                <SectionNote>{t('mobile.scanv2.home.draftsError')}</SectionNote>
              ) : draftItems.length === 0 ? (
                <SectionNote>{t('mobile.scanv2.home.draftsEmpty')}</SectionNote>
              ) : (
                draftItems.slice(0, PREVIEW_ROWS).map((d) => {
                  const ago = compactAgo(d.updated_at);
                  const title = draftTitle(d);
                  const subtitle = draftSubtitle(d);
                  return (
                    <ListCard
                      key={d.id}
                      uri={photoUri(d.thumbnail_object)}
                      title={title}
                      subtitle={subtitle}
                      trailing={
                        resumingId === d.id ? (
                          <ActivityIndicator size="small" color={c.accent} />
                        ) : ago ? (
                          <Chip label={ago} tone="accent" />
                        ) : null
                      }
                      // The age chip is inside the card, so it is never
                      // announced on its own — it has to be in the label.
                      accessibilityLabel={ago ? `${title}. ${subtitle}. ${ago}` : undefined}
                      onPress={() => onDraft(d)}
                      testID={`v2-draft-${d.id}`}
                    />
                  );
                })
              )}
            </>
          ) : null}

          {!isGuest ? (
            <>
              <View style={styles.sectionGap} />
              <SectionHeader
                title={t('mobile.scanv2.home.listingsTitle')}
                actionLabel={
                  listings.isError
                    ? t('mobile.scanv2.common.tryAgain')
                    : listingItems.length > PREVIEW_ROWS
                      ? seeAllLabel(listingItems.length, listingItems.length >= LISTINGS_FETCH)
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
              {/* Same eyebrow-to-card rhythm fix as Drafts, above. */}
              <View style={styles.cardListGap} />

              {listings.isLoading ? (
                <SectionNote>{t('mobile.scanv2.listings.loading')}</SectionNote>
              ) : listings.isError ? (
                <SectionNote>{t('mobile.scanv2.home.listingsError')}</SectionNote>
              ) : listingItems.length === 0 ? (
                <SectionNote>
                  Nothing live yet. Anything you publish shows up here with its offers.
                </SectionNote>
              ) : (
                listingItems.slice(0, PREVIEW_ROWS).map((b) => (
                  <ListCard
                    key={b.batchPk}
                    uri={photoUri(b.thumbnailUrl)}
                    title={listingTitle(b)}
                    subtitle={listingMeta(b)}
                    trailing={<Chip label={listingStatusLabel(b)} tone={listingTone(b)} />}
                    // The status chip is inside the card, so it is never
                    // announced on its own — same rule as the draft card's
                    // age chip above.
                    accessibilityLabel={[listingTitle(b), listingStatusLabel(b), listingMeta(b)]
                      .filter(Boolean)
                      .join('. ')}
                    onPress={() => router.push(routes.v2ListingDetail(b.batchPk))}
                    testID={`v2-listing-${b.batchPk}`}
                  />
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
  cardListGap: { height: space.md },
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
