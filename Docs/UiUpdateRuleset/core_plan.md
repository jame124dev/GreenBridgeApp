# Plan: Core Styling & UI Primitives Refactoring

This plan details the foundation updates needed to support NativeWind v4 and the ruleset-compliant UI primitives across the application. These core changes must be completed first before refactoring any feature screens.

---

## 1. Styling & Token Foundation

Consolidate all design tokens and configure NativeWind to use them as the single source of truth.

- [x] **Create `src/constants/theme.ts`**:
  - **Colors**: Define the primary green (`colors.primary.50` to `900`), neutral scale (`colors.neutral.0` to `950`), semantic statuses (`success`, `warning`, `danger`, `info`), and theme roles (`light` and `dark` configurations for background, surface, borders, and text).
  - **Spacing**: Use standard spacing steps (`xs` to `6xl`).
  - **Radius**: Define radii scale (`sm` to `full`).
  - **Typography**: Configure sizes, line heights, and weights for the 7 roles (`caption`, `bodySm`, `body`, `bodyMd`, `subtitle`, `title`, `hero`).
  - **Elevation**: Shadow configurations for `sm`, `md`, and `lg`.
  - **Motion**: Define timing durations and spring configurations.
  - **Layout**: Logical padding defaults and minimum touch target size ($48$).
- [x] **Configure `tailwind.config.js`**:
  - Extend tailwind values using the tokens imported directly from `./src/constants/theme.ts`.
  - Connect font families (`sans`, `sans-medium`, `sans-bold`, `mono`) to the loaded Inter and JetBrains Mono weights.
- [x] **Clean Up Current Theme Files**:
  - Consolidate configurations from `src/theme/colors.ts`, `radius.ts`, `spacing.ts`, `sizes.ts`, `typography.ts` into `src/constants/theme.ts`.
  - Update general code exports in `src/theme/index.ts` to redirect to the new tokens.

---

## 2. Layout & Base UI wrappers

- [x] **Base Text Component (`src/components/ui/Text.tsx` [NEW])**:
  - Implement a standard typography component mapping the 7 typography roles and color tones (primary, secondary, tertiary, inverse, danger, brand) to NativeWind styles.
- [x] **Base Screen Wrapper (`src/components/ui/Screen.tsx` [REFACTOR])**:
  - Restructure to map the ruleset layout defaults using NativeWind utility classes (`flex-1 bg-bg`), scroll options, and safe area insets.

---

## 3. Core Interactive UI Primitives

- [x] **Base Button Component (`src/components/ui/Button.tsx` [REFACTOR])**:
  - Refactor to `AnimatedPressable` using Reanimated 3 scale timings (`onPressIn` scale to 0.97, `onPressOut` scale to 1).
  - Integrate physical feedback using `expo-haptics` on press.
  - Implement NativeWind configurations for variants (`primary`, `secondary`, `ghost`, `destructive`) and sizes (`sm`, `md`, `lg` maintaining safe touch sizes).
- [x] **Base Input Component (`src/components/ui/Input.tsx` [REFACTOR])**:
  - Refactor using NativeWind class styling.
  - Standardize focus, default, and error states.
  - Show input validation messages and hints inline underneath the input box.
- [x] **Base Card Component (`src/components/ui/Card.tsx` [REFACTOR])**:
  - Support flat, elevated, and outlined variants using Tailwind classes.
