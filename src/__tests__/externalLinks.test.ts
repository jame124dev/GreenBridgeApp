/**
 * The app's outbound web links must not point at dead pages.
 *
 * App Review rejected 1.0.0 (10) under Guideline 2.1(a) — "An error message
 * displayed at the account registration" — because the login screen's
 * "Request an account" opened `seller.greenbidz.com/contact`, which renders
 * "404 — Oops! Page not found". A second dead link (`greenbidz.com/dashboard/
 * settings`) sat on the pending screen, which is exactly where an unapproved
 * reviewer lands.
 *
 * ⚠️ WHY A STATUS-CODE CHECK DOES NOT CATCH THIS: both are single-page apps.
 * The server answers **HTTP 200** and the 404 is rendered client-side, so
 * `curl -o /dev/null -w '%{http_code}'` reports a healthy 200 for a dead page.
 * These URLs must be verified by RENDERING them, not by their status code.
 *
 * This test cannot make network calls, so it does the next best thing: it pins
 * the outbound URLs so a regression is deliberate, and hard-fails on the two
 * URLs already known to be dead.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Verified dead — rendered in a real browser and returned a 404 page. */
const KNOWN_DEAD = [
  'https://seller.greenbidz.com/contact',
  'https://greenbidz.com/dashboard/settings',
];

/** Verified live, by rendering. Update only after checking in a browser. */
const APPROVED = {
  'app/(auth)/login.tsx': 'https://greenbidz.com/contact-us/',
  'app/(auth)/pending.tsx': 'https://seller.greenbidz.com/dashboard/settings',
} as const;

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every source file that can open an external web page. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  for (const d of ['app', 'src']) {
    const p = path.join(ROOT, d);
    if (fs.existsSync(p)) walk(p);
  }
  return out;
}

describe('outbound web links', () => {
  it('never references a URL known to render a 404', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = fs.readFileSync(file, 'utf8');
      for (const dead of KNOWN_DEAD) {
        // Ignore the explanatory comments that name the dead URL on purpose.
        const lines = src.split('\n');
        lines.forEach((line, i) => {
          if (!line.includes(dead)) return;
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
          offenders.push(`${path.relative(ROOT, file)}:${i + 1} → ${dead}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  for (const [file, url] of Object.entries(APPROVED)) {
    it(`${file} still points at the verified page`, () => {
      expect(read(file)).toContain(url);
    });
  }
});
