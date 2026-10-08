# Solutions — v2 review, photos & marketplace (`app/v2/scan/review/photos.tsx`)

Answers [`../ProblemScreen/v2-scan-review-photos.md`](../ProblemScreen/v2-scan-review-photos.md).

This screen is the one implementing marketplace change correctly. The solutions are about making
that the *only* implementation, not about changing this file's behaviour.

---

## 1 This screen becomes the reference, then stops being special

`photos.tsx:455-466` is the behaviour the other two should have. Lift it into the shared
`marketplaceChangePatch()` helper described in
[`scan-detail.md`](scan-detail.md) §1 — which lives in `routingState.ts`, beside
`CLEARED_CATEGORY_DRAFT_FIELDS` that all three already import — and then call it here too.

Net effect on this file: a few lines shorter, behaviour unchanged. That is the success condition.
If adopting the helper changes what this screen does, the helper is wrong.

Keep the immediate `patch(next)` (`:467`) and its comment. Committing a discrete tap at once is
correct and is the behaviour [`scan-grouped-edit.md`](scan-grouped-edit.md) §2 recommends the
legacy editor adopt.

---

## 2 Decide which flow is canonical — **DECISION, and it gates everything else**

Both flows are reachable and `EXPO_PUBLIC_V2_UI` does not cleanly select between them: the flag
makes `/v2` the home, yet the screen observed on the device on 2026-10-08 was the legacy
`app/scan/detail.tsx`.

**Before deciding, map the entry points.** Which routes lead into `app/scan/*` and which into
`app/v2/scan/*`, under `EXPO_PUBLIC_V2_UI=1`. Until that is known it cannot be said which flow
real sellers use, and therefore which of the two marketplace behaviours is actually in production
today. That is a half-day of reading, and every estimate below depends on it.

Three outcomes:

| decision | consequence |
|---|---|
| **v2 is canonical** | remove the legacy entry points; `scan/detail.tsx` and `grouped-*` become dead and can be deleted. Largest change, smallest end state. |
| **legacy is canonical** | the v2 review screens are dead; port the currency behaviour back (already covered by §1) and delete them. |
| **both stay** | the duplication is permanent and must be managed — see §4. |

Note `routes.ts:54-63` records that the one-screen v2 editor was removed "the same day when the
owner asked for the previous scan flow back", so this has been decided once already and reversed.
That history belongs in the decision.

---

## 3 The four-screen split hides consequences — only worth fixing if v2 wins

Changing the marketplace here clears the category (on `details.tsx`) and resets the currency (on
`pricing.tsx`) — both invisible from this screen.

If v2 becomes canonical, the honest fix is a confirmation at the point of change naming what else
moved: *"Category cleared and price switched to TWD."* One line, shown only when `changed` is
true, using the same information the patch already computed.

Do not build this before §2 is decided. If legacy wins, this screen is deleted.

---

## 4 If both flows stay, make the duplication fail loudly

The realistic outcome of §2 may be "both stay for now". In that case the duplication needs a
guard rather than a promise:

- **one helper, enumerated.** A test that finds every call site offering a marketplace choice and
  asserts each goes through `marketplaceChangePatch`. Enumerate from the codebase, with an
  explicit exempt-list — not three hand-written tests, which is how the third site gets missed.
  This workspace has been bitten twice by prose "done" lists hiding a flat control.
- **a named list of marketplace-sensitive behaviours**, kept with the helper: which category
  endpoint, clearing the category, defaulting the currency, converting the amount, confirming the
  routing, gating submit on `marketplaceConfirmed`. Each new one is added to the helper, not to a
  call site.

Without the enumerating test, "both flows stay" means the next marketplace rule drifts the same
way the currency did — and the drift will again be found by someone reading the code rather than
by a failure.
