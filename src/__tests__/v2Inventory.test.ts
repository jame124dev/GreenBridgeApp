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
      // Detected items — the review screen for a MULTI-item draft, added
      // 2026-09-17. No canvas artboard: 7a–7e cover the single-item path only,
      // and a draft from the document lane (18 items in the first real test)
      // had no screen at all before this. See `Docs/v2/WEB-PARITY.md` #1–#2.
      'scan/items',
      'scan/review/details',
      'scan/review/location',
      'scan/review/photos',
      'scan/review/pricing',
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
   * ONE LEFT, 2026-09-17: `details.tsx`'s Category → Choose was wired to the
   * shipped `CategoryPickerSheet`, so it acts now instead of explaining itself.
   *
   * That one was not cosmetic. `detailSchema` requires a category, so a draft
   * the scan could not place was UNPUBLISHABLE from v2 with no control able to
   * fix it — and both single-item drafts on the test account were in exactly
   * that state. Wiring publish while this still printed a sentence would have
   * shipped a Submit button no real draft could reach.
   */
  const SITES = ['app/v2/scan/review/photos.tsx'] as const;

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

  it('is one, on one screen', () => {
    const perFile = Object.fromEntries(SITES.map((f) => [f, sitesIn(f)]));

    // 7b Rearrange — the last one.
    //
    // The count over time, each drop a real wiring rather than a deletion of
    // the notice:
    //   7 → 5  (2026-09-16) 7c + 7b "Save as draft" stopped explaining and
    //                       started committing device-locally.
    //   5 → 2  (2026-09-17) 2a `lot.tsx` and 2b `bid.tsx` were REMOVED; both
    //                       rendered `MOCK_LOT`, nothing navigated to either,
    //                       and bidding already works inside the Browse WebView.
    //   2 → 1  (2026-09-17) 7c Category → Choose now opens the shipped
    //                       `CategoryPickerSheet`.
    //
    // "Save as draft" also stopped being device-only on 2026-09-17 — all four
    // steps now POST through `useSaveDraft`, and 7e publishes through
    // `usePublishDraft`. Neither was ever counted here (they buzzed and
    // returned rather than printing), but the `TODO(v2-writes)` note that used
    // to sit in this comment is gone with them.
    expect(perFile).toEqual({
      'app/v2/scan/review/photos.tsx': 1,
    });
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
  it.each([['app/v2/lot.tsx'], ['app/v2/bid.tsx'], ['app/v2/voice.tsx']])(
    'no longer exists (%s)',
    (rel) => {
      expect(exists(rel)).toBe(false);
    },
  );

  /**
   * And nothing may quietly route to them again. A dangling push compiles fine
   * under expo-router's typed routes only until someone regenerates types, and
   * on device it is a dead primary action — the exact failure the removal was
   * meant to end.
   */
  it('has no route left pointing at the removed screens', () => {
    for (const rel of v2Files()) {
      expect(codeOf(rel)).not.toMatch(/['"`]\/v2\/(?:lot|bid)['"`]/);
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
      .concat(['src/features/v2/home/SellingPane.tsx', 'src/features/v2/home/BuyingPane.tsx'])
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
      'app/v2/index.tsx',
      'app/v2/listing/[id].tsx',
      'app/v2/listings.tsx',
      // "+ add a want" — the want composer sheet exists only in the old UI
      'app/v2/matches.tsx',
      'app/v2/messages.tsx',
      // hands off to the shipped processing screen — DECISIONS.md item 2
      'app/v2/scan/analyzing.tsx',
      'app/v2/scan/camera.tsx',
      'src/features/v2/home/BuyingPane.tsx',
      'src/features/v2/home/SellingPane.tsx',
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
    const withLanguage = readdirSync(V2_APP)
      .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
      .filter((f) => read(`app/v2/${f}`).includes('onLanguage'))
      .sort();

    expect(withLanguage).toEqual(['chat.tsx', 'index.tsx']);
  });
});
