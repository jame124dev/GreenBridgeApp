# Problems — `greenbidz-ai-assistant`, multi-marketplace only

Same structure as the app's `ProblemScreen/`, but a backend has no screens, so the unit is a
**module**. One file per module.

**Scope:** 101lab + 101machine + 101it. Only what is wrong once more than one marketplace is in
play. **No fixes** — those are in [`../Solution/`](../Solution/README.md).

Audited 2026-10-08. Every claim carries `file:line`. `<VERIFY>` marks what was inferred rather
than observed.

---

## Index

| module | file | worst problem |
|---|---|---|
| Site scoping | [site-scoping.md](site-scoping.md) | two resolvers, nine call sites, no stated rule for which to use |
| Product lookup | [product-lookup.md](product-lookup.md) | search finds a product, the follow-up question says it does not exist |
| Seller tools | [seller-tools.md](seller-tools.md) | a seller's own activity on 101machine / 101it is invisible in chat |

---

## The shape of all three

There are two site resolvers in `app/db/site_scope.py`:

- **`resolve_site_ids`** (`:50`) — one site. `labgreenbidz → [2]`, `machines → [5]`, `101it → [6]`.
- **`resolve_marketplace_site_ids`** (`:70`) — the three public sites federate into one searchable
  marketplace, `[5, 2, 6]`. Non-public sites (recycle 1, greenbidz 3, greenx 4) stand alone.

The federated one was written for exactly this programme, and its docstring says so:

> A buyer on any one of them discovers listings across all three, so the conversational chat
> search reaches the same inventory the Want-to-Buy matcher does (they share this resolver).

**Two tools use it. Seven use the narrow one.** Nothing in the codebase states which a new tool
should pick, so the split is a matter of which file was written when.

| federated `[5,2,6]` | narrow `[one]` |
|---|---|
| `tools/search_products.py:154` | `tools/get_product.py:72` |
| `tools/search_from_image.py` (delegates to `_search_products_impl`) | `tools/get_catalog_summary.py:143` |
| `wtb/match.py:308`, `:356` | `tools/get_marketplace_overview.py:70` |
| | `tools/get_recent_batches.py:77` |
| | `tools/get_my_bids.py:85` |
| | `tools/get_bids_on_my_listings.py:95` |
| | `tools/get_seller_activity.py:90` |

---

## What makes it live rather than theoretical

The mobile client sends a **hardcoded** `site_type` on every chat turn —
`GreenBridgeApp/src/features/lab/hooks/useLabTurn.ts:53`:

```ts
const SITE_TYPE = 'labgreenbidz';
```

`'labgreenbidz'` **is** in `TYPE_TO_SITE_ID` (`site_scope.py:32`), so it resolves cleanly to `[2]`
— 101lab only — through the narrow resolver, and to `[5, 2, 6]` through the federated one.

That is what turns the table above into observable behaviour: within one conversation, search
spans three marketplaces and every narrow tool answers for one. Had the client sent an
*unrecognised* string the narrow resolver would have fallen back to `DEFAULT_SITE_IDS` and the two
would have agreed by accident.

⚠️ The hardcoded constant is itself an app-side problem — it is not even `getSiteType()`, so it
would not follow a build configured for another marketplace. Recorded here because it is the
upstream cause; the fix belongs in
[`../../GreenBridgeApp/ProblemScreen/lab-chat.md`](../../GreenBridgeApp/ProblemScreen/lab-chat.md).

---

## Checked and found correct

- **`wtb/match.py`** (`:308`, `:356`) — uses the federated resolver, so Want-to-Buy matching
  reaches all three marketplaces. This is the behaviour search was deliberately aligned with.
- **`resolve_site_ids` fail-closed behaviour** (`:50-67`) — `None`/`""`/unknown all resolve to
  `DEFAULT_SITE_IDS`, never to "no filter"; `"all"`/`"*"` returns `None` and is blocked for public
  callers at schema validation (`api/chat.py:224`, `:490` — *"Validation error (e.g.
  site_type='all')"*). Any change must preserve this.
- **Meilisearch filter construction** (`search/catalog.py:76-78`) — builds
  `site_id IN [...] OR allowed_sites IN [...]` from whatever list it is given, and applies no
  filter only when the list is `None`. Correct at its own level; it is the caller's choice of
  resolver that decides the scope.
