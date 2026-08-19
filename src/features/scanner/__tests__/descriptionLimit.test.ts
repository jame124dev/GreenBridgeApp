import { describe, it, expect } from '@jest/globals';

import { DESCRIPTION_MAX, fitDescription } from '../descriptionLimit';
import { mapAnalyzeResponse } from '../mapAnalyze';
import { mapProductData } from '../mapSmartDetection';

/**
 * Device pass 2026-08-19: the AI's OWN description came back at 543 characters
 * against the 500 limit, and `DescriptionCard` then told the seller
 * "43 characters over the 500 limit — please shorten it."
 *
 * The seller did not write it and cannot be blamed for it, so the cut happens
 * where the AI's text becomes form state — in the two mappers. These tests pin
 * BOTH the cutting rule and the two call sites; a mapper that stops calling
 * `fitDescription` goes red here even though `fitDescription` itself still works.
 */

/** The measured device shape: prose, sentence-ended, 543 characters. */
function aiDescription(length: number): string {
  const sentence = 'This automated optical inspection machine has been fully serviced. ';
  let out = '';
  while (out.length < length) out += sentence;
  return out.slice(0, length);
}

describe('fitDescription — the AI must not hand the seller an over-limit field', () => {
  it('leaves a description that already fits completely alone', () => {
    const short = 'A serviced AOI machine, tested and working.';
    expect(fitDescription(short)).toBe(short);
  });

  it('trims surrounding whitespace but does not otherwise touch a short value', () => {
    expect(fitDescription('  padded  ')).toBe('padded');
  });

  it('treats an exactly-at-limit description as fitting — 500 is legal, 501 is not', () => {
    const exact = 'x'.repeat(DESCRIPTION_MAX);
    expect(fitDescription(exact)).toBe(exact);
    expect(fitDescription(exact).length).toBe(DESCRIPTION_MAX);
    expect(fitDescription('x'.repeat(DESCRIPTION_MAX + 1)).length).toBeLessThanOrEqual(
      DESCRIPTION_MAX,
    );
  });

  it('brings the measured 543-character AI description inside the limit', () => {
    const out = fitDescription(aiDescription(543));
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.length).toBeGreaterThan(0);
  });

  it('cuts at a sentence end when there is one, and adds no ellipsis', () => {
    const text = `${'a'.repeat(400)}. ${'b'.repeat(200)}`;
    const out = fitDescription(text);
    expect(out).toBe(`${'a'.repeat(400)}.`);
    expect(out.endsWith('…')).toBe(false);
  });

  it('never cuts on a decimal point or an abbreviation — "12.5 kg" is not a sentence', () => {
    // The only terminator inside the window is the one in "12.5", at 60%+ of the
    // limit. Accepting it would end the description mid-number.
    const text = `${'word '.repeat(60)}weighs 12.5 kg and ${'more '.repeat(120)}`;
    const out = fitDescription(text);
    expect(out).not.toMatch(/12\.$/);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it('falls back to a word boundary with an ellipsis, never mid-word', () => {
    const text = `${'alpha '.repeat(200)}`; // no sentence terminator at all
    const out = fitDescription(text);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith('…')).toBe(true);
    // Everything before the ellipsis is whole words.
    expect(out.slice(0, -1)).toMatch(/^(alpha ?)+$/);
    expect(out).not.toMatch(/alph…$/);
  });

  it('still produces text for a space-free script (zh/ja/th) instead of emptying it', () => {
    // ⛔ The trap in any threshold-only implementation: no spaces means no word
    // boundary and no sentence end, so a "cut at the last boundary" rule returns
    // ''. A Thai seller would lose the entire description.
    const thai = 'เครื่องตรวจสอบด้วยแสงอัตโนมัติ'.repeat(40);
    expect(thai.length).toBeGreaterThan(DESCRIPTION_MAX);
    const out = fitDescription(thai);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.length).toBeGreaterThan(DESCRIPTION_MAX - 5);
    expect(out.endsWith('…')).toBe(true);
  });

  it('never leaves half an emoji behind on a hard cut', () => {
    // 🔬 is a surrogate PAIR; a naive slice can end on the high half and emit a
    // replacement glyph. No spaces here, so this takes the hard-cut path.
    const out = fitDescription('🔬'.repeat(400));
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.slice(0, -1)).toBe('🔬'.repeat((out.length - 1) / 2));
    // No lone surrogate survived: re-encoding is lossless.
    expect([...out].every((ch) => ch === '🔬' || ch === '…')).toBe(true);
  });

  it('coerces the missing / non-string values the AI actually sends', () => {
    expect(fitDescription(undefined)).toBe('');
    expect(fitDescription(null)).toBe('');
    expect(fitDescription('')).toBe('');
    expect(fitDescription(1260)).toBe('1260');
  });
});

describe('both AI mappers cap the description — not just the helper', () => {
  const long = aiDescription(543);

  it('mapAnalyzeResponse (the /analyze-process-images path)', () => {
    const r = mapAnalyzeResponse({ equipment_description: long });
    expect(long.length).toBe(543);
    expect(r.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it('mapProductData (the smart-detect path) caps the field AND the ai snapshot', () => {
    const r = mapProductData({ equipment_description: long } as never, '101lab');
    expect(r.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    // The two must agree — `ai.description` is what processing.tsx patches onto
    // the draft, so a capped field with an uncapped snapshot would re-introduce
    // the bug through the other door.
    expect(r.ai.description).toBe(r.description);
  });

  it('leaves a normal-length AI description byte-identical on both paths', () => {
    const ok = 'Agilent 1260 Infinity HPLC, fully serviced and working.';
    expect(mapAnalyzeResponse({ equipment_description: ok }).description).toBe(ok);
    expect(
      mapProductData({ equipment_description: ok } as never, '101lab').description,
    ).toBe(ok);
  });
});
