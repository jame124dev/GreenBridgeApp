# Problems per screen — multi-marketplace only

One file per screen. Each lists **only what is wrong on that screen once the app serves more than
one marketplace** (101lab + 101machine + 101it).

**Deliberately out of scope:** general UI/UX, copy, accessibility, performance, auth — anything
that would be equally wrong in a single-marketplace app. If a problem would still exist with only
101lab enabled, it does not belong in this folder.

**No fixes here.** This pass is problem-finding only; remedies come later. Nothing below proposes
a change.

Audited 2026-10-08. Every claim carries the `file:line` it came from. Anything inferred rather
than observed is marked `<VERIFY>`.

---

## Index

| screen | file | worst problem on it |
|---|---|---|
| Review a single item | [scan-detail.md](scan-detail.md) | price currency does not follow the marketplace |
| Review hub (multi-item) | [scan-grouped-review.md](scan-grouped-review.md) | a mixed **lot** is rejected by the server only after every photo has uploaded |
| Item editor (multi-item) | [scan-grouped-edit.md](scan-grouped-edit.md) | the per-item marketplace is the one the hub cannot see until Save |
| Detection / what we found | [scan-detection.md](scan-detection.md) | per-item marketplace is returned by the server and never shown |
| Published / success | [scan-success.md](scan-success.md) | never says which marketplace the item went to |
| My inventory | [v2-drafts.md](v2-drafts.md) | a draft never shows which marketplace it is for |
| AI chat | [lab-chat.md](lab-chat.md) | every listing saved from chat is stamped 101lab |
| v2 review — photos | [v2-scan-review-photos.md](v2-scan-review-photos.md) | correct here, and that is the problem: it diverges from the legacy twin |

---

## The cross-cutting problem: two scan flows, both alive, diverging

There are **two complete scan review flows** in the binary:

- **legacy** — `app/scan/detail.tsx` (one screen, all fields), plus `grouped-review` /
  `grouped-edit` for multi-item
- **v2** — `app/v2/scan/review/{photos,details,pricing,location}.tsx` (four screens)

Both are reachable. `EXPO_PUBLIC_V2_UI=1` makes `/v2` the home (`postAuthLanding.ts`), yet the
screen that rendered on the device on 2026-10-08 was the **legacy** `app/scan/detail.tsx` —
confirmed because `DetailAppBar`, which draws the "ITEM · REVIEW" header, is imported by that file
and no other.

This matters for marketplaces specifically because **the two flows already behave differently on
marketplace change**: the v2 flow resets the price currency, the legacy flow does not (see
[scan-detail.md](scan-detail.md) §1 and [v2-scan-review-photos.md](v2-scan-review-photos.md)).
Every marketplace-sensitive behaviour has to be correct twice, and today at least one of them is
only correct once.

`routes.ts:54-63` records that the one-screen v2 editor was removed "the same day when the owner
asked for the previous scan flow back", which is how the two came to coexist.

---

## Screens checked and found clean for marketplaces

Listed so their absence reads as deliberate:

- `app/(auth)/*` — login, register, pending, forgot-password. Account creation is
  marketplace-neutral; the seller's marketplace is chosen per listing, not per account.
- `app/scan/camera.tsx`, `app/scan/listing-method.tsx`, `app/scan/reorder-photos.tsx` — no
  marketplace-dependent behaviour.
- `app/v2/account-status.tsx` — seller approval is account-level, not per marketplace.

`<VERIFY>` the v2 dashboard screens (`app/v2/dashboard/*`) and the browse/listing screens
(`app/v2/browse.tsx`, `app/v2/listing/[id].tsx`, `app/v2/listings.tsx`) — not audited in this
pass. Buyer-side discovery is federated server-side (`resolve_marketplace_site_ids`), but whether
these screens label or filter by marketplace has not been checked.
