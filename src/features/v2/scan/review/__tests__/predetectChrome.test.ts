/**
 * A screen may not assert a flow total it might not have.
 *
 * Task: `todo/SCANV2_V2UI_02_PREDETECT_CHROME.md`.
 *
 * `v2StepProgress` returns `null` when the item count is not yet known, which is
 * the whole point of `spine.ts`. That contract only holds if consumers HANDLE
 * the null instead of asserting it away. `v2StepProgress(...)!.total` compiles,
 * reads fine in review, and puts a guessed denominator back on screen — so this
 * guard bans the shapes that do it.
 *
 * ── WHAT THIS TEST DELIBERATELY DOES NOT TOUCH ────────────────────────────
 *
 * `app/v2/scan/analyzing.tsx` renders "STEP n OF 5". That 5 is the number of
 * BACKEND DETECTION PHASES, named at `analyzing.tsx:141-146` and emitted in
 * order by the server — its own comment at `:137` calls it "a real count and not
 * a guess". It is not flow chrome and it is not a guess, and removing it would
 * strip a server-backed progress count out of a loading state, which
 * `UX_DESIGN_RULES.md` explicitly forbids.
 *
 * An earlier draft of this task said to delete it. That was wrong — the defect
 * was in the design mock, not the code. See `MISTAKES.md` 2026-09-21. If a
 * future sweep flags that string again: two different quantities wear the same
 * label. Check what the number counts before touching it.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..', '..', '..');

/**
 * ⚠️ BOTH TREES, and that is a 2026-09-22 correction.
 *
 * This scanned only `app/v2/scan` — where the count of files containing
 * `REVIEW_STEP_TOTAL` is **zero**. The four review SCREENS live there, but the
 * component that actually renders the step chrome, `reviewKit.tsx`, lives under
 * `src/features/v2/scan/review/`, outside the scanned tree. So the test named
 * "no scan screen asserts a flow total it may not have" was green while the
 * fixed total rendered on four screens through an import.
 *
 * A guard that scans the wrong directory is worse than no guard: it reports
 * safety. Caught by a review pass, not by the suite.
 */
const SCAN_DIRS = [join(ROOT, 'app', 'v2', 'scan'), join(ROOT, 'src', 'features', 'v2', 'scan')];

/**
 * Files allowed to mention the banned shapes, each with the reason and the task
 * that retires it. ENUMERATED rather than scoped away, so the list itself is
 * the record of what is left — and so a NEW adopter fails immediately.
 *
 * - `wizardState.ts` DEFINES `REVIEW_STEP_TOTAL`; the constant has to live
 *   somewhere while the four review sub-steps exist.
 *
 * `reviewKit.tsx` WAS here — `StepHeader` computed `Step n of 4` and a percent
 * from the constant. Both were deleted on 2026-09-22 (the four-row `Timeline`
 * rail on each review screen already carries position, better), so the
 * exemption stopped being load-bearing and the check below failed until it was
 * removed. That is the mechanism working: an exemption cannot outlive its
 * reason.
 *
 * `spine.ts` is deliberately NOT here: it names the constant only in prose, and
 * `sourcesUnder` strips comments, so it never matches. Listing it would have
 * been a permanent stale entry — which the load-bearing check below caught on
 * the first run.
 */
const EXEMPT: readonly string[] = ['wizardState.ts'];

function sourcesUnder(dir: string): { rel: string; code: string }[] {
  const out: { rel: string; code: string }[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry)) {
        out.push({
          rel: p.slice(ROOT.length + 1).replace(/\\/g, '/'),
          // Comments stripped: this file and the screens discuss the rule in
          // prose, and an assertion satisfied by a sentence ABOUT a total is
          // worse than no assertion.
          code: readFileSync(p, 'utf8')
            .split('\n')
            .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
            .join('\n'),
        });
      }
    }
  };
  walk(dir);
  return out;
}

describe('no scan screen asserts a flow total it may not have', () => {
  /**
   * The three shapes that put a guessed denominator back on screen:
   * a non-null assertion on the progress, a numeric fallback, or reading the
   * old fixed constant.
   */
  const BANNED: readonly { pattern: RegExp; why: string }[] = [
    { pattern: /v2StepProgress\([^)]*\)\s*!/, why: 'non-null assertion on v2StepProgress' },
    { pattern: /v2StepProgress\([^)]*\)\s*\?\?\s*\{/, why: 'numeric fallback for a missing total' },
    { pattern: /REVIEW_STEP_TOTAL/, why: 'the old fixed four-step total' },
  ];

  it.each(BANNED.map((b) => [b.why, b.pattern] as const))(
    'no scan file outside the exempt list uses %s',
    (_why, pattern) => {
      const offenders = SCAN_DIRS.flatMap(sourcesUnder)
        .filter((f) => !f.rel.includes('__tests__'))
        .filter((f) => !EXEMPT.some((e) => f.rel.endsWith(e)))
        .filter((f) => pattern.test(f.code))
        .map((f) => f.rel);

      expect(offenders).toEqual([]);
    },
  );

  /**
   * THE EXEMPT LIST IS ITSELF ASSERTED, so it cannot rot into a permanent
   * amnesty. When the spine is finally wired, `reviewKit.tsx` stops matching and
   * this test fails — telling whoever did it to delete the entry rather than
   * leaving a stale excuse behind. This is the "enumerating test" pattern: a
   * prose "done" list hid a flat control twice before.
   */
  it('every exemption is still load-bearing', () => {
    const all = SCAN_DIRS.flatMap(sourcesUnder).filter((f) => !f.rel.includes('__tests__'));

    const stale = EXEMPT.filter((e) => {
      const file = all.find((f) => f.rel.endsWith(e));
      // Gone from the tree, or no longer mentions any banned shape.
      return !file || !BANNED.some((b) => b.pattern.test(file.code));
    });

    expect(stale).toEqual([]);
  });
});

describe("analyzing's five-phase counter is left alone", () => {
  /**
   * Pinned so a future "strip the step totals" sweep cannot quietly delete it.
   * If this fails, someone removed a real count — read the docblock above before
   * updating the assertion.
   */
  it('still names the five backend phases', () => {
    const code = readFileSync(join(ROOT, 'app', 'v2', 'scan', 'analyzing.tsx'), 'utf8');

    for (const phase of [
      'validating',
      'preparing_documents',
      'ai_running',
      'extracting_products',
    ]) {
      expect(code).toContain(phase);
    }
  });
});
