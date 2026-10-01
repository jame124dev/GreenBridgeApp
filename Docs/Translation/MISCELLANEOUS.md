# Miscellaneous — everything that is not a page

The route files are mostly wiring. This is where the rest of the app lives:
the shared kit, the layouts, the feature modules, and the machinery that
decides which language is in force.

## The mechanism

Two independent systems, both live:

| | Where | Covers |
|---|---|---|
| `t()` / i18next | `src/i18n/index.ts`, `src/i18n/locales/*.json` | the old UI — `(lab)`, `scan`, `(auth)`, settings |
| English-keyed dictionary | `src/i18n/v2Auto.ts`, `src/i18n/v2-auto/*.json` | the v2 UI — 328 strings × 5 languages |

The second exists because the v2 screens were written with English in the
source. Rather than edit eight screens, the kit's `Text` looks its literal
child up by the English sentence, so one interception reaches every
component that renders copy through it — `PrimaryAction` its `label`, `Row`
its `title`, `Chip` its `label`. It is a stopgap: as screens get real `t()`
calls their strings stop reaching the map, and it shrinks to nothing.

**Languages:** `en`, `zh-hant`, `zh-hans`, `ja`, `th`, `vi`. Codes are
lowercase everywhere — `src/i18n/index.ts` sets `lowerCaseLng` and
deliberately sets no `supportedLngs`; the note in that file explains why
`zh-Hant` vs `zh-hant` silently falls back to English.

## Feature areas

| Area | Files | Hardcoded copy | Resolved | `t()` | Streaming | Status |
|---|---:|---:|---:|---:|---|---|
| `src/features/v2` | 71 | 88 | 88 | 56 | — | 🟢 DONE |
| `src/features/auth` | 2 | 14 | 14 | 11 | — | 🟢 DONE |
| `src/features/lab` | 69 | 8 | 5 | 465 | sse, chat-stream, socket | 🟡 PARTIAL |
| `src/features/scanner` | 27 | 2 | 0 | 163 | socket | 🟡 PARTIAL |
| `src/features/inbox` | 0 | 0 | 0 | 0 | — | 🟢 DONE |
| `src/features/listings` | 7 | 0 | 0 | 52 | — | 🟢 DONE |
| `src/features/location` | 1 | 0 | 0 | 4 | — | 🟢 DONE |
| `src/features/notifications` | 1 | 0 | 0 | 0 | — | 🟢 DONE |
| `src/features/seller` | 3 | 0 | 0 | 20 | — | 🟢 DONE |
| `src/features/settings` | 12 | 0 | 0 | 96 | — | 🟢 DONE |

`inbox` shows zero files because it holds no `.tsx`. A `0 / 0` area is
DONE in the only sense that matters: there is nothing on it to translate.

## Layouts and shells

Not pages, but they render chrome and can hold copy of their own.

| File | Lines | Copy | Resolved |
|---|---:|---:|---:|
| `app/_layout.tsx` | 354 | 0 | 0 |
| `app/(auth)/_layout.tsx` | 37 | 0 | 0 |
| `app/(lab)/_layout.tsx` | 80 | 0 | 0 |
| `app/(lab)/(tabs)/_layout.tsx` | 26 | 0 | 0 |
| `app/+not-found.tsx` | 27 | 0 | 0 |
| `app/activity/_layout.tsx` | 8 | 0 | 0 |
| `app/scan/_layout.tsx` | 36 | 0 | 0 |
| `app/v2/_layout.tsx` | 74 | 0 | 0 |
| `app/v2/dashboard/_layout.tsx` | 65 | 0 | 0 |
| `app/v2/scan/review/_layout.tsx` | 39 | 0 | 0 |

## The shared chrome

One component, wrong once, is wrong on every screen at the same time. Two
of these were:

- **`BrandBar`** — the language chip defaulted to the literal `'EN'`, so
  Account read EN while Home read 繁 in the same session. It now reads
  `i18n.language` itself and subscribes to `languageChanged`.
- **`TabBar`** — its five labels are declared in a `const` array
  (`label: 'Home'`), which the extractor's JSX-children pattern could not
  see. The whole tab bar was missing from the dictionary.

## Pages whose words come from the server

No client-side dictionary reaches these, however complete it gets. The text
arrives over a stream after the bundle is built, so translating it is a
backend change.

- [`/v2/chat`](pages/v2-chat.md) — sse, chat-stream
- [`/v2/scan/analyzing`](pages/v2-scan-analyzing.md) — sse

### Live data only (not the same thing)

A socket carrying counts and events. The copy around it is in the bundle.

- [`/v2/account`](pages/v2-account.md) — socket
- [`/v2/browse`](pages/v2-browse.md) — socket
- [`/v2/drafts`](pages/v2-drafts.md) — socket
- [`/v2/listing/[id]`](pages/v2-listing-id.md) — socket
- [`/v2/listings`](pages/v2-listings.md) — socket
- [`/v2/messages`](pages/v2-messages.md) — socket

## Deliberately left in English

A translator looked at each of these and ruled it NOT copy. They are
settled, not pending: the page files exclude them, so they never score a
screen as incomplete again. Translating any of them would corrupt the UI —
a font family in Chinese is not a font family.

| String | Why |
|---|---|
| `#9AA89F` | hex colour value |
| `#9ca3af` | colour value |
| `101IT` | marketplace brand name |
| `101LAB` | marketplace brand name |
| `101MACHINE` | marketplace brand name |
| `101RECYCLE` | marketplace brand name |
| `AI` | used as-is in all five target locales |
| `Agilent / Waters HPLC + DAD` | brand names plus technical abbreviations only |
| `Agilent 1260 Infinity II HPLC` | brand and product model name |
| `English` | language-picker option shown in its own language (endonym) |
| `GreenBidz` | brand name |
| `HPLC + DAD` | technical equipment abbreviations only, no translatable copy |
| `HankenGrotesk_700Bold` | font family name |
| `IBMPlexSans_600SemiBold` | font family name |
| `TWD (NT$)` | currency code and symbol token |
| `Thermo Scientific TSX −80°C Freezer` | brand and product model name |
| `USD ($)` | currency code and symbol token |
| `UTC` | standard time-zone token kept in Latin |
| `details` | ReviewStep slug (wizardState.ts:60), not user-facing copy |
| `font-heading` | font family token |
| `font-heading-semi` | font family token |
| `font-sans` | font family token |
| `mobile.listingEdit.field.title` | i18n key, not user-facing copy |
| `you@example.com` | email placeholder, stays Latin |
| `上海 (GMT+8)` | already in Chinese script |
| `台北 (GMT+8)` | already in Chinese script |
| `東京 (GMT+9)` | already in CJK script |
| `香港 (GMT+8)` | already in Chinese script |

## Known limits of the dictionary

- **No interpolation.** `` `${n} found` `` is a template; the rendered string
  has a number in it and can never match an English key. Those need a real
  `t()` call. The build drops any key containing `${` rather than ship one
  that looks translated and never fires.
- **No plurals.** Same reason.
- **Only a plain string child.** Text with a nested element arrives as an
  array and is left alone, because half-translating it would be worse.
- **An empty value falls through to English**, so a half-filled dictionary is
  always safe to ship.

## Adding a translation

```bash
node scripts/extract-v2-strings.js     # find hardcoded copy
node scripts/build-v2-dictionary.js    # fill it; hand-written wins
node scripts/inventory-screens.js      # re-measure every page
node scripts/write-translation-docs.js # rewrite these docs
npx jest src/i18n                      # 27 guards on the result
```

New wording goes in `scripts/v2-copy-manual.json`, keyed by the English
sentence exactly as it renders.

---

Generated by `scripts/write-translation-docs.js`. Do not hand-edit.
