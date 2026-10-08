# `greenbidz-ai-assistant/` — what has to change

**Search already works across all three marketplaces, by design.** The only item here is a
decision about two tools that scope differently from search, which makes the assistant contradict
itself within one conversation.

Audited 2026-10-08. See [`../README.md`](../README.md) for the programme-level picture.

---

## 1 ✅ Already correct — chat search is federated across exactly these three

`app/db/site_scope.py:70-88` defines `resolve_marketplace_site_ids`, whose whole purpose is this
programme:

> the three public-facing sites — Machines (5), LabGreenbidz (2), 101IT (6) — federate into a
> single searchable marketplace. A buyer on any one of them discovers listings across all three.

`DEFAULT_SITE_IDS = [5, 2, 6]` (line 43), and `TYPE_TO_SITE_ID` (line 30) maps
`recycle→1, labgreenbidz/LabGreenbidz/send→2, greenbidz→3, greenx→4, machines→5` and `101it→6`.
A non-public single site (recycle 1, greenbidz 3, greenx 4) is returned unchanged — those stand
alone.

Both search entry points use it:

- `app/tools/search_products.py:154` — `site_ids = resolve_marketplace_site_ids(site_type)`
- `app/tools/search_from_image.py:47,229` — delegates to `_search_products_impl`, so photo search
  inherits the same scope rather than duplicating it

**Nothing to change here.** It was built for this and it already covers 101lab + 101machine +
101it.

---

## 2 ⚠️ The decision — two tools answer for one site while search answers for three

| tool | resolver | scope |
|---|---|---|
| `search_products.py` | `resolve_marketplace_site_ids` | **three** (5, 2, 6) |
| `search_from_image.py` | *(delegates to search_products)* | **three** |
| `get_catalog_summary.py:143` | `resolve_site_ids` | **one** |
| `get_marketplace_overview.py` | `resolve_site_ids` | **one** |

So in a single conversation a buyer can ask *"what lab equipment do you have?"* and be told a
number for one site, then search and be shown results from three. Both answers are correct for
their own resolver and the user has no way to know they are different questions.

This is a **product decision, not a bug** — there is a defensible reading either way:

- **Align them to the federated resolver** — "what we have" means the same inventory search
  returns. Most likely what a buyer expects, and makes the assistant internally consistent.
- **Leave them narrow** — an overview is deliberately about *this* storefront's own catalogue,
  which is a reasonable thing for a site-branded assistant to say.

Whichever is chosen, say so in a comment at both call sites, because the current split reads as an
oversight whether or not it is one.

**Not in scope either way:** `get_bids_on_my_listings.py:95` correctly uses `resolve_site_ids` —
it answers about *the seller's own* listings on *their* site, which is not a discovery question.

---

## 3 Security property to preserve in any change

`resolve_site_ids` is deliberately total and fail-closed (`app/db/site_scope.py:50-67`):

- `None` / `""` → `DEFAULT_SITE_IDS`
- a known type → `[that id]`
- an **unknown** type → `DEFAULT_SITE_IDS`, explicitly *"security: never no-filter"*
- `"all"` / `"*"` → `None`, the admin no-filter path, which **public callers must never reach** —
  it is blocked at schema validation

If either tool above is switched to the federated resolver, that property must survive: a garbage
`site_type` must still scope to the three public sites, never to everything. `resolve_marketplace_site_ids`
preserves it today because it delegates to `resolve_site_ids` first and only then widens.

---

## 4 Verification

These findings are **traced through code, not observed on a live conversation.** Before acting on
§2, confirm the behaviour: ask the assistant a catalogue-size question and a search question in one
session and compare what each covers.

Worth doing because the assistant is the one surface where a wrong scope is invisible — a search
that quietly omits two marketplaces looks exactly like a marketplace with no matching stock, and
the no-match path leads with "save a want" rather than an error.
