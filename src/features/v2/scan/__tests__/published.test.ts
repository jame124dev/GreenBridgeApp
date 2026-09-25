/**
 * A published listing must land somewhere that carries its batch number.
 *
 * Task: `todo/SCANV2_V2UI_08_PUBLISHED.md`.
 *
 * Today `usePublishDraft` shows a toast and `router.replace('/v2')`, and its
 * `onSuccess` signature is `(count: number) => () => …` — a thunk that takes the
 * ITEM COUNT and ignores the mutation's response entirely. The response is not
 * empty: `useCreateListing.ts:61` returns `{ batchPk, batchNumber, productId }`,
 * and the shipped grouped flow already destructures
 * `{ batchPk, batchNumber, itemCount, groupId, items }` at
 * `app/scan/grouped-review.tsx:205`.
 *
 * So the batch number exists and v2 throws it away. That number is what the
 * seller quotes when they ask about their listing later, which is why landing on
 * Home with a toast is not merely thin — it destroys the one piece of
 * information the moment was for.
 *
 * These are source assertions rather than a render test on purpose: the failure
 * mode is a value being dropped on the way out of a callback, which renders
 * perfectly and is invisible to a snapshot.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Comments stripped — both files discuss the batch number in prose at length. */
function codeOf(rel: string): string {
  return read(rel)
    .split('\n')
    .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
    .join('\n');
}

const PUBLISH_HOOK = 'src/features/v2/scan/review/usePublishDraft.ts';
const PUBLISHED_SCREEN = 'app/v2/scan/published.tsx';

describe('publish lands on a screen that keeps the batch number', () => {
  it('has a published screen', () => {
    expect(existsSync(join(ROOT, PUBLISHED_SCREEN))).toBe(true);
  });

  /**
   * The regression this pins: an `onSuccess` that takes only a count cannot
   * forward a batch number, however the landing is written.
   */
  it('reads the batch number out of the mutation response', () => {
    expect(codeOf(PUBLISH_HOOK)).toMatch(/batchNumber/);
  });

  it('carries the batch number into the landing', () => {
    const code = codeOf(PUBLISH_HOOK);

    // The landing is called with the batch number, not just a count.
    expect(code).toMatch(/landAfterPublish\([^)]*batchNumber/);
  });

  it('no longer dumps the seller on /v2 with only a toast', () => {
    const code = codeOf(PUBLISH_HOOK);

    expect(code).not.toMatch(/router\.replace\(\s*['"]\/v2['"]\s*\)/);
  });

  /**
   * Publish is not a numbered step in either spine, so the success screen sits
   * past the flow and must not draw step chrome. Chrome belonging to a state
   * must not render outside that state (v2-screen skill).
   */
  it('renders no step chrome', () => {
    const code = codeOf(PUBLISHED_SCREEN);

    expect(code).not.toMatch(/STEP \d+ OF \d+/);
    expect(code).not.toMatch(/v2StepProgress/);
    expect(code).not.toMatch(/REVIEW_STEP_TOTAL/);
  });

  it('shows the batch number to the seller', () => {
    expect(codeOf(PUBLISHED_SCREEN)).toMatch(/batchNumber/);
  });
});

/**
 * ── THE DESTINATION, NOT THE SCREEN ───────────────────────────────────────
 *
 * Found by reading `app/v2/listings.tsx` after this task had already been
 * called code-complete: the Published screen's ONE primary action is
 * `View my listings` → `routes.v2Listings` → `useRecentSubmissions`, which is a
 * cached `useQuery` with `staleTime: 60_000`, and NEITHER publish mutation
 * invalidates anything.
 *
 * So the seller publishes, taps the button that promises their listings, and —
 * inside the first minute, which is the only minute this ever happens in —
 * lands on a list served from a cache that predates their publish. The listing
 * they just made is the one thing missing from it.
 *
 * This is worse than the toast-on-Home it replaced, because a CTA reading
 * "View my listings" makes a promise that Home's passive section did not. It is
 * exactly the trap the workspace rule names: *changing where a flow lands means
 * re-verifying the destination — its conditions were written for the old
 * callers, not for you.*
 *
 * The invalidation lives in `usePublishDraft`, not in the shared mutations:
 * `src/features/scanner/**` is outside this session's paths (`_SESSION_LOCKS.md`
 * rule 2), and v2's publish path is the correct owner of v2's landing anyway.
 */
const LISTINGS_SCREEN = 'app/v2/listings.tsx';
const RECENT_SUBMISSIONS = 'src/features/scanner/useRecentSubmissions.ts';

describe('the landing shows the listing that was just published', () => {
  /**
   * The premise, pinned. Without these two the fix below is cargo cult — and if
   * someone later drops the staleTime or adds invalidation upstream, this fails
   * and says so rather than leaving a redundant invalidation in place forever.
   */
  it('still has a stale-cached destination to invalidate', () => {
    expect(codeOf(LISTINGS_SCREEN)).toMatch(/useRecentSubmissions/);
    expect(codeOf(RECENT_SUBMISSIONS)).toMatch(/staleTime:\s*[1-9]/);
  });

  /**
   * ⚠️ CORRECTED 2026-09-22. This block previously asserted the OPPOSITE — that
   * "the shared publish mutations still do not invalidate it themselves" — and
   * passed, because it grepped the two mutation files for the literal
   * `invalidateQueries` and they call a named helper instead. The premise was
   * false, so the "fix" it guarded (a duplicate invalidation in
   * `usePublishDraft`) was redundant, and the test could never have fired the
   * warning its own comment promised.
   *
   * A negative grep is not evidence of absence. These assertions now pin what
   * is actually true, and they are written so that REMOVING the upstream
   * invalidation breaks them.
   */
  it('both publish mutations invalidate the listings the landing reads', () => {
    const helper = codeOf('src/features/scanner/invalidateRecentSubmissions.ts');

    // The helper really does invalidate that key, as a prefix (no `limit`), so
    // it covers Home's page size and the listings screen's alike.
    expect(helper).toMatch(/invalidateQueries/);
    expect(helper).toMatch(/recentSubmissions/);

    for (const rel of [
      'src/features/scanner/useCreateListing.ts',
      'src/features/scanner/useSubmitGroupedListing.ts',
    ]) {
      expect(codeOf(rel)).toMatch(/invalidateRecentSubmissions\(/);
    }
  });

  /**
   * And v2 must NOT add its own. Kept as an assertion rather than a comment so
   * the duplicate cannot quietly come back the next time someone greps the
   * mutation files for the wrong string.
   */
  it('v2 does not duplicate that invalidation', () => {
    const code = codeOf(PUBLISH_HOOK);

    expect(code).not.toMatch(/invalidateQueries/);
    expect(code).not.toMatch(/useQueryClient/);
  });
});

/**
 * ── THE PUBLISHED DRAFT MUST STOP BEING A DRAFT ────────────────────────────
 *
 * `usePublishDraft` resets the local store and clears the server draft's ID from
 * `useServerDraft`, but never tells the BACKEND the draft was published. The row
 * stays `status: 'active'`, and both drafts surfaces filter on exactly that
 * (`app/v2/drafts.tsx`, `SellingPane.tsx`), so a published draft sits under
 * "Your drafts" for ever. Tapping it resumes the same items — and publishing
 * again creates a SECOND live listing of the same equipment.
 *
 * The endpoint and the hook already exist and have **no callers**:
 * `draftApi.markDraftPublished()` → `PATCH /drafts/:id/published`, wrapped by
 * `draftHooks.useMarkDraftPublished()`, which also invalidates `draftKeys.all`
 * on success — so one call closes both the stale-row and the stale-list halves.
 *
 * ⚠️ The premise here is pinned by asserting the MECHANISM EXISTS, not by
 * grepping the publish hook for the absence of a call. Pinning a premise with
 * the same probe that found it is how the invalidation claim above went wrong.
 */
const DRAFT_HOOKS = 'src/services/drafts/draftHooks.ts';
const DRAFT_API = 'src/services/drafts/draftApi.ts';

describe('publishing retires the server draft', () => {
  it('the mark-published mechanism exists and refreshes the list', () => {
    const api = codeOf(DRAFT_API);
    const hooks = codeOf(DRAFT_HOOKS);

    expect(api).toMatch(/markDraftPublished/);
    expect(api).toMatch(/\/published/);
    // The hook invalidates the drafts list itself, which is why the publish
    // path does not need its own invalidation.
    expect(hooks).toMatch(/useMarkDraftPublished/);
    expect(hooks).toMatch(/invalidateQueries\(\{\s*queryKey:\s*draftKeys\.all\s*\}\)/);
  });

  it('the drafts surfaces really do key off the active status', () => {
    // If this ever stops being true, a published-but-active row would no longer
    // be visible and this whole guard would be pointless — so it is asserted
    // rather than assumed.
    expect(codeOf('app/v2/drafts.tsx')).toMatch(/status === 'active'/);
  });

  it('marks the draft published on success', () => {
    const code = codeOf(PUBLISH_HOOK);

    expect(code).toMatch(/useMarkDraftPublished|markDraftPublished/);
  });

  it('sends the batch ids the publish actually returned', () => {
    const code = codeOf(PUBLISH_HOOK);

    // `useSubmitGroupedListing` returns `batchIds`; `useCreateListing` returns a
    // single `batchPk`. Both have to reach the PATCH.
    expect(code).toMatch(/batchIds/);
    expect(code).toMatch(/batchPk/);
  });

  it('still clears the local server-draft handle afterwards', () => {
    expect(codeOf(PUBLISH_HOOK)).toMatch(/useServerDraft\.getState\(\)\.clear\(\)/);
  });
});

describe('the success screen is the end of the flow, not a page on top of it', () => {
  /**
   * Back from "Sent for review" used to walk the seller through the wizard in
   * reverse — and through a RESET store, so each of `review/pricing`,
   * `review/details` and `review/photos` rendered its cold-open "Nothing to
   * review yet". One back-press replaced "your listing is published" with
   * "there is nothing to review".
   *
   * The review steps `push` each other, so those three frames are still on the
   * stack when publish `replace`s the last one. Dismissing the pushed stack
   * first leaves `[/v2, published]`, so Back goes Home.
   */
  it('clears the review stack before landing', () => {
    const code = codeOf(PUBLISH_HOOK);

    expect(code).toMatch(/dismissAll\(\)/);
    // Guarded — `dismissAll` throws when there is nothing to dismiss.
    expect(code).toMatch(/canDismiss\(\)/);
  });

  /**
   * And the landing must be a PUSH after that dismiss, not a replace: replacing
   * the stack root would leave `[published]` alone, so Back would exit the app
   * instead of going Home.
   */
  it('lands with a push so Back reaches Home', () => {
    const code = codeOf(PUBLISH_HOOK);

    expect(code).toMatch(/router\.push\(\{/);
  });
});

describe('the success screen survives a malformed link', () => {
  /**
   * `useLocalSearchParams` returns `string | string[]` at runtime — the generic
   * only asserts the type. A duplicated query param (`?batchNumber=1&batchNumber=2`
   * from a deep link or a restored URL) yields an array, and `.trim()` on it
   * throws: a white screen for someone who has just published.
   *
   * `count` and `titles` already survive it (`parseInt` coerces, `JSON.parse`
   * throws into an existing catch); only `batchNumber` was unguarded.
   */
  it('normalises every param before using it', () => {
    const code = codeOf(PUBLISHED_SCREEN);

    expect(code).toMatch(/Array\.isArray/);
    // The raw `.trim()` straight off a param is what breaks.
    expect(code).not.toMatch(/\(params\.batchNumber \?\? ''\)\.trim\(\)/);
  });
});
