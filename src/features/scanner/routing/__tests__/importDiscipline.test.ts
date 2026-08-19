import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * blockers (d) + (e), as a gate rather than a grep in a plan document.
 *
 * (e) The scan store and the analyze path need the supported-marketplace list
 *     SYNCHRONOUSLY, so they must import the MMKV-only cache module and never
 *     the transport one. `supportedMarketplaces.ts` imports
 *     `@/api/greenbidzClient`, which CALLS `attachGreenbidzInterceptors` at
 *     module load — a side effect — and pulls in
 *     interceptors -> services/auth/logout -> features/lab/messages/socket
 *     (socket.io-client) + lib/secureStorage. Neither `socket.io-client` nor
 *     `expo-secure-store` is in jest.config.js's transformIgnorePatterns
 *     allow-list, so the day either ships ESM, two pure store suites that have
 *     nothing to do with networking go red.
 *
 * (d) `routingState.ts` is imported BY VALUE from the store. That is safe only
 *     while every import in it is `import type` (erased by Babel's TS
 *     transform). A single value import there creates a real runtime require
 *     cycle scanDraftStore -> routingState -> scanDraftStore.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SYNC_CONSUMERS = ['src/stores/scanDraftStore.ts', 'app/scan/processing.tsx'];

describe('blocker (e) — the store must not be able to reach axios', () => {
  for (const rel of SYNC_CONSUMERS) {
    it(`${rel} imports the cache module, not the transport`, () => {
      const src = read(rel);
      const imports = src
        .split('\n')
        .filter((l) => /^import\s/.test(l.trim()) || /^\s+from '/.test(l));
      const joined = imports.join('\n');
      // The transport module, imported: forbidden.
      expect(joined).not.toMatch(/from '@\/features\/scanner\/routing\/supportedMarketplaces';/);
      // The cache module: required.
      expect(joined).toMatch(
        /from '@\/features\/scanner\/routing\/supportedMarketplacesCache';/,
      );
      // And no direct axios client either.
      expect(joined).not.toMatch(/from '@\/api\/greenbidzClient'/);
    });
  }
});

describe('blocker (d) — routingState.ts stays import-type-only', () => {
  it('every import line is `import type`', () => {
    const lines = read('src/features/scanner/routing/routingState.ts')
      .split('\n')
      .filter((l) => l.startsWith('import'));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.startsWith('import type ')).toBe(true);
    }
  });

  it('the ask-trigger and the prefill rule have exactly ONE definition each', () => {
    // Both are exported from routingState.ts and nowhere else. A second
    // `function routingNeedsAsk` anywhere in src/ or app/ is the three-copies
    // regression blocker (d) was raised for. Test files are excluded — this file
    // quotes the patterns it searches for.
    const roots = ['src', 'app'];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name === 'node_modules') continue;
          walk(rel);
        } else if (/\.(ts|tsx)$/.test(e.name) && !rel.includes('__tests__')) {
          const src = read(rel);
          if (
            /function\s+routingNeedsAsk\b/.test(src) ||
            /function\s+shouldPrefillCategory\b/.test(src)
          ) {
            hits.push(rel);
          }
        }
      }
    };
    for (const r of roots) walk(r);
    expect(hits).toEqual(['src/features/scanner/routing/routingState.ts']);
  });
});
