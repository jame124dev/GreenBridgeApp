# Camera capture — WhatsApp-style redesign

**Goal:** make the scan capture step ([app/scan/camera.tsx](../app/scan/camera.tsx)) feel as quiet and elegant as WhatsApp's in-chat camera — one hero shutter, floating translucent controls over a full-bleed viewfinder, gesture shortcuts — **while keeping the scanner-specific helpers** (corner bracket, nameplate tips) that WhatsApp doesn't need.

**Status:** ✅ All 4 phases shipped (2026-05-27) · on-device verification pending. Companion docs: [SCANNER_FLOW.md](./SCANNER_FLOW.md), [DESIGN_DELTA_v7.md](./DESIGN_DELTA_v7.md).

**Flow context (after the recent change):** Scan → Camera → Processing (AI) → Detail (gallery + edit + submit) → Success. The Review screen was merged into Detail, so Camera's only job is "collect good photos, then go." This redesign sharpens that one job.

---

## 1. Reference — how WhatsApp's camera is built

Sources: [WhatsApp blog — new camera features](https://blog.whatsapp.com/introducing-new-camera-features), Sammy Fans, Neowin (see §9).

**Anatomy (top → bottom):**

- **Minimal top bar** — close (✕) one side, flash toggle the other. No title. Translucent over the live preview.
- **Full-bleed preview** — camera fills the whole screen; controls float on top with subtle dark scrims for legibility.
- **Bottom cluster** — one large circular **shutter**, a **recent-photo / gallery thumbnail** on its left, **front/rear flip** on its right. Symmetric around the shutter.

**Signature gestures:**

| Gesture | Action |
|---|---|
| Tap shutter | Photo |
| Press-and-hold shutter | Video (n/a for us) |
| **Double-tap anywhere** | Flip front/rear |
| **Slide finger up/down** | Zoom |

**After capture:** shots animate into the thumbnail; a pre-send strip shows tiles you can add/remove; caption + send sit at the bottom. Capture and review are one continuous motion — no mode switch.

**Why it feels elegant:**
1. The preview is the hero — never boxed; controls are translucent overlays.
2. Exactly one primary action (the shutter); everything else is smaller/secondary.
3. Gestures replace buttons → less on-screen clutter, faster one-handed use.
4. Immediate "I got it" feedback (shutter flash + thumbnail animation).

---

## 2. Current state vs. target

Current [camera.tsx](../app/scan/camera.tsx) layout:

```
┌─────────────────────────────┐
│  ✕      Capture     ⚡  🔄   │  ← top bar HAS a title
│  ┌                       ┐  │
│       (bracket frame)       │
│        ┌ TIP pill ┐         │  ← centered pill
│  └                       ┘  │
│  [thumb][thumb][thumb]…     │  ← strip
│                             │
│          (  ⚪  )            │  ← shutter
│         [ 2  NEXT → ]        │  ← second CTA stacked under shutter
└─────────────────────────────┘
```

Two issues vs. WhatsApp: (a) extra chrome (title, plus the bottom has **two** competing CTAs — shutter AND NEXT), (b) no gestures.

Target:

```
┌─────────────────────────────┐
│  ✕                    ⚡     │  ← title removed; just ✕ + flash (translucent)
│  ┌                       ┐  │
│       (bracket frame)       │  ← KEEP: scanner-specific
│        ┌ TIP pill ┐         │  ← KEEP: nameplate guidance
│  └                       ┘  │
│                             │
│   [▣2]      ⚪       🔄      │  ← thumbnail-count (left) · shutter · flip (right)
│        swipe ↑↓ = zoom       │
└─────────────────────────────┘
   double-tap anywhere = flip
```

The "NEXT" action becomes the **left thumbnail chip** (tap the stack to go to Detail). Shutter is the lone hero, flip moves to the right — WhatsApp's symmetric cluster.

---

## 3. Concrete changes

### 3.1 Quiet the top bar
- Remove the centered **"Capture" title** (`styles.topTitle`).
- Keep ✕ (left) and flash (right) as translucent rounded pills (`rgba(0,0,0,0.4)` bg) so they read on any scene.
- Move **flip** out of the top bar down to the bottom cluster (see 3.3).

### 3.2 Keep the scanner helpers (do NOT remove)
- **Corner bracket** (`styles.viewfinder` / `bracket*`) — helps frame nameplates. WhatsApp has no equivalent; this is our value-add.
- **TIP / Good! pill** — nameplate guidance. Keep, but make sure it never overlaps the thumbnail tray (see 3.4).

### 3.3 One hero shutter + symmetric cluster
- Bottom bar becomes a 3-slot row: **left** = thumbnail-count chip, **center** = shutter (hero, largest), **right** = front/rear flip.
- **Remove the standalone NEXT button.** Its job moves to the left thumbnail chip: tapping the stack (showing the count badge) advances to Detail. An empty state (0 photos) shows a dimmed gallery glyph that does nothing.
- This removes the "two CTAs fighting at the bottom" problem and matches WhatsApp's thumbnail · shutter · flip layout.

### 3.4 Capture tray, not overlapping pill
- Give captured thumbnails a dedicated **bottom tray** above the control row (translucent dark strip), each tile with a remove ✕.
- The TIP/Good pill sits in the viewfinder center only while the tray is empty or animates out once photos exist — never stacked on top of the strip.

### 3.5 Gestures (the big perceived-quality win)
- **Double-tap anywhere on the preview** → flip camera. (expo-camera + a `Pressable`/`GestureDetector` over the preview.)
- **Vertical slide on the preview** → zoom. expo-camera exposes a `zoom` prop (0–1); map a vertical pan delta to it. Start with slide; pinch can come later.
- Both are additive — they don't remove the tappable flip button, they just make it optional.

### 3.6 Capture feedback
- On shutter tap: a quick full-screen white **flash** (80–120 ms opacity animation) + the new photo **animating down** into the left thumbnail chip.
- Keep the existing `haptics.heavy()` on shutter (already wired).

---

## 4. What stays the same

- `CameraView` full-screen (`StyleSheet.absoluteFill`) — already correct.
- `compressPhoto` pipeline, permission gating, capture error handling — unchanged.
- Corner bracket + nameplate tips — kept (our scanner identity).
- `haptics.heavy()` shutter feedback — kept.
- Flow target: still advances to **Detail** (via the thumbnail chip instead of NEXT).

---

## 5. Phased implementation (small, reviewable PRs)

1. **Bar cleanup + cluster reflow** (pure layout, lowest risk) — ✅ **DONE (2026-05-27)**
   - ✅ Dropped the "Capture" title; ✕ (left) + flash (right) as translucent floating pills.
   - ✅ Bottom row → thumbnail-count chip (left) · shutter (center) · flip (right). Removed standalone NEXT; the chip now carries the advance action (`onNext`) and shows the last photo + green count badge; dimmed gallery glyph at zero photos.
   - ✅ Added i18n `mobile.camera.viewPhotos / flipCamera / flashOn / flashOff` (all 4 locales) + a11y labels on every control.
   - ✅ Removed `topTitle` / `topActions` / `nextBtn` / `nextCount` styles. Typecheck 0 errors, lint clean.
   - ⏳ Not yet verified on-device (phone was unplugged during the pass) — needs a quick on-device look.
2. **Capture tray** — ✅ **DONE (2026-05-27)**
   - ✅ Thumbnails now live in a dedicated translucent dark **tray** (`styles.tray`) anchored directly above the control cluster (both inside `styles.bottomArea`), each tile keeps its remove ✕.
   - ✅ TIP pill shows **only when there are no photos** — the "Good!" guidance moved out of the viewfinder into a hint line inside the tray, so it can never overlap the thumbnails.
   - ✅ Reworded `mobile.camera.goodText` (all 4 locales) to drop the stale "tap NEXT" → now "tap the photos to continue" (matches the new chip-advances model).
   - ✅ Removed the floating mid-screen `thumbStrip`; thumbnails shrank 72→64 to sit cleanly in the tray. Typecheck 0 errors, lint clean.
   - ⏳ Not yet verified on-device (phone unplugged) — fold into the same on-device pass as Phase 1.
3. **Gestures** — ✅ **DONE (2026-05-27)**
   - ✅ Transparent full-screen `GestureDetector` catcher sits between the `CameraView` and the box-none overlay, so control taps still win and only preview-area gestures reach it.
   - ✅ **Double-tap anywhere** → flip camera (`Gesture.Tap().numberOfTaps(2)`), shares the new `flipCamera()` helper (resets zoom + `haptics.tap()`); the tappable flip button calls the same helper.
   - ✅ **Vertical slide** → zoom via `Gesture.Pan().onChange` using the per-frame `changeY` delta + functional `setZoom` (0–1, ~400px = full range) wired to `CameraView`'s `zoom` prop. No start-ref needed → sidesteps the `react-hooks/refs` lint rule.
   - ✅ `Gesture.Exclusive(doubleTap, pan)` — double-tap wins, drags fall through to zoom. Root already wraps `GestureHandlerRootView` ([app/_layout.tsx](../app/_layout.tsx)). Callbacks use `.runOnJS(true)` (no Reanimated bridge yet). Typecheck 0 errors, lint clean.
   - Implementation note: `changeY` lives on `.onChange`, not `.onUpdate` (TS caught this) — kept for future reference.
   - ⏳ Not yet verified on-device — gestures don't show in a screenshot, so this phase specifically needs a real-device check.
4. **Feedback polish** — ✅ **DONE (2026-05-27)**
   - ✅ **Shutter flash** — brief white full-screen blink on capture (opacity 0.7 → 0 over 200ms), topmost + `pointerEvents="none"`.
   - ✅ **Gallery chip pop** — the count chip scale-bounces (1 → 1.18 → spring back) when a new photo lands, so multi-shot scanning feels responsive.
   - **⚠️ Used RN `Animated` (native driver), NOT Reanimated.** Rationale: babel.config.js has no explicit Reanimated/worklets plugin (relies on `babel-preset-expo` auto-config), and with the phone unplugged I couldn't verify the worklet runtime — a misconfigured worklet plugin crashes at launch. A flash + a scale pop don't need worklet-thread perf; RN `Animated` with `useNativeDriver: true` runs them on the native thread with zero babel dependency. Swap to Reanimated later only if a gesture-driven animation actually needs it.
   - Implementation notes: Animated.Values held via lazy `useState(() => new Animated.Value(...))` (the React Compiler rejects `useRef(...).current` reads during render); chip wrapped in `Animated.View`; "fly-in from shutter to chip" simplified to a chip pop (true positional fly-in needs measured coords — deferred as not worth the complexity). Typecheck 0 errors, lint clean.
   - Also made the `mobile.camera.shutter` a11y key durable in `_seed_keys.py` (it had been hand-added to the JSONs only — a re-seed would have wiped it).

Each phase is independently shippable; stop after any.

---

## 6. New strings (i18n)

Add under `mobile.camera.*` (seed via `src/i18n/_seed_keys.py`, all 4 locales):

- `viewPhotos` — accessibility label for the thumbnail-count chip ("View N photos").
- `zoomHint` (optional) — a one-time "slide to zoom" coach hint.
- `flipCamera` — a11y label for the flip control.

(The standalone `mobile.common.next` is no longer used by Camera once NEXT is removed — keep the key; other screens still use it.)

---

## 7. Risks / notes

- **Gesture vs. scroll conflict** — the thumbnail tray is a horizontal ScrollView; keep zoom (vertical pan) bound to the preview area only, not the tray, so they don't fight.
- **expo-camera zoom granularity** — `zoom` is 0–1 and non-linear on some devices; clamp and ease the mapping.
- **Reanimated** — only pulled in at phase 4 for the flash/fly-in. If we'd rather not add motion yet, phases 1–3 still deliver most of the elegance with zero animation.
- **Button visual bug** — unrelated, but note the shared `<Button>` primary-variant Android rendering issue is still open; Camera uses its own local controls so it's unaffected.

---

## 8. Acceptance check (on-device)

- [ ] Top bar shows only ✕ + flash, both legible over a bright and a dark scene.
- [ ] One shutter, centered, clearly the largest control.
- [ ] Left chip shows photo count; tapping it goes to Detail; dimmed at 0 photos.
- [ ] Vertical slide zooms; the `ZOOM · NN%` pill appears mid-slide and auto-hides; zoom feels smooth (throttle check). _(Double-tap-to-flip was removed in §12.3 — use the flip button.)_
- [ ] Single tap shows the focus ring; continuous AF keeps nameplates sharp as you reframe (note: not point-focus — §12.2).
- [ ] Captured photo flashes + the gallery chip pops.
- [ ] Corner bracket + nameplate tip still present.
- [ ] Flash toggle hidden on the front camera; flipping to front clears flash.
- [ ] Works one-handed (thumb reaches shutter + chip + flip).

---

## 9. Sources

- [WhatsApp Blog — Introducing New Camera Features](https://blog.whatsapp.com/introducing-new-camera-features) (shutter tap/hold, double-tap flip, slide-to-zoom, front flash)
- [WhatsApp camera & gallery shortcuts in chat bar — Sammy Fans](https://www.sammyfans.com/2024/11/16/whatsapp-introduces-camera-and-gallery-shortcuts-in-chat-bar/)
- [WhatsApp camera icon replaced by gallery shortcut — Neowin](https://www.neowin.net/news/whatsapp-camera-icon-in-the-chat-bar-gets-replaced-by-gallery-shortcut/)
- [Why WhatsApp's Chat UI Just Works — Bootcamp/Medium](https://medium.com/design-bootcamp/why-whatsapps-chat-ui-just-works-and-what-you-can-learn-from-it-bd89fb114423)

---

## 10. Review notes & revised priority (reviewer addendum, 2026-05-26)

The original spec (§1–9) nails the **look** — WhatsApp's quiet chrome, full-bleed preview, one hero shutter. The notes below don't replace it; they realign the parts where WhatsApp is the wrong reference for *this* camera's job.

### 10.1 Core reframing — capture-for-AI ≠ social snapshot

WhatsApp's camera is tuned for fast, casual, one-handed *social* capture (snap and send; framing barely matters). Our camera's job is **deliberate documentation so an AI can read nameplates, model numbers, and condition** — that's much closer to a **document scanner** (Adobe Scan, Google ML Kit Doc Scanner, CamScanner, Apple's built-in scanner) than to a chat camera.

**Takeaway:** keep WhatsApp's chrome minimalism, but borrow the *capture mechanics* from document scanners. The original spec only referenced the social camera, which is why it under-weights the features that most improve AI success rate.

### 10.2 Don't hide the "advance" action (revises §3.3)

§3.3 removes the standalone NEXT and routes "advance to Detail" through a tap on the thumbnail chip. Two problems:

- WhatsApp doesn't actually do this — it keeps a dedicated send button; the thumbnail opens review. So this is a *deviation* from WhatsApp, not a match.
- Hiding the primary advance action behind a thumbnail is a known discoverability trap. Baymard found **50–80% of users overlook truncated/hidden gallery affordances** when they're the primary indicator; Smashing's "Hidden vs. Disabled" guidance says **never hide key actions — disable them** when you want the user to know the action exists but isn't ready.

**Revised:** keep an explicit, persistent **Done / Next (N)** control. De-emphasize it WhatsApp-style (smaller, secondary, right side) so the shutter stays the lone hero — but don't make "tap the photo stack" the only way forward. At 0 photos, show it **disabled, not absent**.

### 10.3 Gestures — two of three are low-value here (revises §3.5)

| Proposed | Verdict |
|---|---|
| Double-tap = flip front/rear | **Drop / demote.** Sellers photograph equipment in front of them; the front camera is near-useless here. WhatsApp needs it (selfies); we don't. Don't spend a gesture *and* a cluster slot on it. |
| Vertical slide = zoom | **Replace with pinch-to-zoom.** Pinch is the universal, discoverable model and won't fight the horizontal thumbnail scroll. Vertical-slide-zoom is finicky and non-obvious. Zoom itself matters (getting close to a small nameplate). |
| Tap shutter = photo | ✅ keep |

### 10.4 Missing features that matter more than what's in (new)

From document-scanner UX research — higher-leverage for AI-readable capture than any social-camera gesture:

1. **Tap-to-focus + exposure lock** — the single biggest win for sharp, readable nameplates. Scanner apps prioritize focus on the document plane and let you tap to set it. The original spec doesn't mention focus at all. **This should be in phase 1.**
2. **Auto-capture on steady (optional)** — detect a stable frame and fire (or show a "hold steady" hint). Cuts blurry, unreadable shots that waste an AI call.
3. **Framing / level guidance** — the corner bracket is a start; a subtle "fill the frame with the nameplate · hold level" nudge raises OCR hit-rate.
4. **Glare / lighting hint** — glossy equipment plates + direct light is the #1 OCR killer per scanner sources. A lightweight "too much glare" warning would cut failed analyses.

### 10.5 Revised phase order

1. **Quiet chrome + tap-to-focus** — chrome is easy; focus is the real quality win.
2. **Persistent-but-secondary Done/Next** + capture tray — keep the affordance, just de-emphasize it (replaces §3.3's "remove NEXT").
3. **Pinch-to-zoom** — drop double-tap-flip; demote or remove flip entirely.
4. **Capture feedback** — shutter flash + thumbnail fly-in (unchanged from original §3.6).
5. **Later, only if data shows blurry/glare failures** — auto-capture-on-steady + glare hint.

### 10.6 Unchanged from the original spec (still endorsed)

Quiet top bar (✕ + flash, translucent) · full-bleed preview · one hero shutter · dedicated capture tray that never overlaps the TIP pill · shutter flash + fly-in feedback · keeping the corner bracket + nameplate tips · phased, independently-shippable PRs.

### 10.7 Added sources

- [Baymard — Truncating gallery thumbnails causes 50–80% of users to overlook them](https://baymard.com/blog/truncating-product-gallery-thumbnails)
- [Smashing Magazine — Hidden vs. Disabled in UX](https://www.smashingmagazine.com/2024/05/hidden-vs-disabled-ux/)
- [Google ML Kit — Document Scanner](https://developers.google.com/ml-kit/vision/doc-scanner)
- [Adobe Scan for Android — capture UX](https://www.adobe.com/devnet-docs/adobescan/android/en/scan.html)
- [Mobile Document Scanning Best Practices 2025 — Documaster](https://www.documaster.app/blog/mobile-document-scanning-best-practices)

---

## 11. Phase 1 review findings (post-merge, 2026-05-27)

Reviewed [camera.tsx](../app/scan/camera.tsx) after Phase 1 shipped. No functional bugs in the capture path; `onNext` branches correctly (0 → no-op · 1 → processing · >1 → reorder), `capturing`/`starting` guards prevent double-fires, a11y labels are on every control. Items below are ordered by severity.

### 🟠 Could break the flow (watch / fix)

- **[UX-BLOCKER → RESOLVED 2026-05-27]** An explicit **`NEXT →` button now lives in the capture tray** (right of the thumbnail strip), appearing the moment a photo exists — the labelled Done/Next the §10.2 research called for. This is the fix the user requested ("after capture I had to click the bottom-left gallery icon — confusing — want an on-screen continue option"), and it matches how Adobe Scan / CamScanner / Google Drive scan / iOS Camera all surface an explicit advance once you've captured. The earlier "tap a thumbnail to advance" hack was **reverted** (thumbnails are review-only now; ✕ removes) since a real button removes the ambiguity. The bottom-left chip still advances too, as a secondary path.

### 🟢 Fixed (2026-05-27)

- **~~Misleading i18n key~~** — renamed `mobile.camera.titleBar` → `mobile.camera.shutter` (camera.tsx + all 4 locales). Value unchanged ("Capture").
- **~~Front-camera flash no-op~~** — the flash toggle is now hidden on the front camera (replaced by a layout spacer), and flipping to the front clears `flash` so the state can't lie. Torch is rear-only.
- **~~Advance discoverability~~** — explicit `NEXT →` button in the tray (see UX-BLOCKER above, now resolved).

### 🟡 Minor / still open (won't break)

- **Double hint at 0 photos:** the viewfinder TIP pill and the bottom `zeroHint` ("No photos yet · tap shutter to start") still both show. They now carry *different* messages (TIP = nameplate/multi-photo guidance; zeroHint = how to begin), so it's less redundant than before — left as-is. Drop `zeroHint` if it feels busy on-device.

### 🔵 Sequencing flag (not a bug)

- **Tap-to-focus still deferred.** Per §10.4/§10.5 this is the biggest capture-quality lever (blurry nameplates → failed AI calls) and should land *ahead of* further gesture polish. Flagging so the order is a conscious choice, not an oversight.

### Acceptance items not yet met (from §8)

- [ ] On-device pass (phone was unplugged during the build) — verify chip/shutter/flip legibility on bright + dark scenes, one-handed reach, and that tapping a thumbnail/chip advances as expected.
- [ ] Confirm "how do I continue?" is obvious to someone who hasn't seen it (the UX-BLOCKER above) — decide whether the labelled Done/Next safety net is needed.

---

## 12. Phase 3–4 review + follow-up fixes (2026-05-27)

Reviewed gestures (Phase 3) + capture feedback (Phase 4) end-to-end. **Nothing crashes** — `GestureHandlerRootView` is at the root so gestures fire on Android; animations use RN `Animated` native driver (no Reanimated/worklet launch risk); JSX is balanced; tsc is green.

> One transient break was caught and is already resolved: the Phase 4 flash style briefly used `StyleSheet.absoluteFillObject`, which this RN/types version doesn't expose (`error TS2551`). It's now an explicit `{ position:'absolute', top/left/right/bottom:0 }` literal.

### 12.1 Fixes applied this pass

- **🟢 Zoom re-render storm → throttled.** `zoomPanGesture.onChange` was calling `setZoom` every pan frame (each one re-renders the screen + pushes a new `zoom` prop to `CameraView`) — janky on mid/low-end Android. Now a `zoomRef` mirror accumulates per-frame and only flushes to state on a **≥0.02 step**, with an exact commit on `onEnd`; `flipCamera` resets the ref too. Cuts per-drag renders ~5–10× with imperceptible lag.
- **🟢 Continuous autofocus made explicit.** `CameraView` now sets `autofocus="off"` (expo-camera's confusingly-named "focus when needed" / continuous mode) — best for handheld scanning where the seller reframes between items, instead of relying on an unknown platform default.
- **🟢 Tap-to-refocus feedback.** Single-tap on the preview shows a focus ring at the tap point + a light haptic. **Honesty note:** this is *feedback only* — see 12.2.

### 12.2 Hard constraint — true tap-to-focus is NOT possible with expo-camera

`CameraView` (expo-camera 56) exposes only `autofocus` ('on' = focus-once-then-lock / 'off' = continuous) and `focusDistance` (a manual 0–1 distance). **There is no point-of-interest / focus-at-(x,y) API.** So the §10.4 "tap-to-focus" recommendation can't be fully delivered here — the ring acknowledges the tap and continuous AF does the focusing, but the camera does **not** focus on the exact tapped point. True point focus would require migrating the capture screen to **`react-native-vision-camera`** (`camera.focus({x,y})`). Tracked as a future option, not a quick fix.

### 12.3 Second follow-up pass — fixes applied (2026-05-27)

- **🟢 Double-tap-to-flip removed.** Dropped the `doubleTapGesture` entirely (low value for equipment capture, risked accidental flips to the unused front camera). The flip *button* stays. Bonus: the single-tap refocus now fires immediately instead of waiting for a double-tap to fail. Gesture tree is now `Gesture.Exclusive(focusTap, zoomPan)`.
- **🟢 Zoom indicator added.** A translucent **`ZOOM · NN%`** pill (percent of the 0–1 range — honest, since expo-camera exposes no optical factor). See §12.5 for its final, lint-clean form.
- Typecheck 0 errors, camera lint clean.

### 12.5 Explicit NEXT button + lint-driven simplifications (2026-05-27)

Triggered by user feedback: *"after capture I had to click the bottom-left gallery icon to continue — confusing; want an on-screen continue option, done smartly."* Backed by research — every serious capture app (Adobe Scan, CamScanner, Google Drive scan, iOS Camera) shows an explicit advance control once a shot exists; the corner thumbnail is for *review*, never the primary proceed.

- **🟢 `NEXT →` button in the capture tray.** Tray is now `[thumbnail strip (scrolls, flex:1)] · [NEXT → button]`. The button (brand-green pill, reuses the existing `mobile.common.next` label — already localized in all 4 locales, no seed risk) appears the instant a photo exists. Resolves the §11 UX-BLOCKER.
- **🟢 NEXT goes straight to AI analysis — no reorder detour.** `onNext` now always calls `start(photos)` → **Processing (AI) → Review/Detail** for *any* photo count (previously >1 photo detoured through the rearrange screen). Per user request: "don't go to the rearrange photo, just go to AI analysis loading → review." Reordering & cover selection still live in the **Detail photo carousel** (`scanReorderPhotosEdit`), so nothing is lost — the standalone camera→reorder path is simply retired (the route still exists, reachable from Detail).
- **🟢 Thumbnails reverted to review-only.** The earlier "tap a thumbnail to advance" hack is gone (it was a workaround for the missing button); ✕ still removes. Removes the tap-photo-vs-tap-✕ ambiguity.
- **🟡 Zoom throttle reverted (lint constraint).** The ref-based ≥0.02-step throttle tripped the project's `react-hooks/refs` rule (can't read `zoomRef.current` in a gesture callback — same reason Phase 3 originally avoided a ref), and Reanimated (the clean no-render fix) isn't wired. Reverted to per-frame functional `setZoom` — the lint-clean approach that already shipped. The per-frame-render perf concern stands as a **real-device watch item**, not a code fix available under the current rules.
- **🟢 Zoom pill simplified.** Now derived purely from `zoom > 0` (visible while zoomed, hidden at 1×) — no `zoomVisible` state, no effect, no timer/ref. This sidesteps both the `react-hooks/refs` rule and the "no synchronous setState in an effect" rule. Trade-off: it stays on-screen while zoomed instead of auto-hiding after 1.2s — which is fine (common camera pattern: show current zoom while zoomed).
- Typecheck 0 errors, camera lint clean.

### 12.6 Still open (not blocking)

- **Zoom per-frame render cost** — only fixable cleanly via Reanimated (deliberately not wired) or a ref (forbidden by lint). Watch on a real mid-range device; revisit only if it visibly stutters.
- **Coach hint** — still deferred (i18n-seed gotcha); the focus ring + zoom pill make the two gestures self-evident, so lower priority.
- **On-device pass still pending** for the whole redesign — the last gate before calling it done. Now also covers: the NEXT button's reachability/clarity, and zoom-slide smoothness under per-frame render.
