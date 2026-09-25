/**
 * No v2 screen pads its own content for the tab bar.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 *
 * `Screen` owns the tab-bar reserve, and for a tab screen that reserve is
 * **zero** — `useTabBarReserve` / `bottomReserve = tabBar ? 0 : insets.bottom`
 * (`src/features/v2/ui/Screen.tsx:146,257-260`). The bar is a real flex sibling
 * below the scroll area, so it already occupies its own height and the gesture
 * bar. `Screen`'s own comment records why:
 *
 *   *"It used to reserve `control.tabBar` as empty space because no tab bar
 *   existed yet, which is why every screen ended in a void."*
 *
 * Three screens that own their own `FlatList` kept adding
 * `control.tabBar + insets.bottom` anyway — `control.tabBar` is **78**
 * (`theme/v2/scale.ts:303`) — so each ended in ~78pt plus the inset of dead
 * space, below a bar already occupying exactly that. Two sibling screens
 * (`chat.tsx`, `messages.tsx`) do it correctly through `useTabBarReserve()`, so
 * the same design was implemented two ways.
 *
 * The comment above one of them read *"The list owns its own bottom reserve —
 * never a hardcoded number"*, which is self-refuting: `control.tabBar` IS the
 * hardcoded reserve, just spelled as a token.
 *
 * ── WHY THIS IS A SOURCE ASSERTION ─────────────────────────────────────────
 *
 * The failure is empty space at the end of a scroll. It renders perfectly, no
 * test throws, and it is only visible after scrolling a real list to the bottom
 * on a device — which is why it survived in three files at once.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const SCAN_DIRS = [join(ROOT, 'app', 'v2'), join(ROOT, 'src', 'features', 'v2')];

/**
 * Files allowed to compute a tab-bar offset, with the reason.
 *
 * - `TabBar.tsx` IS the bar — it sizes itself from the same token.
 * - `SchemeToggleDev.tsx` is an absolutely-positioned dev-only control that has
 *   to sit ABOVE the bar. That is placement, not content padding, and it is not
 *   shipped (`__DEV__` only).
 *
 * `Screen.tsx` is NOT here, which surprised me: it owns the reserve but never
 * names the token in code — `bottomReserve = tabBar ? 0 : insets.bottom`
 * (`Screen.tsx:146`). It discusses `control.tabBar` only in prose, and prose is
 * stripped. The load-bearing check below caught the stale entry on the first
 * run.
 *
 * ⚠️ Comments only strip when their continuation lines begin with `*`. A block
 * comment written without them survives the strip and can trip this gate with
 * its own explanation — which is exactly what happened while fixing the three
 * screens, and why their notes are JSDoc-style.
 */
const EXEMPT: readonly string[] = ['TabBar.tsx', 'SchemeToggleDev.tsx'];

/** `control.tabBar` added to an inset — the hand-rolled reserve, in any spacing. */
const HAND_ROLLED = /control\.tabBar\s*\+\s*insets\.bottom/;

function sourcesUnder(dir: string): { rel: string; code: string }[] {
  const out: { rel: string; code: string }[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry)) {
        out.push({
          rel: p.slice(ROOT.length + 1).replace(/\\/g, '/'),
          // Comments stripped: several of these files discuss the reserve in
          // prose, and an assertion satisfied by a sentence ABOUT the rule is
          // worse than no assertion.
          code: readFileSync(p, 'utf8')
            .split('\n')
            .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
            .join('\n'),
        });
      }
    }
  };
  for (const d of [dir]) walk(d);
  return out;
}

describe('the tab-bar reserve belongs to Screen', () => {
  it('no v2 screen adds its own', () => {
    const offenders = SCAN_DIRS.flatMap(sourcesUnder)
      .filter((f) => !f.rel.includes('__tests__'))
      .filter((f) => !EXEMPT.some((e) => f.rel.endsWith(e)))
      .filter((f) => HAND_ROLLED.test(f.code))
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });

  /**
   * The exemptions are asserted too, so none can outlive its reason — the same
   * mechanism that caught a stale entry in `predetectChrome.test.ts` on its
   * first run.
   */
  it('every exemption is still load-bearing', () => {
    const all = SCAN_DIRS.flatMap(sourcesUnder).filter((f) => !f.rel.includes('__tests__'));

    const stale = EXEMPT.filter((e) => {
      const file = all.find((f) => f.rel.endsWith(e));
      return !file || !/control\.tabBar/.test(file.code);
    });

    expect(stale).toEqual([]);
  });
});
