# Solutions — `greenbidz-ai-assistant`, multi-marketplace

Mirrors [`../Problem/`](../Problem/README.md) file for file, section for section.

Written 2026-10-08. Nothing here has been implemented.

---

## The one decision that resolves most of it

> **For a given tool, is the scope "the storefront the user is on" or "the marketplace they can
> discover across"?**

Every problem in this folder is a consequence of that never being written down. Answer it once,
write it in `site_scope.py`, and the individual tools become mechanical.

The recommended split, as a starting position for that decision:

| kind of question | scope | tools |
|---|---|---|
| **Discovery** — finding things to buy | **federated** `[5,2,6]` | `search_products`, `search_from_image`, `wtb/match`, **`get_product`** |
| **My own business** — my bids, my activity | **DECISION** (see [seller-tools.md](seller-tools.md)) | `get_my_bids`, `get_bids_on_my_listings`, `get_seller_activity`, `get_recent_batches` |
| **This storefront** — what is on *this* site | narrow | `get_catalog_summary`, `get_marketplace_overview` — if that is what they are for |

`get_product` moving into the discovery row is the only change that fixes a live, user-visible
break. Everything else is consistency or latent.

---

## Order

| # | work | why |
|---|---|---|
| 1 | [product-lookup](product-lookup.md) §1 — `get_product` federates | search shows a product, the follow-up denies it exists |
| 2 | [product-lookup](product-lookup.md) §2 — distinguish "wrong site" from "not found" | stops the next instance of this class being silent |
| 3 | [site-scoping](site-scoping.md) §1 — write the rule down, enforce it | prevents the class recurring |
| 4 | [seller-tools](seller-tools.md) — **DECISION** first, then follow | latent until sellers actually use three marketplaces |

§1 alone is a small, safe change worth shipping on its own.

---

## Constraints every change must preserve

Lifted from [`../Problem/site-scoping.md`](../Problem/site-scoping.md) §5, repeated because they
are easy to break while "making scoping consistent":

- unknown / empty `site_type` → `DEFAULT_SITE_IDS`, **never** no-filter (`site_scope.py:57`)
- `"all"` / `"*"` → `None` stays admin-only, blocked for public callers at schema validation
  (`api/chat.py:224`, `:490`)
- non-public sites (recycle 1, greenbidz 3, greenx 4) must **not** be federated —
  `resolve_marketplace_site_ids:86-88` only widens when the resolved ids are a subset of
  `DEFAULT_SITE_IDS`, and that subset test is the guard

---

## Not this repo's problem, but caused here

The mobile client hardcodes `site_type: 'labgreenbidz'`
(`GreenBridgeApp/src/features/lab/hooks/useLabTurn.ts:53`) rather than reading its own build
config. That is what makes the split observable rather than theoretical.

Fixing it app-side **does not** fix anything here — a client sending `'machines'` would simply
move which single marketplace the narrow tools answer for. The two are independent, and this one
is the one that matters for correctness.

---

## Index

- [site-scoping.md](site-scoping.md)
- [product-lookup.md](product-lookup.md)
- [seller-tools.md](seller-tools.md)
