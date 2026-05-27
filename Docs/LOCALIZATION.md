# Localization (i18n) — Mobile App

**Status:** End-to-end working — language switch from the Home pill persists across reloads and re-renders all wired screens in EN / ZH (Traditional) / JA / TH.
**Last update:** 2026-05-26
**Companion docs:** [SCANNER_FLOW.md](./SCANNER_FLOW.md), [STARTER_KIT.md](./STARTER_KIT.md), [DESIGN_DELTA_v7.md](./DESIGN_DELTA_v7.md)

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Library | `react-i18next` + `i18next` | Matches the web app ([101lab-2](../../101lab-2/src/i18n/)); same translation files copy over. |
| Bundling | JSON resources imported at boot | No remote namespace loading — keeps cold start fast. |
| Persistence | MMKV (`scan-draft` instance) via key `i18n.language` | Same storage backend as `scanDraftStore`; no extra deps. |
| Selector UI | Custom RN `<Modal>` ([LanguageSheet.tsx](../src/components/ui/LanguageSheet.tsx)) | `Alert.alert` only renders the title on RN-Web — multi-button picker doesn't work. |
| Plurals | `_one` / `_other` keys + `t(key, { count })` | i18next's standard plural mechanism. |

Supported languages: `en`, `zh`, `ja`, `th`. `fallbackLng: 'en'`.

---

## 2. Files

| Path | Purpose |
|---|---|
| [src/i18n/index.ts](../src/i18n/index.ts) | i18n bootstrap, MMKV persistence, `languageChanged` listener, `__DEV__` `window.__i18n` exposure for chrome-devtools driving. |
| [src/i18n/locales/{en,zh,ja,th}.json](../src/i18n/locales/) | Full translation resources. Copied from the web app's locales; the `mobile.*` namespace is mobile-only. |
| [src/i18n/_seed_keys.py](../src/i18n/_seed_keys.py) | One-shot Python script that re-seeds the `mobile.*` namespace on all 4 JSONs. Safe to re-run — overwrites the `mobile` key only. |
| [src/components/ui/LanguageSheet.tsx](../src/components/ui/LanguageSheet.tsx) | Bottom-sheet language picker used by the Home header pill. |

---

## 3. Namespace shape

All mobile-only keys live under `mobile.*` to avoid collisions with web-shared keys. The script seeds **16 top-level subkeys**:

```
mobile.
├── home          — greeting, scan CTA, recent-uploads label, language sheet copy
├── status        — LIVE / PENDING / SOLD / SUBMITTED / REVIEW / INSPECT / INACTIVE (used by status pills)
├── common        — cancel / ok / retry / back / next / save / remove / loading / couldNotLoad …
├── camera        — permission text, TIP / Good!, capture errors, NEXT button
├── processing    — AI WORKING pill, sub-statuses, slow toast, error block (retake / continue without AI)
├── review        — heading, untitled, suggested price, rearrange / regenerate / looks-good
├── detail        — section labels (TITLE/DESCRIPTION/…), condition labels, REQUIRED bar (header + 3 rows),
│                   price chips, submit, group buttons, doc save / submit error Alerts
├── success       — heading, caption, summary rows (BATCH # / PHOTOS / CONDITION / PRICE / ITEMS), buttons
├── history       — heading, subtitle, TOTAL card, filter chips, empty / emptyFilter
├── listingMethod — heading, subtitle, single / grouped cards
├── groupedReview — heading, plural subtitle, item N, edit, add-another, plural submitN, partialProgress
├── reorder       — heading, cover label, saveOrder / continueBtn, savingTitle / Body
├── resume        — Resume scan? Alert (title/body, startFresh/resume/cancel, expiredTitle/Body)
├── auth          — welcomeBack, email/password labels + placeholders, signIn, forgot password,
│                   verifyEmail / sellersOnly / loginFailed / invalidInput, pending.* (heading, body, openSite, signOut)
├── profile       — heading, role, signOut / signingOut
└── listing       — batch detail heading, batchN, pendingApproval, productsHeading, hint,
                    openOnWebsite, envHint, loadFailed
```

---

## 4. Persistence

- On boot, `loadStoredLanguage()` reads `mmkv.getString('i18n.language')`. If it's a supported code, `lng` is initialised with it; otherwise it falls back to `'en'`.
- The lookup is wrapped in `try/catch` to survive Expo Web's SSR prerender pass (where MMKV is not available).
- A `i18n.on('languageChanged')` listener writes the new language back to MMKV — also wrapped in `try/catch` for the same SSR reason.

Result: changing language in the sheet → next reload renders in the saved language. Verified end-to-end via Chrome DevTools driving (set `zh` → reload → page renders in Chinese; modal opens with translated labels).

---

## 5. Screens wired to `t()`

All screens below import `useTranslation` and route their user-facing strings through `t('mobile.<screen>.<key>')`:

| Screen | Path |
|---|---|
| Home | [app/(tabs)/index.tsx](../app/(tabs)/index.tsx) |
| History | [app/(tabs)/history.tsx](../app/(tabs)/history.tsx) |
| Profile | [app/(tabs)/profile.tsx](../app/(tabs)/profile.tsx) |
| Login | [app/(auth)/login.tsx](../app/(auth)/login.tsx) |
| Pending approval | [app/(auth)/pending.tsx](../app/(auth)/pending.tsx) |
| Listing method | [app/scan/listing-method.tsx](../app/scan/listing-method.tsx) |
| Camera | [app/scan/camera.tsx](../app/scan/camera.tsx) |
| Processing | [app/scan/processing.tsx](../app/scan/processing.tsx) |
| Review (AI) | [app/scan/review.tsx](../app/scan/review.tsx) |
| Detail | [app/scan/detail.tsx](../app/scan/detail.tsx) |
| Grouped review | [app/scan/grouped-review.tsx](../app/scan/grouped-review.tsx) |
| Reorder photos | [app/scan/reorder-photos.tsx](../app/scan/reorder-photos.tsx) |
| Success | [app/scan/success.tsx](../app/scan/success.tsx) |
| Batch detail | [app/listing/[id].tsx](../app/listing/[id].tsx) — top-level strings only (header / load-failed / Open-on-website); the expanded Products / Bidding / Inspection sections still carry English labels. |
| RecentSubmissionsList | [src/components/scanner/RecentSubmissionsList.tsx](../src/components/scanner/RecentSubmissionsList.tsx) |
| LanguageSheet | [src/components/ui/LanguageSheet.tsx](../src/components/ui/LanguageSheet.tsx) |

---

## 6. Patterns

### 6.1 Plurals
i18next handles English `_one` / `_other` via `count`:
```tsx
t('mobile.home.itemsCount', { count: 3 })          // "3 items"
t('mobile.detail.reviewGroup', { count: 1 })       // "Review group (1 item)"
t('mobile.groupedReview.submitN', { count: 5 })    // "Submit 5 items"
```

The non-English locales reuse the same translation for both forms (Chinese / Japanese / Thai don't pluralise nouns).

### 6.2 Bold-name span
For "Hi, **John**." the placeholder is split at render time so part of the string can be wrapped in a styled `<Text>`:
```tsx
const firstName = profile.name.split(' ')[0];
const full = t('mobile.home.greeting', { name: firstName });
const idx = full.indexOf(firstName);
return (
  <>
    {full.slice(0, idx)}
    <Text style={styles.greetingName}>{firstName}</Text>
    {full.slice(idx + firstName.length)}
  </>
);
```
This works in any language as long as the placeholder appears literally in the string.

### 6.3 Condition labels (per-key i18n with constant fallback)
`CONDITION_LABELS` in [src/features/scanner/constants.ts](../src/features/scanner/constants.ts) keeps the English source of truth. Screens look up the translated label by condition key with a fallback:
```tsx
t(`mobile.detail.condition.${key}`, { defaultValue: CONDITION_LABELS[key] })
```

### 6.4 AI request language
Web sends `"zh-hant"` for Chinese and `"en"` otherwise. Mobile mirrors this via `toAnalyzeLanguage(i18n.language)` ([src/features/scanner/constants.ts](../src/features/scanner/constants.ts)) — the Processing screen captures `i18n.language` into a ref so the in-flight `AbortController`-aware mutation doesn't change language mid-call.

### 6.5 Persistent storage caveat (SSR)
Anything that touches MMKV at module load must be wrapped:
```ts
try { return mmkv.getString('i18n.language'); } catch { return undefined; }
```
Expo Web's prerender step runs the module on Node, where MMKV throws `Tried to access storage on the server`.

---

## 7. Re-seeding the namespace

The seed script is the source of truth. After editing keys:

```bash
cd src/i18n
python _seed_keys.py
```

It overwrites only the `mobile` key on each JSON; all web-shared keys (`auth`, `dashboard`, …) are preserved.

**When to use the script vs. editing JSON directly:**
- Adding / renaming keys → script (consistency across 4 langs).
- Tweaking translation copy in one language → either is fine.

The script previously hit Windows `ENAMETOOLONG` when invoked inline with `python -c` for the full seed; writing it to disk is the reliable form.

---

## 8. Selector UI

[LanguageSheet.tsx](../src/components/ui/LanguageSheet.tsx) renders a bottom-sheet modal with EN / ZH (中文) / JA (日本語) / TH (ภาษาไทย). The active row shows ✓, selecting calls `i18n.changeLanguage(code)` and closes the sheet.

**Why custom, not `Alert.alert`:** RN-Web's Alert only renders the title — none of the buttons appear. The original implementation used `Alert.alert('Language', '...', [...])` and looked broken on web. The `<Modal>` works on iOS / Android / Web.

**Dev tip:** chrome-devtools synthetic clicks don't always reach RN-Web `Pressable` onPress. To verify the underlying logic during automated testing, call `window.__i18n.changeLanguage('zh')` directly (exposed behind `__DEV__`).

---

## 9. Known gaps

- **Batch detail (full)** — [app/listing/[id].tsx](../app/listing/[id].tsx) was expanded by a follow-up patch to include Products / Bidding / Batch Info / Inspection cards with rich English labels. Only the top-level header / load-failed / Open-on-website strings are translated; the section card titles ("Products in Batch", "Bidding Details", "Inspection"), info-row labels (Brand / Model / Year / Start Date / Target Price / …), and chips ("Make Offer" / "Fixed Price" / "Whole Price" / "Weight-Based") are still hardcoded English.
- **Date / number formatting** — currently uses `toLocaleString(undefined, …)`, which falls back to device locale rather than i18n language. If a Chinese-language user is on an `en-US` device they'll see English month names. Acceptable for now; revisit if QA flags it.
- **API-returned status strings** — backend may return raw values like `"under_review"` or `"inspection_scheduled"`. These are uppercased / underscore-stripped at display time. If the backend ever returns localized status text, switch to that instead of client-side translation.

---

## 10. QA checklist

- [ ] Tap 🌐 pill on Home → sheet opens with translated title + 4 options.
- [ ] Switch ZH → all 4 tabs (Home / History / Scan / Profile) re-render in Chinese.
- [ ] Reload app → still in Chinese.
- [ ] Start a scan → Camera permission alert, TIP / Good! pills, NEXT button all in Chinese.
- [ ] Processing → AI WORKING pill, sub-statuses cycling in Chinese.
- [ ] Detail → section labels, REQUIRED bar header + rows, condition chips, Submit all in Chinese.
- [ ] Success → heading / caption / summary rows / buttons in Chinese.
- [ ] Login → all labels, placeholders, Alert titles in Chinese.
- [ ] Switch back to EN → everything renders in English.
- [ ] Switch JA / TH → spot-check Home + Detail.

---

## 11. References

- Web i18n source: [101lab-2/src/i18n/](../../101lab-2/src/i18n/) — copied the locale JSONs verbatim; `mobile.*` namespace is mobile-only.
- i18next plurals: https://www.i18next.com/translation-function/plurals
- react-i18next: https://react.i18next.com/
