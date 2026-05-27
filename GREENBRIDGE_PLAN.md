# GreenBridge — 5-Hour Autonomous UI & QA Plan

> **Authority order:** `react_native_marketplace_ruleset_v2.md` > `UiUpdate.md` > `UiUpdateRuleset/*` > this file.
> When a rule has a number (§4, §13…) it refers to `react_native_marketplace_ruleset_v2.md`.

---

## How Claude Should Run This

Start a new Claude Code session and say:
> "Execute GREENBRIDGE_PLAN.md Phase 0 through Phase 12 autonomously. Take an ADB screenshot before and after every fix. Update the Progress Tracker table as each phase completes. Do not stop until all phases are ✅ DONE."

---

## Progress Files — One MD Per Phase

Every phase has its own tracking file in [.claude/progress/](.claude/progress/). **Claude must update the phase file as it works** — not just the tracker table below.

```
.claude/progress/
  phase-0-foundation.md
  phase-1-primitives.md
  phase-2-auth.md
  phase-3-home.md
  phase-4-camera.md
  phase-5-scan-detail.md
  phase-6-scan-flow.md
  phase-7-history.md
  phase-8-inbox.md
  phase-9-profile.md
  phase-10-listing.md
  phase-11-nav-polish.md
  phase-12-final-audit.md
```

### Rules for updating phase files

1. **At phase start** — set `Status: 🔄 IN PROGRESS` and `Started: <date time>`
2. **During work** — add a row to the Work Log table for every meaningful action (file edited, bug found, fix applied)
3. **Paste market research notes** from web search into the Market Research section
4. **Tick checklist boxes** as each item is confirmed working (via screenshot)
5. **Paste before screenshot path** before making changes
6. **Paste after screenshot path** after fixes verified
7. **At phase end** — set `Status: ✅ DONE` and `Completed: <date time>`, then update the Progress Tracker in this file

### Phase file status values
- `⬜ NOT STARTED` — not yet begun
- `🔄 IN PROGRESS` — currently being worked on
- `✅ DONE` — all checklist items ticked, screenshots captured, tsc passes
- `⚠️ BLOCKED` — stuck on something, describe blocker in Issues Found

---

## ADB Screenshot Command (use every check)

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell screencap /sdcard/last-screen.png
& $adb pull /sdcard/last-screen.png .\.claude\last-screen.png
```
Then `Read .claude/last-screen.png`. After every code fix: wait 4 s (hot-reload), re-screenshot, verify.

---

## Tech Stack (Locked — §2)

| Layer | Library |
|---|---|
| Runtime | Expo SDK (dev client) |
| Language | TypeScript strict |
| Navigation | Expo Router |
| Styling | NativeWind v4 |
| Animation | Reanimated 3 + Gesture Handler |
| Lists | FlashList v2 — never FlatList for >20 items |
| Sheets | `@gorhom/bottom-sheet` v5 — no native Modal |
| State | Zustand (client) + TanStack Query v5 (server) |
| Storage | `react-native-mmkv` — no AsyncStorage |
| Icons | `lucide-react-native` outlined only |
| Images | `expo-image` — never RN core Image |
| Forms | `react-hook-form` + `zod` — all forms, no exceptions |
| Haptics | `expo-haptics` — see Haptics Policy below |
| i18n | `i18next` + `react-i18next` — all user strings via `t()` |

---

## Global UI Ruleset (§4 — apply to every screen)

### Token Reference (`src/constants/theme.ts`)

| Token group | Key values |
|---|---|
| Primary green | `primary.500 = #10B981` (default) · `primary.600 = #059669` (pressed) |
| Backgrounds | `light.background = #FFFFFF` · `light.surface = #F9FAFB` · `light.surfaceAlt = #F3F4F6` |
| Borders | `light.border = #E5E7EB` · `light.borderStrong = #D1D5DB` |
| Text | `neutral.900` headings · `neutral.700` body · `neutral.500` secondary · `neutral.400` hints |
| Semantic | `success=#16A34A` · `warning=#F59E0B` · `danger=#DC2626` · `info=#0EA5E9` |
| Radius | `sm=8` · `md=12` · `lg=16` · `xl=20` · `2xl=24` (cards/sheets default) · `full=9999` |
| Spacing | `xs=4` · `sm=8` · `md=12` · `lg=16` · `xl=20` · `2xl=24` · `3xl=32` |
| Min touch | **48 pt** — no exceptions (§17) |

### Typography Roles (only these 7 — §6)
`caption(12/16/500)` · `bodySm(14/20/400)` · `body(16/24/400)` · `bodyMd(16/24/500)` · `subtitle(18/26/600)` · `title(24/30/700)` · `hero(32/38/700)`

### Haptics Policy (§12)
| Trigger | Haptic |
|---|---|
| Primary button press | `Light` impact |
| Destructive confirm | `Medium` impact |
| Success (submit confirmed) | `Notification.Success` |
| Error (validation / API fail) | `Notification.Error` |
| Selection change (tabs, chips) | `Selection` |

### Hard Rules from §21 — Never
- ❌ Inline hex colors, raw px/fontSize — import from `@/constants/theme`
- ❌ `FlatList`, `AsyncStorage`, RN core `Image`, `Modal` for sheets
- ❌ API calls inside UI components — move to hooks
- ❌ Component >300 lines — split
- ❌ `any` without `// @reason:` comment
- ❌ Gradients except on hero banners
- ❌ Forms without `react-hook-form` + `zod`
- ❌ `Alert.alert` for validation — use inline `Input error` prop + `sonner-native` toast

### Hard Rules from §22 — Always
- ✅ Import tokens from `@/constants/theme`
- ✅ Use `<Text>`, `<Button>`, `<Card>`, `<Input>` primitives
- ✅ Wrap screens in `<Screen>`
- ✅ `accessibilityRole` + `accessibilityLabel` on all touchables
- ✅ `FlashList` with `estimatedItemSize` for lists
- ✅ `expo-image` with `placeholder` (blurhash) + `transition`
- ✅ TanStack Query for API data; Zustand for UI/client state
- ✅ All user-facing strings via `t()`
- ✅ Every async screen ships loading skeleton + empty state + error state (§16)

### §24 Verification Checklist (run before closing any phase)
1. Any inline hex / raw px / fontSize? → replace with token
2. Touchable without `accessibilityRole`/`Label`? → add
3. List without `estimatedItemSize`? → add
4. Async data without loading + empty + error? → add
5. Form without zod schema? → add
6. Component over 300 lines? → split
7. API call inside a component? → move to hook
8. Hardcoded user-facing string? → wrap in `t()`
9. Animation without `useReducedMotion` guard? → add
10. `StyleSheet.create` block remaining? → delete it

---

## Market Reference (web-search per phase)

| Screen | Search query |
|---|---|
| Login | `"Mercari login screen UI 2024 mobile"` |
| Home/Feed | `"eBay seller hub dashboard mobile 2024"` |
| Camera | `"eBay scan to list camera UI mobile"` |
| Listing form | `"Mercari sell item form mobile 2024"` |
| History | `"Mercari selling history mobile UI 2024"` |
| Inbox | `"Facebook Marketplace messages mobile 2024"` |
| Profile | `"Mercari seller profile settings mobile 2024"` |

---

## Phase 0 — Foundation: `constants/theme.ts` + Tailwind Config (≈20 min)

> Source: `UiUpdateRuleset/core_plan.md` §1

**Files**
- [src/constants/theme.ts](src/constants/theme.ts) (create if missing)
- [tailwind.config.js](tailwind.config.js)
- [src/theme/index.ts](src/theme/index.ts) (redirect exports)

**Steps**
1. Check if `src/constants/theme.ts` exists and has all token groups (colors, spacing, radius, typography, elevation, motion, layout)
2. If missing/incomplete, create/fill it with the exact token values from the ruleset (copied above)
3. Update `tailwind.config.js` to extend NativeWind with tokens from `constants/theme.ts`
4. Update `src/theme/index.ts` to re-export from `constants/theme.ts` for backward compat
5. Run `npx tsc --noEmit` — must pass before proceeding

---

## Phase 1 — Core UI Primitives (≈30 min)

> Source: `UiUpdateRuleset/core_plan.md` §2–3, `UiUpdate.md` §2–3

**Files**
- [src/components/ui/Text.tsx](src/components/ui/Text.tsx)
- [src/components/ui/Button.tsx](src/components/ui/Button.tsx)
- [src/components/ui/Input.tsx](src/components/ui/Input.tsx)
- [src/components/ui/Card.tsx](src/components/ui/Card.tsx)
- [src/components/ui/Screen.tsx](src/components/ui/Screen.tsx)
- [src/components/ui/Badge.tsx](src/components/ui/Badge.tsx)
- [src/components/ui/EmptyState.tsx](src/components/ui/EmptyState.tsx)

**Checklist per component**
- [ ] **Text** — 7 variants + 6 tones, imports from `@/constants/theme`, no raw fontSize
- [ ] **Button** — `AnimatedPressable` (Reanimated 3 scale 0.97), haptics on press, variants: `primary/secondary/ghost/destructive`, sizes: `sm/md/lg` (min 48pt height), `loading` state with spinner, `disabled` opacity
- [ ] **Input** — NativeWind classes, focused/default/error border states, inline `error`+`hint` text below, `leftIcon`/`rightIcon` support
- [ ] **Card** — `flat/elevated/outlined` variants, `rounded-2xl p-lg`, no raw StyleSheet
- [ ] **Screen** — `SafeAreaView` flex-1, `padded` prop (px-lg), `scroll` prop, `bg-bg`
- [ ] **Badge** — `default/success/warning/danger/info` variants, token colors
- [ ] **EmptyState** — icon + title + description + optional CTA button
- [ ] Delete all `StyleSheet.create` blocks from these files
- [ ] `npx tsc --noEmit` passes

---

## Phase 2 — Auth Screens (≈25 min)

> Source: `UiUpdateRuleset/auth_plan.md`, `UiUpdate.md` §4 Auth

**Files**
- [app/(auth)/login.tsx](app/(auth)/login.tsx)
- [app/(auth)/pending.tsx](app/(auth)/pending.tsx)

**Steps**
1. Screenshot login screen
2. Web search: `"Mercari login screen UI 2024 mobile"`
3. Login checklist:
   - [ ] Wrap in `<Screen keyboardAware scroll={false} padded={false}>`
   - [ ] Hero section with logo/brand centered
   - [ ] Form card wrapped in `<Card variant="flat" className="mt-[-28px] mx-lg p-lg gap-lg">`
   - [ ] Email + password using `<Input>` primitive with `leftIcon`, `label`, `error` props
   - [ ] Password `<Input>` has show/hide toggle (rightIcon eye)
   - [ ] Submit uses `<Button label="Sign in" size="lg" fullWidth loading={isSubmitting} />`
   - [ ] `react-hook-form` + `zod` schema — no ad-hoc `useState` validation
   - [ ] Validation errors inline under fields — zero `Alert.alert`
   - [ ] All `accessibilityRole` + `accessibilityLabel` present
   - [ ] `StyleSheet.create` block deleted
4. Pending screen: update layout + CTA to use `<Button>` primitive
5. Screenshot both to verify

---

## Phase 3 — Home Tab & Recent Submissions (≈35 min)

> Source: `UiUpdateRuleset/home_plan.md`, `UiUpdate.md` §4 index.tsx

**Files**
- [app/(tabs)/index.tsx](app/(tabs)/index.tsx)
- [src/components/scanner/RecentSubmissionsList.tsx](src/components/scanner/RecentSubmissionsList.tsx)

**Steps**
1. Screenshot home tab
2. Web search: `"eBay seller hub dashboard mobile 2024"`
3. Home screen checklist:
   - [ ] `<Screen padded={false} scroll={false} edges={['top']}>`
   - [ ] Inner `<ScrollView>` with `contentContainerStyle` using spacing tokens
   - [ ] Header: location button, language chip, avatar — all NativeWind classes, no StyleSheet
   - [ ] Staff greeting pill uses `<Text>` primitive with correct variants
   - [ ] Scan card: `LinearGradient` uses theme color tokens, press feedback via Reanimated active styles
   - [ ] Pulsing animation uses `useSharedValue` + `withRepeat` (Reanimated 3)
   - [ ] `StyleSheet.create` block fully deleted
4. RecentSubmissionsList checklist:
   - [ ] `BatchRow` layout converted to NativeWind classes
   - [ ] Typography via `<Text variant="body/bodySm/caption" />`
   - [ ] Section headers/count pills use primitives
   - [ ] Empty state uses `<EmptyState>` component
   - [ ] Card border uses `neutral-200` (`#E5E7EB`) + `shadow-sm` for lift
   - [ ] `AppImage` uses explicit `style={{ width, height }}` not className for sizing
   - [ ] `StyleSheet.create` block fully deleted
5. Screenshot to verify — check cards are visually separated, thumbnails visible

---

## Phase 4 — Camera Screen (≈35 min)

> Source: `UiUpdate.md` §4 camera.tsx

**Files**
- [app/scan/camera.tsx](app/scan/camera.tsx)

**Steps**
1. Navigate to camera via ADB tap on scan tab, screenshot
2. Web search: `"eBay scan to list camera UI mobile"`
3. Checklist:
   - [ ] Full-screen camera preview, no StyleSheet
   - [ ] Capture button: 64pt diameter, white border, centered bottom — NativeWind classes
   - [ ] Photo counter badge top-right using `<Badge>` primitive
   - [ ] "Done" CTA only visible after ≥1 photo captured
   - [ ] Flip camera + flash toggle buttons accessible (48pt touch target)
   - [ ] Thumbnail strip of captured photos
   - [ ] Back button top-left with `accessibilityLabel="Go back"`
   - [ ] Shutter tap triggers `Haptics.impactAsync(Light)`
   - [ ] Camera overlay controls use NativeWind — no raw StyleSheet
4. Screenshot to verify

---

## Phase 5 — Scan Detail Form (≈40 min)

> Source: `UiUpdate.md` §4 detail.tsx, `UiUpdateRuleset/core_plan.md`

**Files**
- [app/scan/detail.tsx](app/scan/detail.tsx)

**Steps**
1. Screenshot
2. Web search: `"Mercari sell item form mobile 2024"`
3. Checklist:
   - [ ] Full form uses `react-hook-form` + `zod` schema (title, description, category, price, condition)
   - [ ] All inputs use `<Input>` primitive — no raw `TextInput`
   - [ ] Category selector uses `@gorhom/bottom-sheet` picker, not native `Picker`
   - [ ] Price field: currency symbol prefix, numeric keyboard
   - [ ] Condition selector: chips or sheet — no native select
   - [ ] Validation errors inline via `Input error` prop
   - [ ] Submit button `<Button loading={isSubmitting} fullWidth />`
   - [ ] Sticky bottom submit (KeyboardAvoidingView aware)
   - [ ] StyleSheet.create deleted
4. Screenshot to verify

---

## Phase 6 — Scan Processing, Review & Success (≈30 min)

> Source: `UiUpdate.md` §4 processing/grouped-review/success

**Files**
- [app/scan/processing.tsx](app/scan/processing.tsx)
- [app/scan/grouped-review.tsx](app/scan/grouped-review.tsx)
- [app/scan/reorder-photos.tsx](app/scan/reorder-photos.tsx)
- [app/scan/listing-method.tsx](app/scan/listing-method.tsx)
- [app/scan/success.tsx](app/scan/success.tsx)

**Checklist**
- [ ] **Processing**: skeleton shimmer (not spinner), status text updates, back navigation blocked
- [ ] **Grouped review**: `FlashList` with `estimatedItemSize`, NativeWind classes, swipe-to-remove
- [ ] **Reorder photos**: drag interactions via Reanimated 3 standard timing constants
- [ ] **Listing method**: selection cards use `<Card>` + `<Button>` primitives
- [ ] **Success**: green checkmark animation (Reanimated), `Haptics.notificationAsync(Success)`, "View Listing" + "List Another" CTAs using `<Button>`
- [ ] All `StyleSheet.create` blocks deleted across these files
- Screenshot each screen to verify

---

## Phase 7 — History Tab (≈25 min)

> Source: `UiUpdate.md` §4 history.tsx

**Files**
- [app/(tabs)/history.tsx](app/(tabs)/history.tsx)
- [app/activity/history.tsx](app/activity/history.tsx)

**Steps**
1. Screenshot
2. Web search: `"Mercari selling history mobile UI 2024"`
3. Checklist:
   - [ ] Segmented control: Active / Sold / Drafts — NativeWind styled
   - [ ] List uses `FlashList` with `estimatedItemSize={96}`, memoized `renderItem`
   - [ ] Row: thumbnail (expo-image), title, price, date, `<Badge>` status
   - [ ] Badge variants: `success`=active, `info`=sold, `default`=draft
   - [ ] Pull-to-refresh wired
   - [ ] Skeleton loading (not spinner)
   - [ ] `<EmptyState>` per segment
   - [ ] NativeWind classes — StyleSheet deleted
4. Screenshot to verify

---

## Phase 8 — Inbox Tab (≈20 min)

> Source: `UiUpdate.md` §4 inbox.tsx

**Files**
- [app/(tabs)/inbox.tsx](app/(tabs)/inbox.tsx)

**Steps**
1. Screenshot
2. Web search: `"Facebook Marketplace messages mobile 2024"`
3. Checklist:
   - [ ] Conversation list: `FlashList`, avatar, name, message preview, timestamp
   - [ ] Unread indicator: green dot or `<Badge>` count
   - [ ] Item thumbnail in conversation row via `expo-image`
   - [ ] `<EmptyState>` when no messages
   - [ ] Skeleton loading
   - [ ] NativeWind classes — StyleSheet deleted
4. Screenshot to verify

---

## Phase 9 — Profile / Settings Tab (≈45 min)

> Source: `UiUpdateRuleset/me_plan.md` (full detail), `UiUpdate.md` §4 profile.tsx

**Files**
- [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx)

**Steps**
1. Screenshot
2. Web search: `"Mercari seller profile settings mobile 2024"`
3. Decomposition checklist (per `me_plan.md` §1):
   - [ ] Extract `features/settings/` module with components: `ProfileHero`, `ProfileInfoCard`, `AddressCard`, `SecurityCard`, `LanguageRegionCard`, `InterestChips`, `InterestsSheet`, 4 picker sheets
   - [ ] `app/(tabs)/profile.tsx` becomes thin route — no business logic
   - [ ] All extracted components < 200 lines each
4. Hero block (§2 of me_plan):
   - [ ] `LinearGradient` hero kept (allowed on hero banners)
   - [ ] NativeWind classes replace StyleSheet for avatar, name, email, role pill
   - [ ] Text via `<Text>` primitive with `tone="inverse"`
5. Section cards (§3 of me_plan):
   - [ ] `<Card>` + spacing tokens, no inline style objects
   - [ ] Icon tile backgrounds use token colors
6. Forms (§4 of me_plan — biggest gap):
   - [ ] Replace 14 `useState` hooks with `react-hook-form` + `zod` schemas (one per card section)
   - [ ] Seed forms from `profileQuery.data` via `reset()`
   - [ ] Password validation (match/required) → inline `Input error` prop
   - [ ] Success/error feedback → `sonner-native` `toast.success/error()` + haptics
   - [ ] Zero `Alert.alert` calls remaining
7. Sheets (§5 of me_plan):
   - [ ] Industry, Language, Timezone, Currency pickers via `@gorhom/bottom-sheet`
   - [ ] `InterestChips`: NativeWind chip styles, `<Text variant="bodySm" tone="brand">`
8. Accessibility + polish (§6 of me_plan):
   - [ ] All Pressables: `accessibilityRole="button"` + `accessibilityLabel`
   - [ ] Skeleton loading replacing `ActivityIndicator`
   - [ ] Sign-out: `<Button variant="destructive">` + `Haptics.Medium`
9. Delete `StyleSheet.create` block
10. `npx tsc --noEmit` + `npx eslint app/(tabs)/profile.tsx features/settings/**` clean
11. Screenshot to verify

---

## Phase 10 — Listing Detail Page (≈25 min)

> Source: `UiUpdate.md` §4 [id].tsx

**Files**
- [app/listing/[id].tsx](app/listing/[id].tsx)

**Steps**
1. Navigate to a listing; screenshot
2. Web search: `"eBay item listing page mobile 2024"`
3. Checklist:
   - [ ] Photo gallery uses `expo-image` with `blurhash` placeholder + `transition`
   - [ ] Title (`<Text variant="title">`), price (`<Text variant="subtitle" tone="brand">`), condition chip
   - [ ] Description expandable (BottomSheet or accordion)
   - [ ] Category/tag chips use `<Chip>` primitive
   - [ ] Share button uses `lucide-react-native` icon + `accessibilityLabel`
   - [ ] Status `<Badge>` (active/sold) prominent
   - [ ] Any modals (bid, contact) → `@gorhom/bottom-sheet`
   - [ ] NativeWind classes — StyleSheet deleted
4. Screenshot to verify

---

## Phase 11 — Scan Tab + Navigation Polish (≈20 min)

> Source: `UiUpdate.md` §4 scan.tsx + `UiUpdate.md` §4 _layout.tsx

**Files**
- [app/(tabs)/scan.tsx](app/(tabs)/scan.tsx)
- [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx)
- [app/_layout.tsx](app/_layout.tsx)
- [app/+not-found.tsx](app/+not-found.tsx)

**Checklist**
- [ ] Tab bar: icon + label, active = `primary.500`, inactive = `neutral.400`
- [ ] Stack headers: consistent height, font `subtitle`, back button accessible
- [ ] All `StatusBar` styles correct (dark content on light backgrounds)
- [ ] `+not-found.tsx`: NativeWind layout + `<EmptyState>` + "Go Home" CTA
- [ ] `_layout.tsx`: fonts loaded via `expo-font`, no unnecessary re-renders
- [ ] Route transitions use Reanimated animation standards (§10)
- Screenshot full tab-bar walkthrough — 1 screenshot per tab

---

## Phase 12 — Final TypeScript + Audit (≈15 min)

**Steps**
1. `npx tsc --noEmit` — zero errors
2. Run §24 verification checklist mentally across all changed files
3. Final ADB screenshot walkthrough: Login → Home → Camera → History → Inbox → Profile → Listing
4. Update Progress Tracker below — all phases ✅

---

## Progress Tracker

Update status as each phase completes. ⬜ = pending · 🔄 = in progress · ✅ = done

| Phase | Scope | Status | Notes |
|-------|-------|--------|-------|
| 0 | Foundation: constants/theme.ts + Tailwind | ⬜ | |
| 1 | Core UI Primitives (Text/Button/Input/Card/Screen/Badge/EmptyState) | ⬜ | |
| 2 | Auth Screens (Login + Pending) | ⬜ | auth_plan.md |
| 3 | Home Tab + RecentSubmissionsList | ⬜ | home_plan.md |
| 4 | Camera Screen | ⬜ | |
| 5 | Scan Detail Form | ⬜ | |
| 6 | Processing / Review / Success | ⬜ | |
| 7 | History Tab | ⬜ | |
| 8 | Inbox Tab | ⬜ | |
| 9 | Profile / Settings Tab | ⬜ | me_plan.md (largest phase) |
| 10 | Listing Detail `[id].tsx` | ⬜ | |
| 11 | Scan Tab + Navigation Polish | ⬜ | |
| 12 | TypeScript audit + final screenshots | ⬜ | |

---

## Phase Done Definition

A phase is ✅ only when ALL of:
1. Before screenshot captured
2. All checklist boxes ticked
3. After screenshot shows issues resolved
4. `npx tsc --noEmit` still passes
5. No `StyleSheet.create` left in touched files
6. No `Alert.alert` left in touched files
