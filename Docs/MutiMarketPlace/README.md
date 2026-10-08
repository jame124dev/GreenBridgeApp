# Multi-marketplace on mobile — what each codebase still needs

**Scope: 101lab + 101machine + 101it.** 101recycle is deliberately out (see below).

**Audience:** the engineers who will make these changes. Each folder below is one repo, and its
`UPDATES.md` lists only what that repo has to change — with the evidence for the claim, so nobody
has to re-derive it.

Audited 2026-10-08 against live prod, the shipped binary, and the code. Everything stated as fact
here was checked in that pass; anything not checked is marked `<VERIFY>`.

---

## Where it already stands

The unlock is **further along than it looks**, and most of the surprise is that it is already live:

| | state | evidence |
|---|---|---|
| Server allow-list | **live on prod and dev**, returning all three | `GET /api/v1/mobile-config` → `{"supported_marketplaces":["101lab","101machine","101it"]}` on `api.101recycle.greenbidz.com` and `testapi.greenbidz.com` |
| iOS app reads it | **shipped** in 1.0.4 (25) | EAS build 25, commit `023715f7`; that commit contains `supportedMarketplaces.ts`, `supportedMarketplacesCache.ts`, `RoutingChip.tsx` and the `_layout.tsx` launch prefetch |
| Category trees | **live for all three on prod** | `product/lab/category` 4 top-level · `product/machines/category` 13 · `product/it/category` 6 |
| Scan submit | **marketplace-driven** | `buildFormData.ts:223` `allowed_sites[]`, `createProduct.ts:25` / `createBatch.ts:32` / `submitGroupedListings.ts:171` `?type=` |
| Chat **search** | **already federated across exactly these three** | `search_products.py:154` → `resolve_marketplace_site_ids` → site ids `[5, 2, 6]` = machines, LabGreenbidz, 101IT (`app/db/site_scope.py:70-88`) |
| Chat **save a listing** | ⛔ **always stamps 101lab** | `app/(lab)/chat.tsx:176` passes `getSiteType()`, the build-time env, pinned `LabGreenbidz` in every `eas.json` profile |
| Android | ⛔ **not published** | the Play listing page returns no title; so all of the above is iOS-only in users' hands |

So there is **no release needed to turn 101machine and 101it on** — that part is done. What is left
is one app-side defect, one assistant inconsistency, and the Android publish.

---

## One repo per folder

Each repo folder holds three things: an `UPDATES.md` (the repo-level summary), a problem folder
(what is wrong, no fixes) and a solution folder (what to do, mirroring the problem files section
for section).

| repo | summary | problems | solutions |
|---|---|---|---|
| the mobile app | [UPDATES.md](GreenBridgeApp/UPDATES.md) | [ProblemScreen/](GreenBridgeApp/ProblemScreen/README.md) — 8 screens | [SolutionScreen/](GreenBridgeApp/SolutionScreen/README.md) |
| the Node API | [UPDATES.md](101recycle-greenbidz-backend/UPDATES.md) | [Problem/](101recycle-greenbidz-backend/Problem/README.md) — 3 modules | [Solution/](101recycle-greenbidz-backend/Solution/README.md) |
| the Python assistant | [UPDATES.md](greenbidz-ai-assistant/UPDATES.md) | [Problem/](greenbidz-ai-assistant/Problem/README.md) — 3 modules | [Solution/](greenbidz-ai-assistant/Solution/README.md) |

The app's folders are named `ProblemScreen` / `SolutionScreen` because its unit is a screen; the
two backends have no screens, so theirs are `Problem` / `Solution` and the unit is a module.

### The two findings that matter most

1. **`get_product` cannot resolve what search returns** — chat search federates across all three
   marketplaces, the follow-up lookup does not, and the miss is reported as "not found". A live,
   user-visible break. [assistant Problem/product-lookup.md](greenbidz-ai-assistant/Problem/product-lookup.md)
2. **Chat saves every listing as 101lab** — the one required code change in the programme.
   [app ProblemScreen/lab-chat.md](GreenBridgeApp/ProblemScreen/lab-chat.md)

### ⚠️ A correction worth reading before the rest

An earlier version of this audit named "mixed-marketplace batches are silently mis-filed" as the
worst finding. **That was wrong.** The server resolves each product's marketplace from that
product's own `allowed_sites` (`groupedListingSubmitService.js:180-186`, `:407`); the batch-wide
`?type=` only feeds an admin email. The real constraint is narrower — a mixed **lot** is rejected,
and only after the whole upload. Corrected in place and logged in `MISTAKES.md`.

### Repos that need nothing, stated so the absence is deliberate

- `nextjs-port/` (101lab.co), `101recycle-greenbidz-frontend/` (101machines.com), `admin-panel/`,
  `GreenBridgeSeller*` — all web surfaces. Each already serves its own marketplace by
  `site_type`/`VITE_SITE_TYPE`; nothing about the **mobile** unlock touches them.
- `greenbidz-scraper/` — feeds the Sourcing Engine, unrelated to marketplace routing.

---

## 101recycle — why it is out, and what changed

The original block was integration constraint **C2**: recycle must not be offered until the app's
recycle category tree ships inside a store binary, or a routed recycle item gets a cleared
`categoryId` and cannot be submitted. That constraint is now **satisfied** — the `101recycle` branch
of `endpointForMarketplace` is in the shipped 1.0.4 commit, so recycle could be enabled by the same
one-line env change as the others.

It is held back for a **product** reason instead: category accuracy measured **46% fully correct**,
and 8 of 11 category errors have no reachable correct answer because the taxonomy itself is wrong.
That taxonomy fix was explicitly **not approved** (owner decision #7). Recycle also has the worst
photos, and the "photo isn't clear enough" prompt is concentrated on machines and recycle.

Enabling recycle before someone owns the taxonomy means shipping a 46%-correct category picker to
the marketplace least able to carry it.

---

## Measured baselines (dev, not prod)

From `docs/multi-marketplace/MULTI_MARKETPLACE_PLAN.md` and `SCAN_FLOW_BACKEND.md`, 24 real
equipment photos × 3 runs on the dev backend:

- **routing 89%** (64/72; 22/24 items) — about 1 item in 9 lands on the wrong marketplace, which is
  why the confirmation step exists and why no confidence threshold gates it
- **category 46%** fully correct — the real risk surface
- **`needs_clearer_photo` 37.5%** (9/24), concentrated on machines and recycle

⚠️ None of this has been re-measured on prod; that was owner decision #9 and was **not approved**.
Do not quote these as prod numbers.

---

## Do not drift from the existing plans

The authoritative design work already exists at **`GreenBridgeApp/docs/multi-marketplace/`** —
`MULTI_MARKETPLACE_PLAN.md`, `SCAN_FLOW_BACKEND.md`, `SCAN_FLOW_UX.md` and `phases/PHASE_1..5` plus
`phases/PHASE_INTEGRATION.md`, **which overrides the individual phase docs where they conflict**.

This folder is a per-repo *work list*, not a redesign. If it ever disagrees with
`PHASE_INTEGRATION.md`, that document wins and this one is wrong.

Two integration traps documented there that still apply to any further merge work: **C4** (Phase 5
un-disabling single-mode Submit kills Phase 4's routing gate, because `marketplaceConfirmed` is a
draft field invisible to `detailSchema`) and **C5** (Phases 1 and 2 rewrite the same three server
functions with incompatible bodies; Phase 2 landing second and followed literally drops
`site_type_confidence` and reverts Phase 1).
