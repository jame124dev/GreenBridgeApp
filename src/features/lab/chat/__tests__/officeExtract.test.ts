/**
 * The office/extract classifier — the guard that keeps a spreadsheet away from
 * the photo-detect engine.
 *
 * The cases below are the ones that actually decide behaviour, not a sweep of
 * every extension: the real seller file that started this, the legacy `.xls`
 * the web comment says two of three real spreadsheets use, and the two ways the
 * rule can be wrong in opposite directions (matching mid-name, or missing a
 * capitalised extension).
 */
import { describe, it, expect } from '@jest/globals';

import {
  hasOfficeExtractFile,
  isOfficeExtractFile,
  officeExtractFiles,
} from '../officeExtract';

describe('office/extract classification', () => {
  it('claims the office formats the web sends down the durable lane', () => {
    for (const name of [
      'SOTW04060設備清單對照表0705.xlsx', // the real seller file, non-ASCII name
      'equipment.xls', // legacy Excel
      'list.csv',
      'spec.docx',
      'deck.pptx',
    ]) {
      expect(isOfficeExtractFile({ name })).toBe(true);
    }
  });

  it('leaves photos and PDFs to the detect engine', () => {
    for (const name of ['nameplate.jpg', 'plate.PNG', 'manual.pdf', 'clip.mp4']) {
      expect(isOfficeExtractFile({ name })).toBe(false);
    }
  });

  /**
   * The trailing `$` in the extension rule is load-bearing, and this is the
   * assertion that proves it. Without it, `.csv` matches mid-name and a PDF
   * gets diverted away from detect — a silent regression in the opposite
   * direction from the bug this guard fixes.
   */
  it('does not match an extension appearing mid-name', () => {
    expect(isOfficeExtractFile({ name: 'csv-export-notes.pdf' })).toBe(false);
    expect(isOfficeExtractFile({ name: 'xlsx.jpg' })).toBe(false);
  });

  it('is case-insensitive — a Windows shell yields .XLSX', () => {
    expect(isOfficeExtractFile({ name: 'INVENTORY.XLSX' })).toBe(true);
  });

  it('uses the MIME when a caller has one, even with no extension', () => {
    expect(
      isOfficeExtractFile({
        name: 'download',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ).toBe(true);
  });

  it('survives the empty and malformed cases', () => {
    expect(isOfficeExtractFile(null)).toBe(false);
    expect(isOfficeExtractFile(undefined)).toBe(false);
    expect(isOfficeExtractFile({})).toBe(false);
    expect(isOfficeExtractFile({ name: null })).toBe(false);
    expect(hasOfficeExtractFile(null)).toBe(false);
    expect(hasOfficeExtractFile([])).toBe(false);
  });

  /**
   * A MIXED set is the case that matters most: one spreadsheet alongside three
   * photos must still divert, because detect cannot read the spreadsheet and
   * silently dropping it would lose the seller's inventory list.
   */
  it('flags a mixed set, and can name the offending files', () => {
    const staged = [
      { name: 'nameplate.jpg' },
      { name: 'inventory.xlsx' },
      { name: 'side.jpg' },
    ];

    expect(hasOfficeExtractFile(staged)).toBe(true);
    expect(officeExtractFiles(staged).map((f) => f.name)).toEqual(['inventory.xlsx']);
  });
});
