/**
 * READ-ONLY inventory of every screen in the app.
 *
 * Answers, in one pass: how many pages are there, how do they nest, which area
 * each belongs to, where its words come from, and which of them are fed by a
 * STREAM rather than by the source — because a streamed string can never be
 * translated by the English-keyed dictionary in `src/i18n/v2Auto.ts`. It
 * arrives from the server after the bundle is built, so it has to be handled
 * server-side or not at all. Telling those screens apart from the rest is the
 * point of this script.
 *
 * It writes NOTHING to source. Two reports land in `scripts/out/`:
 *   screen-inventory.json   the full data, for another script to read
 *   SCREEN-INVENTORY.md     the same thing to read with your eyes
 *
 *     node scripts/inventory-screens.js
 *
 * ── HOW A ROUTE IS DERIVED ────────────────────────────────────────────────
 * expo-router file conventions: `(group)` segments are organisational and do
 * NOT appear in the URL, `index` collapses to its folder, `[id]` is dynamic,
 * `_layout` is a shell rather than a page, and `+not-found` is a sentinel.
 * The AREA is the first real folder (or group) under `app/`, which is how this
 * codebase is actually split — `(lab)` is the old UI, `v2` the new one, `scan`
 * the shared scanner, `(auth)` the signed-out shell.
 *
 * ── WHAT "SECTIONS" MEANS ─────────────────────────────────────────────────
 * Two different things, both reported:
 *   nested routes   child pages under this page's folder — `/v2/dashboard`
 *                   owns `bids`, `orders/[id]`, `watchlist` and five more.
 *   in-page         the headed blocks inside one screen — `<SectionHeader
 *                   title="Selling" />`, a tab/segment label, a wizard step.
 *                   This is the level the UI reads as a "section" and the
 *                   level a translation gap shows up at.
 *
 * ── WHAT COUNTS AS A STREAM ───────────────────────────────────────────────
 * Marked per page, from the page AND from the local modules it imports one
 * level deep (the SSE plumbing lives in `src/features/…`, never in the route
 * file). A page is flagged when it touches SSE (`text/event-stream`,
 * `EventSource`, a `/stream` endpoint), a socket, or the chat/scan streaming
 * controllers. Flagged pages are listed separately at the end of the report.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const OUT_DIR = path.join(__dirname, 'out');

/* ── patterns ──────────────────────────────────────────────────────────── */

/**
 * A page's content arrives from the server at runtime.
 *
 * ⚠️ TWO DIFFERENT THINGS, and conflating them makes the report useless.
 *
 *   prose  The server sends WORDS the user reads — an assistant reply, a
 *          detected item's title, a progress line. These can never be reached
 *          by the English-keyed dictionary: they are not in the bundle, so
 *          there is no literal to look up. Translating them is a server job.
 *   live   The server sends DATA — an unread count, a bid event, a status
 *          change. The surrounding words are still in the bundle and
 *          translate normally. The notification bell is the common case, and
 *          flagging those pages as "untranslatable" would be wrong.
 */
const STREAM_SIGNALS = [
  ['sse', 'prose', /text\/event-stream|EventSource|new ReadableStream|\/stream\b|streamSanitizer/],
  ['chat-stream', 'prose', /useChatController|useLabTurn|StreamingMessage|turnReducer|turnFold/],
  ['scan-stream', 'prose', /useSmartDetect|detect\/stream|analyze-smart-detection/],
  ['socket', 'live', /socket\.io|\bsocket\.(on|emit)\b/],
];

/** Headed blocks inside one screen. */
const SECTION_PATTERNS = [
  [/<SectionHeader[^>]*?title=\{?["'`]([^"'`]+)["'`]/g, 'SectionHeader'],
  [/<Section[A-Za-z]*[^>]*?heading=\{?["'`]([^"'`]+)["'`]/g, 'Section'],
  [/\blabel:\s*["'`]([^"'`]+)["'`]/g, 'tab/step'],
];

const QUOTED = `(['"\`])((?:(?!\\2)[^\\\\])*)\\2`;
const COPY_PROPS =
  'label|title|subtitle|placeholder|body|actionLabel|secondaryLabel|heading|emptyTitle|emptyDetail';

/* ── helpers ───────────────────────────────────────────────────────────── */

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      walk(p, acc);
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

/** Documentation prose is not UI copy and must never be counted as it. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** `app/v2/dashboard/orders/[id].tsx` -> `/v2/dashboard/orders/[id]`. */
function routeOf(file) {
  const segs = rel(file).replace(/^app\//, '').replace(/\.tsx?$/, '').split('/');
  const visible = segs.filter((s) => !/^\(.+\)$/.test(s));
  if (visible[visible.length - 1] === 'index') visible.pop();
  return '/' + visible.join('/');
}

/** The first folder or group under `app/` — how this codebase is split. */
function areaOf(file) {
  const segs = rel(file).replace(/^app\//, '').split('/');
  return segs.length === 1 ? '(root)' : segs[0];
}

function kindOf(file) {
  const base = path.basename(file);
  if (base === '_layout.tsx') return 'layout';
  if (base.startsWith('+')) return 'sentinel';
  return 'page';
}

/** Local (`@/…` or relative) imports, so the scan reaches the feature modules
 *  where the streaming actually lives. One level only — deeper turns every
 *  page into every other page through the shared kit. */
function localImports(src, file) {
  const out = new Set();
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    let base;
    if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
    else if (spec.startsWith('.')) base = path.resolve(path.dirname(file), spec);
    else continue;
    for (const cand of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
      if (fs.existsSync(cand)) {
        out.add(cand);
        break;
      }
    }
  }
  return [...out];
}

function streamSignals(text) {
  return STREAM_SIGNALS.filter(([, , re]) => re.test(text)).map(([name]) => name);
}

const KIND_OF_SIGNAL = Object.fromEntries(STREAM_SIGNALS.map(([name, kind]) => [name, kind]));
const isProse = (sig) => KIND_OF_SIGNAL[sig] === 'prose';

function sectionsIn(src) {
  const out = [];
  for (const [re, kind] of SECTION_PATTERNS) {
    for (const m of src.matchAll(re)) {
      const name = (m[1] || '').trim();
      if (name && !out.some((s) => s.name === name)) out.push({ name, kind });
    }
  }
  return out;
}

/** Copy literals, and how much of it the v2 dictionary can reach today. */
function copyIn(src, dict) {
  const strings = new Set();
  for (const m of src.matchAll(/>\s*([A-Z][^<>{}\n]{1,159})\s*</g)) strings.add(m[1].trim());
  for (const m of src.matchAll(new RegExp(`\\b(${COPY_PROPS})\\s*(?:=\\{?|:\\s*)${QUOTED}`, 'g'))) {
    const t = (m[3] || '').trim();
    if (t.length >= 2) strings.add(t);
  }
  const literals = [...strings].filter((s) => /[A-Za-z]{2,}/.test(s) && !s.includes('${'));
  return {
    literals: literals.length,
    translated: literals.filter((s) => dict[s]).length,
    untranslated: literals.filter((s) => !dict[s]),
    tCalls: (src.match(/\bt\(\s*['"`]/g) || []).length,
  };
}

/** Sum several `copyIn` results, counting each distinct string once. */
function mergeCopy(list) {
  const untranslated = new Set();
  let literals = 0;
  let translated = 0;
  let tCalls = 0;
  for (const c of list) {
    literals += c.literals;
    translated += c.translated;
    tCalls += c.tCalls;
    c.untranslated.forEach((s) => untranslated.add(s));
  }
  return { literals, translated, untranslated: [...untranslated], tCalls };
}

/* ── collect ───────────────────────────────────────────────────────────── */

let dict = {};
try {
  dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/v2-auto/zh-hant.json'), 'utf8'));
} catch {
  // No dictionary built yet — every literal then reads as untranslated, which
  // is the honest answer rather than a crash.
}

const files = walk(APP).filter((f) => f.endsWith('.tsx'));
const entries = files.map((file) => {
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripComments(raw);

  // Stream detection reads the page PLUS its local imports, because a route
  // file almost never opens the connection itself.
  const imports = localImports(src, file);
  const own = streamSignals(src);
  const viaImports = new Set();
  for (const imp of imports) {
    for (const sig of streamSignals(stripComments(fs.readFileSync(imp, 'utf8')))) {
      if (!own.includes(sig)) viaImports.add(sig);
    }
  }

  return {
    route: routeOf(file),
    area: areaOf(file),
    kind: kindOf(file),
    file: rel(file),
    lines: raw.split('\n').length,
    sections: sectionsIn(src),
    // Two numbers, and the difference between them matters. A route file in
    // this codebase is mostly wiring: `app/v2/account.tsx` is 600 lines and
    // holds a handful of literals, while the words you actually read come out
    // of `src/features/v2/…`. Counting only the page says the app has almost
    // no copy in it, which is how a translation gap stays invisible.
    copy: copyIn(src, dict),
    componentCopy: mergeCopy(imports.map((f) => copyIn(stripComments(fs.readFileSync(f, 'utf8')), dict))),
    components: imports.filter((f) => rel(f).startsWith('src/')).map(rel),
    stream: { direct: own, viaImports: [...viaImports] },
  };
});

// Nested routes: a page owns the routes that sit below it in the URL tree.
const byRoute = new Map(entries.map((e) => [e.route, e]));
for (const e of entries) {
  e.children = entries
    .filter((o) => o !== e && o.kind === 'page' && o.route.startsWith(e.route + '/'))
    .map((o) => o.route)
    .sort();
}
byRoute.clear();

const pages = entries.filter((e) => e.kind === 'page');
const areas = [...new Set(entries.map((e) => e.area))].sort();
const allSignals = (p) => [...p.stream.direct, ...p.stream.viaImports];
/** Only the prose ones matter for translation — see STREAM_SIGNALS. */
const streamed = pages.filter((p) => allSignals(p).some(isProse));
const liveOnly = pages.filter((p) => allSignals(p).length && !allSignals(p).some(isProse));

// ── the feature areas ────────────────────────────────────────────────────
// `app/` is the route tree; `src/features/*` is where the screens are built
// and where nearly all the copy lives. Reporting one without the other gives
// a picture of the app that is wrong by an order of magnitude.
const FEATURES = path.join(ROOT, 'src', 'features');
const featureAreas = fs.existsSync(FEATURES)
  ? fs
      .readdirSync(FEATURES, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const files = walk(path.join(FEATURES, e.name)).filter((f) => f.endsWith('.tsx'));
        const per = files.map((f) => {
          const src = stripComments(fs.readFileSync(f, 'utf8'));
          return { src, copy: copyIn(src, dict) };
        });
        const copy = mergeCopy(per.map((p) => p.copy));
        const sigs = new Set();
        per.forEach((p) => streamSignals(p.src).forEach((s) => sigs.add(s)));
        return { name: e.name, files: files.length, copy, stream: [...sigs] };
      })
      .sort((a, b) => b.copy.literals - a.copy.literals)
  : [];

const totals = {
  pages: pages.length,
  featureFiles: featureAreas.reduce((n, a) => n + a.files, 0),
  featureCopyLiterals: featureAreas.reduce((n, a) => n + a.copy.literals, 0),
  featureCopyTranslated: featureAreas.reduce((n, a) => n + a.copy.translated, 0),
  layouts: entries.filter((e) => e.kind === 'layout').length,
  areas: areas.length,
  copyLiterals: pages.reduce((n, p) => n + p.copy.literals, 0),
  copyTranslated: pages.reduce((n, p) => n + p.copy.translated, 0),
  tCalls: pages.reduce((n, p) => n + p.copy.tCalls, 0),
  streamedProsePages: streamed.length,
  liveDataOnlyPages: liveOnly.length,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'screen-inventory.json'),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), totals, areas, featureAreas, screens: entries },
    null,
    2,
  ),
);

/* ── markdown ──────────────────────────────────────────────────────────── */

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const md = [];
md.push('# Screen inventory');
md.push('');
md.push(`Generated by \`scripts/inventory-screens.js\`. ${totals.pages} pages, ${totals.layouts} layouts, ${totals.areas} areas.`);
md.push('');
md.push('| Area | Pages | Copy literals | Covered by dictionary | `t()` calls | Server-worded pages |');
md.push('|---|---:|---:|---:|---:|---:|');
for (const area of areas) {
  const inArea = pages.filter((p) => p.area === area);
  if (!inArea.length) continue;
  const lit = inArea.reduce((n, p) => n + p.copy.literals, 0);
  const tr = inArea.reduce((n, p) => n + p.copy.translated, 0);
  md.push(
    `| \`${area}\` | ${inArea.length} | ${lit} | ${tr} (${pct(tr, lit)}%) | ` +
      `${inArea.reduce((n, p) => n + p.copy.tCalls, 0)} | ` +
      `${inArea.filter((p) => allSignals(p).some(isProse)).length} |`,
  );
}
md.push(
  `| **total** | **${totals.pages}** | **${totals.copyLiterals}** | ` +
    `**${totals.copyTranslated} (${pct(totals.copyTranslated, totals.copyLiterals)}%)** | ` +
    `**${totals.tCalls}** | **${totals.streamedProsePages}** |`,
);
md.push('');
md.push('## Feature areas (`src/features/*`)');
md.push('');
md.push('Where the screens are actually built. The route files above are mostly');
md.push('wiring, so this is the table that says how much copy the app has.');
md.push('');
md.push('| Area | Files | Copy literals | Covered | `t()` calls | Streaming |');
md.push('|---|---:|---:|---:|---:|---|');
for (const a of featureAreas) {
  md.push(
    `| \`${a.name}\` | ${a.files} | ${a.copy.literals} | ${a.copy.translated} (${pct(a.copy.translated, a.copy.literals)}%) | ` +
      `${a.copy.tCalls} | ${a.stream.join(', ') || '—'} |`,
  );
}
md.push(
  `| **total** | **${totals.featureFiles}** | **${totals.featureCopyLiterals}** | ` +
    `**${totals.featureCopyTranslated} (${pct(totals.featureCopyTranslated, totals.featureCopyLiterals)}%)** | | |`,
);
md.push('');

for (const area of areas) {
  const inArea = pages.filter((p) => p.area === area).sort((a, b) => a.route.localeCompare(b.route));
  if (!inArea.length) continue;
  md.push(`## \`${area}\``);
  md.push('');
  for (const p of inArea) {
    const sig = allSignals(p);
    const prose = sig.filter(isProse);
    const live = sig.filter((s) => !isProse(s));
    md.push(`### \`${p.route}\``);
    md.push('');
    md.push(
      `\`${p.file}\` · ${p.lines} lines · ${p.copy.literals} literals on the page ` +
        `(+${p.componentCopy.literals} in its components) · ${p.copy.translated + p.componentCopy.translated} translated · ` +
        `${p.copy.tCalls + p.componentCopy.tCalls} \`t()\``,
    );
    if (prose.length)
      md.push(`- **server-worded:** ${prose.join(', ')} — these words arrive from the server, so the dictionary cannot reach them`);
    if (live.length) md.push(`- live data: ${live.join(', ')} (counts/events — the surrounding copy still translates)`);
    if (p.children.length) md.push(`- nested routes: ${p.children.map((c) => `\`${c}\``).join(', ')}`);
    if (p.sections.length)
      md.push(`- sections: ${p.sections.map((s) => `${s.name} _(${s.kind})_`).join(' · ')}`);
    if (p.copy.untranslated.length)
      md.push(`- not in the dictionary (${p.copy.untranslated.length}): ${p.copy.untranslated.slice(0, 8).map((s) => `"${s}"`).join(', ')}${p.copy.untranslated.length > 8 ? ' …' : ''}`);
    md.push('');
  }
}

md.push('## Pages whose words come from the server');
md.push('');
md.push('A string that arrives over a stream is not in the bundle, so there is no');
md.push('literal for the English-keyed dictionary to look up. These are the pages');
md.push('where translating the app means translating the SERVER response — the');
md.push('assistant reply, the detected item, the progress line.');
md.push('');
for (const p of streamed.sort((a, b) => a.route.localeCompare(b.route))) {
  md.push(`- \`${p.route}\` — ${allSignals(p).filter(isProse).join(', ')}`);
}
md.push('');
md.push('### Live data only');
md.push('');
md.push('These hold a socket for counts and events — an unread badge, a bid');
md.push('landing. Their copy is in the bundle and translates normally; they are');
md.push('listed so nobody mistakes the socket for streamed prose.');
md.push('');
for (const p of liveOnly.sort((a, b) => a.route.localeCompare(b.route))) {
  md.push(`- \`${p.route}\` — ${allSignals(p).join(', ')}`);
}
md.push('');

fs.writeFileSync(path.join(OUT_DIR, 'SCREEN-INVENTORY.md'), md.join('\n'));

console.log(`pages            : ${totals.pages}`);
console.log(`layouts          : ${totals.layouts}`);
console.log(`areas            : ${areas.join(', ')}`);
console.log(`copy on pages    : ${totals.copyLiterals} (${totals.copyTranslated} translated, ${pct(totals.copyTranslated, totals.copyLiterals)}%)`);
console.log(`copy in features : ${totals.featureCopyLiterals} across ${totals.featureFiles} files (${totals.featureCopyTranslated} translated, ${pct(totals.featureCopyTranslated, totals.featureCopyLiterals)}%)`);
console.log(`t() calls        : ${totals.tCalls}`);
console.log(`server-worded    : ${totals.streamedProsePages} pages (words come over a stream — not translatable client-side)`);
console.log(`live-data only   : ${totals.liveDataOnlyPages} pages (socket for counts/events; copy still translates)`);
console.log('');
console.log('scripts/out/SCREEN-INVENTORY.md');
console.log('scripts/out/screen-inventory.json');
