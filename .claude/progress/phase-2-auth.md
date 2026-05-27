# Phase 2 — Auth Screens (Login + Pending)

**Status:** ⬜ NOT STARTED
**Started:** —
**Completed:** —

---

## Files Changed

---

## Before Screenshot

---

## Market Research
<!-- Paste notes from web search: "Mercari login screen UI 2024 mobile" -->

---

## Checklist

### login.tsx
- [ ] Wrapped in `<Screen keyboardAware scroll={false} padded={false}>`
- [ ] Hero section with logo/brand centered
- [ ] Form card: `<Card variant="flat" className="mt-[-28px] mx-lg p-lg gap-lg">`
- [ ] Email field: `<Input label leftIcon error>` primitive
- [ ] Password field: `<Input>` with show/hide eye toggle (rightIcon)
- [ ] Submit: `<Button label="Sign in" size="lg" fullWidth loading={isSubmitting} />`
- [ ] `react-hook-form` + `zod` schema — no ad-hoc useState validation
- [ ] Validation errors inline under fields
- [ ] Zero `Alert.alert` calls
- [ ] All `accessibilityRole` + `accessibilityLabel` present
- [ ] `StyleSheet.create` block deleted

### pending.tsx
- [ ] Layout uses NativeWind classes
- [ ] CTA button uses `<Button>` primitive
- [ ] `StyleSheet.create` block deleted (if any)

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
