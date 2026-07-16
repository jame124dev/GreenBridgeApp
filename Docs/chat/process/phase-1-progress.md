# Phase 1 — Behavior-Neutral Refactor · Progress Tracker

> Living changelog for the chat Phase-1 refactor (roadmap: `phase-1-refactor-roadmap.md`).
> Every PR is behavior-neutral, proven by: `tsc --noEmit`, full jest suite, characterization
> snapshots (pixel-identity), the frame-replay net (turn-fold determinism), and lint (no new
> errors). On-device smoke performed on the emulator + a physical device where noted.

**Legend:** ✅ done & verified · 🟡 partial (see notes) · ⏳ not started · ⛔ deferred (Phase 2)

---

## Status board

| PR | Title | Status | tsc | tests | snapshots | frame-replay | lint | device |
|----|-------|--------|-----|-------|-----------|--------------|------|--------|
| 0 | Baseline & guardrails (harness) | ✅ | — | ✅ | baseline | — | warn | — |
| 1 | Scaffold + domain types | ✅ | ✅ | ✅ | — | — | ✅ | — |
| 2 | Theme provider + hooks (light values) | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3A | ThinkingDots + ChatMessage → hooks | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-0 | Compat layer + card snapshot harness | ✅ | ✅ | ✅ | baseline | — | ✅ | — |
| 3B-1 | cardKit primitives → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-2 | Listing-draft family → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-3 | Product family → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-4 | Stat/overview family → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-5 | Buttons/entry/gate → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-6 | List/batch/seller family → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-7 | Multi-product family → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 3B-8 | WTB / soft-card cluster → tokens | ✅ | ✅ | ✅ | unchanged | — | ✅ | — |
| 4 | Extract `useChatController` | ✅ | ✅ | ✅ | unchanged | ✅ built | ✅ | ✅ |
| 5 | Pure turn reducer + effects | ✅ | ✅ | ✅ | re-baselined¹ | ✅ | ✅ | ✅ |
| 6 | `Message` domain model | ✅ | ✅ | ✅ | unchanged | ✅ | ✅ | ✅ |
| 7 | Messages → `conversationStore` (in-mem) | ✅ | ✅ | ✅ | unchanged | ✅ | ✅ | ✅ |
| 8 | Unify render path (delete LiveBotBubble) | ✅ | ✅ | ✅ | unchanged² | ✅ | ✅ | ✅ |
| 9 | CardRegistry (formalize) | ✅ | ✅ | ✅ | unchanged | ✅ | ✅ | — |
| 10 | Motion ownership pass | ✅ | ✅ | ✅ | unchanged | ✅ | ✅ | — |
| 11 | Legacy removal + guardrails | 🟡 | ✅ | ✅ | unchanged | ✅ | ✅ | — |

¹ PR-5 re-baselined one store-shape snapshot for the intended additive `turn.state` field (§11
  `status` projection + all behavior fields byte-identical).
² PR-8 committed goldens byte-identical; one intentional transient change — the live streaming
  bubble adopts the committed border+shadow so streaming ≡ committed (A4 §12.7, user-approved).

---

## Test/verification counts (end of PR-11)
- **25 test suites / 242 tests / 22 snapshots** — all green.
- Frame-replay net: `frameReplay.characterization` (10) + `threadStore.replay` + `labStream.replay`.
- Render isolation (A2 I10): committed boundary 0 re-renders on a token burst; only `StreamingMessage`.
- Lint: 0 new errors in touched files (60 pre-existing project-wide errors in untouched files —
  react-compiler ruleset; tracked for PR-11).

## On-device validation (emulator + physical Redmi, Android 16)
- Real backend stream: seller `product_list` cards render (photos, emerald/gray chips, price).
- Buyer `wtb_draft` interactive card (condition pills / budget / quantity / save); blue user bubble.
- Error → Retry path; unified streaming→committed transition seamless.

---

## Phase-2 deferrals (NOT in Phase 1 — do not flip guardrails against these)
- ⛔ WTB `lab.*` input controls (`togglePill`, `budgetInput*`, `stepper`, `FieldLabel`) — need new
  input tokens; user chose to defer.
- ⛔ `brand.primaryAccent` (#9fd2b4) placeholder-icon tint — no D1 token yet.
- ⛔ `#fff` literals (button text, coin/celebration icons) → `text.onAccent` in Phase 2.
- ⛔ Dark theme, word-by-word streaming, ambient glow (the Gemini visual pass).
- ⛔ Cosmetic `threadStore` → `activeTurnStore` rename.
- ⛔ **Guardrail lints warn→error (PR-11 remainder)** — blocked in Phase 1 (see below).

---

## PR-11 guardrail flip — deferred (documented blocker)

The dead-code half of PR-11 is done (legacy `AiMsg` + `ChatRole` removed). The
**warn→error flip cannot land in Phase 1** — flipping now would break the build,
which is a regression, not a cleanup. Three concrete reasons:

1. **Phase-2 color deferrals still use restricted imports by design.** `cards.tsx`
   legitimately imports `brand`/`greenDark`/`lab` for the WTB `lab.*` inputs,
   `primaryAccent`, and `#fff` literals — all user-approved Phase-2 deferrals. The
   semantic-only color guardrail would (correctly) reject them.
2. **`cards.tsx` imports streaming TYPES** (`QueueData`/`GroupChoiceData`/`QueueItem`
   from `labStreamTypes`). The A4 §12.2 "no streaming import in components" guardrail
   would reject this; fixing it means relocating those types to a shared module —
   a real (non-behavior-neutral-trivial) refactor.
3. **60 pre-existing project-wide errors** (react-compiler ruleset) in files outside
   the chat feature; a global error flip fails on unrelated code.

**Unblocks when:** Phase 2 migrates the WTB inputs/`primaryAccent`/`#fff` to tokens
(#1), the streaming card-payload types move to `types/` (#2), and the project-wide
react-compiler errors are triaged (#3). Guardrails stay at **warn** until then.

---

## PR log (newest first)

### PR-11 — Legacy removal + guardrails · 🟡 partial
- Removed dead legacy `AiMsg` + `ChatRole` (`user|bot|err`) from `chat/types.ts`
  (no consumers after the PR-6 `Message` migration); kept `newMsgId`.
- `LiveBotBubble` leftovers already removed in PR-8.
- Guardrail warn→error flip **deferred** (see section above) — not a behavior-neutral
  Phase-1 change while Phase-2 deferrals + type coupling remain.
- Verify: tsc 0 · 25 suites/242 tests · snapshots unchanged · 60 pre-existing lint
  errors (0 new).

### PR-10 — Motion ownership pass · ✅
- Relocated `chat/useTypewriter.ts` → `chat/hooks/useStreamReveal.ts` (A4 §10);
  hook renamed `useStreamReveal`, logic UNCHANGED and **char-based** (word reveal is
  Phase 2). Updated importers (`StreamingMessage`, barrel, test mock); deleted old file.
- Audited: **no `LayoutAnimation`** in the chat feature (D4-compliant); reveal rAF
  loop cancels on unmount/dep-change (no orphaned loops).
- Verify: tsc 0 · 25 suites/242 tests · snapshots unchanged · lint clean.

### PR-9 — CardRegistry (formalize) · ✅
- Added `registries/cardRegistry.ts` — a generic `CardRegistry` with
  `register`/`registerAll`/`resolve`/`has` (A4 §9 extension seam). `cards.tsx`
  builds the registry via `registerAll(...)` and `renderCard` dispatches via
  `cardRegistry.resolve(type)`; unknown → dev-only fallback (unchanged behavior).
  `bid_list`/`received_bids` stay a mode-disambiguated special case.
- Added `cardRegistry.test.ts` (register/resolve/unknown/override; +4 tests).
- Verify: tsc 0 · 25 suites/242 tests · card snapshots **byte-identical** · lint clean.
