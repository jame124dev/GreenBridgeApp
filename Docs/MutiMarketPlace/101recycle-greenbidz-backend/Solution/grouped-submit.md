# Solutions — grouped submit (`services/groupedListingSubmitService.js`)

Answers [`../Problem/grouped-submit.md`](../Problem/grouped-submit.md).

---

## 0 Change nothing about routing

Per-product resolution is correct and should be left exactly as it is
(`:180-186`, `:407`), including the validate-then-map order at `:396-404`.

Worth stating because an earlier app-side audit proposed splitting the submit into one request
per marketplace. That work is **not needed** and would replace a correct atomic write with
several non-atomic ones.

---

## 1 Mixed lot — the server is right; the fix is mostly in the app

Keep the 400 at `:459-468`. The constraint is real (a batch row carries one `site_id`), the
message is specific and good, and the server must remain the authority.

**The server cannot check it any earlier.** The product metadata is in the multipart body, so
multer has to run before anything can be inspected. There is no server-side fix for the ordering.

So the work is client-side — block a mixed lot on the review hub before upload, mirroring this
rule. Written up in
[`../../GreenBridgeApp/SolutionScreen/scan-grouped-review.md`](../../GreenBridgeApp/SolutionScreen/scan-grouped-review.md) §2.

What this repo can contribute: make the rule **discoverable** so the client can mirror it rather
than reimplement it from a 400 string. A one-line note in the route's documentation — *"lot mode
requires a single marketplace across all products"* — is enough, and it is the kind of thing the
client's check should cite.

---

## 2 Decide what a partially-created lot leaves behind

The throw at `:462` happens mid-loop, after earlier iterations created products. `err.partial`
carries `{ batch_ids, products }`, which is the right instinct and more than most error paths do.

Two things to settle:

**Does the client use it?** `<VERIFY>` what the app does with a 400 carrying `partial` — surfaces
the ids, retries, or drops them. If dropped, those products are orphaned: created, owned by the
seller, not in any batch, and invisible in the flow that made them.

**Should the server clean up instead?** Options, in increasing order of work:

| option | behaviour |
|---|---|
| keep `partial`, make the client responsible | no server change; requires the client to actually handle it |
| roll back the products created so far | atomic, but a rollback path on a write that has already uploaded media is its own risk |
| create nothing until all products validate | **recommended** — hoist the marketplace-consistency check for lot mode above the creation loop |

The third is small: the loop already computes `resolveProductMarketplaceType(meta)` per product,
so a pre-pass over `productsMeta` can establish "lot mode and more than one distinct marketplace"
before anything is written. That turns a partial write into a clean 400 and costs one extra pass
over an in-memory array.

It does not fix the upload ordering — the seller still waits for the upload — but it removes the
orphan case entirely, which is the part that leaves bad data behind.

---

## 3 Make the admin notification honest about a mixed batch

`:670` takes `platform` from `req.query.type`, which the client sources from `items[0]`. For a
mixed batch the email names one marketplace for a batch that spanned several, and falls back to
`"recycle"` when absent.

Derive it from the products instead — they each already carry a resolved `marketplaceType` by the
time the notification is sent. One marketplace when they agree, a list when they do not.

Low priority, internal, but it is a report someone may act on, and the recycle fallback is the
same wrong default as [site-type-defaults.md](site-type-defaults.md) §2.

---

## 4 Delete the false comment in the app repo

`submitGroupedListings.ts:166-171` describes **this service** and describes it wrongly — it
claims the UI has no per-item marketplace picker and that this service assumes a shared
marketplace. Neither is true, and that sentence is what produced a wrong severity-1 finding in
the app-side audit.

The file is in the app repo, so the change lands there, but the correct replacement text is this
module's business: `?type=` feeds the admin notification at `:670` and nothing else; routing is
per-product from `allowed_sites`.

Cheapest item in this folder, and the one that prevents the next person reaching the same wrong
conclusion.

---

## 5 Remove the diagnostic logging

`submitGroupedListings.ts:162` and `:177` — `console.log('[multi-submit] …')` printing per-product
file counts and the POST url on every grouped submit.

App-side change, noted here because it is on this endpoint's path. Marked `DIAG` in the source,
so it was intended to be temporary.
