# Ship blockers

What must not reach App Review. The counts here are asserted by
[`v2Inventory.test.ts`](../../src/__tests__/v2Inventory.test.ts) — add one and
the test fails.

## Five controls explain themselves instead of working

Guideline **2.1 (App Completeness)** treats a visible control that only explains
itself as an unfinished app. Each of these prints a sentence rather than acting.

| # | Screen | Control | Says |
|---|---|---|---|
| 1 | 2b | Review bid | the bid confirmation step is not built; nothing sent |
| 2 | 2a | Make offer | offers are not rebuilt in this UI |
| 3 | 2a | Message seller | this lot is sample data, so there is no seller |
| 4 | 7c | Category → Choose | the picker is a separate screen, not rebuilt |
| 5 | 7b | Rearrange | reordering photos is not wired up |

**Two were closed on 2026-09-16** — 7b's and 7c's *Save as draft*. They now do
what 7d and 7e already did: commit locally, then `router.back()`. No sentence.

That was not just tidying. Their notices were **false**: they said "what you
just typed is not stored yet" while `COMMIT_FIELD_EDITS` is `true`, so the edits
were already in MMKV — `commit()` on blur in 7c, `onPickMarketplace` on tap in
7b. The draft genuinely is on the device and resumable; only the server POST is
missing, and that stays a `TODO(v2-writes)`. Two file-top docblocks also claimed
the flag was off while the declaration sixty lines below read `= true`; both
corrected.

Item 7 was also miscounted. The marketplace pick was never deferred —
`onPickMarketplace` commits to MMKV — so 7b had one deferred control, not two.

**These replaced something worse.** Every one used to be a bare
`onPress={() => haptics.tap()}` — a buzz and nothing. A buzz is worse than
silence: it confirms the tap landed, so a missing screen reads as a hang rather
than an unfinished feature. Saying so costs nothing and writes nothing. But the
sentence must not ship: wire the control or remove the affordance.

*(The count was 8 on the very first pass. `matches.tsx` mentions `defer()` in a
comment explaining what it does instead of one — that control is a real
navigation. The test filters comments for this reason.)*

## ~~One control says nothing and does nothing~~ — CLOSED, removed

Added and closed 2026-09-16, after the T7 audit. Kept here rather than deleted,
because the reasoning is what stops it being re-added from the canvas.

| Screen | Control | What happened |
|---|---|---|
| 2a | **Save this lot** (the heart) | filled in, persisted nothing, for anyone — **now removed** |

**Resolved: the affordance is gone.** `app/v2/lot.tsx` no longer renders it, and
`v2Inventory.test.ts` → `has no save control that pretends to save` keeps it
gone. It is listed apart from the five above because it failed in the opposite
direction, and that direction is harder to catch.

The five above are honest: they explain that they are unfinished. The heart
*lies*. It is local `useState`, so it animates to "saved" and the intent is gone
on unmount — a guest and a signed-in user get exactly the same nothing, and
neither is told. Under Guideline 2.1 a control that appears to succeed is a
weaker position than one that admits it is unbuilt.

It is NOT in the five-control count and must not be added to it — that count is
asserted by `v2Inventory.test.ts` against a specific failure shape (a notice
string). This one has no notice to match on, which is precisely the point.

**The backend is not the obstacle.** `POST /api/v1/wishlist/{userId}/toggle`
exists and is mounted at `app.js:439`
(`101recycle-greenbidz-backend/routes/wishlistRoutes.js`), and `nextjs-port`
calls that family from 12 sites across 8 files. Two things block wiring it here:

1. **This app has no wishlist client at all** — nothing in `GreenBridgeApp` calls
   those routes today.
2. **`app/v2/lot.tsx` renders `MOCK_LOT`**, which has no real product id. There
   is nothing to save until the lot is real.

⚠️ **Before anyone wires it:** those five routes have **zero** auth middleware
and read `userId` straight from the URL path — `const { userId } = req.params`
with only an `if (!userId)` presence check
(`controller/wishlistController.js:13`). Any caller can read or modify anyone
else's wishlist by changing a number in the URL. That is a pre-existing
server-side IDOR on a live endpoint, not something this screen introduces, but
adding a second client to an unauthenticated route widens it. Fix the route
before wiring the heart — and note the same class of bug was already found and
fixed once on `/chat/*` (memory `project_chat_auth_idor_prod`).

**Decided 2026-09-16: removed.** Gating it would have fixed only the guest half
and left it silently broken for everyone signed in. Full reasoning in
[DECISION-LOG.md](DECISION-LOG.md); the vulnerability write-up is
[SECURITY-WISHLIST.md](SECURITY-WISHLIST.md).

## Three writes are held, and that is fine

Different category, no action needed before review:

- **7d and 7e · Save as draft** genuinely commit locally and navigate back — the
  draft is on the device and resumable. Only the server POST is outstanding,
  documented as `TODO(v2-writes)`. Nothing claims it reached the server.
- **7e · Submit listing** is correctly `disabled` by the completeness gate; on a
  draft with no category it cannot be pressed at all.

## Two gaps that are not controls

- **3a does not open at all** — see [STATUS.md](STATUS.md). If v2 ships with an
  entry point to this screen, it ships a dead route.
- **v2's only entry point is dev-gated** (corrected 2026-09-16 — this line used
  to read "v2 has no entry point", which stopped being true when T1 landed). The
  single door is a row on `app/(lab)/(tabs)/account.tsx:163`, wrapped in
  `V2_UI_ENABLED`, which is `process.env.EXPO_PUBLIC_V2_UI === '1'`
  (`src/lib/flags.ts:120`) — opt-in, so **off** in any build a real user gets.
  That flag is now the only thing standing between this list and App Review.
  Treat flipping it as the moment every item above becomes urgent, and note that
  `EXPO_PUBLIC_*` is inlined at bundle time: turning it on needs a Metro
  restart, not a reload.

## Before submitting, re-run

```
npx jest src/__tests__/v2Inventory.test.ts
```

A failure means this file is out of date, not that the build is broken.
