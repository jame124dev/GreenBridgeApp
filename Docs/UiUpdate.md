# UI Update: Ruleset Alignment (V2)

This document outlines the sections and exact pages of the codebase that require refactoring to align with the authoritative [react_native_marketplace_ruleset_v2.md](file:///C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/Docs/react_native_marketplace_ruleset_v2.md).

## 1. Constants & Styling Config
- [ ] **Create `constants/theme.ts`**: Host all raw tokens (colors, spacing, radius, typography, elevation, motion, layout).
- [ ] **Update `tailwind.config.js`**: Extend NativeWind themes using tokens imported from `constants/theme.ts` (extend colors, spacing, borderRadius, and fontFamily).
- [ ] **Clean up `src/theme/`**: Redirect or consolidate the current separate theme files into the single `constants/theme.ts` source of truth.

## 2. Core UI Primitives (`components/ui/`)
- [ ] **Text Component (`components/ui/Text.tsx`)**:
  - Implement variant-based text wrapper using NativeWind utility classes.
- [ ] **Button Component (`components/ui/Button.tsx`)**:
  - Refactor to `AnimatedPressable` using Reanimated 3 scale transitions (`onPressIn` scale to 0.97, `onPressOut` scale to 1).
  - Integrate `expo-haptics` impact feedback on press.
  - Implement variants (`primary`, `secondary`, `ghost`, `destructive`) and sizes (`sm`, `md`, `lg`) using Tailwind.
- [ ] **Input Component (`components/ui/Input.tsx`)**:
  - Refactor using NativeWind utility classes.
  - Implement focused, default, and error states with inline validation labels.
- [ ] **Card Component (`components/ui/Card.tsx`)**:
  - Implement `flat`, `elevated`, and `outlined` variants using Tailwind classes.
- [ ] **Badge, Avatar, Chip, and EmptyState Components**:
  - Standardize styling, theme color consumption, and structure using Tailwind.
- [ ] **BottomSheet / Sheet Component**:
  - Refactor dialogs and modals to use `@gorhom/bottom-sheet` v5.

## 3. Layout Wrapper (`components/layout/`)
- [ ] **Screen Component (`components/layout/Screen.tsx`)**:
  - Standardize `<Screen>` wrapper with NativeWind layout defaults, scroll options, and `SafeAreaView` top edge insets.

## 4. Application Pages to Refactor & Align

### Authentication & Initial Screens
- [ ] **[login.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(auth)/login.tsx)**:
  - Replace custom StyleSheet styles with NativeWind utility classes.
  - Migrate inputs and CTA buttons to the new `<Input>` and `<Button>` primitives.
  - Consolidate inline error displays; eliminate redundant toasts during client validation.
- [ ] **[pending.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(auth)/pending.tsx)**:
  - Update layout elements and CTA buttons to use NativeWind and core primitives.

### Main Navigation Tabs
- [ ] **[index.tsx (Feed/Discover)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(tabs)/index.tsx)**:
  - Refactor feed list to strictly use `FlashList` with `estimatedItemSize`.
  - Memoize item rendering and wrap cards with `React.memo`.
  - Port core `<Image>` components to `expo-image` with transitions.
- [ ] **[history.tsx (User Submissions)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(tabs)/history.tsx)**:
  - Refactor user submission lists to conform to `FlashList` memoization and estimated sizes rules.
  - Port inline layouts and styling to Tailwind classes.
- [ ] **[inbox.tsx (Chat/Messages)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(tabs)/inbox.tsx)**:
  - Style message lists and bubbles using the core text tokens and NativeWind classes.
- [ ] **[profile.tsx (Settings/Profile)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(tabs)/profile.tsx)**:
  - Replace native `Alert.alert` setting saves and language pickers with Gorhom Bottom Sheets.
  - Apply standard primitive components (`Card`, `Button`, `Input`) to settings forms.
- [ ] **[scan.tsx (Redirect)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/(tabs)/scan.tsx)**:
  - Update route transitions to align with animation standards.

### Scanner Workflow Flow
- [ ] **[camera.tsx (Photo Capture)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/camera.tsx)**:
  - Restructure camera overlays and control buttons with NativeWind.
  - Ensure light haptics trigger on shutter click.
- [ ] **[listing-method.tsx (Upload Selection)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/listing-method.tsx)**:
  - Refactor selection cards to utilize the custom `<Card>` and `<Button>` components.
- [ ] **[reorder-photos.tsx (Grid Sort)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/reorder-photos.tsx)**:
  - Align photo-ordering grid interactions to Reanimated 3 standard timing constants.
- [ ] **[processing.tsx (OCR Loading)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/processing.tsx)**:
  - Align progress indicator/shimmer layout to skeleton rendering standards (no blocking spin modals).
- [ ] **[detail.tsx (Listing Create Form)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/detail.tsx)**:
  - Refactor the complex metadata form (title, category, starting price, etc.) to use `react-hook-form` + `zod` resolver.
  - Re-align inputs and selections to use custom `<Input>` and `@gorhom/bottom-sheet` selectors.
  - Remove inline raw CSS/StyleSheet styles.
- [ ] **[grouped-review.tsx (Batch Review)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/grouped-review.tsx)**:
  - Ensure lists of batch items use FlashList layout estimation rules.
  - Style tables and metadata using NativeWind classes.
- [ ] **[success.tsx (Success Screen)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/scan/success.tsx)**:
  - Standardize success feedback animations and transitions.

### Miscellaneous Pages & Layouts
- [ ] **[history.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/activity/history.tsx)**:
  - Align styling and list components to history tab standard rules.
- [ ] **[[id].tsx (Listing Detail)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/listing/[id].tsx)**:
  - Re-style product details, bid lists, dynamic pricing indicators, and gallery carousels using NativeWind and `expo-image`.
  - Replace native modals with `@gorhom/bottom-sheet` wrappers.
- [ ] **[_layout.tsx (Root Layout)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/_layout.tsx)**:
  - Clean up dependencies, wrap loaders, and manage standard font assets.
- [ ] **[+not-found.tsx (404 Page)](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/+not-found.tsx)**:
  - Style with NativeWind layout helpers.
