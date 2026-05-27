# Phase 1 — Core UI Primitives

**Status:** ✅ DONE
**Started:** 2026-05-28
**Completed:** 2026-05-28

---

## Files Changed

- `src/components/ui/EmptyState.tsx` — replaced inline hex `#F1F5F9` default with `colors.neutral[100]` from `@/constants/theme`

---

## Checklist

### Text.tsx
- [x] 7 variants (caption/bodySm/body/bodyMd/subtitle/title/hero)
- [x] 6 tones (primary/secondary/tertiary/inverse/danger/brand)
- [x] Imports from `@/constants/theme` — no raw fontSize
- [x] No StyleSheet.create

### Button.tsx
- [x] `AnimatedPressable` with Reanimated 3 scale 0.97 on press
- [x] `expo-haptics` Light impact on press
- [x] Variants: primary / secondary / ghost / destructive
- [x] Sizes: sm (48pt) / md (56pt) / lg (64pt)
- [x] `loading` state with spinner
- [x] `disabled` opacity state
- [x] `leftIcon` / `rightIcon` support
- [x] No StyleSheet.create

### Input.tsx
- [x] NativeWind classes only
- [x] Focused / default / error border states
- [x] Inline `error` text below field (red)
- [x] Inline `hint` text below field (gray)
- [x] `leftIcon` / `rightIcon` support
- [x] No StyleSheet.create

### Card.tsx
- [x] flat / elevated / outlined variants
- [x] `rounded-2xl` default, `Card.Header` + `Card.Body` sub-components
- [x] No StyleSheet.create

### Screen.tsx
- [x] SafeAreaView flex-1 bg-bg
- [x] `padded` prop (px-lg)
- [x] `scroll` prop
- [x] `keyboardAware` prop
- [x] No StyleSheet.create

### Badge.tsx
- [x] Uses standard success/warning/danger/info variants
- [x] NativeWind classes — no inline hex
- [x] Uses `<Text>` primitive
- [x] No StyleSheet.create

### EmptyState.tsx
- [x] Uses `<Text>` primitive
- [x] No StyleSheet.create
- [x] Icon + title + description + optional CTA button
- [x] Uses `<Button>` primitive
- [x] Replaced inline hex default with `colors.neutral[100]`

---

## Work Log

| Time | Action | Result |
|------|--------|--------|
| 2026-05-28 | Fixed EmptyState.tsx `iconBg` default hex | Replaced with `colors.neutral[100]` |
| 2026-05-28 | `npx tsc --noEmit` | ✅ passes |

---

## Done? ✅
- Screenshot before ✓ (N/A — primitives, no screen)
- Checklist ticked ✓
- tsc passes ✓
- No StyleSheet.create ✓
- No Alert.alert ✓
