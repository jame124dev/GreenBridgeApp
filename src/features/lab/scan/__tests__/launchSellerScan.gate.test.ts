/**
 * Task 4 — the sell gate.
 *
 * `launchSellerScan()` is the single choke point in front of the listing flow.
 * Two things are asserted here, because either one failing ships an ungated
 * sell path:
 *
 *  1. **Behaviour** — anything that is not exactly `status === 'approved'` in
 *     the `/seller-upgrade/my-status` cache routes to the application screen and
 *     touches nothing else. It fails CLOSED for a cold cache (`undefined`) too:
 *     the honest answer to "may this user list?" before the status has ever been
 *     fetched is "ask", not "yes".
 *
 *  2. **Topology** — the gate is inside the function, so every call site is
 *     covered by construction. The static scan at the bottom proves the premise
 *     that makes that true: the five call sites do no gating of their own, and
 *     no other (lab) file enters the scan flow behind the gate's back.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
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
      const src = fs.readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        if (/routes\.scanCamera|routes\.scanListingMethod|['"`]\/scan\/camera/.test(line)) {
          offenders.push(`${rel(file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
