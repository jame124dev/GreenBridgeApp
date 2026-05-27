# UI Update Ruleset Plan: Auth Screens Refactoring

This document outlines the step-by-step plan to migrate the **Auth Screens** (`login.tsx` and `pending.tsx`) to match the ruleset specification. Because these screens depend on the core styling tokens and components, the plan includes setting up the foundations first.

---

## Existing UI Primitives Found in `src/components/ui/`
We scanned `src/components/ui/` and found the following components that need to be aligned with the ruleset:
- **`src/components/ui/Button.tsx`**: Currently custom StyleSheet-styled. Needs to be replaced with the Reanimated + timing scale + NativeWind v4 spec.
- **`src/components/ui/Input.tsx`**: Currently custom StyleSheet-styled. Needs focused/error outlines and NativeWind styling.
- **`src/components/ui/Card.tsx`**: Currently custom StyleSheet-styled. Needs flat/elevated/outlined Tailwind spec.
- **`src/components/ui/Screen.tsx`**: Currently custom StyleSheet-styled. Needs layout/safe-area/NativeWind alignment.
- **`src/components/ui/Badge.tsx`**: Needs color mapping/Tailwind alignment.
- **`src/components/ui/EmptyState.tsx`**: Needs ruleset integration.
- **`src/components/ui/SelectButton.tsx`**: Flat styled, needs Reanimated timing scaling.
- **`src/components/ui/Sheet.tsx`**: Wrapper around BottomSheet.
- **`src/components/ui/Field.tsx`**: Input wrapper for labels and errors.

We also need to **create** a new primitive:
- **`src/components/ui/Text.tsx`**: Essential standard wrapper for typography roles.

---

## Step-by-Step Execution Plan

### Step 1: Styling & Token Foundation
1. **Create `src/constants/theme.ts`**:
   - Write the single source of truth for colors (primary green, neutral scale, semantic indicators, role colors for light/dark themes), spacing tokens, border radii, typography sizes, shadow elevations, and motion durations.
2. **Synchronize `tailwind.config.js`**:
   - Update it to import `colors`, `spacing`, and `radius` from `./src/constants/theme.ts`.
   - Map font families to use loaded `Inter` weights (`sans`, `medium`, `semi`, `bold`).
3. **Build layout and text wrappers**:
   - Create/Align `src/components/ui/Screen.tsx` using `SafeAreaView` and NativeWind defaults.
   - Create `src/components/ui/Text.tsx` using standard typography size/line-height bindings and tone mappings.

### Step 2: Custom UI Primitives Refactoring
1. **Refactor `src/components/ui/Button.tsx`**:
   - Implement timing-based scale down/up on press using Reanimated 3 (`onPressIn` and `onPressOut` updating a scale shared value).
   - Integrate `expo-haptics` (trigger `Haptics.impactAsync(Light)` on successful tap).
   - Map colors to standard variants (`primary`, `secondary`, `ghost`, `destructive`) and heights/paddings to standard sizes (`sm`, `md`, `lg`) using NativeWind.
2. **Refactor `src/components/ui/Input.tsx`**:
   - Apply NativeWind styling for focused, unfocused, and error borders.
   - Add native elements for leading/trailing icons and inline validation labels under the inputs.
3. **Refactor `src/components/ui/Card.tsx`**:
   - Implement `flat`, `elevated`, and `outlined` variants styled via Tailwind classes.

### Step 3: Refactoring `login.tsx` (Sign-In Page)
**Path:** `app/(auth)/login.tsx`
1. **Layout & Wrapper Update**:
   - Wrap the login screen in `<Screen keyboardAware padded={false}>`.
   - Port the top green hero banner to NativeWind styles.
   - Wrap the main form card in `<Card variant="flat">` with rounded edge tokens.
2. **Form & Controls Update**:
   - Refactor inputs to use the new ruleset `<Input>` component (binding focused border colors, labels, and errors).
   - Port the password visibility toggle to map cleanly inside the `<Input>` right-icon action.
   - Swap the raw Submit pressable for the new ruleset `<Button>` (pill shape, scale on tap, loading spinner, and haptic integration).
3. **Validation & Dialog Cleanup**:
   - Ensure all input fields display validation errors *only* inline below each input (eliminating blocking native popups).
   - Keep the Sonner-native Toast for major server-side errors (such as invalid credentials or missing connection).
4. **StyleSheet Removal**:
   - Delete all custom `StyleSheet.create` styles and replace them entirely with NativeWind classes.
5. **Accessibility Attributes**:
   - Add explicit `accessibilityRole="button"` and `accessibilityLabel` attributes to interactive elements.

### Step 4: Refactoring `pending.tsx` (Pending Screen)
**Path:** `app/(auth)/pending.tsx`
1. **Layout & Primitives**:
   - Wrap the screen in `<Screen padded={false}>` and use standard layouts.
   - Use the new `<Text>` and `<Button>` components for the messaging and CTAs.
2. **Tailwind Styling**:
   - Port custom CSS styles and container layouts to NativeWind classes.
   - Ensure the layout is fully responsive and matches the branding alignment.
