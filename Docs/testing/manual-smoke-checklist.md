# Chat — Manual Smoke Checklist

> The neutrality signal that automated tree/behavior tests can't fully cover
> (pixels, real streaming cadence, gestures, native modules). Run this on a
> device/emulator before merging any Phase-1 PR and confirm **no observable
> change** versus the previous build.

## Run recipe (per project memory)
- Start Metro with `CI=1` (the file watcher crashes Metro otherwise); **restart
  Metro `--clear` after each change** (no hot reload with the dev-client).
- Relaunch the dev-client at the chat entry; `adb reverse tcp:8081 tcp:8081` when
  on a device.

## Checklist (each must behave identically to the baseline build)

### Send + stream
- [ ] Type a text prompt, Send → user bubble appears on the right immediately.
- [ ] Thinking dots show before the first token.
- [ ] Reply streams in (current char-based reveal cadence — unchanged in Phase 1).
- [ ] Auto-scroll keeps the latest line visible; scrolling up shows the
      scroll-to-bottom pill; tapping it returns to bottom.

### Cards
- [ ] A seller image/prompt that yields a listing draft renders the draft card
      under the prose; repeated draft frames collapse to one card (latest-wins).
- [ ] The "Sources" strip renders after a tool-using reply.

### Error + retry
- [ ] Force an error (airplane mode mid-turn) → error bubble with Retry.
- [ ] Retry re-sends the same prompt and streams a fresh reply.

### Lifecycle
- [ ] Background the app mid-stream, foreground → no crash; turn state sane.
- [ ] Navigate away and back → thread behaves exactly as before (Phase 1 adds
      **no** persistence/resume; leaving still discards, as today).

### Localization (unchanged)
- [ ] Switch language (e.g. zh-Hant) → chat UI + AI reply language match, as
      before Phase 1.

## Sign-off
- Build/commit under test: `__________`
- Baseline commit compared against: `__________`
- Result: ☐ identical  ☐ differences found (attach notes)
