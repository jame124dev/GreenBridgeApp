# `101recycle-greenbidz-backend/` — what has to change

**No code changes for 101lab + 101machine + 101it.** The work here is already shipped and already
switched on. What follows is operational: knowing which knob controls it, confirming parity, and
knowing how to roll back.

Audited 2026-10-08. See [`../README.md`](../README.md) for the programme-level picture.

---

## 1 The knob, and what it already says

The app's marketplace allow-list is served by one public, unauthenticated, DB-free route:

- `routes/mobileConfigRoute.js` → `GET /api/v1/mobile-config`
- `controller/mobileConfigController.js` → `getMobileConfigController`

It is driven entirely by **`MOBILE_SUPPORTED_MARKETPLACES`** in the server's `.env`:

```
MOBILE_SUPPORTED_MARKETPLACES=101lab,101machine,101it
```

Widening or rolling back is **one env edit plus `pm2 restart`** — no app release, no migration, no
deploy. That is the whole point of the endpoint: withdrawing a marketplace must not cost an App
Store review cycle.

**Verified live on 2026-10-08** — both hosts already return all three:

```
api.101recycle.greenbidz.com/api/v1/mobile-config  →  ["101lab","101machine","101it"]   (prod)
testapi.greenbidz.com/api/v1/mobile-config          →  ["101lab","101machine","101it"]   (dev)
```

`<VERIFY>` the literal `.env` line on each host. The responses above prove the *effective* value;
I did not read the env files, and should not paste their contents anywhere regardless.

The controller is on the prod deploy branch (`release/sales-live`), on `dev`, and on
`origin/main` — checked by `git cat-file`. Local `main` lacks it and is behind.

---

## 2 Behaviour worth knowing before touching it

Read `controller/mobileConfigController.js` before editing — its header carries the reasoning. The
parts that matter operationally:

- **Fail-closed.** Unset, empty, malformed or entirely-invalid input yields `["101lab"]` — exactly
  what app 1.0.3 shipped. The app reads a one-entry list as "locked": no marketplace chip, no
  routing question. So a broken env var degrades to old behaviour and can **never** silently
  unlock everything.
- **Order matters.** The response preserves `KNOWN_MARKETPLACES` order (`101lab`, `101machine`,
  `101it`, `101recycle`) because the app renders the picker in that order. Reordering the env var
  does nothing; reordering the constant changes the UI.
- **The default must not be widened.** `DEFAULT_MARKETPLACES = ["101lab"]` is deliberately one
  entry. Widening the *default* unlocks every environment at once, including any new one someone
  stands up. Widening is meant to be a per-environment, deliberate act.
- **It imports nothing.** Keep it that way — a public read must not be takeable down by an
  unrelated subsystem, and its test suite must not pull in `config/dbConnection.js`.
- Response is cached `public, max-age=300`, so a change takes up to **5 minutes** to reach clients
  that are re-fetching, on top of the app's own MMKV cache.

---

## 3 The app's cache means rollback is not instant

Removing a marketplace from the env does not immediately remove it from installed apps. The client
caches the last good list in MMKV (`scan.supportedMarketplaces`) and falls back to it whenever the
request fails, so a seller who has already fetched three will keep seeing three until a successful
fetch returns fewer.

Plan a withdrawal around that: it is fast, but it is not atomic, and the fallback is intentionally
"last good list", not "locked".

---

## 4 Adding 101recycle later

Technically one env edit — `MOBILE_SUPPORTED_MARKETPLACES=101lab,101machine,101it,101recycle` plus
`pm2 restart`. The app-side blocker (integration constraint C2, the recycle category tree) is
satisfied: that code is in the shipped 1.0.4 binary.

**Do not do it on technical readiness alone.** The controller's own comment still says recycle must
not be offered, written when C2 was unmet; the reason has since changed from technical to product
(category accuracy 46%, taxonomy fix not approved). When recycle is eventually enabled, **update
that comment** so the next person does not read a stale prohibition as current.

---

## 5 Server-side detection is present

The Phase 1 / Phase 2 detection work the unlock depends on is in `controller/wordPressSmart.js` —
`normalizeDetectedSiteType`, `resolveSiteTypeForGroup`, and `site_type` /
`site_type_confidence` in the prompts for all four locales, with the four-way enum
`"LabGreenbidz"|"machines"|"101it"|"recycle"` at line 734.

`<VERIFY>` that the prod deploy branch carries the same revision of this file as the branch you are
reading — I confirmed the controller exists on `release/sales-live` but did not diff the detection
logic between branches.

⚠️ If any further merge work happens here, respect **C5** from `PHASE_INTEGRATION.md`: Phases 1 and
2 rewrite `normalizeDetectedSiteType`, `detectSiteTypeForGroup`'s catch and `resolveSiteTypeForGroup`
with incompatible bodies, and Phase 2 landing second and followed literally **drops
`site_type_confidence` off the wire and reverts Phase 1**. Merged bodies are written out in that
document.
