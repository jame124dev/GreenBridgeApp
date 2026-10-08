# Module: site-type defaults — `utlis/batchUtils.js`, `controller/wordPress.js`

What the server does when it is not told which marketplace. No fixes.

---

## 1 ⛔ An unknown marketplace silently becomes **recycle**

`utlis/batchUtils.js:23-25`:

```js
export const getSiteIdFromType = (type) => {
  return TYPE_TO_SITE_ID[type] ?? TYPE_TO_SITE_ID[type?.toLowerCase()] ?? 1;
};
```

Site **1 is recycle**. So any `site_type` the map does not recognise — a typo, a new marketplace
key, a value from a client version the server predates — resolves to recycle rather than erroring.

Why that is the worst available default:

- **recycle is not enabled for mobile.** `/mobile-config` serves `101lab, 101machine, 101it`; a
  mis-defaulted listing lands on the one marketplace the app deliberately does not offer.
- **it is silent.** No throw, no log at the call site, no 400. The listing is created, just
  somewhere nobody looked.
- **it is the opposite of the client's default.** The app falls back to `'101lab'`
  (`supportedMarketplacesCache.ts:35`, and `?? '101lab'` across the submit paths). Client and
  server disagree about what "unknown" means, so the same ambiguous input lands differently
  depending on which side resolves it.

---

## 2 The single-product path defaults to recycle twice more

`controller/wordPress.js:469`:

```js
data.site_type = String(data.site_type || req.query.type || "recycle");
```

and `:149`:

```js
const platform = (req.query.type || req.headers["x-platform"] || "recycle").toLowerCase().trim();
```

Same default, independently written, in a second file. So "recycle when unsure" is the
established convention — but it is a convention from when recycle **was** the product, and it has
not been revisited now that three other marketplaces exist and recycle is the one held back.

`:149`'s `platform` feeds a notification; `:469`'s `site_type` is written into the data. The
second one matters.

---

## 3 `getSiteIdFromType` is used in paths that should never need a default

Call sites found: `services/Admin/agentReviewService.js:67`, `services/auctionGroupService.js:22`,
and `groupedListingSubmitService.js:407`.

The grouped path is safe — `:401` has already rejected any product with no resolvable marketplace
before `getSiteIdFromType` is reached, so the `?? 1` is unreachable there. That is the right
shape: **validate, then map.**

`<VERIFY>` the other two. If either reaches `getSiteIdFromType` without a prior check, the `?? 1`
is live for admin-created and auction-group listings, and a missing marketplace becomes a recycle
listing rather than an error.

---

## 4 Two independent site-id maps, in two languages, that must agree

| | file | map |
|---|---|---|
| Node | `utlis/batchUtils.js` | `TYPE_TO_SITE_ID` + reverse `SITE_ID_TO_TYPE` (`:28-35`) |
| Python | `greenbidz-ai-assistant/app/db/site_scope.py:30` | `TYPE_TO_SITE_ID` |
| App | `GreenBridgeApp/src/features/scanner/constants.ts:129` | `marketplaceToPlatform` (keys → type strings, no ids) |

All three encode the same marketplace identity. Two of them encode the same numeric ids. Nothing
checks that they agree, and they already differ in what they do on an unknown input — Node
defaults to `1`, Python defaults to `DEFAULT_SITE_IDS` `[5,2,6]`, the app returns `null` and lets
callers choose.

Adding a marketplace means editing at least three files in three repos, with no failing test if
one is missed.

---

## 5 The normaliser is substring-based and order-dependent

`groupedListingSubmitService.js:172-177`:

```js
if (raw.includes("machine")) return "machines";
if (raw.includes("recycle")) return "recycle";
if (raw.includes("101it") || raw === "it") return "101it";
if (raw.includes("lab") || raw.includes("greenbidz")) return "LabGreenbidz";
```

Works for the four current values, but the `lab`/`greenbidz` arm is broad enough to be a hazard:
**any** string containing "greenbidz" becomes LabGreenbidz, and it is last, so it only catches
what the earlier arms missed. A future value like `"greenbidz-machines"` is already handled by
arm 1 — by luck of ordering, not by design.

The app has the same lenient substring matching in `marketplaceFromSiteType`
(`constants.ts:139-153`) with its own comment that *"order matters"*. Two independent
order-dependent matchers that must stay in agreement.
