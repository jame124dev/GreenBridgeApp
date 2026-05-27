# Phase 3 — Home Tab + RecentSubmissionsList

**Status:** ⬜ NOT STARTED
**Started:** —
**Completed:** —

---

## Files Changed

---

## Before Screenshot

---

## Market Research
<!-- Paste notes from web search: "eBay seller hub dashboard mobile 2024" -->

---

## Checklist

### app/(tabs)/index.tsx
- [ ] `<Screen padded={false} scroll={false} edges={['top']}>`
- [ ] Inner ScrollView with `contentContainerStyle` using spacing tokens
- [ ] Header: location button, language chip, avatar — NativeWind only
- [ ] Staff greeting pill uses `<Text>` primitive
- [ ] Scan card: LinearGradient uses theme color tokens
- [ ] Press feedback via Reanimated active styles (not StyleSheet pressed state)
- [ ] Pulsing animation: `useSharedValue` + `withRepeat` Reanimated 3
- [ ] `StyleSheet.create` block fully deleted

### src/components/scanner/RecentSubmissionsList.tsx
- [ ] BatchRow layout: NativeWind classes
- [ ] Typography: `<Text variant="body/bodySm/caption" />`
- [ ] Section headers/count pills use primitives
- [ ] Empty state: `<EmptyState>` component
- [ ] Card border: `neutral-200` + `shadow-sm` (not bg-white on white screen)
- [ ] AppImage: explicit `style={{ width, height }}` (not className)
- [ ] `StyleSheet.create` block fully deleted

---

## Work Log

| Time | Action | Result |
|------|--------|--------|

---

## Issues Found

---

## After Screenshot
<!-- Check: cards visually separated, thumbnails visible, no dead space -->

---

## Done? ✅
