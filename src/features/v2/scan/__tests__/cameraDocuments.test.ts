/**
 * The v2 camera must be able to attach a DOCUMENT, not only a photo.
 *
 * ── THE GAP THIS PINS ─────────────────────────────────────────────────────
 *
 * `app/scan/camera.tsx` — the shipped camera — has had a document lane since
 * the office-docs work: a folder control bottom-left of the shutter
 * (`app/scan/camera.tsx:764-784`), `DocumentPicker.getDocumentAsync` at
 * `:309`, a per-mime size pre-flight at `:82-96`, and the picked files written
 * to the draft with `patch({ documents: docs })` at `:421`.
 *
 * `app/v2/scan/camera.tsx` shipped with none of it, and v2 Home's "Scan it"
 * now routes here (`src/features/v2/scan/startV2Scan.ts:47`). So a seller who
 * has a spec sheet — the single richest input the detector takes — has no way
 * to hand it over from the v2 flow. Reported from the device: "last time we
 * have upload document option same screen now I can't find".
 *
 * ── WHY SOURCE ASSERTIONS ─────────────────────────────────────────────────
 *
 * The three failure modes here are all invisible to a render test:
 *
 *  1. A control that opens the picker for a GUEST. `useSmartDetect.ts:63-71`
 *     throws `'Sign in required to analyze documents'` when there is no
 *     `profile.id`, and v2's scan flow is deliberately open to guests
 *     (`startV2Scan.ts`). Attaching first and failing at the processing screen
 *     is the dead end — the gate has to be in front of the picker.
 *
 *  2. `patch()` EARLY-RETURNS when `current` is null
 *     (`src/stores/scanDraftStore.ts:822-824`). A `patch({documents})` written
 *     before `start()` silently does nothing: no throw, no log, and the
 *     documents simply are not in the draft the processing screen reads.
 *
 *  3. A documents-only scan being blocked by a `photos.length === 0` guard.
 *     The shipped camera allows it on purpose (`app/scan/camera.tsx:409-416`)
 *     because the backend analyses PDF page-images.
 *
 * None of those render differently. They are pinned as source.
 */
import { describe, it, expect } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Comments stripped — this file and the screen both discuss the lane in prose. */
function codeOf(rel: string): string {
  return read(rel)
    .split('\n')
    .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
    .join('\n');
}

const CAMERA = 'app/v2/scan/camera.tsx';
const PICKER = 'src/features/v2/scan/pickScanFiles.ts';
/**
 * The start-then-patch sequence moved OUT of the camera on 2026-09-22, when
 * the intake screen became a second door into the same run. It now lives in
 * one place so the ordering rule cannot drift between the two doors — so the
 * ordering assertion below follows it here, and the camera is instead pinned
 * to DELEGATE rather than to re-implement it.
 */
const RUNNER = 'src/features/v2/scan/startScanRun.ts';

describe('v2 camera — the document lane exists', () => {
  it('has a picker module the screen can call', () => {
    expect(existsSync(join(ROOT, PICKER))).toBe(true);
  });

  it('opens the system document picker, accepting any file type', () => {
    const code = codeOf(PICKER);
    expect(code).toMatch(/getDocumentAsync/);
    // Parity with `app/scan/camera.tsx:309-313` — any type, multi-select,
    // copied to the cache dir so the uri survives the picker closing.
    expect(code).toMatch(/type:\s*'\*\/\*'/);
    expect(code).toMatch(/multiple:\s*true/);
    expect(code).toMatch(/copyToCacheDirectory:\s*true/);
  });

  it('keeps the per-mime size pre-flight and the ASCII filename flattening', () => {
    const code = codeOf(PICKER);
    // The Android multipart filename round-trip — `app/scan/camera.tsx:46-74`.
    expect(code).toMatch(/safeDocumentName/);
    // The caps mirrored from `controller/wordPressSmart.js:2534-2548`.
    expect(code).toMatch(/'\.docx'/);
    expect(code).toMatch(/'\.xlsx'/);
    expect(code).toMatch(/'\.pdf'/);
  });

  it('routes picked IMAGES into photos, not into documents', () => {
    // Same split the shipped camera makes at `app/scan/camera.tsx:321-337`:
    // an image picked from Files is a photo and gets compressed.
    expect(codeOf(PICKER)).toMatch(/compressPhoto/);
  });

  it('exposes the control on the v2 camera', () => {
    const code = codeOf(CAMERA);
    expect(code).toMatch(/pickScanFiles/);
    expect(code).toMatch(/mobile\.scanv2\.camera\.addFile/);
  });
});

describe('v2 camera — a guest is gated BEFORE the picker opens', () => {
  it('wraps the pick in requireAuth', () => {
    const code = codeOf(CAMERA);
    expect(code).toMatch(/requireAuth/);

    // The gate must CONTAIN the pick, not sit beside it. Anything within the
    // 200 characters that follow `requireAuth(` is the gated callback.
    const gated = code.match(/requireAuth\([\s\S]{0,200}/)?.[0] ?? '';
    expect(gated).toMatch(/pick/i);
  });

  it('never calls the picker outside the gate', () => {
    const code = codeOf(CAMERA);
    // Exactly one call site, and it is the gated one.
    const calls = code.match(/\bpickScanFiles\(/g) ?? [];
    expect(calls.length).toBe(1);
  });

  it('tells a guest what the control will ask for', () => {
    expect(codeOf(CAMERA)).toMatch(/mobile\.scanv2\.camera\.addFileGuestHint/);
  });
});

describe('v2 camera — picked documents reach the draft', () => {
  it('patches them onto the draft', () => {
    expect(codeOf(CAMERA)).toMatch(/patch\(\s*\{[\s\S]{0,40}documents/);
  });

  /**
   * Trap 2 above. `start()` is what creates `current`; a patch before it is a
   * no-op that looks like a write.
   */
  it('patches AFTER start(), never before', () => {
    const code = codeOf(RUNNER);
    expect(code).toMatch(/\.start\(photos\);[\s\S]{0,400}?documents/);
  });

  /**
   * ...and the camera must DELEGATE to it rather than grow its own copy of the
   * sequence again. Without this, the assertion above could stay green against
   * `startScanRun` while the screen quietly reintroduced a `patch()` before a
   * `start()` of its own — which is the exact bug, in the exact file, that the
   * assertion above was written to prevent.
   */
  it('the camera delegates the sequence instead of re-implementing it', () => {
    const code = codeOf(CAMERA);
    expect(code).toMatch(/startScanRun\(\{\s*photos,\s*docs\s*\}\)/);
    expect(code).not.toMatch(/\.start\(photos\)/);
  });

  /** Append mode already has a draft — its documents must be merged, not replaced. */
  it('merges into the existing documents when appending', () => {
    expect(codeOf(CAMERA)).toMatch(/documents:\s*\[\s*\.\.\./);
  });

  it('lets a documents-only scan go forward', () => {
    const code = codeOf(CAMERA);
    expect(code).toMatch(/photos\.length === 0 && docs\.length === 0/);
    // And the old `photos.length === 0` bail must be gone.
    expect(code).not.toMatch(/starting \|\| photos\.length === 0\)/);
  });

  it('shows what is attached, with a way to take it back', () => {
    expect(codeOf(CAMERA)).toMatch(/mobile\.scanv2\.camera\.removeFile/);
  });
});
