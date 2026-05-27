# Phase 9 — Profile / Settings Tab

**Status:** ⬜ NOT STARTED
**Started:** —
**Completed:** —

> Largest phase — see `Docs/UiUpdateRuleset/me_plan.md` for full detail.

---

## Files Changed

---

## Before Screenshot

---

## Market Research
<!-- Paste notes from web search: "Mercari seller profile settings mobile 2024" -->

---

## Checklist

### Decomposition (do first)
- [ ] `features/settings/` module created
- [ ] Components extracted: ProfileHero, ProfileInfoCard, AddressCard, SecurityCard, LanguageRegionCard, InterestChips, InterestsSheet, 4 picker sheets
- [ ] `app/(tabs)/profile.tsx` is now a thin route — no business logic
- [ ] Each component < 200 lines

### Hero Block
- [ ] LinearGradient hero kept (allowed for hero banners)
- [ ] NativeWind classes replace all StyleSheet entries
- [ ] `<Text>` primitive with `tone="inverse"`

### Section Cards
- [ ] `<Card>` + spacing tokens only — no inline style objects
- [ ] Icon tile backgrounds use token colors

### Forms → react-hook-form + zod
- [ ] 14 `useState` hooks replaced with `react-hook-form` (one per card section)
- [ ] Forms seeded from `profileQuery.data` via `reset()`
- [ ] Password validation (match/required) → inline `Input error`
- [ ] Success/error → `sonner-native` toast + haptics
- [ ] Zero `Alert.alert` calls remaining

### Sheets
- [ ] Industry, Language, Timezone, Currency via `@gorhom/bottom-sheet`
- [ ] InterestChips: NativeWind chip styles, `<Text variant="bodySm" tone="brand">`

### Accessibility + Polish
- [ ] All Pressables: `accessibilityRole="button"` + `accessibilityLabel`
- [ ] Skeleton loading (not ActivityIndicator)
- [ ] Sign-out: `<Button variant="destructive">` + `Haptics.Medium`
- [ ] `StyleSheet.create` block deleted

### Verification
- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint app/(tabs)/profile.tsx features/settings/**` clean

---

## Work Log

| Time | Action | Result |
|------|--------|--------|

---

## Issues Found

---

## After Screenshot

---

## Done? ✅
