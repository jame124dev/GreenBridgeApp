# Plan: "Me" / Settings Screen Refactoring (Ruleset Alignment)

Target file: **`app/(tabs)/profile.tsx`** (the bottom-tab labelled **"Me"** — internally `SettingsScreen`, route `routes.profile`). Sub-components in the same file: `InterestChips`, `InterestsSheet`.

Unlike `login.tsx` and the home screen, this screen has **not** been migrated yet. It currently uses `StyleSheet.create`, raw `Text` from `react-native`, `@/theme` tokens, and ad-hoc `useState` forms with blocking `Alert.alert` popups. This plan brings it onto the ruleset (`react_native_marketplace_ruleset_v2.md`).

> Status: **not started.** Boxes are unchecked on purpose — check them as each lands, like the other plans.

---

## 0. Current-state audit (what's wrong vs. the ruleset)

| Area | Today | Ruleset rule |
|---|---|---|
| Styling | `StyleSheet.create` block (~80 lines) + inline `style={{...}}` | §4/§22 — NativeWind classes + `@/constants/theme` tokens |
| Typography | raw `Text` from `react-native`, `fonts`/`fontSize` from `@/theme` | §6 — `<Text>` primitive with `variant`/`tone` |
| Forms | 14 `useState` fields, no schema | §13 — `react-hook-form` + `zod`, no ad-hoc validation |
| Validation / feedback | `Alert.alert(...)` for required/mismatch + success | §16 — inline `Input` `error`; transient success via Toast (sonner-native), not blocking alerts |
| File size | ~800 lines, 4 form sections + 5 sheets in one file | §21 — >300 lines is a refusal; split into a feature module |
| Loading | full-screen `ActivityIndicator` | §16 — skeleton matching final layout |
| Token source | `@/theme` (legacy) | migrated primitives use `@/constants/theme` |

---

## 1. Structure / Decomposition (do this first)

- [ ] **Create a `features/settings/` (or `features/profile/`) module** per ruleset §3 and move logic out of the route file:
  - `features/settings/store.ts` or hooks — keep the form wiring (already have `useUserProfile`, `useUpdateUserSettings`, `useLogout`).
  - `features/settings/components/` — extract `ProfileInfoCard`, `AddressCard`, `SecurityCard`, `LanguageRegionCard`, `ProfileHero`, `InterestChips`, `InterestsSheet`, and the four picker sheets (`IndustrySheet`, `LanguageSheet`, `TimezoneSheet`, `CurrencySheet`).
  - `features/settings/constants.ts` — move `INDUSTRY_OPTIONS`, `LANGUAGE_OPTIONS`, `TIMEZONE_OPTIONS`, `CURRENCY_OPTIONS`.
- [ ] **`app/(tabs)/profile.tsx` becomes a thin route** — composes the hero + the section cards + sheets, no business logic (§3 rule: `app/` may not contain business logic).
- [ ] Each extracted component stays **< 200 lines** (§21).

---

## 2. Hero Block (`ProfileHero`)

- [ ] Keep the `LinearGradient` hero (gradients are allowed only on hero banners — §21).
- [ ] Convert `styles.hero`, `heroAvatar`, `heroName`, `heroEmail`, `heroRolePill` to NativeWind classes; keep the bottom-rounded sheet shape.
- [ ] Avatar initials, name → `<Text variant="title"/"hero" tone="inverse">`; email → `<Text variant="bodySm" tone="inverse">` with reduced opacity; role pill text → `<Text variant="caption" tone="inverse">` uppercase.
- [ ] No pure white text on the gradient without a contrast check (§17/§21) — use the inverse tone token, not raw `#FFF` where avoidable.

---

## 3. Section Cards (Profile / Address / Security / Language & Region)

- [ ] Keep the existing `<Card>` + `<Card.Header>` + `<Card.Body>` primitives (already ruleset-refactored in `core_plan.md`). Verify `Card.Header` icon tiles use token backgrounds (`primarySurface`, `destructiveBg`, `infoBg`).
- [ ] Replace `styles.cardWrap` / `styles.titleBlock` / `styles.row` spacing with NativeWind tokens (`mx-3xl mt-2xl`, `gap-xl`, etc. — only `spacing` tokens, §5).
- [ ] All field labels/hints flow through `<Field>` + `<Input>` / `<SelectButton>` primitives (already in place — keep).
- [ ] Section "Save" buttons: keep `<Button leftIcon={Save} loading={...} fullWidth>` — already ruleset-shaped.

---

## 4. Forms → react-hook-form + zod (§13) — the biggest gap

- [ ] Replace the 14 individual `useState` hooks with **`react-hook-form`**, one form (or one per card section), seeded from `profileQuery.data` via `reset()` instead of the current `set-state-in-effect` block (removes the eslint-disable).
- [ ] Define **`zod` schemas** per section: profile info, address, security (current/new/confirm with `.refine` for match), language/region.
- [ ] **Security validation** (`passwordRequired`, `passwordMismatch`) moves from `Alert.alert` to **inline `Input` `error`** props (§16) — no blocking popups.
- [ ] **Success / API-error feedback** moves from `Alert.alert` to **sonner-native `toast`** (already used on the home screen) — `toast.success(savedToast)` / `toast.error(...)`. Keep haptics (`success`/`error`) — §12.

---

## 5. Sheets (Industry / Language / Timezone / Currency / Interests)

- [ ] Keep `@gorhom`-based `<Sheet>` + `<Sheet.Option>` (§11). Confirm standard snap behavior and backdrop.
- [ ] `InterestChips`: convert `styles.chipWrap` / `styles.chip` / `styles.chipText` to NativeWind; chip uses `primarySurface` bg + `primaryBorder` + `<Text variant="bodySm" tone="brand">`; remove `X` button stays accessible (`accessibilityLabel`).

---

## 6. Accessibility & polish (§17, §16)

- [ ] Every `Pressable` (chips remove, sheet triggers, sign-out) gets `accessibilityRole="button"` + `accessibilityLabel`.
- [ ] Touch targets ≥ 48 (Save/Sign-out buttons already are via `Button` sizes).
- [ ] Replace the full-screen `ActivityIndicator` loading state with a **skeleton** matching the hero + first card shape (§16).
- [ ] Sign-out stays `variant="danger"`; confirm destructive haptic (`warning`) — §12.

---

## 7. StyleSheet & token cleanup

- [ ] Delete the entire `StyleSheet.create` block once all styles are ported.
- [ ] Swap `@/theme` imports for `@/constants/theme` tokens / NativeWind classes (align with the migrated primitives). No inline hex / px / fontSize (§21).

---

## 8. Verification (run §24 checklist before closing)

- [ ] `npx tsc --noEmit` clean (from `GreenBridgeApp/`).
- [ ] `npx eslint app/(tabs)/profile.tsx features/settings/**` clean.
- [ ] No remaining `Alert.alert`, no `StyleSheet.create`, no raw `react-native` `Text` in the screen.
- [ ] Manual: edit + save each section (toast + inline errors), open each sheet, sign out.
