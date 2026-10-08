# Solutions — seller-facing tools

Answers [`../Problem/seller-tools.md`](../Problem/seller-tools.md).
`get_my_bids`, `get_bids_on_my_listings`, `get_seller_activity`, `get_recent_batches`.

**This one starts with a decision, not with code.** Do not change these files until it is made —
both answers are defensible and the wrong one is worse than the current state.

---

## 1 The decision

> When a seller asks *"any bids on my listings?"*, do they mean **all their listings**, or
> **their listings on this storefront**?

| answer | change | argues |
|---|---|---|
| **all their listings** (recommended) | switch all four to `resolve_marketplace_site_ids` | it is one app, branded GreenBidz, and the seller was just offered a choice of three marketplaces when listing. Scoping their own business to one of them is a distinction they never made. |
| **this storefront** | keep, and qualify every answer | defensible if the product's intent is that the app *is* 101lab, and the marketplace picker is only about where a listing is published |

**Recommended: all their listings.** The seller chose the marketplace per *listing*; nothing in
the product asked them to choose a marketplace for *themselves*. And `wtb/match.py` already
federates seller-side matching (`:308`, `:356`), so "all" is the existing precedent for a
seller-facing answer.

⚠️ Whichever is chosen, note it is **not** the same decision as the catalogue-summary one
([`site-scoping.md`](site-scoping.md) §3). That is about describing the site; this is about the
user's own business. They can legitimately differ.

---

## 2 If "all their listings" — the change

Four one-line swaps to `resolve_marketplace_site_ids`, at `get_my_bids.py:85`,
`get_bids_on_my_listings.py:95`, `get_seller_activity.py:90`, `get_recent_batches.py:77`, plus
the docstring corrections in [`site-scoping.md`](site-scoping.md) §4.

Safe for the same reason as `get_product` — the federated resolver delegates to the narrow one
and widens only within `DEFAULT_SITE_IDS`, so no non-public site becomes visible and ownership
filtering is untouched.

**Ownership is what protects this data, not site scope.** Confirm that before shipping: these
tools must already filter by the authenticated seller, with the site list as a secondary
constraint. If any of them relies on the site filter to limit rows to the caller, widening it
widens what the caller sees. `<VERIFY>` — not checked in this pass, and it is the one way this
change could be unsafe.

---

## 3 If "this storefront" — the change

Keep the resolver; make the scope visible. Each tool's envelope carries which site it answered
for, and the persona qualifies the answer: *"3 bids on your 101lab listings"*.

Without that, a partial answer is indistinguishable from a complete one — the same failure shape
as [`product-lookup.md`](product-lookup.md) §2, and the reason that fix is recommended
independently of which way this decision goes.

---

## 4 Either way: make the seller-side scopes agree

Today WTB matching federates and the other four do not, with no stated reason. After the decision,
either `wtb/match.py` joins them in the narrow scope, or they join it in the federated one.

Leaving the split is the one outcome to avoid — it is what produced this whole folder.

---

## 5 Verification needs data that does not exist yet

This is latent: it bites once a seller genuinely has activity on more than one marketplace, and
no such account was found on dev in this pass.

So **create one** as part of the work — a seller with a listing and a bid on each of 101lab,
101machine and 101it — rather than shipping on reasoning alone. That account is also what any
future multi-marketplace test needs, so the cost is not specific to this item.

Until it exists, treat any claim about these four tools' live behaviour as unverified, including
the ones in the problem doc.
