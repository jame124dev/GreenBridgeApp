/**
 * Merges a batch of translations into `scripts/v2-copy-manual.json`.
 *
 *     node scripts/merge-translations.js scripts/out/wf-translations.json
 *
 * The input is `{ entries: [{ text, action, why, zh-hant, zh-hans, ja, th, vi }] }`
 * — the shape the translation workflow returns.
 *
 * ── WHAT IT REFUSES TO WRITE ──────────────────────────────────────────────
 * Every rejection here is a way a translation batch silently corrupts the UI:
 *
 *   action: 'keep'      A font name, a colour, a brand, an i18n key. Writing a
 *                       translation for one of these puts Chinese where the
 *                       code expects `font-sans`. Recorded in `_skipped` with
 *                       the reason, so the next run does not re-litigate it.
 *   a missing language  A partial entry would make the string translated in
 *                       three languages and English in two, which reads as a
 *                       bug rather than as untranslated.
 *   an unchanged value  A "translation" identical to the English is a miss
 *                       dressed as a hit; it would count toward coverage while
 *                       changing nothing on screen.
 *   a key with `${`     A template literal can never match a rendered string.
 *
 * It never deletes an existing entry, and an entry already in the file is left
 * alone unless the new one differs — hand-written copy stays hand-written.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANUAL = path.join(__dirname, 'v2-copy-manual.json');
const LOCALES = ['zh-hant', 'zh-hans', 'ja', 'th', 'vi'];

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/merge-translations.js <entries.json>');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path.resolve(ROOT, input), 'utf8'));
const entries = payload.entries || payload;
const manual = JSON.parse(fs.readFileSync(MANUAL, 'utf8'));
const skipped = manual._skipped || {};

const added = [];
const updated = [];
const refused = [];

for (const e of entries) {
  const text = e.text;
  if (!text) continue;

  if (text.includes('${')) {
    refused.push([text, 'template literal — can never match a rendered string']);
    continue;
  }
  if (e.action === 'keep') {
    skipped[text] = e.why || 'not user-facing copy';
    continue;
  }
  const missing = LOCALES.filter((l) => !e[l] || !String(e[l]).trim());
  if (missing.length) {
    refused.push([text, `missing ${missing.join(', ')}`]);
    continue;
  }
  const same = LOCALES.filter((l) => e[l] === text);
  if (same.length === LOCALES.length) {
    refused.push([text, 'every language identical to the English']);
    continue;
  }

  const next = Object.fromEntries(LOCALES.map((l) => [l, String(e[l]).trim()]));
  const prev = manual[text];
  if (!prev) added.push(text);
  else if (LOCALES.some((l) => prev[l] !== next[l])) updated.push(text);
  else continue;
  manual[text] = next;
}

manual._skipped = Object.fromEntries(Object.keys(skipped).sort().map((k) => [k, skipped[k]]));

// Stable order: the README block first, then `_skipped`, then the copy by key.
const keys = Object.keys(manual).filter((k) => !k.startsWith('_')).sort();
const out = { _README: manual._README, _skipped: manual._skipped };
for (const k of keys) out[k] = manual[k];

fs.writeFileSync(MANUAL, JSON.stringify(out, null, 2) + '\n');

console.log(`added   : ${added.length}`);
console.log(`updated : ${updated.length}`);
console.log(`kept as English (not copy): ${Object.keys(skipped).length}`);
if (refused.length) {
  console.log(`\nREFUSED (${refused.length}) — not written:`);
  for (const [t, why] of refused) console.log(`  ${JSON.stringify(t)} — ${why}`);
}
