# Phase 1 — Behavior-Neutral Refactor Roadmap

| | |
|---|---|
| **Doc ID** | P2 / Phase-1 |
| **Layer** | Process |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform |
| **Consumes** | A2, A3, A4, D1, D2, D3, D4 (all approved) |
| **Reference code** | `app/(lab)/chat.tsx`, `chat/{ChatMessage,cards,cardKit,ThinkingDots,useTypewriter,types}.ts(x)`, `hooks/useLabTurn.ts`, `stores/{threadStore,composerStore,sessionStore}.ts`, `streaming/labStream*.ts`, `constants/theme.ts` |

> **This document is a roadmap, not implementation.** It sequences the refactors that prepare the
> codebase for feature work. No code is produced here.

---

## 0. Governing principles

1. **Behavior-neutral, provably.** After Phase 1 the app looks and behaves **identically**. This is
   not asserted — it is *proven* against a baseline captured before any change (PR-0).
2. **Not behind the flag.** Phase 1 refactors the **live light chat** in place. `CHAT_UI_V2` gates
   only Phase 2+ *visual* changes (dark theme, word reveal, glow). Nothing visual changes in Phase 1.
3. **Two neutrality-preserving constraints:**
   - The theme provider maps semantic tokens → **today's exact `theme.ts` values** (light). No dark.
   - `conversationStore` is **in-memory only**. MMKV persistence is deferred (it would make messages
     survive reload = a visible behavior change). Persistence is a Phase-2+ item.
4. **Every PR ships green.** Each PR leaves the app fully working, passes the PR-0 baseline, and is
   independently revertable. No PR depends on a later PR to be correct.
5. **No scope creep.** No word-by-word reveal, no glow, no dark palette, no new features, no token
   value changes. Those are explicitly *later phases* — this roadmap only builds the seams for them.
6. **Deferred to Phase 2+ (NOT in scope here):** dark theme resolution, word-by-word streaming
   (`useTypewriter` stays char-based), background glow / `BackgroundLayer`, Stop button, action row,
   MMKV persistence, FlashList migration, markdown expansion, RTL.

**How neutrality is proven (applies to every PR):**
- **Characterization snapshots** (PR-0) of `ChatMessage`/thread rendering across representative
  fixtures (user / bot / err / cards / streaming) — must remain byte-identical.
- **Frame-replay test** (PR-0): a recorded `LabStreamEvent[]` fed through the pipeline yields an
  identical committed message set.
- **Manual on-device smoke** (per the Metro `CI=1` recipe): send a text turn, stream a reply, render
  a listing draft card, trigger an error + Retry, background/foreground. Checklist in PR-0.

---

## 1. Dependency order

```
PR-0  Baseline & guardrails (safety net)
  │
PR-1  Feature scaffold + domain types (declared, unused)
  │
PR-2  Theme provider + hooks  (today's light values; machinery only)
  │        │
  │        ▼
  │   PR-3  Migrate components → semantic token hooks (identical values)
  ▼
PR-4  Extract useChatController (orchestration out of chat.tsx)
  │
PR-5  Pure turn reducer + effects (activeTurnStore; behavior-preserving)
  │
PR-6  Adopt Message domain model (adapter; render output identical)
  │
PR-7  Messages → conversationStore (in-memory, no persistence)
  │
PR-8  Unify render path + render boundaries (delete LiveBotBubble)
  │
PR-9  CardRegistry (renderCard switch → registry)
  │
PR-10 Motion ownership pass (relocate; cancellation; ban LayoutAnimation)
  │
PR-11 Legacy removal + enable guardrail lints (warn → error)
```

Rationale for order: the **safety net** comes first so neutrality is measurable. **Types + theme
machinery** are additive and unblock consumers. **Component token migration** can proceed in
parallel with the controller/reducer track (they touch different concerns). **Controller → reducer →
model → store → unify** is a strict chain: each needs the previous seam. **Registry, motion, cleanup**
come last because they operate on the settled structure. The riskiest change (unify, PR-8) lands only
after the model and store are stable, so it is a pure presentation merge, not a data change.

---

## 2. The roadmap (one item = one PR)

Template per item: **Purpose · Files · Dependencies · Migration · Rollback · Risk · Validation ·
Acceptance**, then **Estimates** (complexity S/M/L · risk · file count · testing).

---

### PR-0 — Baseline & guardrails

- **Purpose.** Create the safety net that lets every later PR prove behavior-neutrality; introduce
  architecture-lint tooling in **warn** mode. No product change.
- **Files.** New: `features/lab/chat/__tests__/characterization.*` (render snapshots), `streaming/__tests__/frameReplay.*` (recorded frames + expected turn/messages), `docs`/checklist for manual smoke; tooling config (eslint rule stubs / dependency-cruiser) in **warn**. No source edits.
- **Dependencies.** None.
- **Migration.** Capture golden snapshots of `ChatMessage` for fixtures (user, bot, err, listing_draft card, sources); record a representative SSE frame sequence and snapshot the resulting `threadStore.turn` + committed messages; write the manual smoke checklist.
- **Rollback.** Delete tests/config; zero source impact.
- **Risk.** Low (purely additive).
- **Validation.** Tests pass against current code; snapshots + replay fixture committed.
- **Acceptance.** Golden snapshots + frame-replay baseline in repo; smoke checklist documented; lint runs (warn, non-blocking).
- **Estimates.** S · Low · ~6–10 files · establishes the harness all later PRs validate against.

### PR-1 — Feature scaffold + domain types

- **Purpose.** Stand up the A4 §10 folder structure and the A2 §12 / A4 §11 type contracts so later
  PRs have stable targets; nothing wired yet.
- **Files.** New: `features/chat/index.ts` (barrel), `types/{message,card,contentPart,protocol}.ts`, empty dirs w/ barrels (`components/`, `controllers/`, `renderers/`, `registries/`, `boundaries/`). No moves, no imports from existing code.
- **Dependencies.** PR-0.
- **Migration.** Declare `Message`, `ContentPart`, `Card`, `ProtocolState`, `TurnInput`, `Effect` per the RFCs; export types only. `tsc`-only.
- **Rollback.** Delete new files.
- **Risk.** Low.
- **Validation.** `tsc` passes; app runtime unchanged (no runtime references the new modules).
- **Acceptance.** Types compile; structure matches A4 §10; nothing imports them at runtime yet.
- **Estimates.** S · Low · ~8 files · type-check only.

### PR-2 — Theme provider + hooks (today's light values)

- **Purpose.** Introduce the D2 runtime (primitives → semantic → theme → provider → hooks) with the
  chat theme reproducing **current `theme.ts` pixels exactly**. Machinery only; no consumer migration.
- **Files.** New: `features/chat/theme/{primitives,semantic,themes}.ts`, `ThemeProvider.tsx`, `hooks/{useColor,useElevation,useTheme,useBlur,useMotion}.ts`. Edited: app root + (future) `ChatProvider` to mount the provider.
- **Dependencies.** PR-1.
- **Migration.** Primitives = current hex values from `theme.ts`; semantic map binds names to those; `chat` theme = light, byte-identical to today. Wrap the tree; **do not** touch components (they still import `theme.ts`).
- **Rollback.** Remove the provider wrap + files; components unaffected.
- **Risk.** Low–Med (root wrap; verify no context re-render regressions).
- **Validation.** PR-0 snapshots unchanged; a unit test asserts each semantic token resolves to the exact current value; smoke.
- **Acceptance.** Provider mounted; `useColor` etc. return values identical to `theme.ts`; zero visual diff; D2 provider-purity check passes.
- **Estimates.** M · Low–Med · ~10 files · token-resolution unit tests + snapshot parity.

### PR-3 — Migrate components to semantic token hooks

- **Purpose.** Move chat components off direct `theme.ts` imports onto `useColor`/`useTheme` reading
  identical values. Prepares the light↔dark swap without changing pixels.
- **Files.** `ChatMessage.tsx`, `chat.tsx`, `cards.tsx`, `cardKit.tsx`, `ThinkingDots.tsx`, composer sub-views, and other chat-tree consumers of `brand`/`lab`/`green*`.
- **Dependencies.** PR-2.
- **Migration.** Mechanical per-component swap; keep exact values. MAY be split into sub-PRs by component group if the diff is large (same acceptance applies to each).
- **Rollback.** Revert imports to `theme.ts`.
- **Risk.** Med (breadth; a mistyped token = visible diff — caught by snapshots).
- **Validation.** PR-0 snapshots unchanged; visual diff review; smoke.
- **Acceptance.** No direct `theme.ts` color import remains in migrated files; snapshots identical; D2 semantic-only lint passes for migrated files.
- **Estimates.** M–L · Med · ~15–25 files · snapshot parity per component.

### PR-4 — Extract `useChatController`

- **Purpose.** Lift send / commit / abort / retry orchestration out of `chat.tsx` into
  `controllers/useChatController` (the A2 §7.2 effect executor seam), exposed via context.
- **Files.** New: `controllers/useChatController.ts`, `hooks/useChatActions.ts` (context accessor); edited: `chat.tsx` (calls hook), `ChatProvider` (hosts it); `useLabTurn.ts` retained/absorbed.
- **Dependencies.** PR-1, PR-2 (provider hosts the actions context).
- **Migration.** Move logic **verbatim** (no behavior change); expose `{ send, cancel, retry }` via context; `chat.tsx` consumes. Single-flight/abort semantics preserved exactly.
- **Rollback.** Inline the logic back into `chat.tsx`.
- **Risk.** Med (touches the core interaction path).
- **Validation.** Frame-replay + smoke (send / retry / abort / error); snapshot parity.
- **Acceptance.** `chat.tsx` no longer owns send/abort/commit logic; behavior identical; single-flight intact.
- **Estimates.** M · Med · ~5 files · replay + interaction smoke.

### PR-5 — Pure turn reducer + effects

- **Purpose.** Refactor `threadStore.applyFrame` + `turnToMessage` into a **pure** `reduce(state,
  input) → { state, effects }` (A2 §9), with the controller interpreting effects. Add the internal
  A2 `turn.state` with the legacy `status` projection (A2 §11) so the UI reads unchanged.
- **Files.** New: `controllers/turnReducer.ts`, `controllers/effects.ts`; `threadStore`→`activeTurnStore` (shape preserved + `state` added); wiring in `useChatController`.
- **Dependencies.** PR-4.
- **Migration.** Extract current fold logic into the pure reducer; effects (`commit`/`reset`/`haptic`) executed by the controller, matching current side effects (e.g. `haptics.error()` on error). `status` derived from `state` so rendering is byte-identical.
- **Rollback.** Revert to inline `applyFrame`.
- **Risk.** Med–High (core state logic).
- **Validation.** **Determinism/replay test**: recorded frames → committed messages identical to PR-0 baseline; smoke incl. error path; reducer purity unit tests (no I/O).
- **Acceptance.** `reduce()` pure (no clock/IO/randomness); replay matches baseline; status projection yields identical UI; A2 §9.2 transition tests green.
- **Estimates.** M–L · Med–High · ~6 files · determinism + transition-table tests.

### PR-6 — Adopt `Message` domain model (adapter)

- **Purpose.** Replace `AiMsg` (`role: user|bot|err`) with `Message` (`role: user|assistant` +
  `reason` + `content: ContentPart[]`) at the model boundary, via an adapter, with **identical render
  output**.
- **Files.** `types/message.ts` (finalize), `ChatMessage.tsx` (render from `Message`), commit path (`turnToMessage` → produce `Message`), `err`→`assistant`+`reason` mapping.
- **Dependencies.** PR-1, PR-5.
- **Migration.** Introduce `AiMsg ↔ Message` adapter; migrate commit + render; map legacy `err` role to `assistant` with `reason: 'failed'|'interrupted'`; `content = [{kind:'text', text}]`. Rendering produces identical pixels.
- **Rollback.** Keep `AiMsg`; revert adapter usage.
- **Risk.** Med–High (model change ripples into rendering).
- **Validation.** Snapshot parity across user/bot/err/card fixtures; smoke error + (simulated) interrupt.
- **Acceptance.** Single `Message` model in use; `err` role removed in favor of `reason`; snapshots identical.
- **Estimates.** M–L · Med–High · ~8 files · fixture snapshot parity.

### PR-7 — Messages → `conversationStore` (in-memory)

- **Purpose.** Move `messages[]` out of `chat.tsx` `useState` into `conversationStore` keyed by
  `conversationId` (A2 I2). **No persistence** (stays behavior-neutral).
- **Files.** New: `stores/conversationStore.ts`; edited: `chat.tsx` (drop `useState`, subscribe store via narrow selector), commit effect appends to store.
- **Dependencies.** PR-5, PR-6.
- **Migration.** Store = `Map<conversationId, Conversation{messages}>`, in-memory; `chat.tsx` subscribes; commit appends. **Explicitly no MMKV** — navigating away/reload still discards, exactly as today.
- **Rollback.** Restore `useState`.
- **Risk.** Med.
- **Validation.** Multi-turn smoke; snapshot parity; confirm navigation-away still clears (no new resume behavior).
- **Acceptance.** No messages in component state; behavior identical (no persistence/resume added); single source of truth (A2 I2).
- **Estimates.** M · Med · ~5 files · multi-turn smoke + selector test.

### PR-8 — Unify render path + render boundaries

- **Purpose.** Merge `LiveBotBubble` + `ChatMessage` into the A4 two-driver structure
  (`MessageList` → `MessageItem`; `StreamingMessage` → shared `AssistantMessage`); delete the forked
  live bubble; apply `React.memo` + render tiers (A4 §4).
- **Files.** New: `components/list/{MessageList,MessageItem,StreamingMessage}`, `components/message/{UserMessage,AssistantMessage,ErrorMessage,SourcesStrip}`; edited/decomposed: `chat.tsx` (remove inline `LiveBotBubble`), `ChatMessage.tsx` retired.
- **Dependencies.** PR-6, PR-7.
- **Migration.** Extract the shared `AssistantMessage` presentational subtree; committed list renders from `conversationStore`; `StreamingMessage` subscribes `activeTurn` (only token-level subscriber, A2 I10); memoize; keep visuals byte-identical.
- **Rollback.** Restore `ChatMessage` + `LiveBotBubble`.
- **Risk.** **High** (the central visual refactor — highest-traffic component).
- **Validation.** Snapshot parity of streaming vs committed for identical content; **render-count isolation test** (token burst → 0 Tier-0 re-renders); streaming smoke on device.
- **Acceptance.** One `AssistantMessage` subtree drives both paths; `LiveBotBubble` deleted; render-isolation test green; visuals identical (A4 §12.7 satisfied).
- **Estimates.** L · High · ~12 files · snapshot parity + render-count instrumentation + on-device streaming smoke.

### PR-9 — CardRegistry

- **Purpose.** Convert `cards.tsx` `renderCard` switch into a `CardRegistry` (A4 §9); identical cards.
- **Files.** New: `registries/cardRegistry.ts`, `components/cards/{CardStack,CardRenderer}`; `cards.tsx` split into registered per-type renderers; keep the existing `CardBoundary`.
- **Dependencies.** PR-8.
- **Migration.** Register each current card type; `CardRenderer` looks up by `type`; unknown → null (already today's behavior — A3 §10.4). `CardBoundary` seeds `CardErrorBoundary`.
- **Rollback.** Revert to the `switch`.
- **Risk.** Med.
- **Validation.** Snapshot per card type identical; unknown-type no-crash test; smoke (listing draft, sources, product card).
- **Acceptance.** No card `switch` remains; registry dispatch; unknown card renders nothing without crashing; snapshots identical.
- **Estimates.** M · Med · ~10 files · per-card snapshot + boundary test.

### PR-10 — Motion ownership pass

- **Purpose.** Align existing animations to D4 ownership **without changing behavior**: relocate the
  reveal hook, guarantee cancellation on unmount/reset, and audit-out any `LayoutAnimation`. (No word
  reveal, no glow — those are Phase 2.)
- **Files.** `useTypewriter.ts` → `hooks/useStreamReveal.ts` (relocated; **stays char-based**), `ThinkingDots.tsx` (verify UI-thread + cancellation, already close), audit for `LayoutAnimation`, ensure `cancelAnimation` on unmount in loops.
- **Dependencies.** PR-8.
- **Migration.** Move files to A4 locations; add cancellation guards where missing; confirm no `LayoutAnimation` usage; keep current reveal cadence and dot pulse exactly.
- **Rollback.** Revert relocations.
- **Risk.** Low–Med.
- **Validation.** Smoke (dots pulse, reveal, reduced-motion instant reveal unchanged); leak check (no orphaned loops on unmount).
- **Acceptance.** Animations relocated per A4 §10; zero `LayoutAnimation`; loops cancel on unmount; behavior identical (char-based reveal preserved).
- **Estimates.** S–M · Low–Med · ~5 files · leak + reduced-motion smoke.

### PR-11 — Legacy removal + enable guardrails

- **Purpose.** Delete dead code and flip the architecture-lint rules from **warn → error**, locking in
  the new boundaries so regressions can't creep back.
- **Files.** Cleanup across the chat tree (dead paths, unused `theme.ts` imports, legacy `AiMsg`/`err`
  remnants, `LiveBotBubble` leftovers); `index.ts` import boundaries; eslint/dependency-cruiser config → error.
- **Dependencies.** All prior PRs.
- **Migration.** Remove dead code; enable rules: no `palette.*`/theme-map in components (D1 §20.3, D2), no `streaming/`/`LabStreamEvent` import in components (A4 §12.2), semantic-only color (D3), no index keys (A4 §12.9), no `LayoutAnimation` (D4). Fix any surfaced violations.
- **Rollback.** Relax rules to warn; restore removed files.
- **Risk.** Med (enabling lints may surface latent coupling that needs a real fix).
- **Validation.** Full smoke; `tsc`; lint green at error; **all PR-0 baseline tests still green**.
- **Acceptance.** No legacy render/model/theme paths remain; guardrail lints at error; Phase-1 exit criteria (below) met.
- **Estimates.** M · Med · ~10–15 files · full regression smoke + lint gate.

---

## 3. Summary

| PR | Title | Complexity | Risk | ~Files | Key test |
|---|---|---|---|---|---|
| 0 | Baseline & guardrails | S | Low | 6–10 | snapshots + frame-replay baseline |
| 1 | Scaffold + domain types | S | Low | ~8 | tsc |
| 2 | Theme provider (light values) | M | Low–Med | ~10 | token-resolution + snapshot parity |
| 3 | Components → semantic hooks | M–L | Med | 15–25 | snapshot parity |
| 4 | Extract `useChatController` | M | Med | ~5 | replay + interaction smoke |
| 5 | Pure reducer + effects | M–L | Med–High | ~6 | determinism + transition tests |
| 6 | `Message` domain model | M–L | Med–High | ~8 | fixture snapshot parity |
| 7 | Messages → `conversationStore` (in-mem) | M | Med | ~5 | multi-turn smoke |
| 8 | Unify render path + boundaries | L | **High** | ~12 | render-isolation + streaming smoke |
| 9 | CardRegistry | M | Med | ~10 | per-card snapshot + boundary |
| 10 | Motion ownership pass | S–M | Low–Med | ~5 | leak + reduced-motion smoke |
| 11 | Legacy removal + guardrails | M | Med | 10–15 | full regression + lint gate |

**Critical path (must be sequential):** 4 → 5 → 6 → 7 → 8. PRs 2–3 (theme) run parallel to 4–5.
9–11 follow 8.

---

## 4. Phase-1 exit criteria

Phase 1 is done when **all** hold:

- [ ] The app is **pixel- and behavior-identical** to pre-Phase-1 (PR-0 snapshots + frame-replay +
      smoke all green); no `CHAT_UI_V2` visual change shipped.
- [ ] Folder structure matches **A4 §10**; imports cross the `index.ts` boundary only.
- [ ] The turn reducer is **pure + deterministic** (A2 §9; replay reproducible).
- [ ] Messages have **one source of truth** (`conversationStore`, in-memory; A2 I2) — no component
      copy, no persistence added.
- [ ] **One render path** for assistant messages (A4 §2.1); `LiveBotBubble` deleted; render-isolation
      test green (A4 §4 / A2 I10).
- [ ] Chat consumes theme via the **provider + hooks** (light values); no direct `theme.ts` color
      import in chat components.
- [ ] **CardRegistry** in place; no card `switch`.
- [ ] Animations follow **D4 ownership** (UI-thread continuous; cancellation; no `LayoutAnimation`) —
      char-based reveal preserved.
- [ ] Guardrail lints at **error** (no primitives/protocol in components, semantic-only, no index
      keys).
- [ ] The seams for Phase 2 exist and are unused: `ContentPart[]` model (multimodal), theme swap
      (dark), reveal hook (word-by-word), `BackgroundLayer` slot (glow), Stop/action-row mounts — all
      addable **without** re-refactoring.

---

## 5. Risks & mitigations (phase-level)

- **PR-8 (unify) is the high-risk change.** Mitigation: it lands *after* the model (PR-6) and store
  (PR-7) are stable, so it is a pure presentation merge with no data change; gated by the
  render-isolation test + snapshot parity. If it destabilizes, it reverts cleanly to
  `ChatMessage`+`LiveBotBubble` without affecting PRs 1–7.
- **Breadth of PR-3 (token migration).** Mitigation: split by component group; snapshots catch any
  value drift immediately.
- **Reducer purity (PR-5).** Mitigation: the determinism replay test is the gate; side effects
  (haptics) move to the effect interpreter, verified against baseline.
- **Thin existing test coverage.** Mitigation: PR-0 establishes characterization tests *first* — the
  whole roadmap is unsafe without it, so it is non-negotiable as step 0.
- **Neutrality drift over 11 PRs.** Mitigation: every PR re-runs the PR-0 baseline; any snapshot diff
  is a hard fail, not a judgment call.

---

## 6. Open questions (for review)

1. **PR granularity.** Ship PR-3 (token migration) as one PR or split by component group? (Recommend
   split if the diff exceeds ~15 files, same acceptance per sub-PR.)
2. **`useLabTurn` fate.** Absorb it fully into `useChatController` (PR-4) or keep it as the
   transport-facing sub-hook the controller calls? (Recommend keep it as the thin transport caller;
   the controller owns orchestration/effects.)
3. **Snapshot tooling.** Which snapshot mechanism for RN characterization (react-test-renderer tree
   vs. a screenshot harness)? Tree snapshots are cheaper and sufficient for neutrality; screenshots
   would catch pixel drift the tree can't. (Recommend tree snapshots for PR-0, add screenshots only
   if a value-drift bug slips through.)
4. **Parallelization.** The theme track (2–3) is independent of the controller/reducer track (4–5);
   run them concurrently by two devs, or strictly serial? (Recommend concurrent — they don't
   conflict; PR-8 is the join point.)
