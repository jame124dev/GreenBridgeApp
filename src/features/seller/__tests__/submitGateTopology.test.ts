/**
 * Topology: EVERY path that publishes a listing is gated.
 *
 * This replaces the old `/scan/*` door enumeration, which guarded the wrong
 * boundary once authoring became open. The invariant now is narrower and far more
 * important: a listing may not reach the backend unless `canSubmitListing()` said
 * yes.
 *
 * There are two publish paths, and they hit DIFFERENT endpoints — gating one and
 * forgetting the other is the exact mistake this file exists to prevent:
 *
 *   grouped  app/scan/grouped-review.tsx → useSubmitGroupedListing
 *            → POST /wp/create-grouped-listings
 *   single   useDetailController.onSubmitSingle → useCreateListing
 *            → POST /wp/create-product-direct + create batch
 *
 * Neither endpoint enforces seller approval server-side, so the client gate is
 * the only gate. A third path added without a check fails here.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** The submit mutation hooks — importing one means you can publish. */
const SUBMIT_HOOKS = ['useSubmitGroupedListing', 'useCreateListing'];

/**
 * Consumers of those hooks, and the file that must carry the gate for each.
 * `useDetailController` owns the single-submit callback, so the check lives there
 * rather than in the screen that renders its footer.
 */
const GATED_CONSUMERS: Record<string, string> = {
  'app/scan/grouped-review.tsx': 'app/scan/grouped-review.tsx',
  'src/features/scanner/components/detail/useDetailController.ts':
    'src/features/scanner/components/detail/useDetailController.ts',
};

/** Files allowed to name a submit hook without gating: the hooks' own modules. */
const HOOK_DEFINITIONS = new Set([
  'src/features/scanner/useSubmitGroupedListing.ts',
  'src/features/scanner/useCreateListing.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

/** Source with comments stripped — a docblock naming a hook is not a call. */
function codeOf(src: string): string {
  let inBlock = false;
  return src
    .split('\n')
    .filter((raw) => {
      const line = raw.trim();
      if (inBlock) {
        if (line.includes('*/')) inBlock = false;
        return false;
      }
      if (line.startsWith('/*') || line.startsWith('{/*')) {
        if (!line.includes('*/')) inBlock = true;
        return false;
      }
      return !(line.startsWith('//') || line.startsWith('*'));
    })
    .join('\n');
}

const appFiles = () => [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))];

describe('every publish path is gated', () => {
  it('the submit hooks are consumed only by the known, gated call sites', () => {
    const consumers: string[] = [];
    for (const file of appFiles()) {
      if (HOOK_DEFINITIONS.has(rel(file))) continue;
      const code = codeOf(fs.readFileSync(file, 'utf8'));
      if (SUBMIT_HOOKS.some((h) => code.includes(`${h}()`))) consumers.push(rel(file));
    }
    // A new screen that publishes must be added here WITH a gate — that is the
    // deliberate, visible change this assertion forces.
    expect(consumers.sort()).toEqual(Object.keys(GATED_CONSUMERS).sort());
  });

  it.each(Object.entries(GATED_CONSUMERS))(
    '%s checks canSubmitListing before publishing',
    (_consumer, gateFile) => {
      const code = codeOf(fs.readFileSync(path.join(ROOT, gateFile), 'utf8'));
      expect(code).toContain('canSubmitListing');
      expect(code).toContain('redirectToSellerApplication');
    },
  );

  it('no call site re-implements the check with its own status read', () => {
    // A local status comparison at a call site is the drift this forbids: the
    // predicate is the single definition of "may publish".
    const offenders: string[] = [];
    for (const file of Object.values(GATED_CONSUMERS)) {
      const code = codeOf(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      for (const needle of ["status === 'approved'", 'SELLER_UPGRADE_KEY', 'my-status']) {
        if (code.includes(needle)) offenders.push(`${file} → ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the two publish endpoints are reached from exactly the two known services', () => {
    // Catches a raw axios POST to either endpoint that bypasses the hooks (and so
    // bypasses the assertions above).
    const found: Record<string, string[]> = {};
    for (const file of appFiles()) {
      const code = codeOf(fs.readFileSync(file, 'utf8'));
      for (const ep of ['create-grouped-listings', 'create-product-direct']) {
        if (code.includes(ep)) (found[ep] ??= []).push(rel(file));
      }
    }
    expect(found['create-grouped-listings']).toEqual([
      'src/services/scanner/submitGroupedListings.ts',
    ]);
    expect(found['create-product-direct']).toEqual(['src/services/scanner/createProduct.ts']);
  });
});
