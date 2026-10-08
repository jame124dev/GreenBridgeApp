# Module: mobile config — `controller/mobileConfigController.js`, `routes/mobileConfigRoute.js`

`GET /api/v1/mobile-config` — the marketplace allow-list the app reads at launch. No fixes.

---

## 0 What is already correct

This module is the best-documented thing in the programme and does its job. Recorded so the
problems below are read in proportion.

- Live on **prod** (`api.101recycle.greenbidz.com`) and **dev** (`testapi.greenbidz.com`), both
  returning `["101lab","101machine","101it"]` — verified 2026-10-08.
- Driven by one env var, `MOBILE_SUPPORTED_MARKETPLACES`, so widening or rolling back is an env
  edit plus `pm2 restart` — no app release, which is the whole reason it exists.
- **Fail-closed**: unset / empty / malformed / entirely-invalid yields `["101lab"]`, which the app
  reads as "locked" — no chip, no routing question. A broken env degrades to old behaviour and can
  never silently unlock everything.
- Imports nothing, touches no DB, needs no migration.
- `parseSupportedMarketplaces` is total — any input at all yields a valid one-or-more-entry list.

---

## 1 ⛔ The guard comment forbidding 101recycle is now false

`mobileConfigController.js:35-41`:

> ⚠️ DO NOT WIDEN THIS. In particular 101recycle must NOT be offered until the app's recycle
> category tree (M-1) ships inside a store BINARY — integration constraint C2. Until then a routed
> recycle item gets a cleared categoryId and cannot be submitted.

**C2 is satisfied.** The `101recycle` branch of `endpointForMarketplace`
(`GreenBridgeApp/src/services/scanner/fetchCategories.ts:65`) is in the shipped iOS 1.0.4 build
(EAS build 25, commit `023715f7` — confirmed by `git cat-file`), with
`recycleCategoryEndpoint.test.ts` and `recycleCategoryShape.test.ts` covering it.

So the stated technical blocker no longer exists. Recycle is still correctly withheld, but for a
**different** reason — category accuracy measured 46% and the taxonomy fix was never approved.

A comment that gives a resolved reason for a live prohibition is worse than no comment: someone
who checks C2, finds it satisfied, and widens the env is following this file's own instructions
and would be wrong.

---

## 2 Rollback is not as immediate as the design implies

The module's premise — *"withdrawing one marketplace means another App Store review cycle"*
without this endpoint — is right about the direction but understates the lag on the way back.

Two caches sit in front of a withdrawal:

- **HTTP** — the controller sets `Cache-Control: public, max-age=300`, so up to 5 minutes.
- **The app's MMKV cache** — `supportedMarketplacesCache.ts` keeps the last good list under
  `scan.supportedMarketplaces` and `writeCachedSupported` *"never caches an empty list over a good
  one"*. `supportedNow()` returns the cache whenever a fetch has not succeeded.

So a seller who has already fetched three marketplaces keeps seeing three until a **successful**
fetch returns fewer. Withdrawing is fast but not atomic, and nothing in this module says so — it
is documented only on the client side.

---

## 3 Order is encoded here and is a UI decision

`KNOWN_MARKETPLACES` (`:30`) — *"Order matters: the app renders the picker in this order."*

So the sequence a seller sees in the marketplace picker is set by a constant in a backend
controller, and reordering the **env var** does nothing. That is a reasonable implementation but
it puts a presentation decision in a place no designer will look, and the only record of it is
this one comment.

---

## 4 Three copies of the marketplace list must stay in lockstep

`:27-30` says so explicitly:

> Must stay in lockstep with the app's `MarketplaceKey` union
> (`GreenBridgeApp/src/stores/scanDraftStore.ts:108`) and with `KNOWN` in
> `GreenBridgeApp/src/features/scanner/routing/supportedMarketplacesCache.ts`.

Naming the two files is good practice; nothing enforces it. Adding a marketplace means editing
three lists across two repos — four if the assistant's `TYPE_TO_SITE_ID` is counted — with no
failing test if one is missed. See [site-type-defaults.md](site-type-defaults.md) §4.

---

## 5 The route is public and unauthenticated

By design (`mobileConfigRoute.js:7`) — the app prefetches it at launch, before login.

Not a defect. Noted because the body is now a de-facto public statement of which marketplaces are
live, readable by anyone, and it will be the first place an outside observer learns that a fourth
is being prepared. If the timing of a marketplace launch is commercially sensitive, this endpoint
announces it.
