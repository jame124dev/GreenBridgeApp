# Solutions — site-type defaults

Answers [`../Problem/site-type-defaults.md`](../Problem/site-type-defaults.md).

---

## 1 Stop defaulting an unknown marketplace to recycle

`utlis/batchUtils.js:23-25` returns `1` (recycle) for anything unrecognised.

**Recommended: make it return `null` and force callers to decide.**

```js
export const getSiteIdFromType = (type) =>
  TYPE_TO_SITE_ID[type] ?? TYPE_TO_SITE_ID[type?.toLowerCase()] ?? null;
```

A mapping function should not invent an answer. The grouped path already shows the right pattern —
validate first (`groupedListingSubmitService.js:396-404` throws a 400 naming the product), then
map — so there the `?? 1` is already unreachable and this change is a no-op.

That is also what makes it safe to try: the busiest caller is unaffected.

### Do the data check first

**Before changing it**, find out who is relying on the default. Query prod, read-only, for
listings on `site_id = 1` created through the mobile paths. Mobile has never been offered recycle
(`/mobile-config` has never included it), so any such row arrived via `?? 1` and is evidence of a
caller that will start erroring.

If the count is zero, this is a safe change. If it is not, each caller needs handling before the
default moves.

### Then fix the callers

`<VERIFY>` `services/Admin/agentReviewService.js:67` and `services/auctionGroupService.js:22` —
whether either reaches `getSiteIdFromType` without a prior validity check. Each needs either a
check before the call, or an explicit default stated at the call site where a reader can see it.

An explicit `getSiteIdFromType(t) ?? SITE_ID.LAB` at a call site is fine. A hidden `?? 1` inside
the mapper is not, because nobody reading the call site knows it is there.

---

## 2 The single-product path — same treatment, lower priority

`controller/wordPress.js:469` — `data.site_type = String(data.site_type || req.query.type || "recycle")`.

Same reasoning: "recycle when unsure" is a convention from when recycle was the product. Now it is
the one marketplace deliberately withheld from mobile.

Replace the literal with an explicit decision. If a default is genuinely needed on this path, make
it the caller's declared marketplace, and if there is none, reject — a listing whose marketplace
nobody specified is not a listing anyone can find.

`:149`'s `platform` default only feeds a notification, so it can keep a fallback; it should just
not be `"recycle"` silently. Say `"unknown"` in an email rather than naming a marketplace that was
not involved.

---

## 3 Keep validate-then-map as the stated pattern

No code change. The grouped service already does it correctly; the point is to name it so it is
copied rather than rediscovered.

Add one line to `batchUtils.js` above the map: *"Callers must validate before mapping — this
function does not default, by design. See `groupedListingSubmitService.js:396-404`."*

That comment is what makes §1 stick. Without it, the next person debugging a null `site_id`
"fixes" it by putting `?? 1` back.

---

## 4 One source for the marketplace list — **worth doing before 101recycle**

Today the same marketplace identity is encoded in at least four places across three repos:

| repo | file | what it holds |
|---|---|---|
| backend | `utlis/batchUtils.js` | `TYPE_TO_SITE_ID` + reverse map |
| backend | `controller/mobileConfigController.js:30` | `KNOWN_MARKETPLACES` order |
| app | `supportedMarketplacesCache.ts:27` + `scanDraftStore.ts:108` | `KNOWN` + the `MarketplaceKey` union |
| assistant | `app/db/site_scope.py:30` | `TYPE_TO_SITE_ID` |

Nothing enforces agreement, and they already differ on unknown input (backend → `1`, assistant →
`[5,2,6]`, app → `null`).

**A shared module across three repos and two languages is not realistic.** What is realistic is a
test that fails when they drift:

- in this repo, assert `TYPE_TO_SITE_ID` and `mobileConfigController`'s `KNOWN_MARKETPLACES`
  cover the same set;
- cross-repo, a small script in the workspace that reads the four lists and diffs them, run
  manually before any marketplace is added.

The value is concentrated at exactly one moment — **the day 101recycle is enabled** — which is
the next time all four have to change together.

---

## 5 Leave the substring normaliser alone, but pin it

`groupedListingSubmitService.js:172-177` is order-dependent and its `lab`/`greenbidz` arm is
broad. It works for the four current values.

Do **not** rewrite it as part of this work — it is on a live write path and the current behaviour
is correct for every value in use. Instead add a table-driven test enumerating all four canonical
`site_type` values plus the known lowercase and partial variants, asserting each maps as intended.

Then if someone does rewrite it, or a fifth marketplace arrives with a name that collides, the
test says so. The same applies to the app's `marketplaceFromSiteType`
(`constants.ts:139-153`), which has the same shape and the same "order matters" caveat.
