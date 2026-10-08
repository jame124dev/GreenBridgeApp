# Module: seller-facing tools — `get_my_bids`, `get_bids_on_my_listings`, `get_seller_activity`, `get_recent_batches`

The tools that answer a seller's questions about their **own** activity. All four use the narrow
resolver. No fixes.

---

## 1 A seller who lists on three marketplaces sees one marketplace's answers

| tool | line | scope |
|---|---|---|
| `get_my_bids.py` | `:85` | `resolve_site_ids` → one site |
| `get_bids_on_my_listings.py` | `:95` | `resolve_site_ids` → one site |
| `get_seller_activity.py` | `:90` | `resolve_site_ids` → one site |
| `get_recent_batches.py` | `:77` | `resolve_site_ids` → one site |

With the mobile client sending `site_type: 'labgreenbidz'`
(`GreenBridgeApp/src/features/lab/hooks/useLabTurn.ts:53`), that is `[2]` — 101lab.

So once the multi-marketplace unlock means a seller genuinely has listings on 101machine and
101it, *"any bids on my listings?"* answers for their 101lab listings only, and omits the rest
without saying so.

---

## 2 This one is genuinely ambiguous, and that is the problem

Unlike [product-lookup.md](product-lookup.md), there is a real argument for the narrow scope here:
a seller asking a question **inside the 101lab app** may well mean "my 101lab business".

But the app does not present itself that way. It is one app, branded GreenBidz, with a marketplace
picker on the listing flow — a seller who was just invited to choose between three marketplaces
when creating a listing has no reason to expect their questions to be scoped to one of them.

Neither reading is written down anywhere, so the current behaviour is a consequence of which
resolver existed when these files were authored, not of a decision.

---

## 3 The answer is silently partial, not flagged as scoped

Whatever the right scope is, none of these tools states the scope in its result.

The envelope carries the data; nothing accompanies it saying *"for 101lab"*. So the model has no
way to qualify the answer and will phrase it absolutely — *"you have 3 bids"* rather than
*"3 on 101lab"*. A seller with bids on 101it is told a number that is wrong for the question they
asked.

This is the same failure shape as [product-lookup.md](product-lookup.md) §2: the scoping boundary
is invisible in the output, so a partial answer is indistinguishable from a complete one.

---

## 4 Seller-side scoping and buyer-side scoping now disagree by default

`wtb/match.py:308` and `:356` use the **federated** resolver, so a seller's Want-to-Buy matches
reach across all three marketplaces.

So within the seller's own experience: WTB matching is federated, their own bids and activity are
not. Two seller-facing answers, two scopes, no stated reason.

---

## 5 Not observed

`<VERIFY>` — no live reproduction. These need a seller account with real activity on more than
one marketplace, which does not exist yet on dev as far as this pass established. Until the
unlock produces such an account the behaviour cannot be confirmed, only read.

Worth stating plainly: this is the one file in this folder describing a problem that is **latent**
rather than currently biting. It becomes real the moment a seller uses the marketplace picker they
already have.
