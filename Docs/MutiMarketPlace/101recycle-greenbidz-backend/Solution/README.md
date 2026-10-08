# Solutions — `101recycle-greenbidz-backend`, multi-marketplace

Mirrors [`../Problem/`](../Problem/README.md) file for file, section for section.

Written 2026-10-08. Nothing here has been implemented.

---

## Read this first

**Routing is not broken here.** The per-product marketplace resolution works
(`groupedListingSubmitService.js:180-186`, `:407`) and the allow-list endpoint is live on prod
serving all three marketplaces. Nothing in this folder is a routing fix.

What is here: **defaults that point at the wrong marketplace**, **one upload-ordering problem**,
and **comments that are now false and will mislead the next person**.

⚠️ **Prod rules apply.** This repo deploys to `api.101recycle.greenbidz.com` from
`release/sales-live`. Everything below goes to **dev first** (`testapi.greenbidz.com`, branch
`dev`, DB `greenbidz_test`), and anything prod-adjacent needs explicit approval at the time — an
approval for one step does not carry to the next.

---

## Order

| # | work | why here |
|---|---|---|
| 1 | [mobile-config](mobile-config.md) §1 — correct the stale recycle comment | a comment that currently tells someone it is safe to widen |
| 2 | [site-type-defaults](site-type-defaults.md) §1 — stop defaulting to recycle | silent mis-filing to the one disabled marketplace |
| 3 | [grouped-submit](grouped-submit.md) §4 — delete the false client-side comment | it already caused one wrong audit |
| 4 | [site-type-defaults](site-type-defaults.md) §4 — one source for the marketplace list | makes adding a marketplace a single edit |
| 5 | [grouped-submit](grouped-submit.md) §1 — mixed-lot rejection | the server is right; the fix is mostly client-side |

§1 and §3 are comment-only, carry no runtime risk, and remove the two things most likely to cause
the next wrong decision. Worth doing immediately and separately from anything behavioural.

---

## The one thing to be careful about

**§2 changes what happens to malformed input on a live write path.** Today an unknown marketplace
becomes recycle; the proposal is to make it an error. That converts silent mis-filing into visible
failure, which is right — but it means a client that is currently getting away with sending
something unrecognised starts getting 400s.

Before changing the default, find out whether anything does. Query the stored rows for listings
created on site 1 (recycle) via the mobile paths — if mobile has never legitimately created a
recycle listing, any that exist arrived through the `?? 1` default and are evidence of a caller
that will break. Do this on prod data, read-only, before touching dev code.

---

## Index

- [site-type-defaults.md](site-type-defaults.md)
- [grouped-submit.md](grouped-submit.md)
- [mobile-config.md](mobile-config.md)
