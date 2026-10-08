# Problems — `101recycle-greenbidz-backend`, multi-marketplace only

One file per module. A backend has no screens, so the unit is the module that owns the behaviour.

**Scope:** 101lab + 101machine + 101it. Only what is wrong once more than one marketplace is in
play. **No fixes** — those are in [`../Solution/`](../Solution/README.md).

Audited 2026-10-08 against the code and the live prod endpoint. `<VERIFY>` marks what was
inferred rather than observed.

---

## Index

| module | file | worst problem |
|---|---|---|
| Site-type defaults | [site-type-defaults.md](site-type-defaults.md) | an unknown marketplace silently becomes **recycle** |
| Grouped submit | [grouped-submit.md](grouped-submit.md) | a mixed **lot** is rejected only after the whole upload |
| Mobile config | [mobile-config.md](mobile-config.md) | the guard comment forbidding recycle is now stale |

---

## This repo is in better shape than the app

Worth saying up front, because the audit started from the opposite assumption.

**Per-product routing already works.** `services/groupedListingSubmitService.js:180-186`
derives each product's marketplace from **that product's own** `allowed_sites`, falling back to
its own `site_type`, and `:407` computes `site_id` per product. A mixed batch files correctly.

The batch-wide `?type=` query parameter is **not** used for routing — its only consumer is
`:670`, where it becomes the `platform` field of an admin notification email.

> ⚠️ An earlier version of the app-side audit claimed mixed batches were silently mis-filed, on
> the strength of the client sending one `?type=` for the batch. That was wrong — the server was
> never read. Logged in `MISTAKES.md`; corrected in
> [`../../GreenBridgeApp/ProblemScreen/scan-grouped-review.md`](../../GreenBridgeApp/ProblemScreen/scan-grouped-review.md).

**The mobile allow-list endpoint is live and already serves all three.**
`GET /api/v1/mobile-config` returns `["101lab","101machine","101it"]` on prod
(`api.101recycle.greenbidz.com`) and dev (`testapi.greenbidz.com`), driven by
`MOBILE_SUPPORTED_MARKETPLACES`. Widening or rolling back is one env edit plus `pm2 restart`.

**Detection is per-item.** `controller/wordPressSmart.js:428` instructs the model to set
`site_type` and `site_type_confidence` **per product**, explicitly because *"mixed uploads are
common"*, and the four-way enum at `:734` covers all marketplaces.

So the remaining problems here are defaults, one upload-ordering issue, and stale comments —
not routing.
