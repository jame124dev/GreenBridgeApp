/**
 * v2 inventory — the facts the docs would otherwise assert in prose.
 *
 * ── WHY THIS EXISTS ──
 *
 * `Docs/V2_CHECKLIST.md` grew to ~1,900 lines of hand-written claims, and on
 * 2026-09-16 several of them turned out to be stale within HOURS of being
 * written — a screen marked verified that could not be opened, a "real data:
 * n/a" on a screen holding 3,668 live lots, and a generalisation about
 * animations that a single grep disproved. None of that was carelessness in the
 * usual sense: prose cannot notice when the code moves underneath it.
 *
 * `Docs/` also already contains a cleanup plan stalled mid-execution since
 * 2026-05-29, which is the honest prior on tidying documentation by hand.
 *
 * So the load-bearing half of the v2 documentation is HERE, not in a markdown
 * file. Everything a grep can establish is asserted; the markdown keeps only
 * what a grep cannot know — decisions awaiting a human, what was seen on a
 * device, and why.
 *
 * ── HOW TO READ A FAILURE ──
 *
 * A failure here is not necessarily a bug. Most of these assert a CURRENT
 * SHAPE, so the correct response is often "yes, I changed that deliberately —
 * update the list and the doc line it backs". That coupling is the point: the
 * doc cannot silently drift from the code, because changing the code fails a
 * test that names the doc.
 *
 * Same technique as `v2MaterialCoverage.test.ts`, for the same reason: the
 * defect is an ABSENCE, and an absence is only meaningful against the full
 * enumerated population rather than against a list someone remembered to keep.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, it, expect } from '@jest/globals';

const ROOT = join(__dirname, '..', '..');
const V2_APP = join(ROOT, 'app', 'v2');

/** Every `.tsx` under a directory, as paths relative to it, POSIX-separated. */
function tsxUnder(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxUnder(full, base);
    if (!entry.endsWith('.tsx')) return [];
    return [relative(base, full).split(sep).join('/').replace(/\.tsx$/, '')];
  });
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Does a repo-relative path exist? Used to pin a REMOVED screen as removed. */
function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

/** Every v2 screen, as a repo-relative path. */
function v2Files(): string[] {
  return tsxUnder(V2_APP).map((r) => `app/v2/${r}.tsx`);
}

/** Source files that are allowed to reference v2 routes: v2 itself, and tests. */
function nonV2Sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      const rel = relative(ROOT, full).split(sep).join('/');
      if (rel.startsWith('app/v2/') || rel.startsWith('src/features/v2/')) continue;
      out.push(rel);
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'src'));
  return out;
}

describe('v2 route inventory', () => {
  /**
   * Adding or removing a v2 screen changes what the status board claims. The
   * list is here so that change is a deliberate edit rather than a doc that
   * quietly describes a tree that no longer exists.
   */
  it('is exactly the screens the status board covers', () => {
    const routes = tsxUnder(V2_APP)
      .filter((r) => !r.endsWith('_layout'))
      .sort();

    expect(routes).toEqual([
      'account',
      'browse',
      'buying',
      'chat',
      // THE DASHBOARD SECTION, added 2026-09-23. Its own layout with a side
      // menu (`app/v2/dashboard/_layout.tsx`), because the buyer and seller
      // dashboards are nine-plus pages that cannot go in a five-tab bar —
      // the same shape the web gives them with `DashboardLayout`. The menu
      // lists every page including the unbuilt ones, disabled.
      //
      // `dashboard/bids` reached PHASE 2 (real API) 2026-09-24 — see
      // `Docs/V2_CHECKLIST.md`. It is also the seller's bids screen in
      // waiting — on the web the two are one component with a prop. The
      // Account row that reaches the whole section stays `__DEV__`-gated
      // regardless: several sibling pages (`requests`, `orders/[id]`, and
      // this index screen itself) are still phase-1 fixtures.
      //
      // `dashboard/index` WAS a redirect to the first built page. As of
      // 2026-09-24 it is the real Buying home screen
      // (`src/features/v2/buying-home/`) — built last, per its own plan,
      // because it composes rows the other dashboard screens already define.
      'dashboard/bids',
      'dashboard/index',
      // `dashboard/inspections` is PHASE 1 — a list off a fixture. Its status
      // filter is SERVER-side on the web, so phase 2 must send the param
      // rather than keep the client filter this screen uses as a stand-in.
      'dashboard/inspections',
      // `dashboard/orders/[id]` — order detail & tracking, by CHECKOUT id.
      // ⚠️ NOT REACHABLE from anywhere in the app yet: its plan's source file
      // is dead code (imported by nothing in the web app), and a request
      // row's `order_id` was verified to be a DIFFERENT, unrelated id from
      // the `checkout_id` this screen takes (0 orders vs 4 checkouts for the
      // same test buyer, live). Built and verified in isolation instead of
      // wired to a guessed relationship. See the route file's docblock.
      'dashboard/orders/[id]',
      // `dashboard/requests` is PHASE 1 — two fixtures (orders + offers)
      // merged client-side, same as the web. Its plan doc originally
      // described ONE endpoint; there are two — see
      // `src/features/v2/requests/types.ts` for the audit.
      'dashboard/requests',
      // `dashboard/seller-bids` — the FIRST seller page. Its plan said "don't
      // build a screen, reuse the buyer's MyBids with a prop" — that prop
      // only changes a navigation URL, not the query, so following it would
      // have shown a seller their OWN bids, not bids on their listings. Built
      // against the real live source instead: `GET /buyer/bid/seller/{id}`
      // (`batchApiSlice.ts`), not the plan's cited (real but unused)
      // `GET /seller/bids/{id}`. See `src/features/v2/seller-bids/types.ts`.
      'dashboard/seller-bids',
      // `dashboard/seller-offers` — the second seller page, and the first
      // screen on this dashboard with a write (accept/reject/mark sold/
      // decline). Its live endpoint (`GET /offer/seller?sellerID={id}`) is
      // unauthenticated AND leaks buyer password hashes in a nested `buyer`
      // object — `Docs/v2/SECURITY-WISHLIST.md`, 2026-09-24 entry. This
      // screen types only `user_id`, never `buyer`. Phase 1's confirm flow
      // mutates local state, not the network — see the screen's own docblock
      // for why that is deliberate, not a shortcut.
      'dashboard/seller-offers',
      // `dashboard/seller-orders` — the third seller page. Its live endpoint
      // (`GET /checkouts/seller/{id}`) has the SAME unauthenticated
      // password-hash leak as seller-offers — a THIRD occurrence, now a
      // pattern across endpoints, not an isolated bug. See
      // `Docs/v2/SECURITY-WISHLIST.md`. Types only `buyer_id`, never `buyer`.
      // Reuses the canonical `CheckoutStatus` vocabulary from
      // `order-detail/types.ts` rather than redeclaring it a third time.
      'dashboard/seller-orders',
      // `dashboard/watchlist` is PHASE 1 as well — a 2-up image grid off a
      // fixture. Its endpoint (`GET /wishlist/{buyerId}`) is the documented
      // unauthenticated IDOR in `Docs/v2/SECURITY-WISHLIST.md`, so phase 2 is
      // a decision rather than a wiring task.
      'dashboard/watchlist',
      // The two "See all" surfaces behind 6a Home, and a listing's detail.
      // Added 2026-09-17. Not in the canvas — see each file's docblock for what
      // was derived from Home and what was a design call.
      'drafts',
      'index',
      'listing/[id]',
      'listings',
      'matches',
      'messages',
      'scan/analyzing',
      'scan/camera',
      'scan/intake',
      // Detected items — step 2, and as of 2026-09-23 the ONLY one. It serves a
      // fresh scan (a LOCAL draft id projected by
      // `services/drafts/localDraftSource.ts`) and a resumed server draft
      // through the same calls; `services/drafts/draftItemsApi.ts` switches
      // underneath it. `scan/detected` was its local-only twin and is gone —
      // see the removal pin below. Added 2026-09-17; no canvas artboard, since
      // 7a–7e cover the single-item path only.
      'scan/items',
      // Published — the landing after a successful submit, added 2026-09-21.
      // No canvas artboard either (`docs/v2-design/screens/` runs 6a–6f and
      // 7a–7e), so it is a new design rather than a copy. It exists because
      // publishing used to `toast.success(...)` and `router.replace('/v2')`,
      // which THREW THE BATCH NUMBER AWAY — `onSuccess` took only a count and
      // discarded a response carrying `batchNumber`. That number is what a
      // seller quotes when they ask about their listing later.
      // Task: `todo/SCANV2_V2UI_08_PUBLISHED.md`.
      'scan/published',
      'scan/review/details',
      'scan/review/location',
      'scan/review/photos',
      'scan/review/pricing',
      'scan/submit',
      'scan/valuation',
    ]);
  });
});

describe('v2 reachability', () => {
  const NAV_TO_V2 = /(?:push|replace|navigate|href\s*=)\s*[^;\n]{0,40}['"`]\/v2\b/;

  /**
   * A comment is prose, not a door. Scanning whole files counted the docblock
   * on `V2_UI_ENABLED` (`src/lib/flags.ts`) as an entry point, because it
   * explains in English that the flag shows a row that "pushes `/v2`" — which
   * is exactly the sentence the flag deserves to carry. Comment lines are
   * dropped so the assertion names files that NAVIGATE, not files that
   * describe navigating. A real `router.push('/v2')` on a code line still
   * counts, in any file.
   */
  const COMMENT_LINE = /^\s*(?:\/\/|\*|\/\*)/;

  function navigatesToV2(rel: string): boolean {
    return read(rel)
      .split('\n')
      .some((line) => NAV_TO_V2.test(line) && !COMMENT_LINE.test(line));
  }

  /**
   * ⚠️ v2 HAS EXACTLY ONE DOOR, AND IT IS SHUT BY DEFAULT.
   *
   * This asserted ZERO until 2026-09-16: nothing outside `app/v2/` navigated
   * into v2 and every screen verified so far was reached by an `adb` deep
   * link. The door that now exists is ONE row at the bottom of the OLD Account
   * screen, gated on `V2_UI_ENABLED` (`EXPO_PUBLIC_V2_UI=1` — opt-in, default
   * OFF), so v2 still ships to nobody: with the flag unset the app is exactly
   * what it was, and the launch route is untouched (asserted below).
   *
   * The list is EXACT rather than a count. A second door — a tab, a launch
   * redirect, a link from Home — fails here and has to be declared, which is
   * the prompt to update `Docs/v2/STATUS.md`, whose first paragraph tells the
   * reader how v2 is reached.
   */
  it('has exactly one entry point: the row on the old Account screen', () => {
    expect(nonV2Sources().filter(navigatesToV2)).toEqual(['app/(lab)/(tabs)/account.tsx']);
  });

  /**
   * The door being SHUT is the load-bearing half of the claim above — an
   * ungated row would put an unfinished UI in front of every user, which is
   * the one outcome option A was chosen to avoid. Asserted separately so that
   * removing the flag fails with the reason, not with a route list.
   */
  it('keeps that entry point behind the default-OFF flag', () => {
    expect(read('app/(lab)/(tabs)/account.tsx')).toContain('V2_UI_ENABLED');
    expect(read('src/lib/flags.ts')).toContain(
      "export const V2_UI_ENABLED = process.env.EXPO_PUBLIC_V2_UI === '1';",
    );
  });

  /** The launch route, stated so a change to it cannot go unnoticed. */
  it('is not what the app launches into', () => {
    expect(read('app/index.tsx')).toContain('/(lab)/(tabs)/home');
  });
});

describe('v2 controls that explain themselves instead of working', () => {
  /**
   * App Review Guideline 2.1 (App Completeness) treats a visible control that
   * only explains itself as an unfinished app, so this list is a submission
   * blocker, not a nicety. Each entry is a control that prints a sentence
   * instead of acting.
   *
   * These replaced SILENT haptics, which were worse — a buzz confirms the tap
   * landed, so a missing screen reads as a hang. But the sentence must not
   * ship either.
   *
   * The count is asserted rather than the exact wording: wording gets edited,
   * and a test that fails on a comma teaches people to delete the test. Adding
   * a NEW one, or wiring one up, changes the count and lands here.
   */
  /**
   * 2a (`lot.tsx`) and 2b (`bid.tsx`) were REMOVED on 2026-09-17 and took three
   * of these sites with them — `Review bid`, `Make offer` and `Message seller`.
   * Both screens rendered `MOCK_LOT`, nothing navigated to either, and bidding
   * already works for a mobile user inside the 101lab Browse WebView. Five
   * self-explaining controls became two, and both survivors are in the scan
   * review flow where the person is actually editing something.
   */
  /**
   * ZERO, as of 2026-09-21. The list is empty and the assertion below is now
   * "nowhere in v2", which is the state this suite existed to reach.
   *
   * `SITES` is kept as an empty tuple rather than deleted: the second test
   * sweeps every v2 screen and subtracts this list, so it is the exemption
   * register. An empty register means no exemptions — and a future screen that
   * adds a self-explaining control fails immediately instead of quietly
   * appending itself to a list nobody reads.
   */
  const SITES = [] as readonly string[];

  /**
   * A call that SHOWS the notice. Three things are deliberately not counted:
   * the `defer` helper's own definition, the `setNotice(null)` dismissals, and
   * the `setNotice(message)` inside the helper — none of them is a control.
   *
   * The comment filter is not fussiness. The first version of this count said
   * EIGHT, because `matches.tsx` mentions `defer()` in a comment explaining
   * what it does INSTEAD of one; that control is a real navigation.
   */
  const CALL = /\b(?:defer|setNotice)\(/;
  const NOT_A_CONTROL = /setNotice\((?:null|message)\)|const defer|^\s*(?:\*|\/\/)/;

  function sitesIn(rel: string): number {
    return read(rel)
      .split('\n')
      .filter((line) => CALL.test(line) && !NOT_A_CONTROL.test(line)).length;
  }

  it('is zero — the register of exemptions is empty', () => {
    const perFile = Object.fromEntries(SITES.map((f) => [f, sitesIn(f)]));

    // The count over time. Every drop is a control that was WIRED, not a
    // sentence that was deleted — which is the distinction that makes this
    // number mean anything:
    //   7 → 5  (2026-09-16) 7c + 7b "Save as draft" started committing
    //                       device-locally instead of explaining.
    //   5 → 2  (2026-09-17) 2a `lot.tsx` and 2b `bid.tsx` were REMOVED; both
    //                       rendered `MOCK_LOT`, nothing navigated to either,
    //                       and bidding already works inside the Browse WebView.
    //   2 → 1  (2026-09-17) 7c Category → Choose opens the shipped
    //                       `CategoryPickerSheet`. That one was a hard block on
    //                       publishing, not a cosmetic gap.
    //   1 → 0  (2026-09-21) 7b Rearrange opens the shipped reorder screen.
    //
    // "Save as draft" and "Submit" also stopped being inert on 2026-09-17 — all
    // four steps POST through `useSaveDraft`, and 7e publishes through
    // `usePublishDraft`. Neither was ever counted here (they buzzed and
    // returned rather than printing a sentence), but no `TODO(v2-writes)`
    // remains on a control a seller can press.
    expect(perFile).toEqual({});
  });

  it('exists nowhere else in v2', () => {
    const others = tsxUnder(V2_APP)
      .map((r) => `app/v2/${r}.tsx`)
      .filter((rel) => !SITES.includes(rel as (typeof SITES)[number]))
      .filter((rel) => sitesIn(rel) > 0);

    expect(others).toEqual([]);
  });
});

describe('v2 guest gates', () => {
  /**
   * ⚠️ THE TWO HALVES OF GUIDELINE 5.1.1(v), ASSERTED TOGETHER.
   *
   * Build 1.0.3 (21) was rejected on 2026-08-24 for requiring registration
   * before browsing. The fix was not "gate less" — it was to move every ask to
   * the moment an ACCOUNT-BASED action is pressed, through
   * `requireAuth(reason, action)`. That leaves two ways to fail, opposite in
   * direction, and a test that only guards one of them invites the other:
   *
   *   • gate too EARLY — a guest cannot view a lot → rejected, again
   *   • gate too LATE  — a guest fills in a bid form and is stopped at submit
   *
   * `Docs/v2/GUEST-VS-SIGNED-IN.md` audited every v2 screen for this on
   * 2026-09-16 and found 2a (this lot) and 2b (the bid form) were the only two
   * with no guest handling at all. Bidding is unambiguously account-based, so
   * 2a's "Place bid" is the gate, and it is asserted here because nothing
   * WRITES yet: the bid POST is still unwired, so no runtime failure and no
   * device pass would notice the gate going missing before the write lands.
   * That is exactly the window in which a guard quietly disappears.
   *
   * Comment lines are dropped for the same reason the reachability and
   * dead-control counts drop them: this file is heavily commented, `requireAuth`
   * is discussed in prose on several screens, and an assertion satisfied by a
   * sentence ABOUT a gate is worse than no assertion. A gate has to be code.
   */
  function codeOf(rel: string): string {
    return read(rel)
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
      .join('\n');
  }

  /**
   * ⚑ 2a (the lot) and 2b (the bid form) ARE GONE, AND MUST STAY GONE.
   *
   * Removed 2026-09-17. Both rendered `MOCK_LOT` — an invented lot with an
   * invented current bid, bidder count, closing time and seller — and 2b went
   * further, computing a buyer fee and a total from those invented numbers and
   * telling the person "This would put you in the lead." Nothing in the app
   * ever navigated to either: proven by grepping for `/v2/lot` and getting
   * nothing, with the same probe finding `/v2/bid` to show it worked.
   *
   * They went together on purpose. `lot.tsx` held the ONLY route to `bid.tsx`,
   * so deleting the form alone would have left "Place bid" — the screen's
   * primary green action — pointing at nothing, which is worse than a fake
   * form that at least works.
   *
   * Bidding is not lost. A mobile user bids in the 101lab marketplace inside
   * the Browse WebView (`app/v2/browse.tsx` → `/buyer-marketplace`), which is
   * real data and a real bid. A native lot screen only makes sense once there
   * is a native listings endpoint — the same gap that keeps Browse a WebView.
   *
   * This took three of the five self-explaining controls with it: `Review bid`,
   * `Make offer` and `Message seller`. See the count above.
   *
   * Rebuild them ONLY with a real listings endpoint, and then re-add the guest
   * bid gate at the lot before the form opens — the reasoning for that gate is
   * kept in `Docs/v2/DECISION-LOG.md` and should not be re-derived.
   */
  /**
   * ⚑ `scan/detected.tsx` IS GONE, AND MUST STAY GONE — for a different reason
   * from the three above, so it is worth stating rather than appending.
   *
   * It was not fake and nothing about it was broken. It was the SECOND step-2
   * screen: `detected.tsx` read the local scan store, `items.tsx` read
   * `GET /drafts/:id/items`, and a scan reached one or the other depending on
   * whether it had been saved to the server. Two screens, two data models, one
   * step — so every later change to that step had to be made twice or silently
   * only applied to half the sellers.
   *
   * Phase 1 (2026-09-23) closed the fork the way the web does: `items.tsx` is
   * the only step-2 screen, and a fresh scan is given a LOCAL draft id that
   * `services/drafts/localDraftSource.ts` answers with the same shapes the API
   * returns. Re-adding a screen here means re-opening the fork.
   *
   * Its single-item head copy and "worth" block are owed to the Phase 4 item
   * collapse; they are not lost, they are unbuilt.
   */
  it.each([
    ['app/v2/lot.tsx'],
    ['app/v2/bid.tsx'],
    ['app/v2/voice.tsx'],
    ['app/v2/scan/detected.tsx'],
  ])('no longer exists (%s)', (rel) => {
    expect(exists(rel)).toBe(false);
  });

  /**
   * The constant went with the screen. A dangling `Href` compiles under typed
   * routes until someone regenerates them, then fails somewhere else — the same
   * reasoning `routes.ts` records for the removed `v2Voice`.
   */
  it('has no route constant left for the removed step-2 twin', () => {
    // `codeOf`, not `read` — and this test failed on its first run for exactly
    // the reason the helper exists: the constant that REPLACED it carries the
    // old path in its docblock, explaining what it replaced. An assertion a
    // comment can satisfy (or, here, defeat) is not an assertion about the code.
    const src = codeOf('src/lib/routes.ts');
    expect(src).not.toContain("'/v2/scan/detected'");
    expect(src).toContain('v2ScanItems');
  });

  /**
   * And nothing may quietly route to them again. A dangling push compiles fine
   * under expo-router's typed routes only until someone regenerates types, and
   * on device it is a dead primary action — the exact failure the removal was
   * meant to end.
   */
  it('has no route left pointing at the removed screens', () => {
    for (const rel of v2Files()) {
      expect(codeOf(rel)).not.toMatch(/['"`]\/v2\/(?:lot|bid|scan\/detected)['"`]/);
    }
  });

  /**
   * The promo banner is ACQUISITION copy — it argues the app is worth using.
   * That is right for a guest and wrong for an account, and on 6a it used to
   * render above the seller's own drafts, so someone with 24 drafts scrolled
   * past a pitch to reach their work (seen on device 2026-09-16).
   *
   * Both panes, because they drifted apart once already and the buying pane is
   * the one that gets forgotten — it is behind a tab, so a device pass that
   * only opens Home never sees it.
   *
   * The assertion is ORDER-SENSITIVE on purpose: it is not enough that
   * `isGuest` and `<PromoBanner` both appear in the file — `isGuest` is used
   * several times in each pane for the account-scoped sections. The guard must
   * come immediately BEFORE the banner. The 400-character window is what spans
   * the comment and the `<View style={styles.blockGap} />` between them.
   */
  /**
   * ⚑ SIGNING IN FROM v2 MUST NOT EJECT YOU INTO THE OLD UI.
   *
   * The most-reported bug of this build, in the user's words: "it goes back to
   * the previous version while using". The cause was not a v2 file at all, so
   * the `v2 exits into the old UI` suite below could never have caught it —
   * every v2 screen was clean. `app/(auth)/login.tsx` ended with
   * `router.replace(HOME_ROUTE)` where `HOME_ROUTE` is `/(lab)/(tabs)/home`, so
   * ANY gate — bid, draft, sell, account — was a one-way trip out of v2 the
   * moment the person actually signed in. The gate worked; the return did not.
   *
   * Both screens, because the v2 sheet offers "Create account" as well as
   * "I already have an account", and fixing only login leaves the signup half
   * ejecting people exactly as before.
   *
   * Asserting on `landingRoute()` rather than on the absence of `HOME_ROUTE`:
   * the constant legitimately still exists and is still the fallback for the
   * old UI. What must not come back is a BARE `router.replace(HOME_ROUTE)` on
   * the success path.
   */
  it.each([['app/(auth)/login.tsx'], ['app/(auth)/register.tsx']])(
    'returns a v2 guest to v2 after signing in (%s)',
    (rel) => {
      const code = codeOf(rel);

      // Every success path goes through the one gatekeeper…
      expect(code).toContain('router.replace(postAuthLanding())');
      // …and none still hard-replaces to the old home.
      expect(code).not.toContain('router.replace(HOME_ROUTE)');
    },
  );

  /**
   * ⚑ THE THIRD EJECTION POINT, and the reason fixing the two auth screens is
   * not enough. `AuthGuard` replaces to the legacy home on `profile &&
   * inAuthGroup`, which is true at the exact moment login succeeds — it races
   * the screen's own redirect and used to win intermittently. Deleting the
   * `hasPendingV2Return()` term would restore the bug in a form that passes
   * every other test here and reproduces perhaps one run in three.
   */
  it('does not let the root AuthGuard race the v2 return', () => {
    const code = codeOf('app/_layout.tsx');

    expect(code).toMatch(/profile\s*&&\s*inAuthGroup\s*&&\s*!hasPendingV2Return\(\)/);
  });

  /**
   * The gatekeeper itself: scoped to `/v2` so the shipped auth stack is
   * unchanged for old-UI users, who must keep landing exactly where they land
   * today.
   */
  it('scopes the post-auth return to v2 only', () => {
    const code = codeOf('src/features/v2/routing/postAuthLanding.ts');

    expect(code).toMatch(/startsWith\(\s*['"`]\/v2['"`]\s*\)/);
    expect(code).toContain('LEGACY_HOME');
  });

  /**
   * The other end of the same wire. If the sheet stops recording where it was,
   * `returnTo` is always null and `landingRoute()` silently degrades to the old
   * behaviour — green tests, bug back, nothing to see in a diff.
   */
  it('records the screen to come back to before leaving for auth', () => {
    const code = codeOf('src/features/v2/auth/SignInSheet.tsx');

    expect(code).toMatch(/setReturnTo\(\s*pathname\s*\)/);
    // Recorded BEFORE the navigation, or the sheet is already unmounted.
    expect(code.indexOf('setReturnTo')).toBeLessThan(code.indexOf('router.push(path)'));
  });

  it.each([
    ['src/features/v2/home/SellingPane.tsx', 'Turn idle plant into capital'],
    ['src/features/v2/home/BuyingPane.tsx', 'Skip the valuation'],
  ])('shows the promo banner to guests only (%s)', (rel, headline) => {
    const code = codeOf(rel);

    // The banner is still there — this is a guest/account split, not a deletion.
    expect(code).toContain('<PromoBanner');
    expect(read(rel)).toContain(headline);

    // …and it is rendered under an isGuest guard, not unconditionally.
    expect(code).toMatch(/isGuest\s*\?[\s\S]{0,400}?<PromoBanner/);

    // Exactly one banner per pane, so the guard cannot be routed around by a
    // second unguarded copy.
    expect(code.match(/<PromoBanner/g) ?? []).toHaveLength(1);
  });

  /**
   * ⚑ GATE AT PUBLISH — the scan flow is OPEN to a guest, and the ask sits on
   * the two controls that genuinely need an account.
   *
   * This matches `nextjs-port`, which answers the same question and answers it
   * publicly: `/sell` is "now a public chooser", `/sell/ai` is
   * `PublicSmartUploadFlow` ("The visitor is only asked to log in / create an
   * account at the final Publish step"), `/valuation` is the Scan V2 flow
   * "running for a guest", and that repo has no `middleware.ts` protecting any
   * of them.
   *
   * Before this, `Scan it` and `or type the details` were both wrapped in
   * `requireAuth('sell', …)`, so the app's primary action showed a guest a
   * sign-in sheet before any value — the opposite order from the website, on
   * the surface where install-to-signup drop-off is worst.
   *
   * Asserted in BOTH directions on purpose, because this has two opposite
   * failure modes and restoring either one is a one-line edit:
   *
   *   • re-gating the entry  → the funnel closes again, silently
   *   • losing the publish gate → a guest fills in four review steps and is
   *     stopped at the end, which is the "gate too LATE" failure this suite's
   *     opening comment already warns about
   *
   * Nothing here can be satisfied by prose — `codeOf` drops comment lines, and
   * both files discuss `requireAuth` at length.
   */
  it('lets a guest into the scan flow and asks at publish instead', () => {
    const pane = codeOf('src/features/v2/home/SellingPane.tsx');

    /*
      The two entry controls navigate directly — no gate at the door. THAT is
      what this test guards; the destination is incidental to it.

      ⚠️ It asserted `routes.v2Intake` until 2026-09-23. The scan flow was rolled
      back to the shipped one that day — *"we use all v2 screens, only the scan
      flow previous"* — so Home's "Scan it" pushes `routes.scanCamera` again.
      The guest property is unchanged and is the point: whichever screen it
      opens, it opens WITHOUT `requireAuth`, and the account is asked for at
      publish instead.
    */
    expect(pane).toMatch(/router\.push\(routes\.scanCamera\)/);
    /*
      "or type the details" now opens the ASSISTANT IN SELL MODE, mirroring
      `BuyingPane`'s own "Type it" exactly.

      It asserted `routes.scanDetail` until 2026-09-25 — a straight-into-the-
      shipped-form fix that was itself a real improvement over the chooser it
      replaced (`routes.scanListingMethod`, which opened the CAMERA), but still
      a hard exit out of v2 chrome. `onScan` stays on `routes.scanCamera` for
      now because ITS v2 destination has a real, currently-unwired blocker
      (publish/save past `routes.v2Intake`'s review steps is `TODO(v2-writes)`
      — see `app/v2/scan/review/details.tsx`). The assistant has no such gap.
    */
    expect(pane).toMatch(/router\.push\('\/v2\/chat'\)/);
    expect(pane).not.toMatch(/router\.push\(routes\.scanDetail\)/);
    expect(pane).not.toMatch(/router\.push\(routes\.scanListingMethod\)/);
    expect(pane).not.toMatch(/requireAuth\(\s*'sell'/);

    // The flush is NOT collateral damage of removing the wrapper: without it a
    // fresh scan resumes someone else's abandoned draft.
    expect(pane).toMatch(/useScanDraft\.getState\(\)\.reset\(\)/);

    // Resuming a draft IS account-based and keeps its gate.
    expect(pane).toMatch(/requireAuth\(\s*'draft'/);

    // And the ask still exists, on the two writes that need an account.
    expect(codeOf('src/features/v2/scan/review/usePublishDraft.ts')).toMatch(
      /requireAuth\(\s*'sell'/,
    );
    expect(codeOf('src/features/v2/scan/review/useSaveDraft.ts')).toMatch(
      /requireAuth\(\s*'draft'/,
    );
  });
});

describe('v2 exits into the old UI', () => {
  /**
   * ⚠️ EVERY ONE OF THESE DROPS THE USER OUT OF v2 MID-FLOW, and the old shell
   * has a different tab bar, so the chrome changes under them.
   *
   * Reported by the user while using the app: *"routing is wrong, at some point
   * it goes into the previous version"*. Two of the exits turned out to be
   * pointless — Home's banner and 6b's "browse the open lots" both pushed
   * `(lab)/(tabs)/browse`, which renders the SAME `MarketplaceWebView` at the
   * SAME path as `/v2/browse`. And all four review steps sent their empty state
   * to `routes.scanHome` with `router.replace`, which left v2 with no back
   * stack at all. There was no `routes.v2Home` constant, which is why four
   * screens independently reached for the shipped one.
   *
   * What is left is the set that genuinely has no v2 destination yet. This test
   * FIXES that set: a new exit fails here and has to be justified, and an exit
   * that gains a v2 equivalent should be removed from the list rather than left
   * to rot. It counts FILES, not call sites, so re-ordering inside a file does
   * not churn the test.
   */
  /** A literal old-UI path, e.g. `router.push('/(lab)/(tabs)/matches')`. */
  const OLD_PATH = /'\/\(lab\)|'\/scan\//;
  /**
   * The same exit taken through a route constant - which most of them are.
   *
   * Deliberately a SECOND regex rather than another branch of the first. As
   * one literal with a `(?:...)` group, the constant branch matched in plain
   * node and silently never matched under Jest: six files vanished from the
   * list, and the test looked like it was reporting on the code when it was
   * reporting on its own regex. Two simple patterns OR-ed in code cannot
   * fail that way.
   */
  const OLD_ROUTE =
    /routes\.(scanHome|scanDrafts|scanListingMethod|scanDetection|scanProcessing|labListings|labNotifications)/;

  function exitsToOldUI(rel: string): boolean {
    const source = read(rel);
    return OLD_PATH.test(source) || OLD_ROUTE.test(source);
  }

  it('is exactly the screens with no v2 destination yet', () => {
    const leaking = tsxUnder(V2_APP)
      .map((r) => `app/v2/${r}.tsx`)
      .concat([
        'src/features/v2/home/SellingPane.tsx',
        'src/features/v2/home/BuyingPane.tsx',
        'src/features/v2/home/HomeScreen.tsx',
      ])
      .filter(exitsToOldUI)
      .sort();

    expect(leaking).toEqual([
      // the bell — no v2 notifications surface is drawn
      'app/v2/account.tsx',
      'app/v2/browse.tsx',
      'app/v2/chat.tsx',
      // The bell again, on the three list/detail screens added 2026-09-17.
      // These EXIT for the bell only — the "See all" and row taps they were
      // built for now stay inside v2, which is the whole reason they exist.
      'app/v2/drafts.tsx',
      'app/v2/listing/[id].tsx',
      'app/v2/listings.tsx',
      // "+ add a want" — the want composer sheet exists only in the old UI
      'app/v2/matches.tsx',
      'app/v2/messages.tsx',
      // hands off to the shipped processing screen — DECISIONS.md item 2
      'app/v2/scan/analyzing.tsx',
      'src/features/v2/home/BuyingPane.tsx',
      // `SellingPane.tsx` dropped off this list 2026-09-25, verified against
      // this test's own regexes directly (not just by re-running the suite):
      // neither `OLD_PATH` nor `OLD_ROUTE` match the file's current source.
      // "or type the details" moved from the shipped form (`routes.scanDetail`)
      // into the assistant (`/v2/chat`), inside v2; `onScan` still pushes
      // `routes.scanCamera`, which — like `scanDetail` — was never actually
      // in `OLD_ROUTE`'s list, so it was never what put this file here.
      //
      // `app/v2/index.tsx` dropped off this list 2026-09-25 too, for an
      // unrelated reason: it is no longer the Home screen. Home's whole body
      // (bell → `routes.labNotifications`, which is what put it here) moved
      // to `src/features/v2/home/HomeScreen.tsx` unchanged, as one pane of
      // `RootTabsPager`; `index.tsx` itself is now four lines that just mount
      // that pager. The bell exit did not close — it moved file, which is why
      // `HomeScreen.tsx` is added to this same scan below, still leaking.
      'src/features/v2/home/HomeScreen.tsx',
    ]);
  });

  /**
   * The specific regression the user hit. `routes.scanHome` is
   * `/(lab)/(tabs)/home` — v2's own Home is `routes.v2Home`. Nothing inside v2
   * should ever send someone to the OLD home, least of all with `replace`.
   */
  it('never sends anyone to the OLD home', () => {
    const offenders = tsxUnder(V2_APP)
      .map((r) => `app/v2/${r}.tsx`)
      .concat(['src/features/v2/home/SellingPane.tsx', 'src/features/v2/home/BuyingPane.tsx'])
      .filter((rel) => /routes\.scanHome|'\/\(lab\)\/\(tabs\)\/home'/.test(read(rel)));

    expect(offenders).toEqual([]);
  });
});

describe('v2 chrome consistency', () => {
  /**
   * The `EN` badge is a CONTROL where `BrandBar` is given `onLanguage` and a
   * plain LABEL where it is not — identical in appearance either way. It opens
   * the language sheet on two screens and does nothing on the rest, which is a
   * decision still open with the user.
   *
   * Asserted so that "two of six" in the docs stays true, and so that wiring
   * the other four (the likely resolution) is noticed here.
   */
  it('wires the language sheet on exactly Home and the assistant', () => {
    // `index.tsx` stopped being Home 2026-09-25 — it now just mounts
    // `RootTabsPager`. Home's body, `onLanguage` included, moved unchanged to
    // `src/features/v2/home/HomeScreen.tsx`, so that file is scanned instead.
    const withLanguage = readdirSync(V2_APP)
      .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
      .filter((f) => read(`app/v2/${f}`).includes('onLanguage'))
      .sort();
    const homeScreenHasIt = read('src/features/v2/home/HomeScreen.tsx').includes('onLanguage');

    expect(withLanguage).toEqual(['chat.tsx']);
    expect(homeScreenHasIt).toBe(true);
  });

  /**
   * ⚑ THE TAB BAR MUST YIELD TO THE KEYBOARD.
   *
   * `KeyboardProvider` disables Android's `adjustResize`, so with the IME open
   * the window stays full height — measured on RMX2151, `mFrame=[0,0][1080,2400]`.
   * `TabBar` is a flex SIBLING below the content, so a static height goes on
   * reserving 78 + `insets.bottom` at the bottom of that window, behind the
   * keyboard. Every screen that lifts its own footer by the keyboard height
   * then overshoots by exactly that much.
   *
   * It shipped that way: on `/v2/chat` the composer floated 330px above the
   * keyboard (measured — composer bottom y1207, keyboard top y1537) and the
   * thread was squeezed so hard the three starter prompts had no room to draw.
   * After the collapse the same measurement is 52px, which is the composer's
   * own padding.
   *
   * This asserts the SHAPE that fixes it, because the failure is invisible to
   * a render test that does not raise a real IME: the height must be derived
   * from the keyboard inset, never a constant. Restoring
   * `height: control.tabBar + insets.bottom` as a static style fails here.
   *
   * Behaviour borrowed from React Navigation's `tabBarHideOnKeyboard`, which
   * defaults to TRUE; we cannot use the option itself because `app/v2/_layout`
   * is a `Stack` and this bar is a plain component `Screen` renders.
   */
  it('collapses the tab bar while the keyboard is open', () => {
    // Comments stripped, so the prose above `barHeight` — which quotes the
    // static style this replaced — cannot satisfy or defeat the matches below.
    const src = read('src/features/v2/ui/TabBar.tsx')
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
      .join('\n');

    // Derived from the reconciled 3-channel inset, not a keyboard boolean.
    expect(src).toMatch(/useKeyboardInset\(\)/);

    // The height is animated, and the ramp resolves to zero when the keyboard
    // is fully open.
    expect(src).toMatch(/useAnimatedStyle\(/);
    expect(src).toMatch(/height:\s*barHeight\s*\*\s*\(1\s*-\s*t\)/);

    // And the static height it replaced must not come back.
    expect(src).not.toMatch(/height:\s*control\.tabBar\s*\+\s*insets\.bottom\s*,/);
  });
});
