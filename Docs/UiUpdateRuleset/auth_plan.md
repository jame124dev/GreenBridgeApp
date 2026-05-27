# Plan: Auth Screens Refactoring (Ruleset Alignment)

This plan details the migration of the authentication pages (`login.tsx` and `pending.tsx`) to match the NativeWind styling configurations and custom UI primitives.

---

## 1. Login Screen (`app/(auth)/login.tsx`)

- [x] **Base Layout Refactoring**:
  - Wrap the screen in `<Screen keyboardAware scroll={false} padded={false}>`.
  - Convert custom stylesheet `styles.hero` and `styles.heroContent` to NativeWind classes.
  - Wrap the forms card in `<Card variant="flat" className="mt-[-28px] mx-lg p-lg gap-lg">`.
- [x] **Custom UI Primitives Integration**:
  - Replace `Mail` and `Lock` controllers input wrappers with the new ruleset `<Input>` primitive.
  - Pass labels, leftIcons, and React Hook Form validation errors directly to the `<Input>` properties (`label`, `error`, `leftIcon`).
  - Swap the submit Button with the ruleset-aligned `<Button label="Sign in" size="lg" fullWidth />`.
  - Swap the "Forgot password?" Link Pressable with the new ruleset `<Text>` primitive styled as clickable.
- [x] **Validation Dialog Elimination**:
  - Ensure client-side schema validation failures do not trigger standard native `Alert` popups.
  - Redundant toasts on invalid client inputs are replaced by inline red highlighted fields.
- [x] **StyleSheet Elimination**:
  - Fully delete the `StyleSheet.create` block at the bottom of the file.
- [x] **Accessibility and Haptics**:
  - Ensure all interactive nodes have appropriate `accessibilityRole` and `accessibilityLabel` attributes.

---

## 2. Pending Registration Screen (`app/(auth)/pending.tsx`) (Not Required)

- [x] **No Changes Required**: Kept in its original state as requested.
