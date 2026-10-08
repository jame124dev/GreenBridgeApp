# Module: site scoping — `app/db/site_scope.py` and its callers

The two resolvers and the rule nobody wrote down. No fixes.

---

## 1 ⛔ Nothing states which resolver a tool should use

`resolve_site_ids` (`:50`) and `resolve_marketplace_site_ids` (`:70`) both exist, both are
exported, both are correct, and the module explains what each **does** — but not **when to use
which**.

`resolve_marketplace_site_ids`'s docstring gives the rationale for federating:

> the three public-facing sites — Machines (5), LabGreenbidz (2), 101IT (6) — federate into a
> single searchable marketplace. A buyer on any one of them discovers listings across all three

That is a statement about **discovery**. It does not say that discovery is the only case, or name
the cases it is not. So a tool author picks by precedent, and the precedent is split seven to two.

The consequence is not one bug but a **class** of bug, of which
[product-lookup.md](product-lookup.md) is the first instance found. Any new tool added today has
a 50/50 chance of being wrong, and nothing will catch it.

---

## 2 The default is the federated list, which hides the inconsistency

`DEFAULT_SITE_IDS = [5, 2, 6]` (`:43`) — the fallback for `None`, `""` and any unrecognised
`site_type` — **is** the federated set.

So the narrow resolver returns the federated answer for every input it does not recognise, and
differs only for the six it does. A caller that passes a vague or absent `site_type` sees both
resolvers behave identically, and the split only appears once a precise, known value arrives.

That is why this survived: the inconsistency is invisible in exactly the conditions under which
someone would casually test it.

---

## 3 "Marketplace overview" and "catalogue summary" answer for one site

`get_marketplace_overview.py:70` and `get_catalog_summary.py:143` both use the narrow resolver.

In one conversation a user can ask *"what do you have?"* and get a figure for 101lab, then search
and be shown results from three marketplaces. Both answers are internally correct; nothing
distinguishes them to the person reading.

This one is **arguably intentional** — an overview could legitimately mean "this storefront's own
catalogue". It is recorded as a problem because the reading cannot be recovered from the code:
there is no comment either way, and the two tools sit beside `search_products.py` which chose
differently.

The module header of `get_catalog_summary.py:15` says only *"site_ids come ONLY from
`resolve_site_ids(ctx.context.site_type)`"* — a rule about where the value comes from, not about
which scope is meant.

---

## 4 The tool docstrings assert a rule that is no longer true

Several narrow tools carry a header line of the form *"site_ids come from
`resolve_site_ids(ctx.context.site_type)`, same as …"* — `get_bids_on_my_listings.py:15`,
`get_my_bids.py:14`, `get_seller_activity.py:14`, `get_recent_batches.py:10`,
`get_product.py:21`.

Read together they present a house style — *this is how tools scope* — which `search_products.py`
and `wtb/match.py` no longer follow. A reader auditing one of those files would conclude the
codebase is consistent, and be wrong.

`get_product.py:21` goes further: *"site_ids **MUST** come from `resolve_site_ids(...)`"*. For the
tool that resolves products a search just returned, that stated requirement is the defect.

---

## 5 Properties any change must preserve

Not problems — constraints, recorded so a fix does not break them.

- **Fail-closed on unknown input.** `:57` — *"unknown type → `DEFAULT_SITE_IDS` (security: never
  'no filter')"*. An unparseable `site_type` must never widen to everything.
- **The admin path is not reachable publicly.** `"all"`/`"*"` → `None` → no filter, and
  `api/chat.py:224` / `:490` document the 422 that blocks it at schema validation.
- **Non-public sites stand alone.** `resolve_marketplace_site_ids:86-88` only widens when the
  resolved ids are a subset of `DEFAULT_SITE_IDS`, so recycle (1), greenbidz (3) and greenx (4)
  are returned unchanged. Any new federation must keep that test rather than widening
  unconditionally.
