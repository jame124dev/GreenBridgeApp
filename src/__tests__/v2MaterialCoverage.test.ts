/**
 * v2 material coverage — every filled control either ramps or says why not.
 *
 * ── WHY THIS EXISTS ──
 *
 * The material pass was "rolled through the KIT so all twelve screens pick it
 * up at once and none can drift". Three times that failed the same way:
 * `IconAction` shipped flat and was caught months later by LOOKING at a screen;
 * `PillButton` shipped flat and survived the whole rollout, five screens and
 * three sign-offs, until someone asked "are we actually following material?";
 * then `Stepper` and `BrandBar` turned up within a second of the first version
 * of this test, after the kit had already been hand-audited twice.
 *
 * None was catchable by the existing tests, and the reason is structural:
 * `v2Contrast.test.ts` asserts that things which ramp ramp CORRECTLY, so a
 * component with no ramp at all is invisible to it. The completeness record was
 * a prose list in `V2_CHECKLIST.md` written by the same pass that did the work
 * — so an omission from the work was also an omission from the list, and
 * nothing cross-checked the two.
 *
 * This test is the cross-check. It ENUMERATES the population instead of
 * trusting a list, in two sweeps: the kit, and the screens.
 *
 * ── WHY SOURCE-LEVEL, NOT A RENDER TEST ──
 *
 * Same reason as `v2Adherence.test.ts`: a flat control renders perfectly. There
 * is nothing to assert about the output — the defect is an ABSENCE, and an
 * absence is only meaningful against the full list of things that should be
 * present. That is a property of the source tree, not of one mounted tree.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const KIT = join(ROOT, 'src', 'features', 'v2', 'ui');

/** A ground painted from a palette role — `backgroundColor: c.foo` / `c[foo]`. */
const PALETTE_GROUND = /backgroundColor:\s*[^,\n}]*\bc[.[]/;
const RAMPS = /\bMaterialFill\b|\bSurface\b|\bmaterial\(/;

/**
 * Kit components with no ramp, each for a stated reason.
 *
 * ⚠️ Adding a name here is a DESIGN DECISION, not a way to get green. The
 * reason must be one of: nothing to ramp (no fill), or the surface is
 * photography / a page ground / a hole in the app. "Not done yet" is not a
 * reason — wire it or leave the build red.
 */
const FLAT_ON_PURPOSE: Record<string, string> = {
  // No fill to ramp.
  'QuietAction.tsx': 'outlined — no fill',
  'BrandBar.tsx':
    'paints only a 20pt brand mark and a 7pt unread dot — neither is a control ground',
  'Hairline.tsx': 'a 1pt rule',
  'ProgressLine.tsx': 'a track, not a control',
  'Tabs.tsx': 'underline strip, no filled ground',
  'TabBar.tsx': 'the bar is a page ground; depth here would lift the whole chrome',

  // The ground is photography, and a ramp would tint the photograph.
  'ScrimPill.tsx': 'sits ON photography — see RowThumb / PromoBanner',

  // Structure and type, not controls.
  'Text.tsx': 'type',
  'SectionHeader.tsx': 'type + layout',
  'SectionNote.tsx': 'type + layout',
  'Screen.tsx': 'the page ground itself',
  'Motion.tsx': 'animation wrappers',
  'EmptyState.tsx': 'composes other kit pieces; paints no ground of its own',
  'Timeline.tsx': 'connector + dots',
  'StagedChip.tsx': 'composes Chip',
  'SchemeToggleDev.tsx': 'dev tool, deliberately off-palette',

  // Open design question — tracked in V2_CHECKLIST.md § Material.
  // NOT settled; parked with the question so the build stays honest about
  // which flats are decided and which are pending.
  //
  // ⚠️ `PickerRow` used to sit here as 'composes Row'. It does NOT — it
  // paints its own `surface` ground. A WRONG reason is worse than a missing
  // one: it reads as settled and nobody re-checks it. This list is only as
  // good as its reasons, so verify one before trusting it.
  'Bubble.tsx': 'PENDING: TintedRow (its analogue) ramps — decide together',
};

function kitFiles(): string[] {
  return readdirSync(KIT)
    .filter((e) => /\.tsx$/.test(e) && statSync(join(KIT, e)).isFile())
    .map((e) => join(KIT, e));
}

/** Every `.tsx` under the v2 screens, EXCLUDING the kit (swept separately). */
function screenFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) {
        if (e === '__tests__' || e === '__snapshots__' || e === 'ui') continue;
        walk(full);
      } else if (/\.tsx$/.test(full)) {
        out.push(full);
      }
    }
  };
  walk(join(ROOT, 'app', 'v2'));
  walk(join(ROOT, 'src', 'features', 'v2'));
  return out;
}

describe('v2 material coverage — the kit', () => {
  const files = kitFiles();

  it('finds the kit', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('every kit component that paints a palette ground ramps, or is exempt with a reason', () => {
    const offenders: string[] = [];

    for (const f of files) {
      const name = f.split(/[\\/]/).pop() as string;
      if (name in FLAT_ON_PURPOSE) continue;

      const src = readFileSync(f, 'utf8');
      if (PALETTE_GROUND.test(src) && !RAMPS.test(src)) {
        offenders.push(
          `${relative(ROOT, f)} — paints a palette ground but never ramps. ` +
            'Give it MaterialFill, or add it to FLAT_ON_PURPOSE with a reason.',
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the exemption list has no dead entries', () => {
    // A stale exemption is how a component silently loses its ramp later: the
    // name stays on the list, the file is renamed or deleted, and the next
    // component to take that name inherits a free pass.
    const present = new Set(files.map((f) => f.split(/[\\/]/).pop() as string));
    const dead = Object.keys(FLAT_ON_PURPOSE).filter((n) => !present.has(n));
    expect(dead).toEqual([]);
  });
});

/**
 * The kit sweep is necessary and NOT sufficient: screens hand-roll controls too
 * (3a's mic, 2a's hero buttons, the camera's roll chip), and every one of those
 * escapes a kit-only check. Same hole, one level up — so the same remedy.
 *
 * A screen exemption is per-LINE and written AT the line as a `flat:` marker,
 * not collected in a list here. A file-level list would be too coarse to be
 * honest: `camera.tsx` paints four grounds, three correctly flat (the
 * viewfinder, the shutter core, a control over the viewfinder) and one that is
 * a real accent button. Exempting the file would hide the button.
 */
const FLAT_MARKER = /\bflat:/;

/** `MaterialFill` normally sits as the first child, a line or two below. */
const LOOKAHEAD = 8;

describe('v2 material coverage — screens', () => {
  it('finds screens to check', () => {
    expect(screenFiles().length).toBeGreaterThan(10);
  });

  it('every hand-rolled palette ground either ramps or carries a `flat:` reason', () => {
    const offenders: string[] = [];

    for (const f of screenFiles()) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!PALETTE_GROUND.test(line)) return;

        const near = lines.slice(Math.max(0, i - 2), i + LOOKAHEAD).join('\n');
        if (/\bMaterialFill\b/.test(near)) return; // the element ramps
        if (FLAT_MARKER.test(near)) return; // a reason is written at the line

        offenders.push(`${relative(ROOT, f)}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
