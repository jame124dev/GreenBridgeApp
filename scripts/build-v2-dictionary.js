/**
 * Builds the English→translated lookup the v2 kit's `Text` uses.
 *
 * Reads `scripts/out/v2-strings.json` (from extract-v2-strings.js) and emits
 * one flat map per locale under `src/i18n/v2-auto/`:
 *
 *     { "My listings": "我的刊登", ... }
 *
 * Keyed on the ENGLISH SENTENCE, not a dotted key. That is the whole point:
 * the v2 screens have English hardcoded, so the English IS the key and no
 * screen has to be edited. (Same idea as gettext.) When a screen is properly
 * internationalised later, its strings simply stop reaching this map.
 *
 * Two sources fill it:
 *   1. Strings that already exist as a VALUE in `en.json` — their key is
 *      looked up in each locale file and the translation copied verbatim.
 *      No new wording, nothing to review.
 *   2. `scripts/v2-copy-manual.json` — hand-written translations for copy that
 *      exists nowhere else. It is applied OVER source 1, so a string with both
 *      takes the hand-written one.
 *   3. Everything else is written with an empty string, so it is obvious what
 *      still needs a translator. An empty value falls through to English at
 *      runtime, so a half-filled file is safe to ship.
 *
 * ⚠️ A string containing `${` is DROPPED. The extractor reads source, so it
 * sees the template `"${n.total} found"`, which is not what any screen renders
 * — the runtime string has a number in it and could never match this map.
 * Keeping such a key would look translated while never firing once. Those
 * strings need a real `t()` call with interpolation.
 *
 * Writes ONLY to `src/i18n/v2-auto/`. Never edits source.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES = path.join(ROOT, 'src', 'i18n', 'locales');
const OUT = path.join(ROOT, 'src', 'i18n', 'v2-auto');
const REPORT = path.join(__dirname, 'out', 'v2-strings.json');

const TARGET_LOCALES = ['zh-Hant', 'zh-Hans', 'ja', 'th', 'vi'];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** dotted key -> string, for lookup by key. */
function flattenByKey(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flattenByKey(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

const report = readJson(REPORT);
const manual = readJson(path.join(__dirname, 'v2-copy-manual.json'));
fs.mkdirSync(OUT, { recursive: true });

/** Template literals can never match a rendered string — see the header. */
const isInterpolated = (text) => text.includes('${');

const summary = [];
for (const loc of TARGET_LOCALES) {
  const file = path.join(LOCALES, `${loc}.json`);
  if (!fs.existsSync(file)) {
    summary.push(`${loc}: NO LOCALE FILE — skipped`);
    continue;
  }
  const byKey = flattenByKey(readJson(file));

  const map = {};
  let filled = 0;
  for (const { text, key } of report.reusable) {
    if (isInterpolated(text)) continue;
    const translated = key ? byKey[key] : undefined;
    // Only take it if the locale actually differs from English; an identical
    // string means that locale never translated this key, and writing it would
    // look filled while doing nothing.
    if (translated && translated !== text) {
      map[text] = translated;
      filled++;
    } else {
      map[text] = '';
    }
  }
  for (const { text } of report.needsNew) {
    if (isInterpolated(text)) continue;
    map[text] = '';
  }

  // Hand-written copy wins over anything reused from the locale files: it was
  // written for THIS sentence, where the reused one only matched by value.
  const code = loc.toLowerCase();
  for (const [text, byLocale] of Object.entries(manual)) {
    if (text.startsWith('_')) continue; // _README
    const translated = byLocale[code];
    if (translated) {
      if (!map[text]) filled++;
      map[text] = translated;
    }
  }

  // Stable order so diffs are readable.
  const ordered = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
  fs.writeFileSync(path.join(OUT, `${loc.toLowerCase()}.json`), JSON.stringify(ordered, null, 2) + '\n');
  summary.push(`${loc}: ${filled} auto-filled of ${Object.keys(map).length}`);
}

console.log(summary.join('\n'));
console.log(`\nwrote ${TARGET_LOCALES.length} files to src/i18n/v2-auto/`);
