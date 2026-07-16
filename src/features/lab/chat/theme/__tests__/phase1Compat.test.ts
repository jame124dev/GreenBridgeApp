import { describe, it, expect } from '@jest/globals';

import { brand, warnAmber } from '@/constants/theme';

import { phase1CompatLight } from '../phase1Compat';
import type { CompatToken } from '../phase1Compat';

// PR-3B-0: proves each Phase-1 compat alias resolves to the CURRENT theme.ts
// value, so card migrations that consume them stay pixel-identical. These are
// temporary bridges (see phase1Compat.ts) — this test also documents the mapping.

describe('phase1CompatLight — value parity with current theme.ts', () => {
  const cases: [CompatToken, string][] = [
    ['border.divider', brand.divider],
    ['status.warningSurface', brand.warningBg],
    ['status.warningStrong', brand.warningText],
    ['status.successSurface', brand.successBg],
    ['status.successBorder', brand.successBorder],
    ['status.infoStrong', brand.infoText],
    ['status.infoSurface', brand.infoBg],
    ['accent.meterWarn', warnAmber],
  ];

  it.each(cases)('%s === current value', (token, expected) => {
    expect(phase1CompatLight[token]).toBe(expected);
  });

  it('covers exactly the declared compat tokens (no orphans)', () => {
    expect(Object.keys(phase1CompatLight).sort()).toEqual(cases.map((c) => c[0]).sort());
  });
});
