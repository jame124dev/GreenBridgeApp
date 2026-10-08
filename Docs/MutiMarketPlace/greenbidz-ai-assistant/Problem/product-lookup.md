# Module: product lookup — `app/tools/get_product.py`

The tool the agent calls when a user asks about a specific product. **The one place in the
assistant where the resolver split produces a user-visible failure.** No fixes.

---

## 1 ⛔ Search finds a product; the follow-up question says it does not exist

Two tools, two scopes, one conversation:

| step | tool | resolver | scope for a `labgreenbidz` session |
|---|---|---|---|
| "show me centrifuges" | `search_products.py:154` | `resolve_marketplace_site_ids` | `[5, 2, 6]` — all three |
| "tell me about the second one" | `get_product.py:72` | `resolve_site_ids` | `[2]` — 101lab only |

So any result the seller or buyer was just shown from **101machine (site 5)** or **101it
(site 6)** cannot be looked up by the tool that answers questions about it.

`get_product.py:72`:

```python
site_type: str | None = getattr(getattr(ctx, "context", None), "site_type", None)
site_ids = resolve_site_ids(site_type)
```

---

## 2 The failure is indistinguishable from "this product does not exist"

The module's own docstring (`get_product.py:26-27`) states the behaviour:

> Returns `tool_envelope("product", {"found": False})` for any non-matching row (not-found /
> draft / NETWORK / **wrong-site**) — never raises.

Four distinct conditions collapse into one `found: False`. "Wrong site" — which here means
*"correct site, wrong resolver"* — is reported identically to a product that was deleted.

The model therefore receives no signal that it has hit a scoping boundary, and will phrase the
answer as absence. The user sees the assistant list a product and then deny it exists.

This is the worst possible failure mode for a chat surface: it is silent, it is plausible, and
the person has no way to tell it from the truth.

---

## 3 It is reachable on every 101lab session, which is all of them

The mobile client hardcodes `site_type: 'labgreenbidz'`
(`GreenBridgeApp/src/features/lab/hooks/useLabTurn.ts:53`), which is a **known** key
(`site_scope.py:32`), so it resolves to exactly `[2]`.

Had the client sent an unrecognised string, `resolve_site_ids` would have fallen back to
`DEFAULT_SITE_IDS` (`:67`) — the same `[5, 2, 6]` — and the two tools would have agreed by
accident. The precision of the client's value is what exposes the inconsistency.

---

## 4 The admin-path guard quietly widens the scope in one case

`get_product.py:81-84`:

```python
if site_ids is None:
    # Admin "all" path — resolve to default to keep the gate closed for this tool.
    site_ids = list(DEFAULT_SITE_IDS)
```

So when `site_type` is `"all"`/`"*"` this tool resolves to `[5, 2, 6]` — and **works across all
three marketplaces**, which is the behaviour every session should have had.

The guard is correct for its stated purpose (never let a tool see everything). But it means the
tool already contains the federated list, used only on the path public callers cannot reach.

---

## 5 Not observed, only traced

`<VERIFY>` — this has not been reproduced in a live conversation. The trace is short and each
link is cited, but confirming it needs one chat session: search for something that returns a
101machine or 101it result, then ask a follow-up about that specific item.

Worth doing before acting, because the whole finding rests on the client sending a resolvable
`site_type`, and that was read from the app source rather than captured off the wire.
