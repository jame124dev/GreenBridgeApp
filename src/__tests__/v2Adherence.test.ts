/**
 * v2 design-system adherence — source-level.
 *
 * WHY A SOURCE TEST AND NOT A RENDER TEST
 *
 * Every rule below describes a failure that renders perfectly, throws nothing,
 * and is wrong on the phone. None of them can be caught by mounting the
 * component:
 *
 *  • A raw hex renders fine — it is just the wrong colour in dark mode.
 *  • An imported `lightPalette` renders fine — it just never updates when the
 *    scheme changes.
 *  • A function-form `style` prop renders fine — NativeWind's interop spreads
 *    `style`, spreading a function yields `{}`, and the state silently
 *    disappears. Jest cannot see it: the interop is skipped when
 *    NODE_ENV==='test', so the unit test passes and the device is broken.
 *    This one has already cost this codebase real debugging time.
 *  • A bare `fontSize` renders fine — it is just off the scale, by 0.5pt,
 *    eleven times, until nobody can say why the app feels untidy.
 *
 * Scope: `app/v2/**` and `src/features/v2/**`. The token modules themselves
 * (`src/theme/v2/**`) are where the literals are allowed to live.
 */
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCANNED = [join(ROOT, 'app', 'v2'), join(ROOT, 'src', 'features', 'v2')];

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // directory not created yet
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === '__snapshots__') continue;
      out = out.concat(walk(p));
    } else if (/\.tsx?$/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Development-only files, exempt from the design rules.
 *
 * `SchemeToggleDev` is a tool, not a surface. It renders `null` outside
 * `__DEV__` and is deliberately an off-palette magenta so it can never be
 * mistaken for part of the design — which is exactly what the raw-hex rule
 * would otherwise forbid.
 *
 * Keep this list at one entry if at all possible. Every name here is a hole.
 */
const DEV_ONLY = ['SchemeToggleDev.tsx'];

const files = SCANNED.flatMap(walk).filter(
  (f) => !DEV_ONLY.some((name) => f.endsWith(name)),
);
const rel = (f: string) => relative(ROOT, f).split(sep).join('/');

/** Strip comments so documentation examples and provenance notes do not trip the rules. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function scan(matcher: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = code(readFileSync(f, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      const m = line.match(matcher);
      if (m) hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
  return hits;
}

describe('v2 design-system adherence', () => {
  it('finds v2 source to check', () => {
    // Guards against the test silently passing because the glob broke.
    // Remove this expectation only when v2 is deleted.
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no raw hex colours — colours come from useV2Colors()', () => {
    // 'transparent' and rgba() scrims are allowed; a hex literal is not.
    expect(scan(/#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
  });

  it('does not import a palette directly — that will not re-render on a scheme change', () => {
    expect(scan(/\b(lightPalette|darkPalette|palettes)\b/)).toEqual([]);
  });

  it('sets no raw type properties — use <Text variant> or the `type` scale', () => {
    expect(scan(/\b(fontSize|fontFamily|letterSpacing|lineHeight|fontWeight)\s*:/)).toEqual([]);
  });

  it('has no function-form style props (NativeWind deletes them at runtime)', () => {
    expect(scan(/style=\{\s*\(/)).toEqual([]);
  });

  it('uses the radius scale, not raw borderRadius numbers', () => {
    // `radius.pill`, `radius.sm`… are fine; `borderRadius: 22` is not.
    expect(scan(/borderRadius(?:Bottom\w*|Top\w*)?\s*:\s*\d/)).toEqual([]);
  });

  it('uses the space scale for padding, margin and gap', () => {
    // 0–4 are allowed as sub-token optical nudges (the canvas has a 3pt one).
    expect(scan(/\b(padding|margin|gap)(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?\s*:\s*(?![0-4]\b)\d+/)).toEqual([]);
  });

  it('does not hardcode the tab-bar or safe-area height', () => {
    // The one true source is `control.tabBar` + useSafeAreaInsets().
    expect(scan(/\b(78|insets\.top\s*\+\s*\d{2,})\b(?!\s*\})/)).toEqual([]);
  });
});
