# Solutions — product lookup (`app/tools/get_product.py`)

Answers [`../Problem/product-lookup.md`](../Problem/product-lookup.md).

**The smallest change in the whole programme with a user-visible effect**: one import, one call.

---

## 1 Use the federated resolver

```python
-from app.db.site_scope import DEFAULT_SITE_IDS, resolve_site_ids
+from app.db.site_scope import DEFAULT_SITE_IDS, resolve_marketplace_site_ids
...
-    site_ids = resolve_site_ids(site_type)
+    site_ids = resolve_marketplace_site_ids(site_type)
```

**Why this is safe rather than a widening of access.** `resolve_marketplace_site_ids` delegates to
`resolve_site_ids` first and widens only when the result is a subset of `DEFAULT_SITE_IDS`
(`site_scope.py:85-88`). So:

- the three public sites federate — the intended change;
- recycle (1), greenbidz (3), greenx (4) are returned **unchanged**, so no non-public site becomes
  reachable;
- unknown / empty input still lands on `DEFAULT_SITE_IDS`, which is the same list;
- `"all"` / `"*"` still returns `None` and is still caught by the existing guard at `:81-84`.

The tool is also already written to handle a federated list — `:83` falls back to
`list(DEFAULT_SITE_IDS)`, which is `[5, 2, 6]`, on the admin path. The federated behaviour exists
in this file today; it is simply only reachable where the public cannot go.

### Fix the docstring in the same commit

`get_product.py:21` currently says *"site_ids **MUST** come from `resolve_site_ids(...)`"*. Left
in place it is a standing instruction to undo this change. Replace it with the reason — this tool
resolves what search returned, so it must share search's scope.

### Test

Assert that a product on site 5 or 6 is found for a `labgreenbidz` context. If a repo-level test
is awkward, test `_get_product_impl` directly — the module is explicitly structured for that
(`:15-18`, *"ALL business logic lives in the plain coroutine `_get_product_impl` so unit tests can
import and call it directly"*).

The regression this pins is specific: **anything `search_products` can return, `get_product` must
be able to resolve.** Phrase the test name that way, because that is the invariant, not the
resolver name.

---

## 2 Stop reporting "wrong site" as "not found"

Four conditions currently collapse into `{"found": False}` — not-found, draft, NETWORK, wrong-site
(`:26-27`). The model cannot tell a scoping boundary from a deleted product, so it phrases a
scoping miss as absence.

Add a reason to the envelope — `{"found": False, "reason": "out_of_scope"}` vs `"not_found"` —
and let the persona say something truthful when it is the former.

Worth doing **even after §1**, because §1 fixes today's instance and this fixes the class. Any
future scoping mismatch then surfaces as a visibly odd answer rather than a plausible lie.

⚠️ Whatever the model is allowed to say about it must respect `CHATBOT_RULES.md` — in particular
never leaking internals or raw ids. *"I can't open that one from here"* is within the rules;
naming site ids is not.

---

## 3 No separate work

Problem §3 is the explanation of why §1 is live rather than theoretical. Fixed by §1.

---

## 4 Remove the asymmetry the guard creates

Once §1 lands, the `if site_ids is None` guard at `:81-84` still resolves the admin path to
`DEFAULT_SITE_IDS`, which now equals what every other path gets. Keep the guard — it is what stops
a tool ever seeing no-filter — but update its comment, which currently reads as though the default
is a *narrowing* ("keep the gate closed"). After §1 it is simply the same scope as everyone else.

---

## 5 Reproduce before and after

Problem §5 notes this was traced, not observed. Do one live conversation both sides of the change:

1. search for something that returns a 101machine or 101it result;
2. ask a follow-up about that specific item;
3. before the fix, expect a "cannot find it" style answer; after, expect the product.

That also confirms the premise the whole finding rests on — that the client really does send a
`site_type` the narrow resolver recognises — which was read from app source rather than captured
off the wire.
