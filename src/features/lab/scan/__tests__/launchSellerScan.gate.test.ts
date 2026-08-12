/**
 * Task 4 — the sell gate.
 *
 * `launchSellerScan()` is the choke point in front of the five chat/home entry
 * points into the listing flow. Three things are asserted here, because any one
 * of them failing ships an ungated sell path:
 *
 *  1. **Behaviour** — anything that is not exactly `status === 'approved'` in
 *     the `/seller-upgrade/my-status` cache routes to the application screen and
 *     touches nothing else. It fails CLOSED for a cold cache (`undefined`) too:
 *     the honest answer to "may this user list?" before the status has ever been
 *     fetched is "ask", not "yes".
 *
 *  2. **Topology, within the customer fork** — the gate is inside the function, so
 *     every call site is covered by construction. The static scan proves the
 *     premise: the five call sites do no gating of their own.
 *
 *  3. **Topology, app-wide** — the section at the very bottom. The Phase 3 review
 *     caught that (2) was too narrow: resuming a saved draft reaches the same
 *     `/scan/*` screens from `src/features/scanner`, outside both `app/(lab)` and
 *     `src/features/lab`, so a (lab)-scoped scan could never have seen it. There
 *     are TWO choke points, sharing ONE predicate — `canEnterScanFlow()` — and the
 *     app-wide enumeration is what makes a third door fail the build.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
// ⚠️ JEST DOES NOT LOAD `.env`, so `IS_CUSTOMER` is `false` in this process while
// EVERY shipped profile sets `EXPO_PUBLIC_USER_TYPE: "customer"` (eas.json lines
// 18/39/60) — verified by probe. `canEnterScanFlow()` short-circuits to `true` for
// the seller fork, so without this override these tests would exercise the
// allow-all path and quietly stop testing the gate at all.
jest.mock('@/lib/flags', () => ({
  ...(jest.requireActual('@/lib/flags') as typeof import('@/lib/flags')),
  IS_CUSTOMER: true,
}));
// The axios instance reads expo-constants at module load; the gate never makes a
// request, so a stub is enough to keep the import graph out of native modules.
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn(), post: jest.fn() },
}));
// `reset` is created inside the factory (babel-plugin-jest-hoist runs the factory
// before module-scope assignments) and closed over, so `getState().reset` is the
// same spy on every call.
jest.mock('@/stores/scanDraftStore', () => {
  const reset = jest.fn();
  return { useScanDraft: { getState: () => ({ reset }) } };
});

import { router } from 'expo-router';

import { launchSellerScan } from '../launchSellerScan';
import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { queryClient } from '@/lib/queryClient';
import { useScanDraft } from '@/stores/scanDraftStore';

const push = router.push as unknown as jest.Mock;
const draftReset = () =>
  (useScanDraft.getState() as unknown as { reset: jest.Mock }).reset;

const APPLY_ROUTE = '/(lab)/sell/apply';

const row = (status: string) => ({
  status,
  company_name: 'Acme',
  admin_notes: null,
  reviewed_at: null,
});

beforeEach(() => {
  push.mockReset();
  draftReset().mockReset();
  queryClient.clear();
});

afterEach(() => {
  // `setQueryData` on an unobserved query arms a garbage-collection timer
  // (5 minutes by default on the shared client). `clear()` destroys the queries
  // and their timers — without it Jest reports "did not exit one second after
  // the test run had completed".
  queryClient.clear();
});

describe('launchSellerScan — the sell gate', () => {
  it('sends an unapproved user to the application form', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, null);
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('lets an approved seller straight into the scan flow', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
  });

  it.each(['pending', 'rejected'])('blocks a %s application', (status) => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row(status));
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('fails closed when the status has never been fetched', () => {
    // No setQueryData at all — getQueryData returns undefined.
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('fails closed on an unrecognised status rather than guessing approved', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('APPROVED_PENDING_REVIEW'));
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('does not touch the scan draft when it blocks', () => {
    // A blocked attempt must be a pure navigation: wiping the draft here would
    // destroy in-progress work belonging to a flow the user never entered.
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('pending'));
    launchSellerScan();
    expect(draftReset()).not.toHaveBeenCalled();
  });

  it('flushes the scan draft when it lets the user through', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
    launchSellerScan();
    expect(draftReset()).toHaveBeenCalledTimes(1);
  });

  it('marks the status stale so the screen it opens shows the server’s answer', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('pending'));
    launchSellerScan();
    expect(queryClient.getQueryState(SELLER_UPGRADE_KEY)?.isInvalidated).toBe(true);
  });

  it('navigates exactly once per call', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, null);
    launchSellerScan();
    expect(push).toHaveBeenCalledTimes(1);
  });
});

// ── Topology: one gate, five call sites, no side doors ──────────────────────
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

/**
 * Every call site, with the number of calls in each. Gating inside
 * `launchSellerScan` covers all of them; this list exists so that ADDING a
 * caller (or a second sell entry point) is a visible, deliberate change rather
 * than a silent hole.
 */
const CALL_SITES: Record<string, number> = {
  'app/(lab)/(tabs)/home.tsx': 2, // onPhoto + onAttach
  'app/(lab)/chat.tsx': 2, // camera + attach composer buttons
  'src/features/lab/chat/controllers/useChatController.ts': 1, // entry-card upload
};

/**
 * Files allowed to mention the identifier at all, in code — an ALLOW-list, so the
 * assertion is "no unknown reference" rather than "these files exist". The
 * application screen is on it because its APPROVED state hands control straight
 * back to the gate (`onPress={launchSellerScan}`) instead of duplicating the
 * camera push: a reference, not a bypass.
 */
const ALLOWED_REFERENCES = new Set([...Object.keys(CALL_SITES), 'app/(lab)/sell/apply.tsx']);

/**
 * Source with comments removed — a docblock naming the function is not a call.
 * `{/*` is treated as a block start too: JSX comments are how the (lab) layout
 * documents its screens, and they do not begin with a bare `/*`.
 */
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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

/** Files under app/(lab) and src/features/lab — the customer fork. */
function labFiles(): string[] {
  return [
    ...walk(path.join(ROOT, 'app', '(lab)')),
    ...walk(path.join(ROOT, 'src', 'features', 'lab')),
  ];
}

describe('the gate has no bypass', () => {
  it('is called from exactly the known five places', () => {
    const found: Record<string, number> = {};
    for (const file of labFiles()) {
      // The gate's own file declares it; that is not a call site.
      if (rel(file).endsWith('scan/launchSellerScan.ts')) continue;
      const calls = codeOf(fs.readFileSync(file, 'utf8')).match(/launchSellerScan\(\)/g) ?? [];
      if (calls.length) found[rel(file)] = calls.length;
    }
    expect(found).toEqual(CALL_SITES);
    expect(Object.values(found).reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('is referenced nowhere unexpected in the customer fork', () => {
    // Catches a NEW entry point added by reference rather than by call — the one
    // way a sixth sell door could appear without tripping the count above.
    const unknown = labFiles()
      .filter((f) => !rel(f).endsWith('scan/launchSellerScan.ts'))
      .filter((f) => codeOf(fs.readFileSync(f, 'utf8')).includes('launchSellerScan'))
      .map(rel)
      .filter((f) => !ALLOWED_REFERENCES.has(f))
      .sort();
    expect(unknown).toEqual([]);
  });

  it('no call site re-implements or short-circuits the check', () => {
    // A local `useCanSell()` / status read at a call site is the failure mode
    // this forbids: four of five sites would drift out of sync with the fifth.
    const offenders: string[] = [];
    for (const file of Object.keys(CALL_SITES)) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const needle of ['useCanSell', 'SELLER_UPGRADE_KEY', 'my-status']) {
        if (src.includes(needle)) offenders.push(`${file} → ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('launchSellerScan is the only (lab) door into the scan flow', () => {
    const offenders: string[] = [];
    for (const file of labFiles()) {
      if (rel(file).endsWith('scan/launchSellerScan.ts')) continue;
      for (const line of codeOf(fs.readFileSync(file, 'utf8')).split('\n')) {
        if (/routes\.scanCamera|routes\.scanListingMethod|['"`]\/scan\/camera/.test(line)) {
          offenders.push(rel(file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── Every door into /scan/*, app-wide ───────────────────────────────────────
//
// The (lab)-scoped test above missed the real second door: resuming a saved draft
// lands on `/scan/detail` / `/scan/grouped-review` / `/scan/detection` — and, for
// a draft with no photos, `/scan/camera` — from `src/features/scanner`, which is
// outside `app/(lab)` and `src/features/lab` entirely. This section enumerates
// EVERY file app-wide that can put a user inside the scan flow, so the next one
// added fails the build rather than shipping ungated.

/** The scan-flow AUTHORING screens. `/scan/drafts` (a list), `/scan/success`
 *  (post-submit) and `/(tabs)` are deliberately NOT here — a buyer may see them. */
const SCAN_AUTHORING = [
  'scanCamera',
  'scanListingMethod',
  'scanProcessing',
  'scanProcessingV2',
  'scanDetection',
  'scanDetail',
  'scanGroupedReview',
  'scanGroupedEdit',
  'scanReorderPhotos',
];

const AUTHORING_PUSH = new RegExp(
  `router\\.(push|replace|navigate)\\(` +
    `|routes\\.(${SCAN_AUTHORING.join('|')})\\b` +
    `|['"\`]/scan/(camera|listing-method|detail|detection|processing)`,
);

/**
 * Files that can put the user inside the scan flow, and why each is safe.
 *
 *  gated       — calls `canEnterScanFlow()`; asserted below, so deleting the
 *                guard fails this suite.
 *  seller-fork — `app/(tabs)/*` is never mounted when `IS_CUSTOMER`, and in the
 *                seller fork listing IS the product.
 *  inside-flow — only reachable once a gated choke point has already let the user
 *                in (e.g. the Detail screen's "retake photos").
 *  via-gated    — does not push a scan route itself; delegates to `resumeDraftById`,
 *                 which is gated. Listed so it stays visible rather than exempt.
 */
const SCAN_FLOW_DOORS: Record<string, 'gated' | 'seller-fork' | 'inside-flow' | 'via-gated'> = {
  'src/features/lab/scan/launchSellerScan.ts': 'gated',
  'src/features/scanner/useResumeDraft.ts': 'gated',
  'app/(tabs)/index.tsx': 'seller-fork',
  'app/(tabs)/scan.tsx': 'seller-fork',
  'src/features/scanner/components/detail/useDetailController.ts': 'inside-flow',
  // The background-recognition "draft ready" toast's "View" action. A GLOBAL
  // entry point — it can fire on any screen — which is precisely why the guard
  // belongs in `resumeDraftById` rather than on the surfaces that call it.
  'src/features/scanner/surfaceDraftReady.tsx': 'via-gated',
};

/** Everything under app/ and src/, minus the scan flow's own screens. */
function appWideFiles(): string[] {
  const out: string[] = [];
  for (const dir of ['app', 'src']) walk(path.join(ROOT, dir), out);
  // `app/scan/**` IS the flow. Its one buyer-reachable screen, `drafts.tsx`, gets
  // its own assertion below rather than an exemption.
  return out.filter((f) => !rel(f).startsWith('app/scan/'));
}

describe('every door into the scan flow is accounted for', () => {
  it('no file outside the allow-list pushes a scan authoring screen', () => {
    const doors = new Set<string>();
    for (const file of appWideFiles()) {
      for (const line of codeOf(fs.readFileSync(file, 'utf8')).split('\n')) {
        // Both halves must be on the line: a `router.push(` AND a scan authoring
        // target. `routes.ts` itself only DEFINES the paths, so it never matches.
        if (!/router\.(push|replace|navigate)\(/.test(line)) continue;
        if (
          new RegExp(
            `routes\\.(${SCAN_AUTHORING.join('|')})\\b|['"\`]/scan/(camera|listing-method|detail|detection|processing)`,
          ).test(line)
        ) {
          doors.add(rel(file));
        }
      }
    }
    // Resume doors push a route computed at runtime (`getScanResumeRoute`), which
    // no line-level regex can see — count importing it as a door too.
    for (const file of appWideFiles()) {
      const code = codeOf(fs.readFileSync(file, 'utf8'));
      if (/getScanResumeRoute|resumeDraftById/.test(code) && !rel(file).includes('scanResume')) {
        doors.add(rel(file));
      }
    }
    const unknown = [...doors].filter((f) => !(f in SCAN_FLOW_DOORS)).sort();
    expect(unknown).toEqual([]);
  });

  it('both choke points actually call the shared predicate', () => {
    // Guards against the guard being deleted while the door stays open.
    const gated = Object.entries(SCAN_FLOW_DOORS)
      .filter(([, why]) => why === 'gated')
      .map(([file]) => file);
    expect(gated).toHaveLength(2);
    for (const file of gated) {
      const code = codeOf(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      // The CALL form, not the bare identifier: deleting the guard body while
      // leaving the import behind must fail this (it did, on the first attempt —
      // the assertion originally matched the unused import and passed).
      expect({ file, calls: code.includes('canEnterScanFlow()') }).toEqual({ file, calls: true });
      expect({ file, redirects: code.includes('redirectToSellerApplication()') }).toEqual({
        file,
        redirects: true,
      });
    }
  });

  it('there is exactly ONE definition of the predicate', () => {
    // Two copies drifting apart is the failure this phase was reviewed for.
    const definitions = appWideFiles()
      .filter((f) => /export function canEnterScanFlow/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(definitions).toEqual(['src/features/seller/scanFlowGate.ts']);
  });

  it('the drafts list has no scan-authoring push of its own', () => {
    // Answers the specific question "can the drafts screen START a new scan?".
    // Its empty state is inert copy today; a future "Start a listing" button there
    // would be an ungated door, so it fails here instead.
    const code = codeOf(fs.readFileSync(path.join(ROOT, 'app', 'scan', 'drafts.tsx'), 'utf8'));
    const offending = code
      .split('\n')
      .filter((line) => AUTHORING_PUSH.test(line) && /router\./.test(line));
    expect(offending).toEqual([]);
  });
});
