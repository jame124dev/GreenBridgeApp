/**
 * Walks every screen on the CONNECTED DEVICE and reports what is still in
 * English. One command, no tapping, no screenshots to read.
 *
 *     node scripts/sweep-device-i18n.js            # all routes
 *     node scripts/sweep-device-i18n.js v2         # routes matching "v2"
 *     node scripts/sweep-device-i18n.js --reset    # forget progress, start over
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Verifying the translation by hand cost most of a session: open a screen, tap
 * to the next, screenshot, read it, derive the next tap's coordinates from the
 * screenshot, repeat — and every keyboard that opened moved the targets and
 * produced a mis-tap. It also only ever covered ONE language.
 *
 * Two things make it fast instead:
 *   1. expo-router answers DEEP LINKS, so any screen is one `am start` away.
 *      No tap chain, no coordinates, nothing to mis-measure.
 *   2. `uiautomator dump` returns the text as DATA. Leftover English is then a
 *      string test, not something a human has to spot in a picture.
 *
 * ── WHAT IT CANNOT SEE ────────────────────────────────────────────────────
 *   - WebView content (the Browse tab) — the dump stops at the WebView.
 *   - A screen behind a disclosure, a sheet, or a tab that needs a tap.
 *   - Whether the translation is GOOD. It tells you a string is not English;
 *     only a speaker of the language can tell you it is right.
 * It is a net for the common failure, not a substitute for reading the screen.
 *
 * ── RESUMABLE ─────────────────────────────────────────────────────────────
 * Each finished route is appended to `scripts/out/.sweep-done`; a re-run skips
 * those. A dropped cable or a crashed app costs you one route, not the walk.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const DONE = path.join(OUT, '.sweep-done');
const SCHEME = 'greenbridge';
const PKG = 'com.greenbidz.bridge';

const argv = process.argv.slice(2);
const reset = argv.includes('--reset');
const includeLegacy = argv.includes('--legacy');
const filter = argv.find((a) => !a.startsWith('--'));

/**
 * ── SCOPE: v2 ONLY ────────────────────────────────────────────────────────
 *
 * The app still carries the pre-v2 screens — `(lab)` (18 pages), the old
 * `app/scan/*` flow, `listing/[id]`, `activity/*`. They are not where the
 * product is going, and translating them was explicitly ruled out as not worth
 * the effort (2026-10-01). Sweeping them anyway would pad the report with
 * failures nobody intends to fix, and a report full of accepted failures stops
 * being read.
 *
 * `(auth)` IS in scope: v2 routes a signed-out user straight into it, so it is
 * part of the v2 journey whatever folder it lives in.
 *
 * `--legacy` includes everything again, for the day that changes.
 */
const IN_SCOPE = (route) => /^\/v2\b/.test(route) || /^\/(login|register|pending|forgot-password)$/.test(route);

/**
 * Strings that are CORRECTLY Latin and must not be reported.
 *
 * Keeping this list honest is the whole value of the report: one wrong entry
 * here hides a real untranslated string for good. Everything in it is either a
 * brand, a unit, an identifier, or seller-entered data that the app never
 * translates.
 */
const ALLOWED = [
  /^[A-Z0-9][A-Z0-9\s\-_/.#&+()]*$/, // model numbers, SKUs, ALLCAPS tokens
  /^(GreenBidz|101LAB|101IT|101MACHINE|101RECYCLE)$/i,
  /^(USD|TWD|EUR|JPY|THB|VND|NT\$|\$|€|¥)/,
  /^(UTC|GMT[+-]\d+|EN|JA|TH|VI|ZH)$/,
  /^[\d\s.,:%+\-/#]+$/, // pure numbers, times, percentages
  /^(HPLC|DAD|CNC|GC|TLC|FPGA|HBM2|PDF|AI|UI|QR|SKU|ID)$/,
  /@/, // emails
  /^https?:/,
];

/** Seller-entered titles are data, not UI copy — they are never translated. */
const DATA_HINT = /^[A-Z][\w\s\-—,.()/&+]{25,}$/;

/**
 * Chrome that only exists in a DEBUG build and never ships.
 *
 * Both of these sit on top of every screen, so counting them scored all 22
 * reached screens as dirty and reported "clean screens: 0/22" on a run where
 * most screens were in fact fully translated. A permanent +2 on every row is
 * not a finding, it is a broken instrument.
 */
const DEV_ONLY = [
  /^SYS → (LIGHT|DARK)$/, // the dev scheme toggle, `SchemeToggleDev`
  /^Can't perform a React state update/, // LogBox / warning toast
  /^(Log \d+ of \d+|Render Error|Component Stack|Call Stack|See \d+ more components)$/,
];

const hasCJK = (s) => /[　-鿿＀-￯]/.test(s);
const hasThai = (s) => /[฀-๿]/.test(s);
const hasVietDiacritic = (s) => /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s);

/** Does this look like UI copy that should have been translated? */
function isLeftoverEnglish(s, lang) {
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[A-Za-z]{3,}/.test(t)) return false; // no Latin words at all
  if (DEV_ONLY.some((re) => re.test(t))) return false;
  if (ALLOWED.some((re) => re.test(t))) return false;
  if (DATA_HINT.test(t)) return false;
  // Already in the target script => translated (a mixed string like
  // "Agilent 1260 已送出" is fine: the copy around the model number is done).
  if (lang.startsWith('zh') && hasCJK(t)) return false;
  if (lang === 'ja' && hasCJK(t)) return false;
  if (lang === 'th' && hasThai(t)) return false;
  if (lang === 'vi' && hasVietDiacritic(t)) return false;
  return true;
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function deviceReady() {
  try {
    return /\tdevice\b/.test(sh('adb devices'));
  } catch {
    return false;
  }
}

/** Open a route by deep link and return the visible text, or null. */
function visit(route) {
  const url = `${SCHEME}://${route.replace(/^\//, '')}`;
  try {
    sh(`adb shell am start -a android.intent.action.VIEW -d "${url}"`);
  } catch {
    return null;
  }
  // Give the route time to mount and its first query to settle. Measured: a
  // list screen needs ~4s on this handset, so 5 is one retry's worth of slack.
  execSync('ping -n 6 127.0.0.1 > nul', { shell: 'cmd.exe' });
  const remote = `/sdcard/sweep.xml`;
  try {
    sh(`adb shell uiautomator dump ${remote}`);
    const xml = sh(`adb shell cat ${remote}`);
    return [...xml.matchAll(/text="([^"]+)"/g)].map((m) =>
      m[1].replace(/&amp;/g, '&').replace(/&#10;/g, ' ').replace(/&quot;/g, '"'),
    );
  } catch {
    return null;
  }
}

/* ── routes ────────────────────────────────────────────────────────────── */

const inv = JSON.parse(fs.readFileSync(path.join(OUT, 'screen-inventory.json'), 'utf8'));
let routes = inv.screens
  .filter((s) => s.kind === 'page')
  .map((s) => s.route)
  // A dynamic route needs an id this account owns; without one it renders its
  // own "did not load" state, which is a real screen but not the one meant.
  .filter((r) => !r.includes('['))
  // The camera is a live preview of whatever the phone is pointed at. Opening
  // it repeatedly in a sweep is both useless and intrusive.
  .filter((r) => !/camera/.test(r))
  .sort();
const beforeScope = routes.length;
if (!includeLegacy) routes = routes.filter(IN_SCOPE);
if (filter) routes = routes.filter((r) => r.includes(filter));

if (reset && fs.existsSync(DONE)) fs.unlinkSync(DONE);
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);

if (!deviceReady()) {
  console.error('no device — run `adb devices` and connect the handset.');
  process.exit(1);
}

/*
  PREFLIGHT: refuse to sweep an app that is not actually running the bundle.

  A previous run produced a full report while the handset sat on the Expo dev
  launcher the whole time — every route "did not navigate", and the summary
  still printed a pass. Checking the foreground activity first turns that from
  a misleading report into one clear error.
*/
const focus = (() => {
  try {
    return sh('adb shell dumpsys window | grep mCurrentFocus');
  } catch {
    return '';
  }
})();
if (/DevLauncherActivity/.test(focus)) {
  console.error('the app is on the Expo dev launcher, not the bundle — nothing here would be real.');
  console.error('connect it first:');
  console.error('  adb reverse tcp:8081 tcp:8081');
  console.error('  adb shell am force-stop ' + PKG);
  console.error(`  adb shell am start -a android.intent.action.VIEW -d "${SCHEME}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`);
  process.exit(1);
}
if (!new RegExp(PKG).test(focus)) {
  console.error(`${PKG} is not in the foreground (focus: ${focus.trim() || 'none'}) — start it first.`);
  process.exit(1);
}

/** Ask the running app which language it is in, via the brand bar badge. */
const BADGE_TO_LANG = { 繁: 'zh-hant', 简: 'zh-hans', JA: 'ja', TH: 'th', VI: 'vi', EN: 'en' };

/* ── sweep ─────────────────────────────────────────────────────────────── */

const results = [];
let skipped = 0;
let failed = 0;
let stuck = 0;
let lang = 'zh-hant';

/*
  ⚠️ A DEEP LINK THAT DOES NOT NAVIGATE LOOKS EXACTLY LIKE A CLEAN SCREEN.

  The first run of this script reported `/forgot-password` as showing
  "Condition, Year, Capacity, Category" — the DRAFT screen's field labels. The
  link had not been handled, the app stayed where it was, and the dump
  faithfully returned the previous screen's text under the new route's name.
  Every string on it was then attributed to the wrong route.

  So each dump is compared with the one before it. Identical text means the
  screen did not change, and that route is reported as `stuck` rather than
  silently contributing someone else's strings. A route whose content really is
  identical to its predecessor is rare, and being told twice is cheap; being
  told the wrong thing once is not.
*/
let previousSignature = null;

console.log(
  `sweeping ${routes.length} routes (${done.size} already done)` +
    (includeLegacy ? ' — INCLUDING legacy' : `, ${beforeScope - routes.length} legacy/out-of-scope skipped`) +
    '\n',
);

for (const route of routes) {
  if (done.has(route)) {
    skipped++;
    continue;
  }
  const texts = visit(route);
  if (!texts) {
    failed++;
    console.log(`  ✗ ${route} — no dump (app may have crashed)`);
    continue;
  }
  const signature = texts.join('\u0001');
  if (signature === previousSignature) {
    stuck++;
    results.push({ route, lang, navigated: false, textCount: texts.length, leftovers: [] });
    // ⚠️ NOT written to `.sweep-done`. A route that never opened has not been
    // checked, and recording it as done means a resume skips it forever — the
    // run then reports full coverage having never seen the screen. Observed
    // when the app dropped back to the dev launcher mid-sweep and every
    // subsequent route "did not navigate".
    console.log(`  ~ ${route.padEnd(34)} did not navigate — will retry on resume`);
    continue;
  }
  previousSignature = signature;

  // The brand bar badge is on nearly every screen and names the live language,
  // so the sweep cannot be fooled by the app sitting in English.
  const badge = texts.find((t) => BADGE_TO_LANG[t]);
  if (badge) lang = BADGE_TO_LANG[badge];

  const leftovers = [...new Set(texts.filter((t) => isLeftoverEnglish(t, lang)))];
  results.push({ route, lang, navigated: true, textCount: texts.length, leftovers });
  fs.appendFileSync(DONE, route + '\n');

  const mark = leftovers.length === 0 ? '✓' : '·';
  console.log(`  ${mark} ${route.padEnd(34)} ${texts.length} strings, ${leftovers.length} English`);
  if (leftovers.length) console.log(`      ${leftovers.slice(0, 6).map((s) => JSON.stringify(s)).join(', ')}`);
}

/* ── report ────────────────────────────────────────────────────────────── */

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'i18n-device-sweep.json'),
  JSON.stringify({ language: lang, routes: results.length, skipped, failed, results }, null, 2),
);

const all = [...new Set(results.flatMap((r) => r.leftovers))].sort();
/*
  ⚠️ `navigated` IS PART OF THE DEFINITION OF CLEAN.

  A stuck route carries an empty `leftovers`, so counting "no leftovers" as
  clean scored 30 never-opened screens as passing and printed
  "clean screens: 30/31" on a run where the app had not even started. The
  denominator is the routes actually REACHED; anything else reports coverage
  the run does not have.
*/
const reached = results.filter((r) => r.navigated);
const clean = reached.filter((r) => !r.leftovers.length).length;

console.log(`\nvisited ${results.length}, skipped ${skipped}, failed ${failed}, did-not-navigate ${stuck}`);
if (stuck) {
  console.log(`  (a stuck route proves nothing — reach it by tapping, or give it a real id)`);
}
console.log(`language on device: ${lang}`);
console.log(`screens actually reached: ${reached.length}/${results.length}`);
console.log(`clean screens: ${clean}/${reached.length} (of those reached)`);
if (reached.length < results.length) {
  console.log(`⚠️  ${results.length - reached.length} route(s) never opened — NOT verified, not counted either way`);
}
console.log(`distinct English strings left: ${all.length}`);
if (all.length) {
  console.log('\n' + all.map((s) => '  ' + JSON.stringify(s)).join('\n'));
}
console.log(`\nreport: scripts/out/i18n-device-sweep.json`);
console.log(`progress: scripts/out/.sweep-done (delete or pass --reset to redo)`);
