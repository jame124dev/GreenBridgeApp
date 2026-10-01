/**
 * Writes `Docs/Translation/` — one file per page, plus one file for everything
 * that is not a page, each stating where that surface stands on translation.
 *
 * GENERATED. Do not hand-edit the output: re-run the two scripts it reads
 * from and then this one, or the next run silently discards the edit.
 *
 *     node scripts/extract-v2-strings.js
 *     node scripts/build-v2-dictionary.js
 *     node scripts/inventory-screens.js
 *     node scripts/write-translation-docs.js
 *
 * Writes ONLY under `Docs/Translation/`. Never touches source.
 *
 * ── THE FOUR STATUSES ─────────────────────────────────────────────────────
 *   DONE          no literal is left unresolved — either the page has none,
 *                 or every one of them is in the dictionary.
 *   PARTIAL       some copy still renders English. Note this INCLUDES a page
 *                 that is fully internationalised through `t()` and has one
 *                 stray hardcoded string: it is a real gap, but calling it
 *                 NOT STARTED would be a lie about a screen with 134 `t()`
 *                 calls on it. The count of strays is what matters, and each
 *                 page file lists them.
 *   NOT STARTED   the page has copy, none of it resolves, and it calls `t()`
 *                 nowhere. Nothing on it has ever been translated.
 *   SERVER-WORDED separate axis, reported alongside the others: the words
 *                 arrive over a stream, so no client-side dictionary can
 *                 reach them however complete it is.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'Docs', 'Translation');
const PAGES = path.join(OUT, 'pages');

const inv = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'screen-inventory.json'), 'utf8'));
const LOCALES = ['zh-hant', 'zh-hans', 'ja', 'th', 'vi'];
const dicts = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/v2-auto', `${l}.json`), 'utf8'))]),
);
const dictSize = Object.keys(dicts['zh-hant']).length;

const PROSE = new Set(['sse', 'chat-stream', 'scan-stream']);
const signalsOf = (p) => [...p.stream.direct, ...p.stream.viaImports];
const proseOf = (p) => signalsOf(p).filter((s) => PROSE.has(s));
const liveOf = (p) => signalsOf(p).filter((s) => !PROSE.has(s));

/** `/v2/dashboard/orders/[id]` -> `v2-dashboard-orders-id`. */
const slug = (route) =>
  route.replace(/^\//, '').replace(/[[\]]/g, '').replace(/\//g, '-') || 'index';

// A bare capitalised identifier that reached the extractor is not copy —
// `Promise` came from a type position, not from anything a user reads. Both
// the status and the "still English" list filter these out, or a page scores
// PARTIAL over a JS global and someone is sent to translate it.
const NOT_COPY = /^(Promise|Record|Partial|Array|Object|React|Props|String|Number|Boolean|Date|Map|Set|Error)$/;

// Strings a translator looked at and ruled DELIBERATELY English — a font
// family, a colour, a brand, a product model. They are settled, not pending,
// so they must not keep scoring a page PARTIAL for the rest of time. The
// reasons are republished in MISCELLANEOUS.md so the call stays auditable.
const SKIPPED = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'v2-copy-manual.json'), 'utf8'))._skipped || {};
  } catch {
    return {};
  }
})();

function missingOf(p) {
  return [...new Set([...p.copy.untranslated, ...p.componentCopy.untranslated])]
    .filter((s) => !NOT_COPY.test(s) && !(s in SKIPPED))
    .sort();
}

function statusOf(p) {
  const lit = p.copy.literals + p.componentCopy.literals;
  const tr = p.copy.translated + p.componentCopy.translated;
  const t = p.copy.tCalls + p.componentCopy.tCalls;
  if (lit === 0 || missingOf(p).length === 0) return 'DONE';
  // A page carrying `t()` calls HAS been translated; the leftover literals are
  // strays, not an untouched screen. Scoring those NOT STARTED put 34 pages —
  // including one with 134 `t()` calls — in the worst bucket.
  if (tr > 0 || t > 0) return 'PARTIAL';
  return 'NOT STARTED';
}

const BADGE = {
  DONE: '🟢 DONE',
  PARTIAL: '🟡 PARTIAL',
  'NOT STARTED': '🔴 NOT STARTED',
};

/**
 * ── SCOPE: v2 ONLY ────────────────────────────────────────────────────────
 *
 * The pre-v2 screens — `(lab)`, the old `app/scan/*` flow, `listing/[id]`,
 * `activity/*` — are deliberately NOT translated (decided 2026-10-01): the
 * product is moving to v2 and the effort does not pay back. They are listed
 * in their own section at the end of the index, marked out of scope, rather
 * than scored as incomplete — a status page where most rows are accepted
 * failures is a status page nobody reads.
 *
 * `(auth)` counts as v2: a signed-out v2 user is routed straight into it.
 */
const inV2Scope = (route) =>
  /^\/v2\b/.test(route) || /^\/(login|register|pending|forgot-password)$/.test(route);

const allPages = inv.screens.filter((s) => s.kind === 'page').sort((a, b) => a.route.localeCompare(b.route));
const pages = allPages.filter((p) => inV2Scope(p.route));
const legacyPages = allPages.filter((p) => !inV2Scope(p.route));

fs.mkdirSync(PAGES, { recursive: true });

/*
  Remove page files for routes that are no longer in scope.

  Without this, narrowing the scope leaves the previous run's files behind and
  the folder keeps claiming to document 66 screens while the index lists 34.
  A stale generated file is worse than a missing one: it looks current.
  Only `.md` files this script itself writes are removed.
*/
const expected = new Set(pages.map((p) => `${slug(p.route)}.md`));
for (const file of fs.readdirSync(PAGES)) {
  if (file.endsWith('.md') && !expected.has(file)) fs.unlinkSync(path.join(PAGES, file));
}

/* ── one file per page ─────────────────────────────────────────────────── */

for (const p of pages) {
  const lit = p.copy.literals + p.componentCopy.literals;
  const tr = p.copy.translated + p.componentCopy.translated;
  const t = p.copy.tCalls + p.componentCopy.tCalls;
  const status = statusOf(p);
  const prose = proseOf(p);
  const live = liveOf(p);
  const missing = missingOf(p);

  const md = [];
  md.push(`# \`${p.route}\``);
  md.push('');
  md.push(`**Status: ${BADGE[status]}**${prose.length ? ' · ⚡ SERVER-WORDED' : ''}`);
  md.push('');
  md.push(`| | |`);
  md.push(`|---|---|`);
  md.push(`| Route | \`${p.route}\` |`);
  md.push(`| Area | \`${p.area}\` |`);
  md.push(`| File | \`${p.file}\` (${p.lines} lines) |`);
  md.push(`| Hardcoded copy | ${lit} strings — ${p.copy.literals} on the page, ${p.componentCopy.literals} in its components |`);
  md.push(`| Resolved by the dictionary | ${tr} of ${lit} |`);
  md.push(`| Still English | ${missing.length} |`);
  md.push(`| \`t()\` calls | ${t} |`);
  md.push(`| Languages | ${LOCALES.length} (zh-Hant, zh-Hans, ja, th, vi) |`);
  md.push('');

  md.push('## How this page gets translated');
  md.push('');
  if (t > 0 && lit === 0) {
    md.push(`Through \`t()\` — ${t} calls, reading \`src/i18n/locales/*.json\`. There is no`);
    md.push('bare English left on it, so nothing here depends on the v2 dictionary.');
  } else if (lit > 0 && t === 0) {
    md.push('Through the v2 dictionary: the copy is hardcoded English in the source, and');
    md.push('`src/features/v2/ui/Text.tsx` looks each literal up by its English sentence');
    md.push('(`src/i18n/v2Auto.ts`). Nothing on this page calls `t()`.');
  } else if (lit > 0) {
    md.push(`Both ways — ${t} \`t()\` call${t === 1 ? '' : 's'} plus ${lit} hardcoded literals that go through`);
    md.push('the v2 dictionary (`src/i18n/v2Auto.ts`). Mixed is fine; it is not a defect.');
    if (missing.length && t > 0) {
      md.push('');
      md.push(`The ${missing.length} unresolved literal${missing.length === 1 ? ' below is a stray' : 's below are strays'} on an otherwise`);
      md.push('internationalised screen — not an untranslated screen.');
    }
  } else {
    md.push('Nothing to translate — this page renders no copy of its own.');
  }
  md.push('');

  if (prose.length) {
    md.push('## ⚡ Its words come from the server');
    md.push('');
    md.push(`Signals: ${prose.map((s) => `\`${s}\``).join(', ')}.`);
    md.push('');
    md.push('The text a user reads here is streamed in after the bundle is built — the');
    md.push('assistant reply, the detected item, the progress line. There is no literal');
    md.push('in the source to look up, so **however complete the dictionary gets, this');
    md.push('page stays English until the server sends the other language.** Translating');
    md.push('it is a backend change, not an app change.');
    md.push('');
    md.push('The static chrome around the stream — buttons, headers, the empty state —');
    md.push('is ordinary copy and is covered by the figures above.');
    md.push('');
  }

  if (live.length) {
    md.push('## Live data');
    md.push('');
    md.push(`Holds a socket (${live.map((s) => `\`${s}\``).join(', ')}) for counts and events — an unread`);
    md.push('badge, a bid landing. That is data, not prose: every word around it is in');
    md.push('the bundle and translates normally.');
    md.push('');
  }

  if (p.children.length) {
    md.push('## Nested routes');
    md.push('');
    for (const c of p.children) {
      const child = pages.find((x) => x.route === c);
      md.push(`- [\`${c}\`](${slug(c)}.md) — ${child ? BADGE[statusOf(child)] : '?'}`);
    }
    md.push('');
  }

  if (p.sections.length) {
    md.push('## Sections on this page');
    md.push('');
    for (const s of p.sections) {
      const hit = dicts['zh-hant'][s.name];
      md.push(`- **${s.name}** _(${s.kind})_ — ${hit ? `🟢 \`${hit}\`` : '🔴 not in the dictionary'}`);
    }
    md.push('');
  }

  if (missing.length) {
    md.push('## Still English in every language');
    md.push('');
    md.push('These literals render on this page and resolve in no dictionary. Add each');
    md.push('one to `scripts/v2-copy-manual.json`, then re-run `node');
    md.push('scripts/build-v2-dictionary.js`.');
    md.push('');
    for (const s of missing) md.push(`- \`${s}\``);
    md.push('');
  } else if (lit > 0) {
    md.push('## Still English in every language');
    md.push('');
    md.push('None — every literal on this page resolves in all five languages.');
    md.push('');
  }

  md.push('---');
  md.push('');
  md.push('Generated by `scripts/write-translation-docs.js`. Do not hand-edit.');
  md.push('');

  fs.writeFileSync(path.join(PAGES, `${slug(p.route)}.md`), md.join('\n'));
}

/* ── everything that is not a page ─────────────────────────────────────── */

const misc = [];
misc.push('# Miscellaneous — everything that is not a page');
misc.push('');
misc.push('The route files are mostly wiring. This is where the rest of the app lives:');
misc.push('the shared kit, the layouts, the feature modules, and the machinery that');
misc.push('decides which language is in force.');
misc.push('');

misc.push('## The mechanism');
misc.push('');
misc.push('Two independent systems, both live:');
misc.push('');
misc.push('| | Where | Covers |');
misc.push('|---|---|---|');
misc.push('| `t()` / i18next | `src/i18n/index.ts`, `src/i18n/locales/*.json` | the old UI — `(lab)`, `scan`, `(auth)`, settings |');
misc.push(`| English-keyed dictionary | \`src/i18n/v2Auto.ts\`, \`src/i18n/v2-auto/*.json\` | the v2 UI — ${dictSize} strings × ${LOCALES.length} languages |`);
misc.push('');
misc.push('The second exists because the v2 screens were written with English in the');
misc.push('source. Rather than edit eight screens, the kit\'s `Text` looks its literal');
misc.push('child up by the English sentence, so one interception reaches every');
misc.push('component that renders copy through it — `PrimaryAction` its `label`, `Row`');
misc.push('its `title`, `Chip` its `label`. It is a stopgap: as screens get real `t()`');
misc.push('calls their strings stop reaching the map, and it shrinks to nothing.');
misc.push('');
misc.push('**Languages:** `en`, `zh-hant`, `zh-hans`, `ja`, `th`, `vi`. Codes are');
misc.push('lowercase everywhere — `src/i18n/index.ts` sets `lowerCaseLng` and');
misc.push('deliberately sets no `supportedLngs`; the note in that file explains why');
misc.push('`zh-Hant` vs `zh-hant` silently falls back to English.');
misc.push('');

misc.push('## Feature areas');
misc.push('');
misc.push('| Area | Files | Hardcoded copy | Resolved | `t()` | Streaming | Status |');
misc.push('|---|---:|---:|---:|---:|---|---|');
for (const a of inv.featureAreas) {
  // Same rule as the pages — `lab` has 465 `t()` calls and 8 stray literals,
  // and scoring that NOT STARTED would be the most wrong row in the file.
  const strays = a.copy.literals - a.copy.translated;
  const st =
    strays === 0 ? 'DONE' : a.copy.translated > 0 || a.copy.tCalls > 0 ? 'PARTIAL' : 'NOT STARTED';
  misc.push(
    `| \`src/features/${a.name}\` | ${a.files} | ${a.copy.literals} | ${a.copy.translated} | ${a.copy.tCalls} | ` +
      `${a.stream.join(', ') || '—'} | ${BADGE[st]} |`,
  );
}
misc.push('');
misc.push('`inbox` shows zero files because it holds no `.tsx`. A `0 / 0` area is');
misc.push('DONE in the only sense that matters: there is nothing on it to translate.');
misc.push('');

misc.push('## Layouts and shells');
misc.push('');
misc.push('Not pages, but they render chrome and can hold copy of their own.');
misc.push('');
misc.push('| File | Lines | Copy | Resolved |');
misc.push('|---|---:|---:|---:|');
for (const l of inv.screens.filter((s) => s.kind !== 'page').sort((a, b) => a.file.localeCompare(b.file))) {
  misc.push(`| \`${l.file}\` | ${l.lines} | ${l.copy.literals} | ${l.copy.translated} |`);
}
misc.push('');

misc.push('## The shared chrome');
misc.push('');
misc.push('One component, wrong once, is wrong on every screen at the same time. Two');
misc.push('of these were:');
misc.push('');
misc.push('- **`BrandBar`** — the language chip defaulted to the literal `\'EN\'`, so');
misc.push('  Account read EN while Home read 繁 in the same session. It now reads');
misc.push('  `i18n.language` itself and subscribes to `languageChanged`.');
misc.push('- **`TabBar`** — its five labels are declared in a `const` array');
misc.push('  (`label: \'Home\'`), which the extractor\'s JSX-children pattern could not');
misc.push('  see. The whole tab bar was missing from the dictionary.');
misc.push('');

misc.push('## Pages whose words come from the server');
misc.push('');
misc.push('No client-side dictionary reaches these, however complete it gets. The text');
misc.push('arrives over a stream after the bundle is built, so translating it is a');
misc.push('backend change.');
misc.push('');
for (const p of pages.filter((x) => proseOf(x).length)) {
  misc.push(`- [\`${p.route}\`](pages/${slug(p.route)}.md) — ${proseOf(p).join(', ')}`);
}
misc.push('');
misc.push('### Live data only (not the same thing)');
misc.push('');
misc.push('A socket carrying counts and events. The copy around it is in the bundle.');
misc.push('');
for (const p of pages.filter((x) => !proseOf(x).length && liveOf(x).length)) {
  misc.push(`- [\`${p.route}\`](pages/${slug(p.route)}.md) — ${liveOf(p).join(', ')}`);
}
misc.push('');

misc.push('## Deliberately left in English');
misc.push('');
misc.push('A translator looked at each of these and ruled it NOT copy. They are');
misc.push('settled, not pending: the page files exclude them, so they never score a');
misc.push('screen as incomplete again. Translating any of them would corrupt the UI —');
misc.push('a font family in Chinese is not a font family.');
misc.push('');
if (Object.keys(SKIPPED).length) {
  misc.push('| String | Why |');
  misc.push('|---|---|');
  for (const [k, why] of Object.entries(SKIPPED)) misc.push(`| \`${k}\` | ${why} |`);
} else {
  misc.push('_None recorded yet._');
}
misc.push('');

misc.push('## Known limits of the dictionary');
misc.push('');
misc.push('- **No interpolation.** `` `${n} found` `` is a template; the rendered string');
misc.push('  has a number in it and can never match an English key. Those need a real');
misc.push('  `t()` call. The build drops any key containing `${` rather than ship one');
misc.push('  that looks translated and never fires.');
misc.push('- **No plurals.** Same reason.');
misc.push('- **Only a plain string child.** Text with a nested element arrives as an');
misc.push('  array and is left alone, because half-translating it would be worse.');
misc.push('- **An empty value falls through to English**, so a half-filled dictionary is');
misc.push('  always safe to ship.');
misc.push('');

misc.push('## Adding a translation');
misc.push('');
misc.push('```bash');
misc.push('node scripts/extract-v2-strings.js     # find hardcoded copy');
misc.push('node scripts/build-v2-dictionary.js    # fill it; hand-written wins');
misc.push('node scripts/inventory-screens.js      # re-measure every page');
misc.push('node scripts/write-translation-docs.js # rewrite these docs');
misc.push('npx jest src/i18n                      # 27 guards on the result');
misc.push('```');
misc.push('');
misc.push('New wording goes in `scripts/v2-copy-manual.json`, keyed by the English');
misc.push('sentence exactly as it renders.');
misc.push('');
misc.push('---');
misc.push('');
misc.push('Generated by `scripts/write-translation-docs.js`. Do not hand-edit.');
misc.push('');

fs.writeFileSync(path.join(OUT, 'MISCELLANEOUS.md'), misc.join('\n'));

/* ── index ─────────────────────────────────────────────────────────────── */

const counts = { DONE: 0, PARTIAL: 0, 'NOT STARTED': 0 };
pages.forEach((p) => counts[statusOf(p)]++);
// ⚠️ NOT the sum of the per-page figures. A shared component is counted once
// for every page that imports it, so adding the page rows up gives 607 for an
// app that has 321 distinct strings in it. The headline uses the de-duplicated
// totals the inventory measured per file.
const totalLit = inv.totals.copyLiterals + inv.totals.featureCopyLiterals;
const totalTr = inv.totals.copyTranslated + inv.totals.featureCopyTranslated;

const idx = [];
idx.push('# Translation status');
idx.push('');
idx.push(`${pages.length} pages · ${dictSize} dictionary strings × ${LOCALES.length} languages · ` +
  `${totalTr} of ${totalLit} distinct hardcoded literals resolved (${Math.round((totalTr / totalLit) * 100)}%)`);
idx.push('');
idx.push(`Split: ${inv.totals.copyTranslated}/${inv.totals.copyLiterals} on the route files, ` +
  `${inv.totals.featureCopyTranslated}/${inv.totals.featureCopyLiterals} across ${inv.totals.featureFiles} files in \`src/features\`.`);
idx.push('');
idx.push('> The **Copy** column below counts a page\'s own literals plus those of');
idx.push('> every component it imports, so a shared component is counted once per');
idx.push('> page. Those rows do not sum to the total above, and are not meant to —');
idx.push('> they answer "how much English is on THIS screen".');
idx.push('');
idx.push(`- ${BADGE.DONE} — ${counts.DONE} pages`);
idx.push(`- ${BADGE.PARTIAL} — ${counts.PARTIAL} pages`);
idx.push(`- ${BADGE['NOT STARTED']} — ${counts['NOT STARTED']} pages`);
idx.push(`- ⚡ server-worded — ${pages.filter((p) => proseOf(p).length).length} pages, which no client-side dictionary can reach`);
idx.push('');
idx.push('[**Miscellaneous**](MISCELLANEOUS.md) — the mechanism, the feature areas, the');
idx.push('layouts, the shared chrome, the known limits, and how to add a translation.');
idx.push('');

const areas = [...new Set(pages.map((p) => p.area))].sort();
for (const area of areas) {
  idx.push(`## \`${area}\``);
  idx.push('');
  idx.push('| Page | Status | Copy | Resolved | `t()` | Server-worded |');
  idx.push('|---|---|---:|---:|---:|---|');
  for (const p of pages.filter((x) => x.area === area)) {
    const lit = p.copy.literals + p.componentCopy.literals;
    const tr = p.copy.translated + p.componentCopy.translated;
    idx.push(
      `| [\`${p.route}\`](pages/${slug(p.route)}.md) | ${BADGE[statusOf(p)]} | ${lit} | ${tr} | ` +
        `${p.copy.tCalls + p.componentCopy.tCalls} | ${proseOf(p).length ? '⚡ ' + proseOf(p).join(', ') : '—'} |`,
    );
  }
  idx.push('');
}

idx.push('## Out of scope — the pre-v2 screens');
idx.push('');
idx.push(`${legacyPages.length} screens are deliberately NOT translated: \`(lab)\`, the old`);
idx.push('`scan` flow, `listing/[id]` and `activity`. The product is moving to v2 and');
idx.push('the effort does not pay back. They are listed so their absence is a decision');
idx.push('on the record rather than a gap someone rediscovers.');
idx.push('');
idx.push('Most already carry `t()` from the old i18n pass, so they are not English —');
idx.push('they simply are not covered by the v2 dictionary or by the device sweep.');
idx.push('');
idx.push('| Page | `t()` calls |');
idx.push('|---|---:|');
for (const p of legacyPages) {
  idx.push(`| \`${p.route}\` | ${p.copy.tCalls + p.componentCopy.tCalls} |`);
}
idx.push('');

idx.push('---');
idx.push('');
idx.push('Generated by `scripts/write-translation-docs.js` from');
idx.push('`scripts/out/screen-inventory.json`. Do not hand-edit — re-run the pipeline');
idx.push('in [MISCELLANEOUS.md](MISCELLANEOUS.md#adding-a-translation).');
idx.push('');

fs.writeFileSync(path.join(OUT, 'README.md'), idx.join('\n'));

console.log(`wrote ${pages.length} page files to Docs/Translation/pages/`);
console.log('wrote Docs/Translation/MISCELLANEOUS.md');
console.log('wrote Docs/Translation/README.md');
console.log(`status: ${counts.DONE} done, ${counts.PARTIAL} partial, ${counts['NOT STARTED']} not started`);
