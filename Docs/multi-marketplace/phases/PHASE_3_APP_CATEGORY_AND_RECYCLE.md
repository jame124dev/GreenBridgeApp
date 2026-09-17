# Phase 3 — App: the two hard blockers (M-1, M-2)

**Owner of this file:** whoever implements it. **Author:** senior engineer, 2026-08-18.
**Implements:** `MULTI_MARKETPLACE_PLAN.md` §7 Stage 1, tasks **M-1** and **M-2** only.
**Ships in:** app version **1.0.4** (a store binary — see "What must land before/after").
**Repo:** `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp` (HEAD at time of writing: `11ef609`).

Everything below was opened and re-checked on 2026-08-18 against the working tree and against the
**dev** API. Where the approved plan's `file:line` had drifted, the correct reference is given inline
and repeated in §9 "Citation drift". Where something is *not* verified, it says so.

---

## 0. Why these two, and why in this order

- **M-1 is a hard submit-blocker.** `101recycle` fetches the **lab** category tree
  (`src/services/scanner/fetchCategories.ts:24-29`). The recycle ids the backend picks are not in
  that tree, so `CategoryConditionCard`'s validity check (`:124`) rejects them, the field is cleared
  (`:157`), and `categoryId` is schema-required (`src/features/scanner/schema.ts:23`) — the listing
  **cannot be submitted at all**. Re-measured on dev today: recycle ids `1147–5366`, lab ids
  `5371–5849`, **overlap 0**.
- **M-2 is what makes M-1 and the Stage-0 "blank category" decision survivable.** Once the app can
  legitimately hand the seller an empty category, picking one has to be fast. Today it is two stacked
  240 px nested scrollers inside the page scroll with no search
  (`CategoryConditionCard.tsx:211-216` and `:267-272`).
- They touch the same two files and the same data shape. Doing M-2 first would mean building the
  sheet against a tree that is wrong for one of the four marketplaces, then reworking it.
  **Do M-1 first.**

---

## 1. ⚠️ THE TRAP — read this before you write a line

`CategoryConditionCard.tsx:46-47` rebuilds the category tree from `watch('marketplace')`:

```tsx
  const marketplace = watch('marketplace');
  const categories = useLabCategories(marketplace);
```

The card's own comment at `:166-169` records what happens if you "tidy" the clearing logic into that
watch:

```tsx
  // NOTE: clearing the category/subcategory + Other fields on a marketplace
  // change is handled in MarketplaceCard's onPress (user-driven only). Doing it
  // here via a watch-effect wrongly fired during initial hydration (the form's
  // default marketplace flips to the AI's), wiping the auto-filled category.
```

**Rules for this phase, no exceptions:**

1. **Never write `categoryId` / `parentCategoryId` / `parentCategoryName` / `customSubcategory` from
   an effect that depends on `marketplace`.** The only place a marketplace switch clears the category
   is `MarketplaceCard.tsx:50-63`, inside `onPress` — a user gesture.
2. **Do not touch the hydrate/bridge effect at `CategoryConditionCard.tsx:112-164`.** It is the thing
   that preserves the AI's auto-filled category: non-empty-tree gate at `:117`, EN-bridge settle gate
   at `:118`, `__other__` sentinel guard at `:121`, parent-only adoption at `:147-155`. M-2 moves the
   *presentation* around it; the effect body is copied **verbatim**, dependency array included.
3. The only new writes this phase introduces are inside the new sheet's `onSelect` callback, which is
   reached exclusively from a `Pressable` `onPress`. If you find yourself adding a `useEffect` that
   calls `setValue`, stop — you are re-opening the hydration race.
4. Keep the `:166-169` comment in the file. It is the guard rail for the next person.

---

## 2. Re-verify the references before you start (`main` moves; anchors don't)

Line numbers here were correct on 2026-08-18. Do not trust them — re-anchor with these greps, all
read-only. Every one printed the expected line today.

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp

# M-1 anchors
grep -n "function endpointForMarketplace"        src/services/scanner/fetchCategories.ts   # 24
grep -n "export function bridgeCategoryId"       src/services/scanner/fetchCategories.ts   # 95
grep -n "export function flattenCategoryOptions" src/services/scanner/fetchCategories.ts   # 144
grep -n "EN_CATEGORY_NAME_FIXUPS"                src/services/scanner/fetchCategories.ts   # 47,54,57
grep -n "export function fetchLabCategories"     src/services/scanner/fetchCategories.ts   # 62

# M-2 anchors
grep -n "const stillValid"                  src/features/scanner/components/detail/CategoryConditionCard.tsx  # 124
grep -n "NOTE: clearing the category"       src/features/scanner/components/detail/CategoryConditionCard.tsx  # 166
grep -n "maxHeight: 240"                    src/features/scanner/components/detail/CategoryConditionCard.tsx  # 212,268
grep -n "const onPickParent"                src/features/scanner/components/detail/CategoryConditionCard.tsx  # 182
grep -n "marketplace === '101it'"           src/features/scanner/components/detail/CategoryConditionCard.tsx  # 430
grep -n "Sheet.Option = function SheetOption"  src/components/ui/Sheet.tsx    # 152
grep -n "export function Sheet"                src/components/ui/Sheet.tsx    # 51
grep -n "categoryId: z.string"                 src/features/scanner/schema.ts # 23
grep -n "MARKETPLACE_LOCKED"                   src/features/scanner/components/detail/MarketplaceCard.tsx  # 17-22,29

# The THREE screens that mount CategoryConditionCard — M-2's real blast radius
grep -rn "<CategoryConditionCard />" app     # app/scan/detail.tsx:130
                                             # app/scan/grouped-edit.tsx:220
                                             # app/(lab)/listing-edit.tsx:534
```

**The backend is only read, never changed, in this phase.** Two backend files are quoted as the
contract this phase must match; re-anchor them the same way:

```bash
cd C:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
grep -n "async function fetchRecycle"   utils/categoryCache.js           # 163
grep -n "export const getCategories"    controller/productController.js  # 244
grep -n '"/category"'                   routes/productRoute.js           # 35
```

Backend HEAD when this was written: `aabac85`, with the uncommitted chat-IDOR / socket-auth /
AI-description work present in the tree. **Do not commit, stash, reset or clean anything in either
repo.**

---

## 3. ⚠️ Environment — point the app at DEV, and put it back

`.env` is git-ignored (`.gitignore:34`), is loaded into `app.config.ts` via `import 'dotenv/config'`
(`app.config.ts:1`), is exposed as `extra.GREENBIDZ_API_URL` (`app.config.ts:255`), and the axios
client reads it as its `baseURL` (`src/api/greenbidzClient.ts:19`).

**Right now `.env` holds PRODUCTION:**

```
GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
```

### 3.1 Before you start — in this order

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
# 1. Back the file up OUTSIDE the repo so no git operation can lose it, and record
#    the path so §3.2 restores from THIS backup rather than from a glob.
ENVBAK="C:/Users/Pc/AppData/Local/Temp/claude/env.backup.$(date +%Y%m%d-%H%M%S)"
cp .env "$ENVBAK"
echo "$ENVBAK" > "C:/Users/Pc/AppData/Local/Temp/claude/env.backup.LATEST"
# 2. Record the exact line you are replacing, so the restore is not from memory.
grep -n '^GREENBIDZ_API_URL=' .env
# 3. Point at dev.
sed -i 's#^GREENBIDZ_API_URL=.*#GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1#' .env
grep -n '^GREENBIDZ_API_URL=' .env   # must read testapi.greenbidz.com
```

`GREENBIDZ_API_URL` is read at **config-eval time** (it is not an `EXPO_PUBLIC_*` var), so after
changing it: **restart Metro with `npx expo start --clear`.** No dev-client rebuild is needed — there
is no native change in this phase.

### 3.2 After you finish — restore, and prove it

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
sed -i 's#^GREENBIDZ_API_URL=.*#GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1#' .env
grep -n '^GREENBIDZ_API_URL=' .env   # MUST read api.101recycle.greenbidz.com/api/v1
# and prove nothing ELSE in the file moved. Read the ONE backup path recorded in
# §3.1 — an `env.backup.*` glob matches every previous run, and `grep` then
# prefixes each line with a filename, so the diff can never come back clean:
ENVBAK="$(cat 'C:/Users/Pc/AppData/Local/Temp/claude/env.backup.LATEST')"
diff <(grep -v '^GREENBIDZ_API_URL=' "$ENVBAK") \
     <(grep -v '^GREENBIDZ_API_URL=' .env)   # must print nothing
```

**A previous session left this file on a `localhost` URL and it had to be recovered from a backup.**
Restoring `.env` is part of "done", not an afterthought. Do not hand the branch over with the app
pointed anywhere but production.

### 3.3 Hard limits for this phase

- **Read-only against dev.** Every step below issues `GET`s only. No listing is submitted, published
  or edited on any marketplace.
- **No production write, no prod deploy, no migration, no backend change.** Nothing here needs prod.
- `greenbidz-ai-assistant/` is not touched.
- **No EAS Update.** 1.0.3 (build 19) is `WAITING_FOR_REVIEW` and `runtimeVersion.policy` is
  `appVersion` (`app.config.ts:90-91`), so an OTA for 1.0.3 would reach the build Apple is testing.

---

## 4. Measured ground truth (dev, `https://testapi.greenbidz.com/api/v1`, all HTTP 200, 2026-08-18)

| Marketplace | Endpoint the app should call | Lang param | Row shape | Parents / subs | Id range |
|---|---|---|---|---|---|
| `101lab` | `/product/lab/category` | `language` | `{id,name,slug,count,subcategories[]}` | 4 / 62 | 5371–5849 |
| `101machine` | `/product/machines/category` | `language` | `{id,name,slug}` — **`subcategories` key absent on all 13 rows** | 13 / 0 | 5296–5862 |
| `101it` | `/product/it/category` | `language` | `{id,name,slug,subcategories[]}` | 6 / 25 | 5419–5524 |
| **`101recycle`** | **`/product/category`** | **`lang`** | **`{term_id,term_taxonomy_id,name,slug,description,thumbnail_id}` — no `subcategories`, no `id`** | **37 / 0** | **1147–5366** |

Cross-tree id overlap, computed today: **recycle ∩ lab = 0, recycle ∩ machines = 0,
recycle ∩ 101it = 0.** The two recycle ids named in the brief — `1281` ("Surplus &amp; Scrap
Materials") and `2019` ("Metalworking Equipment") — are **both present in the recycle tree and absent
from the lab tree.** HTML-escaped names in the EN recycle tree: **18 of 37**. In the lab / machines /
101it trees: **0**.

### 4.1 Three findings about the recycle endpoint that are NOT in the approved plan

All three came out of reading the endpoint's controller and diffing the two live trees, and all three
change what M-1 has to do.

**(a) The parameter is `lang`, not `language`.** `getCategories`
(`101recycle-greenbidz-backend/controller/productController.js:244-257`) reads `req.query.lang` and
coerces anything that is not `en` / `zh` to `zh-hant`. Verified on dev: `?language=en` returns the
**Chinese** tree (the `language` param is simply ignored); `?lang=en` returns English. If M-1 changes
only the path and keeps `?language=`, a recycle listing gets 37 Chinese names on an English phone and
every AI-supplied EN id is still invalid — the same bug in a new costume.

**(b) Only two recycle trees exist: `en` and `zh-hant`.** Same controller, `:251-257`. Verified on
dev: `?lang=ja`, `?lang=th` and no-param all return the identical `zh-hant` tree (ids 1154–5367).
Four of the app's six shipped locales (ja, th, vi, zh-Hans) have **no** recycle translation today.

**(c) `bridgeCategoryId`'s sorted-position heuristic is WRONG for the recycle tree — silently.**
`bridgeCategoryId` (`fetchCategories.ts:95-131`) assumes position-in-sorted-id-order identifies the
same logical category across locales, which its doc comment says was verified for `/machines`. It
does **not** hold for recycle. Both trees return 37 rows in ascending id order; position by position:

| pos | EN | zh-hant at the same position | verdict |
|---|---|---|---|
| 0–13 | 1147 Material Handling … 1281 Surplus &amp; Scrap Materials | 1154 … 1287 | aligned |
| **14** | 1339 Packaging Equipment | 1373 半導體與電子製造 (*Semiconductor & Electronics*) | **WRONG** |
| **15** | 1344 Automation &amp; Robotics | 1399 包裝設備 (*Packaging*) | **WRONG** |
| **16** | 1352 Semiconductor &amp; Electronics Manufacturing | 1404 自動化與機器人 (*Automation & Robotics*) | **WRONG** |
| **17** | 1918 Others | 2195 金屬加工機械 (*Metalworking*) | **WRONG** |
| **18** | 1954 Recycling Technology | 2238 其他 (*Others*) | **WRONG** |
| **19** | **2019 Metalworking Equipment** | 2312 回收技術 (*Recycling Technology*) | **WRONG** |
| **20** | 2020 Woodworking Equipment | 2408 運輸與物流設備 (*Transport & Logistics*) | **WRONG** |
| **21** | 2046 Transport &amp; Logistics Equipment | 2416 木工機械 (*Woodworking*) | **WRONG** |
| 22–36 | 5234 … 5366 | 5235 … 5367 | aligned |

**8 of 37 mis-map**, and one of them is `2019` — one of the two ids the brief names. A Taiwanese
seller photographing a lathe would have "Metalworking Equipment" silently rewritten to 回收技術
(Recycling Technology) and submitted. Raw API order equals sorted order, so ordering by response
position does not help. Slugs do not help either: EN slugs are ASCII
(`material-handling-equipment`), zh slugs are percent-encoded Chinese
(`%e7%89%a9%e6%96%99%e6%90%ac%e9%81%8b%e8%a8%ad%e5%82%99`) — there is no cross-locale key on the wire.

**Therefore M-1 pins `101recycle` to the `en` tree**, for four verifiable reasons:

1. The backend's own recycle cache is **EN-only**: `fetchRecycle`
   (`utils/categoryCache.js:163-169`) hard-codes `.../product/category?lang=en`. So **every** recycle
   id the AI can return is an EN-tree id. Fetch EN and `stillValid`
   (`CategoryConditionCard.tsx:124`) matches with **no bridge at all** — zero chance of a silent
   mis-file.
2. There is no ja/th/vi/zh-Hans recycle tree (4.1b), so those four locales see Chinese names today.
   English is a strict improvement for them.
3. Only zh-Hant / zh-Hans sellers lose a localised recycle label — in exchange for removing an
   8-in-37 chance of the wrong category being written. **Untranslated beats silently wrong.**
4. It reverts in one line the day the backend exposes stable cross-locale ids — exactly the fix
   `bridgeCategoryId`'s own comment asks for at `:92-94`.

The zh-Hant recycle labels become a **backend/content follow-up**, recorded in §8.

### 4.2 One more content bug found in passing (worth one line of code)

The EN recycle tree contains an **untranslated Chinese name**: term **5334** returns
`車床 (CNC 與傳統)` from `?lang=en`, while term **5341** returns the English
`Lathes (CNC &amp; Conventional)`. That is exactly the bug `EN_CATEGORY_NAME_FIXUPS`
(`fetchCategories.ts:47-49`) already exists for (lab term 5373). Keying by id is verified safe here:
recycle ids do not collide with lab, machines or 101it ids (overlap 0 against all three), so a fixup
on 5334 cannot reach another tree.

Also present: a junk row `5366 "test"`. **Do not filter junk ids client-side** — the AI can return
them, and dropping a returned id would clear a "valid" pick and re-create the blocker. Both go on the
owner's taxonomy list instead (§8).

---

## 5. File structure

### Created

| File | Responsibility |
|---|---|
| `src/features/scanner/components/detail/CategoryPickerSheet.tsx` | **The searchable category sheet.** Pure presentational: takes a `LabCategory[]`, the current value, loading/error flags and a marketplace label; renders search + grouped browse (or flat rows for flat trees) + `Other (type brand)` + empty/loading/error states; returns a `CategoryPick` on tap. **No react-hook-form, no React Query** — that is what makes it unit-testable and what keeps the form writes on the card, where they stay user-initiated. |
| `src/services/scanner/__tests__/recycleCategoryEndpoint.test.ts` | M-1: which URL is requested per marketplace, and with which lang param. |
| `src/services/scanner/__tests__/recycleCategoryShape.test.ts` | M-1: `normalizeRecycleCategories`, `decodeHtmlEntities`, `normalizeLabCategories`, `flattenCategoryOptions` on a flat tree, and the positional-bridge hazard. |
| `src/features/scanner/components/detail/__tests__/CategoryPickerSheet.test.tsx` | M-2: search filtering, flat vs nested rows, `Other`, empty-state recovery, loading/error copy, and the exact `CategoryPick` emitted. |

### Modified

| File | Change |
|---|---|
| `src/services/scanner/fetchCategories.ts` | `endpointForMarketplace` returns a descriptor (path + lang param + shape + `enOnly`) and is **exported**; new `decodeHtmlEntities`, `normalizeRecycleCategories`, `normalizeLabCategories`; `fetchLabCategories` routes and normalises through them; `flattenCategoryOptions` additionally emits `parentId`/`parentName` and gains an exported `CategoryLeafOption` return type; one entry added to `EN_CATEGORY_NAME_FIXUPS`. |
| `src/features/scanner/components/detail/CategoryConditionCard.tsx` | The two 240 px `ScrollView`s and the whole subcategory `Controller` are replaced by **one row** (label + current pick + Change) that opens `CategoryPickerSheet`. The `customSubcategory` input moves up to card level. `selectedParentId` state, its sync effect and `onPickParent` are deleted. **The hydrate/bridge effect and the `:166-169` NOTE are untouched.** |
| `src/components/ui/Sheet.tsx` | Two **additive, backwards-compatible** props: `stickyHeader?: React.ReactNode` on `Sheet` (so the search field does not scroll away), and `onPress` made optional on `Sheet.Option` (so a section header is not a tappable no-op). |
| `src/i18n/locales/{en,ja,th,vi,zh-Hans,zh-Hant}.json` | 11 new `mobile.detail.*` keys, all six locales. |

### Not modified in this phase

`MarketplaceCard.tsx` (M-4 owns `MARKETPLACE_LOCKED`), `mapSmartDetection.ts` (M-4 / M-6),
`ProfitIntelligenceCard.tsx` (M-5), `requiredStatus.ts` (M-7), `DetailFooter.tsx` (M-8),
`useDetailController.ts` (M-9), the AI badge on the category `FieldLabel` (M-10), anything under
`101recycle-greenbidz-backend/`, anything under `greenbidz-ai-assistant/`.

---

# M-1 — 101recycle category endpoint + shape

## Step M1.0 — Prove the problem against dev, read-only

Run exactly this. It fetches the trees from **dev** and prints the failure.

```bash
SP="C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/scratch"; mkdir -p "$SP"
B=https://testapi.greenbidz.com/api/v1
curl -s "$B/product/lab/category?language=en"      -o "$SP/lab_en.json"
curl -s "$B/product/machines/category?language=en" -o "$SP/mach_en.json"
curl -s "$B/product/it/category?language=en"       -o "$SP/it_en.json"
curl -s "$B/product/category?lang=en"              -o "$SP/rec_en.json"
curl -s "$B/product/category?lang=zh-hant"         -o "$SP/rec_zh.json"
curl -s "$B/product/category?language=en"          -o "$SP/rec_wrongparam.json"

node -e "
const rd=n=>require('$SP/'+n).data;
const ids=t=>t.flatMap(c=>[c.id,...(c.subcategories||[]).map(s=>s.id)]);
const lab=ids(rd('lab_en.json'));
const rec=rd('rec_en.json').map(r=>r.term_id);
console.log('lab ids', Math.min(...lab)+'-'+Math.max(...lab), 'count', lab.length);
console.log('rec ids', Math.min(...rec)+'-'+Math.max(...rec), 'count', rec.length);
console.log('overlap lab n rec =', rec.filter(i=>lab.includes(i)).length);
console.log('1281 in lab?', lab.includes(1281), ' 2019 in lab?', lab.includes(2019));
console.log('1281 in rec?', rec.includes(1281), ' 2019 in rec?', rec.includes(2019));
console.log('rec rows carry a subcategories key?', rd('rec_en.json').some(r=>'subcategories' in r));
console.log('rec rows carry an id key?', rd('rec_en.json').some(r=>'id' in r));
console.log('HTML-escaped rec names:', rd('rec_en.json').filter(r=>/&[a-z#0-9]+;/i.test(r.name)).length, 'of', rec.length);
console.log('?language=en first name ->', rd('rec_wrongparam.json')[0].name);
"
```

**Expected output — this is what it printed on 2026-08-18:**

```
lab ids 5371-5849 count 66
rec ids 1147-5366 count 37
overlap lab n rec = 0
1281 in lab? false  2019 in lab? false
1281 in rec? true  2019 in rec? true
rec rows carry a subcategories key? false
rec rows carry an id key? false
HTML-escaped rec names: 18 of 37
?language=en first name -> 物料搬運設備
```

That is the whole blocker on one screen: the app asks the lab tree for ids that only exist in the
recycle tree, and even the naive path-only fix (`?language=`) returns Chinese.

## Step M1.1 — Add the RED test for the endpoint

Create `src/services/scanner/__tests__/recycleCategoryEndpoint.test.ts`:

```ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// babel-plugin-jest-hoist workaround used throughout this repo (see
// recognitionJobClient.test.ts:5-12): create the jest.fn() INSIDE the factory,
// then grab a reference through the already-mocked import.
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import { fetchLabCategories } from '@/services/scanner/fetchCategories';

type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockGet = greenbidz.get as AxiosLikeMock;

const urlOf = () => String(mockGet.mock.calls[0]?.[0] ?? '');

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: { data: [] } });
});

describe('fetchLabCategories — endpoint per marketplace', () => {
  it('101lab uses the lab taxonomy with the `language` param', async () => {
    await fetchLabCategories('en', '101lab');
    expect(urlOf()).toBe('/product/lab/category?language=en');
  });

  it('101machine uses the machines taxonomy', async () => {
    await fetchLabCategories('en', '101machine');
    expect(urlOf()).toBe('/product/machines/category?language=en');
  });

  it('101it uses the 101it taxonomy', async () => {
    await fetchLabCategories('en', '101it');
    expect(urlOf()).toBe('/product/it/category?language=en');
  });

  // THE BLOCKER: 101recycle must not be served the lab tree, and the recycle
  // endpoint reads `lang`, not `language`
  // (backend controller/productController.js:244-257).
  it('101recycle uses the recycle taxonomy with the `lang` param', async () => {
    await fetchLabCategories('en', '101recycle');
    expect(urlOf()).toBe('/product/category?lang=en');
  });

  // The backend's recycle cache is EN-only (utils/categoryCache.js:167
  // hard-codes `?lang=en`), so every AI-returned recycle id is an EN-tree id.
  // Pin the app to EN too: the sorted-position bridge mis-maps 8 of the 37
  // recycle categories — see recycleCategoryShape.test.ts.
  it('101recycle stays on the EN tree even when the app is in Chinese', async () => {
    await fetchLabCategories('zh-Hant', '101recycle');
    expect(urlOf()).toBe('/product/category?lang=en');
  });

  it('the three WP-backed trees still follow the app locale', async () => {
    await fetchLabCategories('zh-Hant', '101lab');
    expect(urlOf()).toBe('/product/lab/category?language=zh-hant');
  });

  it('an unset marketplace falls through to the lab tree (unchanged)', async () => {
    await fetchLabCategories('en', undefined);
    expect(urlOf()).toBe('/product/lab/category?language=en');
  });
});
```

Run it:

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx jest src/services/scanner/__tests__/recycleCategoryEndpoint.test.ts
```

**Expected now: 2 failing tests** — the two `101recycle` cases (received
`/product/lab/category?language=en` and `/product/lab/category?language=zh-hant`). The other five
pass. If the two recycle cases pass before you change anything, someone already landed M-1 — stop and
re-read this file before continuing.

## Step M1.2 — Rewrite the routing half of `fetchCategories.ts`

Replace `fetchCategories.ts` lines **13-29** (the doc block plus `endpointForMarketplace`) with:

```ts
/**
 * Marketplace → category endpoint descriptor.
 *
 * Each marketplace has its OWN WordPress taxonomy; the backend makes the same
 * split (`utils/categoryCache.js#TAXONOMY_BY_SITE`, `:122-127`). Getting this
 * wrong does not fail loudly — it returns a valid-looking tree whose ids simply
 * do not exist for that marketplace, which `CategoryConditionCard`'s validity
 * check then clears (`CategoryConditionCard.tsx:124`, `:157`), and because
 * `categoryId` is schema-required (`schema.ts:23`) the listing cannot be
 * submitted at all.
 *
 * W3  (scan_v3): added the `101it` branch — 101IT used to fall through to the
 *                machines endpoint.
 * M-1 (multi-marketplace): added the `101recycle` branch. Measured on dev
 *                2026-08-18: recycle ids run 1147-5366, the lab tree's
 *                5371-5849 — overlap ZERO, so `101recycle` on the lab endpoint
 *                is a hard submit-blocker, not a cosmetic mismatch.
 *
 * Two per-endpoint quirks are encoded here rather than at the call site:
 *
 * - `langParam` — the three WP-backed endpoints read `?language=`; the recycle
 *   endpoint reads `?lang=` (`controller/productController.js:247`) and IGNORES
 *   `language` entirely, silently serving the zh-hant tree. Verified on dev.
 *
 * - `enOnly` — the recycle endpoint has only `en` and `zh-hant` trees
 *   (`productController.js:251-257`; `?lang=ja|th` both return zh-hant), and the
 *   BACKEND's recycle cache is EN-only (`utils/categoryCache.js:167` hard-codes
 *   `?lang=en`), so every AI-returned recycle id is an EN id. Pinning the app to
 *   EN means the validity check matches with no cross-locale bridge — which
 *   matters because `bridgeCategoryId`'s sorted-position heuristic MIS-MAPS 8 of
 *   the 37 recycle categories (positions 14-21; EN 2019 "Metalworking Equipment"
 *   resolves to zh 2312 "回收技術"/Recycling Technology). Untranslated labels beat
 *   silently-wrong data. Drop `enOnly` the day the API exposes a stable
 *   cross-locale key.
 */
export type CategoryEndpoint = {
  path: string;
  langParam: 'language' | 'lang';
  /** Response row shape: WP `{id,…,subcategories}` vs recycle `{term_id,…}`. */
  shape: 'lab' | 'recycleFlat';
  /** Always request the EN tree, whatever the app locale. */
  enOnly: boolean;
};

export function endpointForMarketplace(
  marketplace: MarketplaceKey | undefined,
): CategoryEndpoint {
  if (marketplace === '101machine') {
    return { path: '/product/machines/category', langParam: 'language', shape: 'lab', enOnly: false };
  }
  if (marketplace === '101it') {
    return { path: '/product/it/category', langParam: 'language', shape: 'lab', enOnly: false };
  }
  if (marketplace === '101recycle') {
    return { path: '/product/category', langParam: 'lang', shape: 'recycleFlat', enOnly: true };
  }
  // 101lab (and the fall-through default).
  return { path: '/product/lab/category', langParam: 'language', shape: 'lab', enOnly: false };
}
```

## Step M1.3 — Add the HTML-entity decoder

Insert immediately **after** the `endpointForMarketplace` block:

```ts
/**
 * Minimal HTML-entity decoder for category names.
 *
 * The recycle endpoint selects `jos_terms.name` raw
 * (`controller/productController.js:259-277`), so WordPress's stored entities
 * come through literally: 18 of the 37 EN recycle names are affected, e.g.
 * `Construction &amp; Earthmoving Equipment` (measured on dev 2026-08-18).
 * Unfixed they render with a visible `&amp;`.
 *
 * Deliberately not a general HTML parser: it decodes the five XML entities plus
 * `&nbsp;` and numeric references, and leaves anything it does not recognise
 * EXACTLY as-is (so an unknown entity degrades to today's behaviour rather than
 * to an empty label). It is IDEMPOTENT on already-clean text, which is what
 * makes it safe to keep once the server-side unescape (plan task S0-4) lands:
 * running it on `Construction & Earthmoving Equipment` is a no-op.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.charAt(0) === '#') {
      const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}
```

## Step M1.4 — Add the two normalisers

Insert immediately after `decodeHtmlEntities`:

```ts
/**
 * Normalise a WP-shaped tree (`/product/lab|machines|it/category`) to
 * `LabCategory[]`.
 *
 * The response used to be cast straight to `LabCategory[]`. Two reasons to
 * normalise instead:
 *   1. `subcategories` is ABSENT (not empty) on all 13 machines rows — measured
 *      on dev. Guaranteeing the array here lets every consumer stop writing
 *      `?? []`; `LabListingEditSheet.tsx:1661` already does a bare
 *      `parent.subcategories.map(...)` and would throw on such a tree.
 *   2. Names are entity-decoded defensively. Escaped names measured in these
 *      three trees today: ZERO — this is a guard, not a fix, and it is
 *      idempotent (see decodeHtmlEntities).
 *
 * Rows with a non-numeric/absent id or a blank name are DROPPED: an unnamed row
 * renders as a blank tappable option, which is worse than not offering it.
 */
export function normalizeLabCategories(rows: unknown): LabCategory[] {
  if (!Array.isArray(rows)) return [];
  const out: LabCategory[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const id = Number(raw?.id);
    const name = decodeHtmlEntities(String(raw?.name ?? '')).trim();
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    const rawSubs = Array.isArray(raw?.subcategories)
      ? (raw.subcategories as Record<string, unknown>[])
      : [];
    const subcategories: LabSubcategory[] = [];
    for (const rawSub of rawSubs) {
      const subId = Number(rawSub?.id);
      const subName = decodeHtmlEntities(String(rawSub?.name ?? '')).trim();
      if (!Number.isFinite(subId) || subId <= 0 || !subName) continue;
      subcategories.push({ id: subId, name: subName, slug: String(rawSub?.slug ?? '') });
    }
    out.push({ id, name, slug: String(raw?.slug ?? ''), subcategories });
  }
  return out;
}

/**
 * Normalise the recycle tree (`/product/category?lang=en`) to `LabCategory[]`.
 *
 * Shape differences from the WP trees, measured on dev 2026-08-18:
 *   - the id lives in `term_id`; there is NO `id` key;
 *   - there is NO `subcategories` key — the SQL filters `tt.parent = 0`
 *     (`controller/productController.js:275`), so the tree is flat BY
 *     CONSTRUCTION, not by accident. It cannot grow children without a backend
 *     change, so `subcategories: []` is correct rather than a stopgap;
 *   - names are HTML-escaped (18 of 37).
 *
 * This mirrors, field for field, what the BACKEND already does with the same
 * endpoint at `utils/categoryCache.js:171-176` — so the app's tree and the tree
 * the AI picks from are the same objects with the same ids.
 */
export function normalizeRecycleCategories(rows: unknown): LabCategory[] {
  if (!Array.isArray(rows)) return [];
  const out: LabCategory[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const id = Number(raw?.term_id ?? raw?.id);
    const name = decodeHtmlEntities(String(raw?.name ?? '')).trim();
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    out.push({ id, name, slug: String(raw?.slug ?? ''), subcategories: [] });
  }
  return out;
}
```

## Step M1.5 — Extend the EN name fixups by one entry

`EN_CATEGORY_NAME_FIXUPS` is at `fetchCategories.ts:47-49`. Replace the map body with:

```ts
const EN_CATEGORY_NAME_FIXUPS: Record<number, string> = {
  // lab tree: EN term 5373 still returns its Chinese source name.
  5373: 'Testing & Measurement',
  // recycle tree: EN term 5334 returns `車床 (CNC 與傳統)` from ?lang=en
  // (measured on dev 2026-08-18) — the same WPML content bug as 5373. Safe to
  // key by id: recycle ids (1147-5366) do not overlap lab (5371-5849), machines
  // (5296-5862) or 101it (5419-5524) — measured, overlap 0 against all three.
  // NOTE for the owner's taxonomy list: term 5341 is the properly-translated
  // duplicate of the same category, and 5366 is a junk row named "test".
  // Neither is filtered here on purpose — the AI can return either id, and
  // dropping a returned id would clear the seller's category and re-create the
  // submit blocker.
  5334: 'Lathes (CNC & Conventional)',
};
```

## Step M1.6 — Route `fetchLabCategories` through the descriptor

Replace `fetchCategories.ts:62-73` with:

```ts
export async function fetchLabCategories(
  language: string,
  marketplace?: MarketplaceKey,
): Promise<LabCategory[]> {
  const endpoint = endpointForMarketplace(marketplace);
  // `enOnly` endpoints ignore the app locale on purpose — see the descriptor doc.
  const lang = endpoint.enOnly ? 'en' : toAnalyzeLanguage(language);
  const res = await greenbidz.get(
    `${endpoint.path}?${endpoint.langParam}=${encodeURIComponent(lang)}`,
    { timeout: 60_000 },
  );
  const raw = res.data?.data ?? [];
  const data =
    endpoint.shape === 'recycleFlat'
      ? normalizeRecycleCategories(raw)
      : normalizeLabCategories(raw);
  // Fixups are keyed by EN-tree term id, so gate on the RESOLVED language.
  return lang === 'en' ? applyEnCategoryFixups(data) : data;
}
```

## Step M1.7 — Leave `applyEnCategoryFixups` alone

`applyEnCategoryFixups` (`:51-60`) already writes `(cat.subcategories ?? [])`, so it is safe against
either shape. **No change.** Verified by reading it — do not "improve" it.

## Step M1.8 — Give `flattenCategoryOptions` the parent, and a name

Replace `fetchCategories.ts:133-165` (the doc block plus the function) with:

```ts
export type CategoryLeafOption = {
  /** The leaf id the form stores in `categoryId`. */
  id: string;
  /** The leaf's own name (what `buildDraftPatch` writes to `categoryName`). */
  name: string;
  /** Display label: `Parent › Sub` when nested, the parent's name when flat. */
  label: string;
  /** Owning parent — the form's `parentCategoryId`. Equals `id` for flat trees. */
  parentId: string;
  /** Owning parent's name — the form's `parentCategoryName`. */
  parentName: string;
};

/**
 * Flatten the category tree to the set of selectable leaves. A leaf is:
 *   - a subcategory (nested marketplaces: /lab, /101it), OR
 *   - a parent with NO subcategories (flat marketplaces: /machines, /recycle).
 *
 * The "no children → parent is the leaf" branch is critical: without it, an
 * AI-supplied id pointing at a flat-leaf parent was judged invalid on hydrate by
 * CategoryConditionCard's stillValid check, which then cleared the field — so
 * the seller saw an empty Category after AI fill even though the AI's pick was
 * valid. That branch already shipped for /machines; the M-1 recycle tree
 * (37 flat parents, 0 children by construction) reuses it unchanged.
 *
 * M-2 addition: `parentId` / `parentName` are emitted so the category sheet can
 * commit `parentCategoryId` / `parentCategoryName` from a single search hit
 * without re-walking the tree.
 */
export function flattenCategoryOptions(categories: LabCategory[]): CategoryLeafOption[] {
  const options: CategoryLeafOption[] = [];
  for (const cat of categories) {
    const parentId = String(cat.id);
    const subs = cat.subcategories ?? [];
    if (subs.length === 0) {
      options.push({
        id: parentId,
        name: cat.name,
        label: cat.name,
        parentId,
        parentName: cat.name,
      });
      continue;
    }
    for (const sub of subs) {
      options.push({
        id: String(sub.id),
        name: sub.name,
        label: `${cat.name} › ${sub.name}`,
        parentId,
        parentName: cat.name,
      });
    }
  }
  return options;
}
```

> **Drift note.** The approved plan lists "make `flattenCategoryOptions` handle a **flat** tree" as
> M-1 work. **It already does** — the `subs.length === 0` branch shipped for `/machines`
> (`fetchCategories.ts:148-155` before this edit, with the reason in the doc comment at `:138-142`).
> What recycle actually needs is the **normalisation** in M1.4, which turns a `subcategories`-less
> `{term_id}` row into `{id, subcategories: []}` so the existing branch fires. The change above adds
> `parentId`/`parentName` for M-2 and names the return type; flat-tree behaviour is unchanged.
> Consumers (`useLabCategories.ts:19`, `RequiredChecklist.tsx:38-40`, `buildDraftPatch` at
> `src/features/scanner/components/detail/formMapping.ts:91`, and the `CategoryOption` type at that
> file's `:79` — note the path is under `components/detail/`, not `src/features/scanner/`) read
> `.id` / `.name` / `.label` only, so the two extra
> fields are additive.

## Step M1.9 — Make the endpoint test green

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx jest src/services/scanner/__tests__/recycleCategoryEndpoint.test.ts
```

**Expected: 7 passed, 0 failed.**

## Step M1.10 — Add the shape / bridge-hazard test

Create `src/services/scanner/__tests__/recycleCategoryShape.test.ts`:

```ts
import { describe, it, expect, jest } from '@jest/globals';

// The module imports the greenbidz axios client, which transitively pulls in
// MMKV (a native module with no jest binary). Same stub as
// enCategoryFixups.test.ts:6.
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));

import {
  bridgeCategoryId,
  decodeHtmlEntities,
  endpointForMarketplace,
  flattenCategoryOptions,
  normalizeLabCategories,
  normalizeRecycleCategories,
  type LabCategory,
} from '@/services/scanner/fetchCategories';

// Verbatim rows from GET https://testapi.greenbidz.com/api/v1/product/category?lang=en
// (dev, 2026-08-18). Includes two of the 18 HTML-escaped names, both ids the
// backend is known to pick (1281, 2019), and the untranslated-Chinese EN row
// (5334).
const RECYCLE_ROWS = [
  { term_id: 1147, term_taxonomy_id: 1147, name: 'Material Handling Equipment', slug: 'material-handling-equipment', description: '', thumbnail_id: '0' },
  { term_id: 1148, term_taxonomy_id: 1148, name: 'Construction &amp; Earthmoving Equipment', slug: 'construction-earthmoving-equipment', description: '', thumbnail_id: '0' },
  { term_id: 1281, term_taxonomy_id: 1281, name: 'Surplus &amp; Scrap Materials', slug: 'surplus-scrap-materials', description: '', thumbnail_id: '0' },
  { term_id: 2019, term_taxonomy_id: 2019, name: 'Metalworking Equipment', slug: 'metalworking-equipment', description: '', thumbnail_id: '0' },
  { term_id: 5334, term_taxonomy_id: 5334, name: '車床 (CNC 與傳統)', slug: 'lathes-cnc-conventional-2', description: '', thumbnail_id: '0' },
];

describe('endpointForMarketplace', () => {
  it('gives recycle its own path, the `lang` param and EN pinning', () => {
    expect(endpointForMarketplace('101recycle')).toEqual({
      path: '/product/category',
      langParam: 'lang',
      shape: 'recycleFlat',
      enOnly: true,
    });
  });

  it('leaves the three WP-backed trees on `language` and locale-following', () => {
    for (const mk of ['101lab', '101machine', '101it', undefined] as const) {
      const ep = endpointForMarketplace(mk);
      expect(ep.langParam).toBe('language');
      expect(ep.shape).toBe('lab');
      expect(ep.enOnly).toBe(false);
    }
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes the entity the recycle endpoint actually emits', () => {
    expect(decodeHtmlEntities('Construction &amp; Earthmoving Equipment')).toBe(
      'Construction & Earthmoving Equipment',
    );
  });

  it('decodes numeric and hex references', () => {
    expect(decodeHtmlEntities('A&#38;B')).toBe('A&B');
    expect(decodeHtmlEntities('A&#x26;B')).toBe('A&B');
  });

  it('is idempotent, so it stays safe once the server unescapes (task S0-4)', () => {
    const clean = 'Construction & Earthmoving Equipment';
    expect(decodeHtmlEntities(clean)).toBe(clean);
    expect(
      decodeHtmlEntities(decodeHtmlEntities('Construction &amp; Earthmoving Equipment')),
    ).toBe(clean);
  });

  it('leaves an unrecognised entity exactly as-is rather than blanking it', () => {
    expect(decodeHtmlEntities('R&sup2; Widgets')).toBe('R&sup2; Widgets');
  });
});

describe('normalizeRecycleCategories', () => {
  it('maps term_id to id, unescapes the name and marks the tree flat', () => {
    const tree = normalizeRecycleCategories(RECYCLE_ROWS);
    expect(tree).toHaveLength(5);
    expect(tree[1]).toEqual({
      id: 1148,
      name: 'Construction & Earthmoving Equipment',
      slug: 'construction-earthmoving-equipment',
      subcategories: [],
    });
    expect(tree.every((c) => Array.isArray(c.subcategories) && c.subcategories.length === 0)).toBe(true);
  });

  it('keeps the ids the backend picks (1281, 2019) — the whole point of M-1', () => {
    const ids = normalizeRecycleCategories(RECYCLE_ROWS).map((c) => c.id);
    expect(ids).toContain(1281);
    expect(ids).toContain(2019);
  });

  it('drops rows with no usable id or a blank name instead of rendering blanks', () => {
    const tree = normalizeRecycleCategories([
      { term_id: 'nope', name: 'Bad id' },
      { term_id: 99, name: '   ' },
      { term_id: 100, name: 'Good' },
    ]);
    expect(tree.map((c) => c.id)).toEqual([100]);
  });

  it('survives a non-array payload', () => {
    expect(normalizeRecycleCategories(undefined)).toEqual([]);
    expect(normalizeRecycleCategories({ nope: true })).toEqual([]);
  });
});

describe('normalizeLabCategories', () => {
  it('guarantees a subcategories array for the machines shape (13/13 rows omit it)', () => {
    const tree = normalizeLabCategories([
      { id: 5300, name: 'Boring & Drilling Machines', slug: 'boring-drilling-machines' },
    ]);
    expect(tree[0].subcategories).toEqual([]);
  });

  it('keeps nested subcategories and drops unusable ones', () => {
    const tree = normalizeLabCategories([
      {
        id: 5375,
        name: 'Lab Infrastructure & Essentials',
        slug: 'lab-infra',
        subcategories: [
          { id: 5573, name: 'Autoclaves and Sterilisation', slug: 'autoclaves' },
          { id: 0, name: 'Broken', slug: 'broken' },
        ],
      },
    ]);
    expect(tree[0].subcategories.map((s) => s.id)).toEqual([5573]);
  });
});

describe('flattenCategoryOptions', () => {
  it('treats every recycle parent as a selectable leaf, with itself as parent', () => {
    const options = flattenCategoryOptions(normalizeRecycleCategories(RECYCLE_ROWS));
    expect(options).toHaveLength(5);
    expect(options[0]).toEqual({
      id: '1147',
      name: 'Material Handling Equipment',
      label: 'Material Handling Equipment',
      parentId: '1147',
      parentName: 'Material Handling Equipment',
    });
  });

  it('labels a nested leaf `Parent › Sub` and carries the parent through', () => {
    const nested: LabCategory[] = [
      {
        id: 5375,
        name: 'Lab Infrastructure & Essentials',
        slug: 'lab-infra',
        subcategories: [{ id: 5578, name: 'Centrifugation', slug: 'centrifugation' }],
      },
    ];
    expect(flattenCategoryOptions(nested)).toEqual([
      {
        id: '5578',
        name: 'Centrifugation',
        label: 'Lab Infrastructure & Essentials › Centrifugation',
        parentId: '5375',
        parentName: 'Lab Infrastructure & Essentials',
      },
    ]);
  });
});

// Why `enOnly` exists. `bridgeCategoryId` assumes position-in-sorted-id-order
// identifies the same logical category in both locales (verified for /machines).
// The recycle taxonomy breaks that: EN and zh-hant terms were created in
// different orders, so 8 of 37 positions disagree on dev. This reproduces the
// class of failure with the smallest possible tree, so nobody "simplifies"
// `enOnly` away later.
describe('bridgeCategoryId — why 101recycle must not be bridged', () => {
  const EN: LabCategory[] = [
    { id: 1339, name: 'Packaging Equipment', slug: 'packaging', subcategories: [] },
    { id: 1352, name: 'Semiconductor & Electronics Manufacturing', slug: 'semi', subcategories: [] },
  ];
  // Live zh-hant ids at the same two positions (1373 / 1399 on dev): the
  // SEMICONDUCTOR row sorts first, so position 0 is not "Packaging".
  const ZH: LabCategory[] = [
    { id: 1373, name: '半導體與電子製造', slug: 'semi-zh', subcategories: [] },
    { id: 1399, name: '包裝設備', slug: 'packaging-zh', subcategories: [] },
  ];

  it('silently resolves an EN recycle id to the WRONG locale category', () => {
    // "Packaging Equipment" bridges to the Semiconductor row. No error, no null.
    expect(bridgeCategoryId('1339', EN, ZH)).toBe('1373');
  });

  it('so the recycle endpoint is pinned to EN and the bridge never runs for it', () => {
    expect(endpointForMarketplace('101recycle').enOnly).toBe(true);
  });
});
```

Run:

```bash
npx jest src/services/scanner/__tests__/recycleCategoryShape.test.ts
```

**Expected: 16 passed, 0 failed.**

## Step M1.11 — Prove all four trees end-to-end against dev

This exercises the real routing/param/normalisation logic against dev without starting the app. It is
read-only. Run from the app root.

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
node -e "
const B='https://testapi.greenbidz.com/api/v1';
const EP={
  '101lab':     {p:'/product/lab/category',      q:'language', s:'lab',         en:false},
  '101machine': {p:'/product/machines/category', q:'language', s:'lab',         en:false},
  '101it':      {p:'/product/it/category',       q:'language', s:'lab',         en:false},
  '101recycle': {p:'/product/category',          q:'lang',     s:'recycleFlat', en:true },
};
const NAMED={amp:'&',lt:'<',gt:'>',quot:'\"',apos:\"'\",nbsp:'\u00a0'};
const dec=s=>s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(w,b)=>{
  if(b[0]==='#'){const h=b[1]==='x'||b[1]==='X';const c=h?parseInt(b.slice(2),16):parseInt(b.slice(1),10);
    return Number.isFinite(c)&&c>0&&c<=0x10ffff?String.fromCodePoint(c):w;}
  return NAMED[b.toLowerCase()]??w;});
const normLab=r=>(Array.isArray(r)?r:[]).map(c=>({id:Number(c.id),name:dec(String(c.name??'')).trim(),
  subcategories:(Array.isArray(c.subcategories)?c.subcategories:[]).map(s=>({id:Number(s.id),name:dec(String(s.name??'')).trim()})).filter(s=>s.id>0&&s.name)}))
  .filter(c=>c.id>0&&c.name);
const normRec=r=>(Array.isArray(r)?r:[]).map(c=>({id:Number(c.term_id??c.id),name:dec(String(c.name??'')).trim(),subcategories:[]})).filter(c=>c.id>0&&c.name);
const flat=t=>t.flatMap(c=>c.subcategories.length?c.subcategories.map(s=>({id:String(s.id),label:c.name+' > '+s.name})):[{id:String(c.id),label:c.name}]);
(async()=>{
  for(const locale of ['en','zh-Hant']){
    for(const [mk,e] of Object.entries(EP)){
      const lang=e.en?'en':(locale.toLowerCase().startsWith('zh')?'zh-hant':'en');
      const url=B+e.p+'?'+e.q+'='+encodeURIComponent(lang);
      const res=await fetch(url,{headers:{'x-platform':'LabGreenbidz'}});
      const j=await res.json();
      const tree=e.s==='recycleFlat'?normRec(j.data):normLab(j.data);
      const opts=flat(tree);
      const esc=opts.filter(o=>/&[a-z#0-9]+;/i.test(o.label)).length;
      const blank=opts.filter(o=>!o.label.trim()).length;
      const dupe=opts.length-new Set(opts.map(o=>o.id)).size;
      console.log([locale.padEnd(7),mk.padEnd(11),String(res.status),url.replace(B,'').padEnd(42),
        'parents='+String(tree.length).padStart(3),'leaves='+String(opts.length).padStart(3),
        'stillEscaped='+esc,'blank='+blank,'dupIds='+dupe].join(' '));
    }
  }
})();
"
```

**Expected — measured 2026-08-18. Parent/leaf counts are WordPress content and may move; the last
three columns must be `0 0 0` on every row, and the two `101recycle` rows must be identical:**

```
en      101lab      200 /product/lab/category?language=en          parents=  4 leaves= 62 stillEscaped=0 blank=0 dupIds=0
en      101machine  200 /product/machines/category?language=en     parents= 13 leaves= 13 stillEscaped=0 blank=0 dupIds=0
en      101it       200 /product/it/category?language=en           parents=  6 leaves= 25 stillEscaped=0 blank=0 dupIds=0
en      101recycle  200 /product/category?lang=en                  parents= 37 leaves= 37 stillEscaped=0 blank=0 dupIds=0
zh-Hant 101lab      200 /product/lab/category?language=zh-hant     parents=  4 leaves= 62 stillEscaped=0 blank=0 dupIds=0
zh-Hant 101machine  200 /product/machines/category?language=zh-hant parents= 13 leaves= 13 stillEscaped=0 blank=0 dupIds=0
zh-Hant 101it       200 /product/it/category?language=zh-hant      parents=  6 leaves= 25 stillEscaped=0 blank=0 dupIds=0
zh-Hant 101recycle  200 /product/category?lang=en                  parents= 37 leaves= 37 stillEscaped=0 blank=0 dupIds=0
```

`stillEscaped=0` on the recycle rows is M-1's proof: 18 escaped names in, 0 out.

## M-1 interface contract (what later tasks consume)

```ts
// src/services/scanner/fetchCategories.ts
export type CategoryEndpoint = {
  path: string;
  langParam: 'language' | 'lang';
  shape: 'lab' | 'recycleFlat';
  enOnly: boolean;
};
export function endpointForMarketplace(marketplace: MarketplaceKey | undefined): CategoryEndpoint;
export function decodeHtmlEntities(input: string): string;
export function normalizeLabCategories(rows: unknown): LabCategory[];
export function normalizeRecycleCategories(rows: unknown): LabCategory[];

export type CategoryLeafOption = {
  id: string; name: string; label: string; parentId: string; parentName: string;
};
export function flattenCategoryOptions(categories: LabCategory[]): CategoryLeafOption[];

// unchanged signatures
export function fetchLabCategories(language: string, marketplace?: MarketplaceKey): Promise<LabCategory[]>;
export function bridgeCategoryId(enCategoryId: string, enTree: LabCategory[], localeTree: LabCategory[]): string | null;
export function applyEnCategoryFixups(categories: LabCategory[]): LabCategory[];
```

- **M-2** consumes `CategoryLeafOption` (`parentId`, `parentName`) and `flattenCategoryOptions`.
- **M-4** relies on `fetchLabCategories` being correct for all four marketplaces before it flips
  `MARKETPLACE_LOCKED`; it needs no new symbol from here.
- `useLabCategories(marketplace)` (`src/features/scanner/useLabCategories.ts:10-22`) is **unchanged**
  and keeps returning `{ categories: LabCategory[]; options: CategoryLeafOption[] }`.

> Accepted cost, stated so nobody hunts it as a bug: for a zh-Hant seller on `101recycle`,
> `useLabCategories` (query key `['labCategories','zh-Hant','101recycle']`) and `useEnLabCategories`
> (key `['labCategories','en','101recycle']`) now both resolve to the **same** EN tree — two React
> Query entries, one extra GET, `staleTime` 5 min. Removing it means special-casing one marketplace in
> two hooks; collapsing the locale inside `fetchLabCategories` keeps a single choke point. Not worth
> the second edit.

---

# M-2 — Searchable category sheet

## What is being replaced, and what it costs today

`CategoryConditionCard.tsx:196-388` renders, inside the page's own `KeyboardAwareScrollView`:

- a parent `ScrollView` with `style={{ maxHeight: 240 }}` + `nestedScrollEnabled` (`:211-216`);
- when the selected parent has children, a second identical one for subcategories (`:267-272`);
- an always-visible "Other (type brand)" row and a conditional brand `TextInput` (`:317-384`).

Rows are `py-2.5` + `text-lg` + 6 px `marginTop` ≈ **45 px**, so a 240 px window shows about **5**
rows. 38 of 101lab's 62 subcategories live under one parent — roughly **7 blind swipes** inside a
window that is itself inside a page scroll, with no search (`SCAN_FLOW_UX.md:275-279`; `:181` puts
the whole card at **~714 px**). Those are arithmetic on the source constants, **not** a device
measurement — `SCAN_FLOW_UX.md:66` says the same about its own numbers.

Against `UX_DESIGN_RULES.md`, four checklist answers are currently **No**: "Can scrolling be
reduced?", "Is the next action obvious?", "Is the interface adapted to the user's progress?", "Does
every error have recovery?" (a load failure is a dead-end sentence today, `:207-209`).

The pattern that answers them already exists one card lower in the same flow —
`CountryPicker.tsx:37-91` (search + `Sheet` + `Sheet.Option`) over 95 countries — and a grouped
*category* variant already exists in the lab chat flow at
`src/features/lab/chat/LabListingEditSheet.tsx:1582-1689` (parent headers + indented children).
**Copy those two. Do not invent a third pattern.**

## Step M2.0 — See the problem on the device first

With `.env` on dev (§3.1):

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx expo start --clear
```

Open the app → scan flow → reach `app/scan/detail.tsx`. On the Category card:

1. Try to reach the last subcategory under "Lab Infrastructure & Essentials" (38 children). **Count
   the swipes** — that is the before-number for your handover note.
2. Start a swipe inside the list and keep going past its end. Note whether it chains to the page
   scroll or dead-stops (`SCAN_FLOW_UX.md:72`'s open question; either answer is fine, M-2 removes the
   nesting).
3. Note that there is no way to type "centrifuge".

**Do not submit anything.**

## Step M2.1 — Two additive props on the shared `Sheet` primitive

`src/components/ui/Sheet.tsx`. Both additions are optional, so every current consumer keeps working
untouched. No test or snapshot in the repo renders `Sheet` (checked: the four `*.snap` files under
`src/` are for lab-chat cards, `ChatMessage`, `ThinkingDots` and `threadStore`; no test imports
`Sheet`), so this is a low-risk edit.

**(a)** In `SheetProps` (`:39-49`), after `maxHeight`:

```ts
  /**
   * Rendered BETWEEN the title block and the scrollable body, so it stays put
   * while the list scrolls. Added for the category sheet's search field: with 62
   * leaves under 4 parents, a search box placed as the first CHILD (the
   * CountryPicker pattern, `CountryPicker.tsx:50-66`) scrolls out of reach after
   * one flick.
   */
  stickyHeader?: React.ReactNode;
```

**(b)** Add it to the destructure at `:51`:

```ts
export function Sheet({ visible, onClose, title, subtitle, maxHeight = 380, stickyHeader, children }: SheetProps) {
```

**(c)** Render it after the drag region (which closes at `:118`) and before the `ScrollView` (`:120`):

```tsx
          </View>

          {stickyHeader}

          <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
```

**(d)** In `SheetOptionProps` (`:139-150`) make the handler optional:

```ts
  /** Omit for a non-interactive row (e.g. a `header` section label). */
  onPress?: () => void;
```

**(e)** In the `header` branch **only** (`:162-181`), make a handler-less header inert and announce it
as a header rather than a button:

```tsx
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'header'}
        accessibilityState={{ selected: active }}
        style={[styles.headerOption, active && styles.headerOptionActive]}
      >
```

Leave the non-header branch (`:183-212`) exactly as it is — every caller of it passes `onPress`.

**(f) [REVIEWER FIX — do not skip] `keyboardShouldPersistTaps` on the sheet's `ScrollView`.**
`Sheet.tsx:120` renders `<ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>`
with no `keyboardShouldPersistTaps`, so it defaults to `'never'`. With the search field focused and
the keyboard up, the **first** tap on a result is consumed dismissing the keyboard and never reaches
`Sheet.Option`'s `onPress` — "type `centrif`, tap the row, nothing happens". The card code being
replaced set this explicitly on both scrollers (`CategoryConditionCard.tsx:215` and `:271`); the
shared primitive never did, which is why `CountryPicker` has the same latent bug today. Change
`Sheet.tsx:120` to:

```tsx
          <ScrollView
            style={{ maxHeight }}
            showsVerticalScrollIndicator={false}
            // A focused TextInput above the list (stickyHeader, or a first child
            // as in CountryPicker) otherwise eats the first tap on every row:
            // ScrollView defaults to keyboardShouldPersistTaps='never'.
            keyboardShouldPersistTaps="handled"
          >
```

`"handled"` is the correct value, not `"always"`: taps on non-interactive space still dismiss the
keyboard, taps on a child still fire. It changes behaviour for all ~10 `Sheet` consumers, and in
every one the change is the desired one (only `CountryPicker` and this new sheet have a text input
at all). **No unit test can catch this** — `fireEvent.press` bypasses the touch-responder chain, so
the M2.5 suite passes with or without it. On-device check #1 in Step M2.6 is the only gate, and it
must be performed with the keyboard still up, tapping the result **once**.

**(g) [REVIEWER FIX] Search rows must not rely on the `Parent › Sub` label alone.**
`Sheet.Option` renders its label with `numberOfLines={1}` (`Sheet.tsx:198`) at `fontSize: 15`
semibold inside a card at most `460 - 20*2 - 14*2 - 12 = 380 px` wide (`Sheet.tsx:232`, `:237`,
`:266`, `:195`) — about 45 characters, and ~40 on an SE-class 375 pt screen. Real lab leaves exceed
that: `Lab Infrastructure & Essentials › Autoclaves and Sterilisation` is 62 characters, so the
search list — the headline improvement of this phase — would render as a column of rows all
truncated inside their shared parent prefix, indistinguishable from one another. `Sheet.Option`
already has the field for this (`description`, `:141`, rendered at `:202-206` with
`numberOfLines={2}`), and `LabCategorySheet` already uses it that way
(`LabListingEditSheet.tsx:1668`). In **Step M2.2**, render the search branch as:

```tsx
          matches.map((o) => (
            <Sheet.Option
              key={o.id}
              label={o.name}
              // Parent on its own line rather than a `Parent > Sub` label: the
              // label is numberOfLines={1} in ~380 px and the shared prefix is
              // what survives truncation (Sheet.tsx:198). `description` is
              // numberOfLines={2} (Sheet.tsx:203) — same pattern as
              // LabListingEditSheet.tsx:1668.
              description={o.parentName !== o.name ? o.parentName : undefined}
              active={value === o.id}
              onPress={() =>
                commit({
                  categoryId: o.id,
                  parentCategoryId: o.parentId,
                  parentCategoryName: o.parentName,
                })
              }
            />
          ))
```

The `o.parentName !== o.name` guard suppresses a duplicate second line on a **flat** tree, where
`flattenCategoryOptions` sets `parentName === name` (machines, recycle). `CategoryLeafOption.label`
stays as specified in M1.8 — the collapsed card row still uses it, and so does
`RequiredChecklist.tsx:38-40`.

Two assertions in **Step M2.5** must match, and two criteria in **Step M2.6**:

```tsx
  it('search narrows to matching leaves and hides the rest', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'centrif');
    expect(getByText('Centrifugation')).toBeTruthy();
    // the parent renders as the row's description, not as a label prefix
    expect(getByText('Lab Infrastructure & Essentials')).toBeTruthy();
    expect(queryByText('Autoclaves and Sterilisation')).toBeNull();
  });

  it('search matches on the parent name too, and still emits the child leaf', () => {
    const onSelect = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'infrastructure');
    fireEvent.press(getByText('Autoclaves and Sterilisation'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '5573',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
  });
```

Step M2.6 row **#1** becomes: *one row reading `Centrifugation` with `Lab Infrastructure &
Essentials` beneath it, neither truncated; a single tap — keyboard still up — collapses the card to
`Lab Infrastructure & Essentials › Centrifugation`.* Row **#7** becomes: *both `Surplus & Scrap
Materials` and `Scrap` appear as full, untruncated labels with no description line (flat tree).*

> (f) and (g) were added by the reviewing CTO on 2026-08-18. Every reference in them was opened and
> confirmed against HEAD `11ef609`. The width arithmetic in (g) is arithmetic on the `StyleSheet`
> constants, **not** a device measurement — Step M2.6 #1 and #13 remain the gates.


## Step M2.2 — Create `CategoryPickerSheet.tsx`

Create `src/features/scanner/components/detail/CategoryPickerSheet.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Sheet, Text } from '@/components/ui';
import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import { flattenCategoryOptions, type LabCategory } from '@/services/scanner/fetchCategories';
import { brand } from '@/constants/theme';

/** Everything a pick has to write back onto the form, in one object. */
export type CategoryPick = {
  /** The leaf id, or `OTHER_SUBCATEGORY_ID`. Goes to `categoryId`. */
  categoryId: string;
  /** Goes to `parentCategoryId`. Equals `categoryId` on a flat tree. */
  parentCategoryId: string;
  /** Goes to `parentCategoryName`. */
  parentCategoryName: string;
};

interface Props {
  visible: boolean;
  /** The marketplace's tree, straight from `useLabCategories().data.categories`. */
  categories: LabCategory[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Marketplace label (e.g. `101RECYCLE`) — named in the loading copy. */
  marketplaceLabel: string;
  /** Currently-committed `categoryId` (may be `''` or the Other sentinel). */
  value: string;
  /** Currently-committed `parentCategoryId` — disambiguates Other per parent. */
  parentId: string;
  onSelect: (pick: CategoryPick) => void;
  onClose: () => void;
}

/**
 * M-2 — searchable category picker.
 *
 * Replaces the two stacked 240 px nested `ScrollView`s that used to live inside
 * the page scroll on `CategoryConditionCard` (~7 blind swipes to reach the 38th
 * child of one parent, no search). Built on the same `Sheet` + `Sheet.Option`
 * primitives as `CountryPicker` (search-on-top over 95 rows) and the lab-chat
 * category sheet (`LabListingEditSheet.tsx:1582-1689`, parent headers + indented
 * children), so the flow keeps one visual language.
 *
 * Two modes, ONE scroller:
 *   - empty query → grouped browse. Nested trees (/lab, /101it) get a
 *     non-interactive parent header, its indented children, and an
 *     "Other (type brand)" row per parent. Flat trees (/machines, /101recycle —
 *     13 and 37 parents, zero children) get one plain row per parent, because
 *     for them the parent IS the leaf (see `flattenCategoryOptions`).
 *   - non-empty query → one flat list of matching leaves labelled `Parent › Sub`,
 *     so a hit on the parent's name still reads in isolation.
 *
 * Deliberately prop-driven: no react-hook-form, no React Query. The card owns
 * the form writes — they must stay user-initiated (see the card's `:166-169`
 * NOTE) — and this file stays renderable in a plain unit test.
 *
 * Known limitation, accepted: the sheet does not auto-scroll to the current
 * pick. `Sheet` owns the `ScrollView` and exposes no ref; search is the fast
 * path, and the current pick renders `active` so it is recognisable once
 * reached.
 */
export function CategoryPickerSheet({
  visible,
  categories,
  loading,
  error,
  onRetry,
  marketplaceLabel,
  value,
  parentId,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const leaves = useMemo(() => flattenCategoryOptions(categories), [categories]);
  const matches = useMemo(
    () => (q ? leaves.filter((o) => o.label.toLowerCase().includes(q)) : []),
    [leaves, q],
  );

  const otherLabel = t('mobile.detail.subCategoryOther', {
    defaultValue: 'Other (type brand)',
  });

  const commit = (pick: CategoryPick) => {
    setQuery('');
    onSelect(pick);
    onClose();
  };

  const close = () => {
    setQuery('');
    onClose();
  };

  const search = (
    <View className="pb-sm">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('mobile.detail.categorySearchPlaceholder', {
          defaultValue: 'Search categories…',
        })}
        placeholderTextColor={brand.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground"
        accessibilityLabel={t('mobile.detail.categorySearchPlaceholder', {
          defaultValue: 'Search categories…',
        })}
      />
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('mobile.detail.selectCategoryTitle', { defaultValue: 'Select category' })}
      subtitle={t('mobile.detail.selectCategorySubtitle', {
        defaultValue: 'Search, or browse by group',
      })}
      maxHeight={520}
      stickyHeader={search}
    >
      {error ? (
        // Recovery, not a dead end (UX_DESIGN_RULES: "Does every error have recovery?").
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="flex-row items-center gap-sm rounded-xs border border-brand-destructive px-md py-2.5"
        >
          <MaterialIcons name="error-outline" size={18} color={brand.destructive} />
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.detail.categoriesRetry', {
              defaultValue: "Couldn't load categories — tap to retry",
            })}
          </Text>
        </Pressable>
      ) : loading && categories.length === 0 ? (
        // Explanatory, not generic: name the marketplace whose tree is loading.
        <View className="items-center gap-sm py-lg">
          <ActivityIndicator color={brand.primary} />
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.detail.categoriesLoading', {
              defaultValue: 'Loading {{marketplace}} categories…',
              marketplace: marketplaceLabel,
            })}
          </Text>
        </View>
      ) : q ? (
        matches.length === 0 ? (
          <View className="gap-sm py-md">
            <Text variant="bodySm" tone="tertiary">
              {t('mobile.detail.categorySearchEmpty', {
                defaultValue: 'No category matches "{{q}}"',
                q: query,
              })}
            </Text>
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              className="self-start rounded-xs border border-brand-border-strong px-md py-2"
            >
              {/* tone="brand" (= `text-brand-primary`, `Text.tsx:13`), NOT tone="primary":
                  `Text.tsx:8` maps "primary" to `text-neutral-900`, which would render this
                  tappable recovery row as plain body text inside its border. */}
              <Text variant="bodySm" tone="brand">
                {t('mobile.detail.categorySearchClear', {
                  defaultValue: 'Clear search to browse all categories',
                })}
              </Text>
            </Pressable>
          </View>
        ) : (
          matches.map((o) => (
            <Sheet.Option
              key={o.id}
              label={o.label}
              active={value === o.id}
              onPress={() =>
                commit({
                  categoryId: o.id,
                  parentCategoryId: o.parentId,
                  parentCategoryName: o.parentName,
                })
              }
            />
          ))
        )
      ) : (
        categories.map((cat) => {
          const pid = String(cat.id);
          const subs = cat.subcategories ?? [];

          // Flat marketplace (/machines, /101recycle): the parent IS the leaf.
          if (subs.length === 0) {
            return (
              <Sheet.Option
                key={pid}
                label={cat.name}
                active={value === pid}
                onPress={() =>
                  commit({
                    categoryId: pid,
                    parentCategoryId: pid,
                    parentCategoryName: cat.name,
                  })
                }
              />
            );
          }

          return (
            <View key={pid}>
              {/* Non-interactive section label — no onPress, so it is not a
                  tappable no-op (Sheet.Option renders it disabled with
                  accessibilityRole="header"). */}
              <Sheet.Option header label={cat.name} />
              {subs.map((sub) => {
                const sid = String(sub.id);
                return (
                  <Sheet.Option
                    key={sid}
                    indent
                    label={sub.name}
                    active={value === sid}
                    onPress={() =>
                      commit({
                        categoryId: sid,
                        parentCategoryId: pid,
                        parentCategoryName: cat.name,
                      })
                    }
                  />
                );
              })}
              {/* Files the product under THIS parent and sends the typed brand as
                  suggested_subcategory — same semantic as the old in-card row at
                  CategoryConditionCard.tsx:317-354. The brand TextInput stays on
                  the card, where the seller sees it after the sheet closes. */}
              <Sheet.Option
                key={`${pid}-other`}
                indent
                label={otherLabel}
                active={value === OTHER_SUBCATEGORY_ID && parentId === pid}
                onPress={() =>
                  commit({
                    categoryId: OTHER_SUBCATEGORY_ID,
                    parentCategoryId: pid,
                    parentCategoryName: cat.name,
                  })
                }
              />
            </View>
          );
        })
      )}
    </Sheet>
  );
}
```

Export it from the barrel — append to `src/features/scanner/components/detail/index.ts`:

```ts
export { CategoryPickerSheet, type CategoryPick } from './CategoryPickerSheet';
```

## Step M2.3 — Collapse the card to one row

`src/features/scanner/components/detail/CategoryConditionCard.tsx`.

**(a) Imports.** Replace `:1-22` with:

```tsx
// `useEffect` STAYS — the hydrate/bridge effect kept in step (d) uses it
// (`CategoryConditionCard.tsx:112`). Only the `:87-90` sync effect is deleted.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  CONDITION_LABELS,
  MARKETPLACE_OPTIONS,
  OTHER_SUBCATEGORY_ID,
  VALID_CONDITION_KEYS,
  type ConditionKey,
} from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import {
  useEnLabCategories,
  useLabCategories,
} from '@/features/scanner/useLabCategories';
import { bridgeCategoryId, flattenCategoryOptions } from '@/services/scanner/fetchCategories';
import type { ItemGrade } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';

import { CategoryPickerSheet, type CategoryPick } from './CategoryPickerSheet';
import { FieldLabel } from './FieldLabel';
```

Removed: `ActivityIndicator`, `ScrollView` — both were used only by the two 240 px scrollers and the
inline load/error states, all of which move into the sheet. **`useEffect` is NOT removed:** the
hydrate/bridge effect kept verbatim in step (d) IS a `useEffect` (`CategoryConditionCard.tsx:112`),
so dropping the import is a compile error — `npx tsc --noEmit` fails with *Cannot find name
'useEffect'*. Only the `selectedParentId` sync effect at `:87-90` goes. Added: `MARKETPLACE_OPTIONS`,
`flattenCategoryOptions`, `haptics`, `CategoryPickerSheet`. (`haptics.tap()` on the row mirrors
`MarketplaceCard.tsx:51`.) `expo lint` will flag any import you leave unused.

**(b) One more watch.** After `:53`, add the parent name — it must be reactive, so `watch`, **not**
`getValues` inside a `useMemo`:

```tsx
  const watchedParentCategoryName = watch('parentCategoryName');
```

**(c) Delete the local parent state and its sync effect** — `:81-90`
(`const [selectedParentId, setSelectedParentId] = useState(derivedParentId)` plus the `useEffect`
that mirrors `derivedParentId` into it, including its
`// eslint-disable-next-line react-hooks/set-state-in-effect`). With the pill row gone, nothing needs
a second copy of the parent id. **Keep `derivedParentId` (`:60-79`) exactly as it is** — all three of
its branches (Other sentinel, parent-only AI fill, tree walk) are still load-bearing.

**(d) Keep `:92-164` — the hydrate/bridge effect — byte for byte.** Same body, same dependency array.
It is why the AI's category survives. **And keep the `:166-169` NOTE comment.**

**(e) Replace `:178-194`** (`selectedParent` / `subs` / `isFlatLeaf` / `onPickParent`) with:

```tsx
  const [sheetOpen, setSheetOpen] = useState(false);
  const options = useMemo(() => flattenCategoryOptions(parents), [parents]);
  const selectedParent = parents.find((c) => String(c.id) === derivedParentId);
  const marketplaceLabel =
    MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.label ?? '';
  const otherLabel = t('mobile.detail.subCategoryOther', {
    defaultValue: 'Other (type brand)',
  });

  // What the collapsed row shows. Four states, in priority order:
  //   Other picked → "Parent › Other (type brand)"
  //   leaf picked  → the flattened label ("Parent › Sub", or the parent's own
  //                  name on a flat tree)
  //   parent only  → "Parent › pick a subcategory" — shows what the AI DID
  //                  resolve instead of discarding it, while the empty leaf keeps
  //                  Submit blocked (schema.ts:23)
  //   nothing      → '' (the row renders the "Not set" prompt)
  const selectedLabel = useMemo(() => {
    if (categoryId === OTHER_SUBCATEGORY_ID) {
      const parentName = watchedParentCategoryName || selectedParent?.name || '';
      return parentName ? `${parentName} › ${otherLabel}` : otherLabel;
    }
    if (categoryId) return options.find((o) => o.id === categoryId)?.label ?? '';
    if (selectedParent) {
      return `${selectedParent.name} › ${t('mobile.detail.categoryPickSubcategory', {
        defaultValue: 'pick a subcategory',
      })}`;
    }
    return '';
  }, [categoryId, options, selectedParent, watchedParentCategoryName, otherLabel, t]);

  // The ONLY place this card writes the category fields, and it is reachable
  // exclusively from the sheet's own Pressables — i.e. user-initiated. Never
  // move any of this into an effect keyed on `marketplace`: see the NOTE above.
  const applyPick = (pick: CategoryPick) => {
    setValue('categoryId', pick.categoryId, { shouldValidate: true });
    setValue('parentCategoryId', pick.parentCategoryId, { shouldValidate: false });
    setValue('parentCategoryName', pick.parentCategoryName, { shouldValidate: false });
    // A real leaf leaves "Other" behind — drop any stale typed brand so it is
    // never submitted (same reason as the old `:193` and `:289`).
    if (pick.categoryId !== OTHER_SUBCATEGORY_ID) {
      setValue('customSubcategory', '', { shouldValidate: false });
    }
  };
```

**(f) Replace the whole JSX block `:198-388`** — the category `Controller` with its `ScrollView`, and
the entire subcategory `Controller` — with:

```tsx
      <Controller
        control={control}
        name="categoryId"
        render={({ fieldState }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionCategory')} required />
            <Pressable
              className="flex-row items-center gap-sm border border-brand-border-strong rounded-xs px-md py-2.5"
              onPress={() => {
                haptics.tap();
                setSheetOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('mobile.detail.sectionCategory')}: ${
                selectedLabel ||
                t('mobile.detail.categoryNotSet', { defaultValue: 'Not set — pick a category' })
              }`}
            >
              <Text
                className={`flex-1 font-label-medium text-lg ${
                  selectedLabel ? 'text-brand-foreground' : 'text-brand-placeholder'
                }`}
                numberOfLines={2}
              >
                {selectedLabel ||
                  t('mobile.detail.categoryNotSet', {
                    defaultValue: 'Not set — pick a category',
                  })}
              </Text>
              <Text className="font-label text-md text-brand-primary">
                {selectedLabel
                  ? t('mobile.detail.change', { defaultValue: 'Change' })
                  : t('mobile.detail.choose', { defaultValue: 'Choose' })}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={brand.placeholder} />
            </Pressable>
            {fieldState.error ? (
              <Text className="text-brand-destructive text-md">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      {/* The typed brand for "Other" stays on the CARD, not in the sheet: the
          seller must see and edit it after the sheet closes. Same field, same
          validation (schema.ts superRefine), one less place to look. */}
      {categoryId === OTHER_SUBCATEGORY_ID ? (
        <Controller
          control={control}
          name="customSubcategory"
          render={({ field: { value: brandValue, onChange: onBrandChange, onBlur }, fieldState }) => (
            <View className="gap-1.5">
              <FieldLabel
                text={t('mobile.detail.sectionSubcategory', { defaultValue: 'SUBCATEGORY' })}
                required
              />
              <TextInput
                className={otherInputCls}
                value={brandValue ?? ''}
                onChangeText={onBrandChange}
                onBlur={onBlur}
                maxLength={60}
                placeholder={t('mobile.detail.subCategoryOtherPlaceholder', {
                  defaultValue: 'Enter brand name',
                })}
                placeholderTextColor={brand.placeholder}
              />
              {fieldState.error ? (
                <Text className="text-brand-destructive text-md">{fieldState.error.message}</Text>
              ) : null}
            </View>
          )}
        />
      ) : null}

      <CategoryPickerSheet
        visible={sheetOpen}
        categories={parents}
        loading={categories.isLoading}
        error={categories.isError}
        onRetry={() => {
          void categories.refetch();
        }}
        marketplaceLabel={marketplaceLabel}
        value={categoryId ?? ''}
        parentId={watchedParentCategoryId ?? ''}
        onSelect={applyPick}
        onClose={() => setSheetOpen(false)}
      />
```

Everything from `:390` down — the condition pills and the 101it-only grade block at `:430-466` — is
**unchanged**. The old inline error message (`t('mobile.detail.categoriesLoadFailed')`, `:207-209`)
becomes the sheet's tappable retry, so that key goes unused; **leave it in the locale files** (an
unused key costs nothing, removing one risks a coverage test).

**Height delta (arithmetic, not measured):** two 240 px scrollers + the standalone Other row (~45 px)
+ their labels and gaps ≈ **480–520 px** removed, against `SCAN_FLOW_UX.md:181`'s ~714 px card. The
card goes from up to ~11 visible controls to **one**.

## Step M2.4 — Add the 11 i18n keys to all six locales

None of these keys exists today (checked all six files). `mobile.detail.*` is **not** covered by a
full-coverage i18n test — `src/i18n/__tests__/draftKeys.test.ts:60-68` pins only named keys — so
these would not break a test if skipped. They are here because the app ships six locales and a raw
`mobile.detail.change` in the UI is a defect. Wording mirrors the already-translated
`mobile.labEdit.selectCategoryTitle` / `categoriesLoadError` and `mobile.common.loading`, so
terminology stays consistent.

Insert into the `mobile.detail` object of each file.

`src/i18n/locales/en.json`
```json
      "change": "Change",
      "choose": "Choose",
      "categoryNotSet": "Not set — pick a category",
      "categoryPickSubcategory": "pick a subcategory",
      "selectCategoryTitle": "Select category",
      "selectCategorySubtitle": "Search, or browse by group",
      "categorySearchPlaceholder": "Search categories…",
      "categorySearchEmpty": "No category matches \"{{q}}\"",
      "categorySearchClear": "Clear search to browse all categories",
      "categoriesLoading": "Loading {{marketplace}} categories…",
      "categoriesRetry": "Couldn't load categories — tap to retry",
```

`src/i18n/locales/ja.json`
```json
      "change": "変更",
      "choose": "選択",
      "categoryNotSet": "未設定 — カテゴリーを選択してください",
      "categoryPickSubcategory": "サブカテゴリーを選択",
      "selectCategoryTitle": "カテゴリーを選択",
      "selectCategorySubtitle": "検索するか、グループから選択",
      "categorySearchPlaceholder": "カテゴリーを検索…",
      "categorySearchEmpty": "「{{q}}」に一致するカテゴリーがありません",
      "categorySearchClear": "検索をクリアしてすべて表示",
      "categoriesLoading": "{{marketplace}} のカテゴリーを読み込み中…",
      "categoriesRetry": "カテゴリーを読み込めませんでした — タップで再試行",
```

`src/i18n/locales/th.json`
```json
      "change": "เปลี่ยน",
      "choose": "เลือก",
      "categoryNotSet": "ยังไม่ได้ตั้งค่า — เลือกหมวดหมู่",
      "categoryPickSubcategory": "เลือกหมวดหมู่ย่อย",
      "selectCategoryTitle": "เลือกหมวดหมู่",
      "selectCategorySubtitle": "ค้นหา หรือเลือกตามกลุ่ม",
      "categorySearchPlaceholder": "ค้นหาหมวดหมู่…",
      "categorySearchEmpty": "ไม่พบหมวดหมู่ที่ตรงกับ \"{{q}}\"",
      "categorySearchClear": "ล้างการค้นหาเพื่อดูทั้งหมด",
      "categoriesLoading": "กำลังโหลดหมวดหมู่ของ {{marketplace}}…",
      "categoriesRetry": "โหลดหมวดหมู่ไม่สำเร็จ — แตะเพื่อลองใหม่",
```

`src/i18n/locales/vi.json`
```json
      "change": "Đổi",
      "choose": "Chọn",
      "categoryNotSet": "Chưa đặt — hãy chọn danh mục",
      "categoryPickSubcategory": "chọn danh mục con",
      "selectCategoryTitle": "Chọn danh mục",
      "selectCategorySubtitle": "Tìm kiếm, hoặc xem theo nhóm",
      "categorySearchPlaceholder": "Tìm danh mục…",
      "categorySearchEmpty": "Không có danh mục nào khớp với \"{{q}}\"",
      "categorySearchClear": "Xóa tìm kiếm để xem tất cả",
      "categoriesLoading": "Đang tải danh mục {{marketplace}}…",
      "categoriesRetry": "Không thể tải danh mục — chạm để thử lại",
```

`src/i18n/locales/zh-Hans.json`
```json
      "change": "更改",
      "choose": "选择",
      "categoryNotSet": "未设置 — 请选择类别",
      "categoryPickSubcategory": "选择子类别",
      "selectCategoryTitle": "选择类别",
      "selectCategorySubtitle": "搜索，或按分组浏览",
      "categorySearchPlaceholder": "搜索类别…",
      "categorySearchEmpty": "找不到符合「{{q}}」的类别",
      "categorySearchClear": "清除搜索以浏览全部",
      "categoriesLoading": "正在加载 {{marketplace}} 类别…",
      "categoriesRetry": "无法加载类别 — 点击重试",
```

`src/i18n/locales/zh-Hant.json`
```json
      "change": "變更",
      "choose": "選擇",
      "categoryNotSet": "未設定 — 請選擇類別",
      "categoryPickSubcategory": "選擇子分類",
      "selectCategoryTitle": "選擇類別",
      "selectCategorySubtitle": "搜尋，或依分組瀏覽",
      "categorySearchPlaceholder": "搜尋類別…",
      "categorySearchEmpty": "找不到符合「{{q}}」的類別",
      "categorySearchClear": "清除搜尋以瀏覽全部",
      "categoriesLoading": "正在載入 {{marketplace}} 類別…",
      "categoriesRetry": "無法載入類別 — 點選重試",
```

Check every file still parses and every key landed:

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
node -e "
const K=['change','choose','categoryNotSet','categoryPickSubcategory','selectCategoryTitle',
 'selectCategorySubtitle','categorySearchPlaceholder','categorySearchEmpty','categorySearchClear',
 'categoriesLoading','categoriesRetry'];
let bad=0;
for(const f of ['en','ja','th','vi','zh-Hans','zh-Hant']){
  const d=require('./src/i18n/locales/'+f+'.json').mobile.detail;
  const m=K.filter(k=>!d[k]);
  console.log(f, m.length?('MISSING '+m.join(',')):'ok');
  if(m.length) bad=1;
}
process.exit(bad);
"
```

**Expected: six `ok` lines, exit 0.**

## Step M2.5 — Component test for the sheet

Create `src/features/scanner/components/detail/__tests__/CategoryPickerSheet.test.tsx`:

```tsx
import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// The module chain reaches the greenbidz axios client (via fetchCategories),
// which imports MMKV — a native module with no jest binary. Same stub as
// enCategoryFixups.test.ts:6.
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import type { LabCategory } from '@/services/scanner/fetchCategories';

import { CategoryPickerSheet } from '../CategoryPickerSheet';

// /lab shape: one parent, two children (real ids and names from dev).
const NESTED: LabCategory[] = [
  {
    id: 5375,
    name: 'Lab Infrastructure & Essentials',
    slug: 'lab-infra',
    subcategories: [
      { id: 5573, name: 'Autoclaves and Sterilisation', slug: 'autoclaves' },
      { id: 5578, name: 'Centrifugation', slug: 'centrifugation' },
    ],
  },
];

// /101recycle shape after normalizeRecycleCategories: flat parents, no children.
const FLAT: LabCategory[] = [
  { id: 1147, name: 'Material Handling Equipment', slug: 'mhe', subcategories: [] },
  { id: 2019, name: 'Metalworking Equipment', slug: 'metalworking', subcategories: [] },
];

const base = {
  visible: true,
  loading: false,
  error: false,
  onRetry: () => {},
  marketplaceLabel: '101LAB',
  value: '',
  parentId: '',
  onClose: () => {},
};

describe('CategoryPickerSheet', () => {
  it('emits the leaf id AND its parent when a nested subcategory is tapped', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.press(getByText('Centrifugation'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '5578',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
  });

  it('treats a flat parent as the leaf — the /machines and /101recycle case', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategoryPickerSheet
        {...base}
        marketplaceLabel="101RECYCLE"
        categories={FLAT}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByText('Metalworking Equipment'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '2019',
      parentCategoryId: '2019',
      parentCategoryName: 'Metalworking Equipment',
    });
  });

  it('offers "Other (type brand)" only on a nested tree, filed under its parent', () => {
    const onSelect = jest.fn();
    const nested = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.press(nested.getByText('Other (type brand)'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });

    const flat = render(<CategoryPickerSheet {...base} categories={FLAT} onSelect={() => {}} />);
    expect(flat.queryByText('Other (type brand)')).toBeNull();
  });

  it('search narrows to matching leaves and hides the rest', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'centrif');
    expect(getByText('Lab Infrastructure & Essentials › Centrifugation')).toBeTruthy();
    expect(queryByText('Autoclaves and Sterilisation')).toBeNull();
  });

  it('search matches on the parent name too, and still emits the child leaf', () => {
    const onSelect = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'infrastructure');
    fireEvent.press(getByText('Lab Infrastructure & Essentials › Autoclaves and Sterilisation'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '5573',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
  });

  it('a no-match search offers a way back instead of a dead end', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'zzzzz');
    expect(getByText('No category matches "zzzzz"')).toBeTruthy();
    fireEvent.press(getByText('Clear search to browse all categories'));
    expect(queryByText('No category matches "zzzzz"')).toBeNull();
    expect(getByText('Centrifugation')).toBeTruthy();
  });

  it('names the marketplace in the loading copy rather than showing a bare spinner', () => {
    const { getByText } = render(
      <CategoryPickerSheet
        {...base}
        loading
        marketplaceLabel="101MACHINE"
        categories={[]}
        onSelect={() => {}}
      />,
    );
    expect(getByText('Loading 101MACHINE categories…')).toBeTruthy();
  });

  it('a load failure is a tappable retry, not a dead end', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <CategoryPickerSheet {...base} error onRetry={onRetry} categories={[]} onSelect={() => {}} />,
    );
    fireEvent.press(getByText("Couldn't load categories — tap to retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it('never writes the form on mount — the trap guard, as a test', () => {
    const onSelect = jest.fn();
    render(<CategoryPickerSheet {...base} categories={NESTED} value="5578" onSelect={onSelect} />);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

Run:

```bash
npx jest src/features/scanner/components/detail/__tests__/CategoryPickerSheet.test.tsx
```

**Expected: 9 passed, 0 failed.** The assertions read **English** strings because the jest env loads
no locale bundle, so `t(key, { defaultValue })` returns the default — the same reason every new key
in the source passes `defaultValue`.

## Step M2.6 — On-device pass, all four trees, on dev

`MarketplaceCard` is hidden while `MARKETPLACE_LOCKED = true` (`MarketplaceCard.tsx:22`, early return
at `:29`), so you cannot reach the other three trees from the UI yet. **M-4 owns flipping that flag
permanently. For this pass only, flip it locally and revert before you commit:**

```bash
cd C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
sed -i 's/^const MARKETPLACE_LOCKED = true;$/const MARKETPLACE_LOCKED = false;/' \
  src/features/scanner/components/detail/MarketplaceCard.tsx
# ... run the pass ...
sed -i 's/^const MARKETPLACE_LOCKED = false;$/const MARKETPLACE_LOCKED = true;/' \
  src/features/scanner/components/detail/MarketplaceCard.tsx
git diff --stat src/features/scanner/components/detail/MarketplaceCard.tsx   # must be EMPTY
```

Then, with `.env` on dev and `npx expo start --clear`, on `app/scan/detail.tsx`:

| # | Marketplace | Do | Pass criterion |
|---|---|---|---|
| 1 | 101LAB | Open the sheet, type `centrif` | One row, `Lab Infrastructure & Essentials › Centrifugation`; tapping it collapses the card to that label |
| 2 | 101LAB | Clear the search, scroll | 4 group headers, 62 indented children, one `Other (type brand)` per header; the headers do not respond to taps |
| 3 | 101LAB | Pick `Other`, close the sheet, type a brand | Brand input appears **on the card**; leaving it blank blocks Submit (schema `superRefine`) |
| 4 | 101MACHINE | Open the sheet | 13 plain rows, **no** headers, **no** `Other`; picking one commits immediately |
| 5 | 101IT | Open the sheet | 6 headers / 25 children; the Grade pills still render below (101it only) |
| 6 | **101RECYCLE** | Open the sheet | **37 plain rows, all English, no `&amp;` anywhere** — M-1's visible proof |
| 7 | 101RECYCLE | Search `scrap` | Both `Surplus & Scrap Materials` and `Scrap` appear |
| 8 | any | Switch marketplace on the pill row | Category clears (that is `MarketplaceCard.tsx:59-62`, user-driven) and the sheet shows the new tree |
| 9 | any | Airplane mode, open the sheet | Tappable "Couldn't load categories — tap to retry"; restoring the network and tapping loads the tree |
| 10 | zh-Hant | Settings → 繁體中文, reopen | lab / machines / 101it labels are Chinese; **recycle stays English by design** (§4.1c) |
| 11 | any | Run an AI scan that returns a category, open `detail.tsx` | The category is **pre-filled**. This is the trap check. If it is blank you broke the hydrate/bridge effect — revert (e) and (f) and re-apply without touching `:92-169` |
| 12 | — | Repeat #1 and #11 on `app/scan/grouped-edit.tsx` and `app/(lab)/listing-edit.tsx` | Both mount the same card (`grouped-edit.tsx:220`, `listing-edit.tsx:534`); the collapsed row and the sheet must work there too |
| 13 | — | Small phone (SE-class) and an Android with a 3-button nav bar | The sheet's Cancel row is clear of the nav bar (`Sheet.tsx:110` reads the inset) and the search field stays put while the list scrolls |

**Do not press Submit on any of these.** Nothing in this phase requires a write.

---

## 6. Verification

Run all of it, in this order, from `C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp`.

```bash
# 1. Types — baseline is ZERO errors (re-measured today: exit 0, no output)
npx tsc --noEmit

# 2. Lint
npx expo lint

# 3. The three new suites
npx jest src/services/scanner/__tests__/recycleCategoryEndpoint.test.ts \
         src/services/scanner/__tests__/recycleCategoryShape.test.ts \
         src/features/scanner/components/detail/__tests__/CategoryPickerSheet.test.tsx

# 4. Full app suite
npm test

# 5. i18n keys present in all six locales (Step M2.4 snippet) — exit 0

# 6. Four trees against DEV, end to end (Step M1.11)
#    every row: HTTP 200, stillEscaped=0, blank=0, dupIds=0

# 7. .env restored to PRODUCTION (§3.2)
grep -n '^GREENBIDZ_API_URL=' .env   # api.101recycle.greenbidz.com/api/v1
```

### Baselines

| Check | Baseline before this phase (measured 2026-08-18) | Expected after |
|---|---|---|
| `npx tsc --noEmit` (app) | **0 errors**, exit 0 | **0 errors** |
| `npm test` (app) | **92 suites / 825 tests / 22 snapshots, all passing** | **95 suites / 857 tests / 22 snapshots** (+3 suites; 7 + 16 + 9 = 32 tests). Any *pre-existing* suite that turns red is a regression from this phase — do not rationalise it. |
| Backend full suite | **2 pre-existing failing suites: `zohoListingSyncPublished`, `uploadValidationService`** | Unchanged. **This phase changes no backend file**, so it is not a gate here; it is listed only so nobody mistakes those two for something they caused. |

`npm test` also prints `A worker process has failed to exit gracefully…` on a clean tree today. That
is pre-existing noise, not a failure.

### Not verified

- Every on-device criterion in Step M2.6. They are written from source, not observed. Whoever runs
  them owns reporting which passed.
- The `~480–520 px` scroll saving and the "~5 rows / ~7 swipes" figures are arithmetic on source
  constants, not hardware measurement.
- Whether a nested-list swipe currently chains to the page scroll on Android
  (`SCAN_FLOW_UX.md:72`). M-2 removes the nesting either way.
- Prod behaviour of any of this. Every measurement is **dev** (`testapi.greenbidz.com`,
  `greenbidz_test`). Prod re-measurement is release gate 1 in the plan (§8.3) — a separate,
  owner-approved step.

---

## 7. What this phase does NOT do

- **It does not unlock the marketplace picker.** `MARKETPLACE_LOCKED` stays `true`
  (`MarketplaceCard.tsx:22`). After this phase the recycle tree is *correct*, but a seller still
  cannot choose recycle in a shipped build. That is **M-4**, and it must land in the same 1.0.4 for
  any of this to be visible.
- **It does not consume the AI's routing signal.** `suggestedMarketplace`
  (`mapSmartDetection.ts:188`) stays computed-and-unused; `needs_clearer_photo`,
  `site_type_confidence`, `site_type_source` and `category_source` remain unread. **M-3 / M-6.**
- **It does not badge the category as AI-derived.** `FieldLabel` is still called with `required` only
  (`CategoryConditionCard.tsx:203`, still true after the rewrite). **M-10.**
- **It does not add marketplace option descriptions**, so M-3's sheet body would still be four
  codenames. **M-10.**
- **It changes nothing on the server** — not the unescape at source (**S0-4**), not the
  blank-category rule (**S0-3a**), not `recycle`-as-unknown-bucket (**S0-3b**), not
  `inferSiteTypeFromProduct` (**S0-1**), not the confidence emission (**S0-2**). The client-side
  unescape added here is idempotent, so S0-4 can land later without a revert.
- **It does not touch the profit card, the required-fields checklist, the footer, `onInvalid`, or the
  keyboard-sticky CTA.** M-5, M-7, M-8, M-9, M-11.
- **It does not fix the missing taxonomy rows**, the duplicate `Lathes` (recycle 5334 vs 5341), or
  the junk `test` row (5366). Owner content work — plan Decision 6 / **S0-6**.
- **It does not localise the recycle tree.** zh-Hant sellers see English recycle categories on
  purpose (§4.1c). That is a backend/content item (§8).
- **It submits nothing, publishes nothing, deploys nothing, migrates nothing.**

---

## 8. What must land before / after

### Before — already true; verify, do not rebuild

| Prerequisite | Where | Status |
|---|---|---|
| The app is marketplace-aware end to end | `MARKETPLACE_OPTIONS` `constants.ts:40-48`, `marketplaceToPlatform` `:106-114`, `marketplaceFromSiteType` `:116-125`, `defaultCurrencyForSite` `:70-72` | ✅ verified today |
| `detailSchema` already accepts all four marketplaces | `schema.ts:57` | ✅ verified — **no schema change in this phase** |
| Backend routes and categorises per marketplace | `controller/wordPressSmart.js` ~1930-1975; per-site taxonomies `utils/categoryCache.js:122-127` | ✅ verified by reading |
| The recycle endpoint exists and is EN-capable on dev | `routes/productRoute.js:35` → `controller/productController.js:244-290` | ✅ HTTP 200 measured |
| `Sheet` + `Sheet.Option`, safe-area handled | `src/components/ui/Sheet.tsx:51-137`, `:152-213` | ✅ |
| `flattenCategoryOptions` flat-tree branch | `fetchCategories.ts:148-155` (pre-edit) | ✅ already shipped for /machines — plan drift, §9 |
| Nothing uncommitted in the app tree | `git status` → only `Docs/multi-marketplace/` untracked | ✅ HEAD `11ef609` |

### After — in the same 1.0.4 binary

- **M-4** must land, or none of M-1 is reachable by a seller. It flips `MARKETPLACE_LOCKED`, takes
  `suggestedMarketplace` on the apply path (`scanDraftStore.ts:413`), patches the single-photo path
  (`app/scan/processing.tsx:504-508`), keeps the AI price in USD, and guards the `mergedSingleFields`
  mixed-batch fallback. **M-4 must write `marketplace` only through the user-driven path** — the same
  trap as §1.
- **M-3** (routing chip in the `detail.tsx:127` slot) sits directly above the card this phase
  rewrites; build it after M-2 so it lands on the collapsed layout, not the old one.
- **M-10** adds the AI badge to the category label — one line on the `FieldLabel` call this phase
  leaves at `required`-only.
- **M-7** must land before `marketplace` starts taking AI input (`requiredStatus.ts:42-61` maps only
  6 paths while `allComplete` gates Submit on the full schema, `:128-137`).

### After — server side, dev first, owner-approved

- **S0-4** — unescape recycle names at the API. The client decoder here is idempotent, so S0-4 is
  purely additive and needs no app change.
- **S0-3a / S0-3b** — the blank-category rule and removing `recycle` as the silent unknown bucket.
  M-2 is the precondition the plan itself names for S0-3a (§4.2 item 4): without a fast picker, a
  blank category converts "wrong listing" into "abandoned listing".
- **New, from this phase — recycle taxonomy localisation.** `bridgeCategoryId`'s position heuristic
  mis-maps 8 of 37 recycle categories (§4.1c). To give zh-Hant sellers localised recycle labels the
  API must expose a stable cross-locale key (WPML `trid` / `term_translation_id`) on
  `/product/category`. Until then `enOnly: true` stays and the app is honest about it.
- **New, from this phase — recycle taxonomy hygiene** (owner, WP admin): the duplicate `Lathes`
  (5334 untranslated-EN vs 5341), the junk `test` row (5366), and the six machines-style rows
  (5319–5356) duplicated into the recycle tree under different ids.

### Release constraint that outlives this phase

1.0.3 (build 19) is `WAITING_FOR_REVIEW`; Play is at versionCode 6. `runtimeVersion.policy` is
`appVersion` (`app.config.ts:90-91`) and `version` is `'1.0.3'` (`:34`). **No EAS Update while 1.0.3
is in review** — an OTA published for 1.0.3 lands on the build Apple is testing. This phase ships in
the 1.0.4 binary.

---

## 9. Citation drift found while writing this

| Reference in `MULTI_MARKETPLACE_PLAN.md` (M-1 / M-2) | Correct today (HEAD `11ef609`) |
|---|---|
| `fetchCategories.ts:24-30` — `endpointForMarketplace` | **`:24-29`.** Line 29 is the closing brace; there is no line-30 content for this claim. The behaviour claim is exact — `:27-28` reads *"101lab + 101recycle (and the fall-through default) share the lab tree"* and returns `/product/lab/category`. |
| `fetchCategories.ts:95-130` — `bridgeCategoryId` | **`:95-131`.** `:130` is the `return null;`, `:131` the closing brace. |
| `fetchCategories.ts:144-170` — `flattenCategoryOptions` | **`:144-165`.** The file is **165 lines long**; `:170` does not exist. |
| M-1: *"make `flattenCategoryOptions` handle a **flat** tree"* | **Already implemented** — the `subs.length === 0` branch at `:148-155` shipped for `/machines`, with the reason documented at `:138-142`. What recycle needs is the **normalisation** (M1.4): a `{term_id}` row with no `subcategories` key must become `{id, subcategories: []}` before that branch can fire. |
| M-1: *"unescape names defensively"* | Correct, and **for recycle it is not merely defensive** — 18 of 37 EN recycle names are escaped today (measured). For lab / machines / 101it it *is* defensive: 0 escaped names measured. |
| M-1 and plan §5 do not mention the **query-parameter** difference | **New finding.** The recycle endpoint reads `?lang=`, not `?language=` (`controller/productController.js:247`), and ignores `language` — `?language=en` returns the **Chinese** tree. Changing only the path is not enough. |
| M-1 does not mention the **cross-locale bridge hazard** | **New finding.** `bridgeCategoryId` mis-maps **8 of 37** recycle categories (positions 14–21), including EN `2019` → zh `2312`. Hence `enOnly: true`. |
| M-1 does not mention that **only `en` and `zh-hant` recycle trees exist** | **New finding** (`productController.js:251-257`): `?lang=ja|th` return the zh-hant tree, so ja / th / vi / zh-Hans sellers see Chinese recycle names today. |
| `CategoryConditionCard.tsx:198-388` (M-2 target) | **Exact.** `:198` opens the category `Controller`; `:388` closes the subcategory `Controller`'s ternary. |
| `CountryPicker.tsx:37-91`, `Sheet.tsx:139-181` (M-2 pattern) | **Exact.** `Sheet.Option`'s props type is `:139-150`, its header branch `:162-181`. Also worth copying, and not found by the plan: `LabListingEditSheet.tsx:1582-1689`, an existing parent-header + indented-child category sheet already in this codebase (it is named in `Sheet.tsx:32`). |
| M-2 lists only `CategoryConditionCard.tsx` as modified | **The blast radius is three screens:** `app/scan/detail.tsx:130`, `app/scan/grouped-edit.tsx:220`, `app/(lab)/listing-edit.tsx:534` all mount `CategoryConditionCard`. All three must be smoke-tested (Step M2.6 #12). |
| Plan §3 / §4.2: `CategoryConditionCard.tsx:211-216`, `:267-272`, `:203`, `:124`, `:46-47`, `:166-169`, `:430-466` | **All exact.** |
| Plan §1 / §5: `schema.ts:23`, `schema.ts:57`, `MarketplaceCard.tsx:22`, `:50-63`, `mapSmartDetection.ts:153`/`:157`/`:188`, `app/scan/detail.tsx:127`, `app.config.ts:34` and `:90-91` | **All exact.** |
| Plan §4.1 recycle-tree shape (37 flat, `term_id`, no `subcategories`, 18 escaped, overlap 0, ids 1147–5366 vs lab 5371–5849) | **All re-measured on dev today and confirmed.** |

---

## 10. Honest limits of this plan

- Every number here is from **dev** (`testapi.greenbidz.com`, `greenbidz_test`). Prod runs a
  different vision-provider configuration and its category content may differ. **Prod is not
  verified.**
- The four category trees are WordPress **content**. Parent/leaf counts can change between the day
  this was measured and the day it is implemented. The assertions in Step M1.11 that matter are
  `stillEscaped=0 / blank=0 / dupIds=0` and "the two `101recycle` rows are identical in both locale
  blocks" — not the counts.
- The 8-of-37 bridge misalignment is a snapshot of dev on 2026-08-18. If someone re-orders the WPML
  translations it could get better or worse; the unit test in M1.10 pins the *class* of failure with a
  hand-built tree so it cannot silently stop being tested.
- No UI in this plan has been rendered. Every layout and copy decision is reasoned from source and
  from `UX_DESIGN_RULES.md`; Step M2.6 is where it gets confirmed or corrected.
- The claim that no jest test or snapshot renders `Sheet` is from a grep and a `find` over `src/` and
  `app/`; it is not a guarantee about a test someone adds tomorrow.
- Writing this document changed no `.ts` / `.tsx` / `.js` file, made no commit, push, branch switch,
  stash, reset or clean, ran no migration, wrote nothing to production, and did not touch
  `greenbidz-ai-assistant/`. The only network calls were read-only `GET`s against
  `testapi.greenbidz.com`.
