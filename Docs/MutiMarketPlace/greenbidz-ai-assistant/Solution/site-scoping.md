# Solutions — site scoping (`app/db/site_scope.py` and its callers)

Answers [`../Problem/site-scoping.md`](../Problem/site-scoping.md).

---

## 1 Write the rule in the module, then make it enforceable

### The rule

Add to `site_scope.py`, above the two resolvers, as the thing a tool author reads before choosing:

> **Which resolver?**
> `resolve_marketplace_site_ids` — **discovery**: anything that finds, resolves or matches a
> listing the user could buy. Search, image search, product lookup, WTB matching. These must agree
> with each other: anything search can return, every discovery tool must be able to resolve.
> `resolve_site_ids` — **this storefront**: anything that describes the site itself, or the user's
> own relationship to it, where "which site" is part of the question rather than a constraint on
> the answer.

The first half is not a preference — it is an invariant with a failure mode
([`product-lookup.md`](product-lookup.md)). The second half is the open decision
([seller-tools.md](seller-tools.md)).

### Make it hold

A rule in a docstring is what the current narrow tools already have, and it did not hold. Add a
test that **enumerates** the tools in `app/tools/` and asserts each uses the resolver its category
requires, with an explicit exempt-list for anything deliberately neither.

Enumerate from the filesystem, not from a hand-written list. A hand-written list is how the
seventh narrow caller gets missed — this workspace has been bitten twice by prose "done" lists
hiding an item.

---

## 2 Consider making the difference visible in tests

The reason this survived is that `DEFAULT_SITE_IDS` **is** the federated set, so the two resolvers
agree for every unrecognised input and differ only for the six known ones.

So any test written with a vague or absent `site_type` passes under both resolvers and proves
nothing. Tests that care about scope must use a **known** `site_type` — `'labgreenbidz'`,
`'machines'`, `'101it'` — which is also what the real client sends.

Worth a comment beside `DEFAULT_SITE_IDS` saying exactly that, because it is a genuine trap: a
fixture using `site_type=None` will keep passing after someone reverts §1.

---

## 3 Catalogue summary and marketplace overview — **DECISION**

`get_catalog_summary.py:143` and `get_marketplace_overview.py:70`.

> Does *"what do you have?"* mean this storefront's catalogue, or everything the user can
> discover?

| answer | change | consequence |
|---|---|---|
| **federated** | switch both to `resolve_marketplace_site_ids` | the assistant stops contradicting itself; counts get larger and include stock the user cannot see branded as this site's |
| **narrow** (keep) | add a comment at both sites saying so, and qualify the answer | internally consistent, but the model must say *"on 101lab"* or the number is wrong for the question asked |

Either is defensible. **What is not defensible is leaving it undocumented**, because the next
tool author has no way to infer it and the split looks like an oversight.

If "narrow" is chosen, the result envelope should carry the site so the persona can qualify it —
same mechanism as [`product-lookup.md`](product-lookup.md) §2.

---

## 4 Correct the tool docstrings

Five headers assert *"site_ids come from `resolve_site_ids(...)`, same as …"*
(`get_bids_on_my_listings.py:15`, `get_my_bids.py:14`, `get_seller_activity.py:14`,
`get_recent_batches.py:10`, `get_product.py:21`).

Once §1 and §3 settle each tool's category, rewrite those lines to state the **category** and its
reason rather than the function name. A docstring naming a function is a thing to copy; a
docstring naming a reason is a thing to think about.

This is the cheapest item here and the one that prevents the next recurrence, because the wrong
pattern is currently the one that looks like house style.

---

## 5 Constraints — unchanged

No work. [`../Problem/site-scoping.md`](../Problem/site-scoping.md) §5 lists the fail-closed
behaviour, the admin-path block and the non-public-site guard. They are correct today and every
change above preserves them by delegating to `resolve_site_ids` rather than reimplementing the
mapping.

Call this out in review explicitly: a "simplification" that replaces the subset test at
`:86-88` with an unconditional widen would quietly federate recycle, greenbidz and greenx.
