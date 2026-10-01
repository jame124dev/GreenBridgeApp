/**
 * READ-ONLY. Lists the English copy that is hardcoded in the v2 UI, and says
 * which of it we can already translate from the shipped locale files.
 *
 * Why this exists: switching the app to 繁體中文 translates the Home selling
 * pane and nothing else, because only `SellingPane`, `drafts` and `listings`
 * call `t()`. The rest of `app/v2` and the v2 kit have English in the source.
 *
 * It writes NOTHING to source. Output is a JSON report under `scripts/out/`.
 *
 * What it collects, deliberately narrow so the result is trustworthy:
 *   1. JSX text children:            <Text>Browsing as a guest</Text>
 *   2. String literals in copy props: label=, title=, subtitle=, placeholder=,
 *      body=, actionLabel=, secondaryLabel=, heading=, chip=
 * It SKIPS anything already wrapped in `t(...)`, anything inside a comment,
 * import paths, and single words that are obviously not copy (ids, tokens).
 *
 * Then, for every string found, it looks the English text up as a VALUE in
 * `src/i18n/locales/en.json`. A hit means the phrase is already translated in
 * the other locale files and we can reuse it verbatim — no machine
 * translation, no new copy to review.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [path.join(ROOT, 'app', 'v2'), path.join(ROOT, 'src', 'features', 'v2')];
const LOCALES = path.join(ROOT, 'src', 'i18n', 'locales');
const OUT_DIR = path.join(__dirname, 'out');

const COPY_PROPS = [
  'label', 'title', 'subtitle', 'placeholder', 'body', 'actionLabel',
  'secondaryLabel', 'heading', 'chip', 'text', 'emptyTitle', 'emptyDetail',
];

/** Files to walk. */
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p, acc);
    } else if (/\.tsx$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Strip comments so documentation prose is never mistaken for UI copy. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Does this look like user-facing copy rather than a token/id/path? */
function isCopy(s) {
  const t = s.trim();
  if (t.length < 2 || t.length > 160) return false;
  if (!/[a-z]/.test(t)) return false;              // ALLCAPS tokens, numbers
  // ids, keys, paths. A single word is only an id if it is lowercase or has
  // non-letters in it — "Home", "Browse" and "Account" are the tab bar's
  // labels, and rejecting every one-word string hid the whole tab bar.
  if (!/\s/.test(t) && !/^[A-Z][a-z]+$/.test(t)) return false;
  if (/^https?:|^\/|^@\//.test(t)) return false;   // urls, routes, imports
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;   // colours
  return /[A-Za-z]{2,}/.test(t);
}

const found = new Map(); // text -> Set(file)

for (const file of TARGETS.flatMap((d) => walk(d))) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(file, 'utf8'));

  // 1. JSX text children: >Some words<
  for (const m of src.matchAll(/>\s*([A-Z][^<>{}\n]{1,159})\s*</g)) {
    const text = m[1].trim();
    if (isCopy(text)) {
      if (!found.has(text)) found.set(text, new Set());
      found.get(text).add(rel);
    }
  }

  // 2. copy props with a plain string literal, as a JSX attribute
  //    (`label="Home"`) OR as an object property (`{ label: 'Home' }`). The
  //    object form matters: the tab bar, the Selling/Buying segmented control
  //    and the chat tabs all declare their labels in a const array, and the
  //    attribute-only pattern left every one of them out of the dictionary.
  //    The literal is matched QUOTE-AWARE — `(['"\`])…\\1` — not with a
  //    "no quote character" class. A class stopped at the apostrophe in
  //    "No matches yet. We'll…" and emitted the fragment `No matches yet. We`
  //    as if it were the copy, which is a key that can never match at runtime.
  const propRe = new RegExp(
    `\\b(${COPY_PROPS.join('|')})\\s*(?:=\\{?|:\\s*)(['"\`])((?:(?!\\2)[^\\\\])*)\\2\\}?`,
    'g',
  );
  for (const m of src.matchAll(propRe)) {
    const text = m[3].trim();
    if (text.length < 2 || text.length > 159) continue;
    if (isCopy(text)) {
      if (!found.has(text)) found.set(text, new Set());
      found.get(text).add(rel);
    }
  }
}

/** Flatten a locale file to value -> dotted key. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else if (typeof v === 'string') out[v] = key;
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(LOCALES, 'en.json'), 'utf8'));
const valueToKey = flatten(en);

const reusable = [];
const needsNew = [];
for (const [text, files] of found) {
  const key = valueToKey[text];
  (key ? reusable : needsNew).push({ text, key: key || null, files: [...files] });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  totals: { found: found.size, reusable: reusable.length, needsNew: needsNew.length },
  reusable,
  needsNew,
};
fs.writeFileSync(path.join(OUT_DIR, 'v2-strings.json'), JSON.stringify(report, null, 2));

console.log(`strings found : ${found.size}`);
console.log(`already in en.json (reusable translations): ${reusable.length}`);
console.log(`need new copy : ${needsNew.length}`);
console.log(`report: scripts/out/v2-strings.json`);
