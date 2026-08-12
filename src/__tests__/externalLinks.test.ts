/**
 * The app's outbound web links have now caused THREE App Store rejections, each
 * from a different failure mode. This test encodes all three lessons.
 *
 * 1. **Guideline 2.1(a) — build 10.** "An error message displayed at the account
 *    registration": the login screen's "Request an account" opened
 *    `seller.greenbidz.com/contact`, which renders "404 — Oops! Page not found".
 *    A second dead link (`greenbidz.com/dashboard/settings`) sat on the pending
 *    screen, which is exactly where an unapproved reviewer lands.
 *
 *    ⚠️ WHY A STATUS-CODE CHECK DOES NOT CATCH THIS: both are single-page apps.
 *    The server answers **HTTP 200** and the 404 is rendered client-side, so
 *    `curl -o /dev/null -w '%{http_code}'` reports a healthy 200 for a dead
 *    page. Such URLs must be verified by RENDERING them.
 *
 * 2. **Guideline 3.1.1 — build 14.** Fixing (1) by pointing those links at
 *    `greenbidz.com/contact-us/` created a WORSE problem. That page carries a
 *    Company field and a chat widget offering "auction services" / "list my
 *    equipment" / "free valuation", so App Review found:
 *
 *      "The app includes an account registration feature for businesses and
 *       organizations, which is considered access to external mechanisms for
 *       purchases or subscriptions to be used in the app.
 *       Next Steps: Remove the account registration features for business and
 *       organizations."
 *
 *    The app is therefore **sign-in only** and links to NO commercial or
 *    account-registration page. `BANNED` below is the enforcement.
 *
 * 3. The two rules pull in opposite directions, so neither list may be relaxed
 *    without re-reading both rejections. A link that is merely "alive" is not
 *    automatically safe, and a link that is "safe" is not automatically alive.
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

/**
 * Alive, but rejected under Guideline 3.1.1 — these are business/organization
 * sign-up and account-management surfaces. The app must not open any of them.
 * `greenbidz.com` is banned wholesale: its nav reaches the flagged contact form
 * in one tap, so linking the homepage is linking the funnel.
 */
const BANNED = [
  'https://greenbidz.com/contact-us/',
  'https://greenbidz.com/contact-us',
  'https://greenbidz.com',
  'https://seller.greenbidz.com/dashboard/settings',
  'https://seller.greenbidz.com/dashboard',
];

/**
 * Screens that App Review reached and rejected. They must contain NO outbound
 * web navigation at all — not a fixed URL, not one built at runtime.
 */
const MUST_NOT_NAVIGATE = ['app/(auth)/login.tsx', 'app/(auth)/pending.tsx'];

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Strip comments so an explanatory note naming a banned URL isn't a failure. */
function codeLines(src: string): { line: string; n: number }[] {
  let inBlock = false;
  return src.split('\n').flatMap((raw, i) => {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      return [];
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      return [];
    }
    if (line.startsWith('//') || line.startsWith('*')) return [];
    return [{ line: raw, n: i + 1 }];
  });
}

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

function scan(needles: string[]): string[] {
  const offenders: string[] = [];
  for (const file of sourceFiles()) {
    // The locale files legitimately mention greenbidz.com as display text.
    if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
    for (const { line, n } of codeLines(fs.readFileSync(file, 'utf8'))) {
      for (const needle of needles) {
        if (!line.includes(needle)) continue;
        // Only flag a real URL, not a longer unrelated one that contains it.
        const after = line.slice(line.indexOf(needle) + needle.length, line.indexOf(needle) + needle.length + 1);
        if (needle === 'https://greenbidz.com' && /[\w/-]/.test(after)) continue;
        offenders.push(`${path.relative(ROOT, file)}:${n} → ${needle}`);
      }
    }
  }
  return offenders;
}

describe('outbound web links', () => {
  it('never references a URL known to render a 404 (Guideline 2.1(a))', () => {
    expect(scan(KNOWN_DEAD)).toEqual([]);
  });

  it('never links to a business sign-up or account page (Guideline 3.1.1)', () => {
    expect(scan(BANNED)).toEqual([]);
  });

  for (const file of MUST_NOT_NAVIGATE) {
    it(`${file} performs no outbound navigation at all`, () => {
      const src = read(file);
      const nav = codeLines(src).filter(({ line }) =>
        /Linking\.openURL|WebBrowser\.openBrowserAsync|openAuthSessionAsync/.test(line),
      );
      expect(nav.map((l) => `${file}:${l.n} ${l.line.trim()}`)).toEqual([]);
    });
  }

  /**
   * The rule is "no OUTBOUND navigation", NOT "no signup".
   *
   * Guideline 3.1.1 objected to the app giving access to an EXTERNAL
   * registration mechanism. A native in-app signup is a different thing and is
   * what every marketplace app ships, so `/(auth)/register` is allowed and
   * expected. Enforce the real constraint: the entry point is a router push,
   * never a URL.
   */
  it('the login screen routes to native signup, not a web page', () => {
    const src = read('app/(auth)/login.tsx');
    const lines = codeLines(src);
    expect(lines.some(({ line }) => line.includes("router.push('/(auth)/register')"))).toBe(true);
    // Belt and braces: no http(s) literal anywhere in the screen's code.
    const urls = lines.filter(({ line }) => /['"`]https?:\/\//.test(line));
    expect(urls.map((l) => `${l.n}: ${l.line.trim()}`)).toEqual([]);
  });

  /**
   * Terms and Privacy are the ONE permitted exception: they are legal notices,
   * not a purchase or account-registration mechanism, and consent links are
   * expected on a signup screen. The allow-list is exact — any OTHER URL on this
   * screen (a contact form, a pricing page, a "request an account" funnel) is
   * the Guideline 3.1.1 failure all over again.
   */
  it('the registration screen opens nothing except the legal pages', () => {
    const ALLOWED = ['https://101lab.co/terms-of-service', 'https://101lab.co/privacy-policy'];
    const lines = codeLines(read('app/(auth)/register.tsx'));
    const urls = lines
      .filter(({ line }) => /['"`]https?:\/\//.test(line))
      .flatMap(({ line, n }) => {
        const m = line.match(/https?:\/\/[^'"`\s]+/g) ?? [];
        return m.filter((u) => !ALLOWED.includes(u)).map((u) => `${n}: ${u}`);
      });
    expect(urls).toEqual([]);
  });

  it('registration keeps company optional (a required one is business signup)', () => {
    const schema = read('src/features/auth/schema.ts');
    const m = schema.match(/company:\s*z\.string\(\)[^,\n]*/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('optional()');
  });
});
