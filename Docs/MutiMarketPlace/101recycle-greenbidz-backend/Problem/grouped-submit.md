# Module: grouped submit — `services/groupedListingSubmitService.js`

`POST /wp/create-grouped-listings`. Where a multi-item scan becomes listings. No fixes.

---

## 0 What is already correct

Stated first because the app-side audit originally got this wrong.

- **Per-product routing works.** `resolveProductMarketplaceType` (`:180-186`) reads each
  product's own `allowed_sites[0]`, falling back to its own `site_type`; `:407` maps that to
  `site_id`. A mixed batch files each product where it belongs.
- **A product with no marketplace is rejected, not defaulted.** `:396-404` throws a 400 —
  *"Product N is missing marketplace (allowed_sites/site_type)"* — before `getSiteIdFromType`'s
  `?? 1` recycle default can be reached. Validate-then-map, which is the right order.
- **The error carries partial state.** `err.partial = { batch_ids: batchIds, products }`, so a
  client can tell what was created before the failure.

---

## 1 ⛔ A mixed **lot** is rejected only after the entire upload

`:459-468`:

```js
if (groupMode === "lot") {
  // A batch has one site_id, so a lot cannot span marketplaces.
  if (lotMarketplace && lotMarketplace !== marketplaceType) {
    const err = new Error(
      "A combined lot must be a single marketplace; mixed marketplaces detected"
    );
    err.statusCode = 400;
```

The rule is sound — a batch row carries one `site_id`, so a lot genuinely cannot span
marketplaces. The problem is **when** it fires.

This check runs inside the per-product loop, which runs after `uploadProductsBatch` (multer) has
buffered **every image, document and video in the batch**. The mobile client allows 300 s for
this call. So a seller on a phone uploads the whole batch and then gets a 400 for a condition
that was knowable from the metadata before a single byte moved.

The marketplace of each product is in `productsMeta`, which is parsed from the multipart body —
so the server cannot check it before multer runs either. The cheap place to catch this is the
client; the server's rejection is correct and should stay.

---

## 2 The failure is mid-loop, so a lot can fail after creating products

The throw at `:462` happens inside the loop at `:396`, after earlier iterations have already
created products (`products.push(...)`, `batchIds`).

`err.partial` is populated, which is the right instinct. But the outcome is a **partial write**:
some products exist, the lot does not, and recovery depends entirely on the client doing
something sensible with `partial`.

`<VERIFY>` what the mobile client does with a 400 carrying `partial` — whether those product ids
are surfaced, retried, or orphaned. Not checked in this pass. Orphaned products from a failed lot
would be invisible to the seller and still occupy their inventory.

---

## 3 `?type=` is batch-wide and names the wrong marketplace for a mixed batch

Its only consumer is `:670`:

```js
platform: (req.query.type || req.headers?.["x-platform"] || "recycle"),
```

— the `platform` field of the admin "productAdded" notification. The client sends it from
`items[0]` (`submitGroupedListings.ts:172`), so for a mixed batch the admin email claims one
marketplace for a batch that spanned several.

Internal and cosmetic, but it is a report someone may act on, and it defaults to **recycle** when
absent — see [site-type-defaults.md](site-type-defaults.md).

---

## 4 A misleading comment on the client side, about this module

`submitGroupedListings.ts:166-171` asserts:

> All items in a single grouped submit are assumed to share a marketplace (the grouped-review UI
> doesn't surface a per-item marketplace picker — sellers set marketplace once and items inherit).

Both halves are false: the UI does offer a per-item picker, and this service does not assume a
shared marketplace. The comment is in the app repo but it is a claim **about this module**, and
it is what caused a wrong finding in the app-side audit.

Recorded here so that whoever owns this service knows a false description of it is living in
another repo.

---

## 5 Diagnostic logging left in the client's submit path

`submitGroupedListings.ts:162`, `:177` — `console.log('[multi-submit] …')` with per-product file
counts and the POST url including `?type=`.

Not a marketplace defect, but it is in the code path this module serves and it prints routing
information to the device log on every grouped submit.
