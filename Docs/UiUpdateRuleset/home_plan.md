# Plan: Scan Home Screen & Recent Submissions (Ruleset Alignment)

This plan details the migration of the Scan Home Dashboard (`app/(tabs)/index.tsx`) and its primary subcomponent (`RecentSubmissionsList.tsx`) to match the NativeWind styling configurations and custom UI primitives.

---

## 1. Scan Home Screen (`app/(tabs)/index.tsx`)

- [x] **Base Layout Refactoring**:
  - Wrap the screen in `<Screen padded={false} scroll={false} edges={['top']}>`.
  - Let the inner `<ScrollView>` handle the scrolling content (with `contentContainerStyle` utilizing standard spacing tokens, e.g. `px-lg pt-md pb-xl`).
- [x] **Header Components Integration**:
  - Convert custom stylesheet `styles.header`, `styles.headerTopRow`, and `styles.headerActions` to NativeWind classes.
  - Refactor the current Location block button to use NativeWind focus/active classes.
  - Swap the custom language chip Pressable to use standard ruleset `<Text>` and design tokens.
  - Convert the User Avatar initials container to ruleset design tokens (neutral background, custom rounded avatar look).
- [x] **STAFF Greeting Banner Refactoring**:
  - Refactor the STAFF pill, code label, and inline greeting `Hi, {name}` to use ruleset typography variants and tones.
- [x] **Pulsing Shutter camera Card**:
  - Replace the `<LinearGradient>` color parameters with tokens or direct theme variables.
  - Convert the scan card container press feedback `pressed && styles.scanCardPressed` to NativeWind active styles.
  - Keep the pulsing scale micro-interaction using Reanimated 3 (`useSharedValue` + `withRepeat` loop) to align with animation rulesets.
- [x] **StyleSheet Elimination**:
  - Fully delete the `StyleSheet.create` block at the bottom of the file.

---

## 2. Recent Submissions List (`src/components/scanner/RecentSubmissionsList.tsx`)

- [x] **Row Component Refactoring**:
  - Convert the `BatchRow` layout styles (`styles.row`, `styles.rowBody`, `styles.thumbWrap`, `styles.pillRow`) to NativeWind utility classes.
  - Replace legacy typography properties with standard `<Text>` primitives (e.g. `variant="body"`, `variant="bodySm"`, `variant="caption"`).
- [x] **Section Header and Feed Container Refactoring**:
  - Refactor the section headers and counts pill using custom primitives and NativeWind colors.
  - Convert error and empty hints to ruleset-compliant layouts.
- [x] **StyleSheet Elimination**:
  - Fully delete the `StyleSheet.create` block at the bottom of the file.

---

## 3. Design Fixes (post-migration review — 2026-05-27)

Specific issues spotted on the live home screen and corrected in `app/(tabs)/index.tsx`:

- [x] **Placeholder title bug**: the Scan card title rendered the literal `Testing new code!` (leftover debug text) instead of the real heading. Restored to `t('mobile.home.scanTitle')` → "Scan & Upload".
- [x] **Hero balance / dead space**: the older landscape card left ~55% empty green. The card is now a centered vertical hero; bumped vertical padding `py-xl` → `py-2xl` so the icon + title + subtitle sit as a balanced block rather than cramped.
- [x] **Faint subtitle**: hero subtitle was `variant="caption"` (12px) at `opacity-85` with a forced `leading-4` — too small/dim for the primary CTA. Raised to `variant="bodySm"` (14px) at `opacity-90`, dropped the manual line-height override.
- [x] **Fragile font-size override**: removed the `text-[22px]` className on the title — the `Text` primitive already sets `fontSize` via its `variant`, so the className just fought the token. Title now uses the `title` variant cleanly.
- [x] **Recent-uploads rows blending into the background**: rows were `bg-white` on a `bg-bg` (`#FFFFFF`) screen, separated only by `border-neutral-100` (`#F3F4F6`) — effectively invisible. Per ruleset §7.2 the `outlined` card uses the `border` token (**neutral-200 / `#E5E7EB`**); switched to that and added `shadow-sm` (ruleset `elevation.sm`) for lift. Border carries separation cross-platform since the row's `overflow-hidden` (for the colored edge rail) clips shadows on web. See `src/components/scanner/RecentSubmissionsList.tsx`.
- [x] **Thumbnails invisible on home (but fine on History)**: the row passed `className="w-full h-full"` to `AppImage`, which only forwards `style` to `expo-image` — NativeWind doesn't transform that className, so images rendered at 0px. Switched to an explicit `style={{ width: '100%', height: '100%', borderRadius: 12 }}` (matching History's style-based sizing).

> Note: the device screenshot that prompted this review was a **stale build** (showed the old left-aligned card). Rebuild / reload Metro to see the centered hero with the corrected title.
