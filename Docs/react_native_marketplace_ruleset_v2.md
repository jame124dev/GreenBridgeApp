# React Native Marketplace App — AI IDE Ruleset (2026)

> **For the AI IDE:** This document is authoritative. When a rule has a number, use that number. When code is shown, match its shape. When a token name is defined, import it — never inline the value. If a rule conflicts with your prior training, this document wins.

---

## 1. Scope & Target

Build premium marketplace/social apps in the spirit of Swiggy, Zomato, Instagram, OLX, Shopify, Uber Eats, Pinterest. Cross-platform (iOS + Android), production-grade, native-feeling.

**Brand:** Green-primary marketplace (GreenBidz-style). Eco/auction/marketplace tone — clean, trustworthy, action-oriented.

---

## 2. Tech Stack (Locked)

| Layer | Library | Notes |
|---|---|---|
| Runtime | Expo SDK (latest stable) | Use **dev client**, not Expo Go (MMKV + Reanimated require it) |
| Language | TypeScript (strict mode on) | No `any` without `// @reason` comment |
| Navigation | Expo Router | File-based routing |
| Styling | NativeWind v4 | Tailwind classes; use theme tokens (Section 4) |
| Animation | Reanimated 3 + Gesture Handler | Worklets where possible |
| Lists | FlashList v2 | Never use `FlatList` for >20 items |
| Sheets | `@gorhom/bottom-sheet` v5 | All modals/filters/actions |
| State | Zustand | Feature-scoped stores |
| Server state | TanStack Query v5 | Mandatory for all API data |
| Storage | `react-native-mmkv` | No AsyncStorage |
| Icons | `lucide-react-native` | Outlined only |
| Images | `expo-image` | Never `Image` from RN core |
| Forms | `react-hook-form` + `zod` | All forms, no exceptions |
| Haptics | `expo-haptics` | See Section 12 |
| i18n | `i18next` + `react-i18next` | All user-facing strings via `t()` |

---

## 3. Folder Structure

```txt
app/                    # Expo Router routes only — no business logic
  (tabs)/
  (auth)/
  _layout.tsx
features/               # Feature modules — primary work area
  auth/
    components/
    hooks/
    api/
    store.ts
    types.ts
  feed/
  listings/
  bidding/
  profile/
components/             # Cross-feature shared components
  ui/                   # Primitives: Button, Card, Input, Sheet, etc.
  layout/               # Screen, Section, SafeArea wrappers
hooks/                  # Cross-feature hooks only
lib/                    # Third-party config: queryClient, mmkv, i18n
services/               # API clients per domain
constants/              # theme.ts, config.ts
utils/                  # Pure functions only — no React imports
```

**Rules:**
- A file in `app/` may import from `features/` and `components/`. It may **not** contain business logic, API calls, or stores.
- `features/x/` may import from `components/`, `lib/`, `utils/`, `hooks/`. It may **not** import from another feature directly — go through a public `index.ts`.
- `utils/` must be pure (testable without React Native).

---

## 4. Theme Tokens (Source of Truth)

All colors, spacing, radii, and typography live in `constants/theme.ts`. **Never inline these values.** NativeWind classes are configured to consume these tokens via `tailwind.config.js`.

### `constants/theme.ts`

```ts
export const colors = {
  // Brand — GreenBidz-inspired green primary
  primary: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',   // ← default primary
    600: '#059669',   // ← pressed / strong
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Neutral surfaces & text
  neutral: {
    0:   '#FFFFFF',
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0B1220',
  },

  // Semantic
  success: '#16A34A',
  warning: '#F59E0B',
  danger:  '#DC2626',
  info:    '#0EA5E9',

  // Roles (light theme)
  light: {
    background:   '#FFFFFF',
    surface:      '#F9FAFB',
    surfaceAlt:   '#F3F4F6',
    border:       '#E5E7EB',
    borderStrong: '#D1D5DB',
    textPrimary:   '#111827',
    textSecondary: '#4B5563',
    textTertiary:  '#9CA3AF',
    textInverse:   '#FFFFFF',
  },
  // Roles (dark theme)
  dark: {
    background:   '#0F172A',
    surface:      '#111827',
    surfaceAlt:   '#1E293B',
    border:       '#1F2937',
    borderStrong: '#374151',
    textPrimary:   '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary:  '#9CA3AF',
    textInverse:   '#0F172A',
  },
} as const;

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,   // ← default for cards & sheets
  full: 9999,
} as const;

export const typography = {
  // size / lineHeight / weight
  caption:  { size: 12, line: 16, weight: '500' },
  bodySm:   { size: 14, line: 20, weight: '400' },
  body:     { size: 16, line: 24, weight: '400' },
  bodyMd:   { size: 16, line: 24, weight: '500' },
  subtitle: { size: 18, line: 26, weight: '600' },
  title:    { size: 24, line: 30, weight: '700' },
  hero:     { size: 32, line: 38, weight: '700' },
} as const;

export const elevation = {
  // Subtle only. Used sparingly.
  none: { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const motion = {
  // Durations (ms)
  tap:        100,
  micro:      150,
  short:      220,
  medium:     280,
  long:       360,
  // Easings — use Reanimated's Easing
  easeOut:    'easeOut',
  easeInOut:  'easeInOut',
  spring:     { damping: 18, stiffness: 220, mass: 1 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
} as const;

export const layout = {
  screenPaddingX: spacing.lg,    // 16
  sectionGap:     spacing['2xl'], // 24
  cardPadding:    spacing.lg,    // 16
  minTouch:       48,            // Cross-platform safe (≥ Material 48, > iOS 44)
} as const;
```

### `tailwind.config.js` (excerpt)

```js
const { colors, spacing, radius } = require('./constants/theme');

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger:  colors.danger,
        info:    colors.info,
        bg:      colors.light.background,
        surface: colors.light.surface,
        border:  colors.light.border,
      },
      spacing,
      borderRadius: radius,
      fontFamily: {
        sans:   ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semi:   ['Inter_600SemiBold'],
        bold:   ['Inter_700Bold'],
      },
    },
  },
};
```

---

## 5. Spacing & Layout Rules

- **Allowed values:** only tokens from `spacing`. No `padding: 7`, no `marginTop: 13`.
- **Screen horizontal padding:** `spacing.lg` (16).
- **Section vertical gap:** `spacing['2xl']` (24) standard, `spacing['3xl']` (32) for major breaks.
- **Card internal padding:** `spacing.lg` (16) default, `spacing.xl` (20) for hero/featured cards.
- **List item gap:** `spacing.md` (12) compact lists, `spacing.lg` (16) standard.
- **Form field vertical gap:** `spacing.lg` (16).

**Screen wrapper pattern (always use):**

```tsx
// components/layout/Screen.tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';

export function Screen({ children, scroll = false, padded = true }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className={padded ? 'flex-1 px-lg' : 'flex-1'}>
        {children}
      </View>
    </SafeAreaView>
  );
}
```

---

## 6. Typography Rules

- **Use only the 7 roles** in `typography`. Never inline `fontSize`.
- **Font family:** Inter (load via `expo-font` + `@expo-google-fonts/inter`). Fallback to system.
- **Max 4 roles per screen.** Hero/title/body/caption is a typical set.
- **Color roles** (light theme):
  - Headings/primary content → `neutral.900`
  - Body text → `neutral.700`
  - Secondary/meta → `neutral.500`
  - Disabled/hints → `neutral.400`
- **Never** use pure `#000` for text.

**`<Text>` wrapper (use everywhere):**

```tsx
// components/ui/Text.tsx
import { Text as RNText, TextProps } from 'react-native';
import { typography } from '@/constants/theme';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'danger' | 'brand';

const toneClass: Record<Tone, string> = {
  primary:   'text-neutral-900',
  secondary: 'text-neutral-700',
  tertiary:  'text-neutral-500',
  inverse:   'text-white',
  danger:    'text-danger',
  brand:     'text-primary-600',
};

export function Text({
  variant = 'body',
  tone = 'primary',
  className = '',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = typography[variant];
  return (
    <RNText
      className={`${toneClass[tone]} ${className}`}
      style={[{ fontSize: t.size, lineHeight: t.line, fontWeight: t.weight as any }, style]}
      {...rest}
    />
  );
}
```

---

## 7. Component Contracts

Every primitive in `components/ui/` follows the same prop shape: `variant`, `size`, `disabled`, `loading` (where applicable), `leftIcon`, `rightIcon`. No surprises.

### 7.1 Button

```tsx
// components/ui/Button.tsx
import { Pressable, ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { motion } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  haptic?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:     'bg-primary-500 active:bg-primary-600',
  secondary:   'bg-neutral-100 active:bg-neutral-200',
  ghost:       'bg-transparent active:bg-neutral-100',
  destructive: 'bg-danger active:opacity-90',
};

const variantText: Record<Variant, 'inverse' | 'primary' | 'brand'> = {
  primary:     'inverse',
  secondary:   'primary',
  ghost:       'brand',
  destructive: 'inverse',
};

// Height in px → enforces 48dp min touch target
const sizeClasses: Record<Size, { container: string; text: 'bodySm' | 'body' | 'bodyMd' }> = {
  sm: { container: 'h-12 px-lg',  text: 'bodySm' },  // 48
  md: { container: 'h-14 px-xl',  text: 'bodyMd' },  // 56
  lg: { container: 'h-16 px-2xl', text: 'bodyMd' },  // 64
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  disabled, loading, leftIcon: LeftIcon, rightIcon: RightIcon,
  fullWidth, haptic = true,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sz = sizeClasses[size];

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withTiming(0.97, { duration: motion.tap }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: motion.tap }); }}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled || loading}
      style={animatedStyle}
      className={`
        ${sz.container} ${variantClasses[variant]}
        rounded-2xl flex-row items-center justify-center
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50' : ''}
      `}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'destructive' ? '#fff' : '#10B981'} />
      ) : (
        <View className="flex-row items-center gap-sm">
          {LeftIcon && <LeftIcon size={20} color={variantText[variant] === 'inverse' ? '#fff' : '#111827'} />}
          <Text variant={sz.text} tone={variantText[variant]} className="font-semi">{label}</Text>
          {RightIcon && <RightIcon size={20} color={variantText[variant] === 'inverse' ? '#fff' : '#111827'} />}
        </View>
      )}
    </AnimatedPressable>
  );
}
```

### 7.2 Card

```tsx
// components/ui/Card.tsx
import { View, ViewProps } from 'react-native';

type Variant = 'flat' | 'elevated' | 'outlined';

const variants: Record<Variant, string> = {
  flat:     'bg-surface',
  elevated: 'bg-white shadow-sm',  // Use elevation.sm via tailwind plugin or style prop
  outlined: 'bg-white border border-border',
};

export function Card({
  variant = 'flat',
  className = '',
  ...rest
}: ViewProps & { variant?: Variant }) {
  return <View className={`rounded-2xl p-lg ${variants[variant]} ${className}`} {...rest} />;
}
```

### 7.3 Input

```tsx
// components/ui/Input.tsx
import { useState } from 'react';
import { View, TextInput, TextInputProps } from 'react-native';
import { Text } from './Text';
import { LucideIcon } from 'lucide-react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
}

export function Input({ label, error, hint, leftIcon: L, rightIcon: R, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderClass = error
    ? 'border-danger'
    : focused
      ? 'border-primary-500'
      : 'border-border';

  return (
    <View className="gap-xs">
      {label && <Text variant="bodySm" tone="secondary" className="font-medium">{label}</Text>}
      <View className={`flex-row items-center gap-sm h-14 px-lg rounded-xl bg-white border ${borderClass}`}>
        {L && <L size={20} color="#6B7280" />}
        <TextInput
          className="flex-1 text-neutral-900"
          style={{ fontSize: 16 }}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {R && <R size={20} color="#6B7280" />}
      </View>
      {(error || hint) && (
        <Text variant="caption" tone={error ? 'danger' : 'tertiary'}>
          {error || hint}
        </Text>
      )}
    </View>
  );
}
```

### 7.4 Other primitives to build to the same spec

- `Badge` — variants: `default | success | warning | danger | info`
- `Avatar` — sizes: `sm | md | lg | xl`; supports fallback initials
- `Chip` — variants: `default | selected`; for filters/categories
- `Sheet` — wrapper around Gorhom; standard snap points `['25%', '50%', '90%']`
- `Skeleton` — shimmer; sizes match content
- `EmptyState` — icon + title + description + CTA
- `Toast` — semantic colors, auto-dismiss 3s

---

## 8. Lists (FlashList rules)

- **Always** specify `estimatedItemSize`.
- Use `keyExtractor` returning a stable string ID (never index).
- Memoize `renderItem` with `useCallback`.
- Item components must be wrapped in `React.memo`.
- Use `ItemSeparatorComponent` for gaps, not margin on items.

```tsx
<FlashList
  data={listings}
  renderItem={renderListing}
  keyExtractor={(item) => item.id}
  estimatedItemSize={96}
  ItemSeparatorComponent={() => <View className="h-md" />}
  onEndReached={fetchNextPage}
  onEndReachedThreshold={0.5}
  ListEmptyComponent={<EmptyState ... />}
  ListFooterComponent={isFetchingNext ? <Skeleton /> : null}
/>
```

---

## 9. Images

- **Always** `expo-image`, never RN `Image`.
- **Always** specify `contentFit`, a `placeholder` (blurhash), and a `transition`.
- Aspect ratios: product cards `1:1`, hero `16:9`, avatars `1:1`.

```tsx
<Image
  source={{ uri: item.imageUrl }}
  placeholder={{ blurhash: item.blurhash }}
  contentFit="cover"
  transition={200}
  style={{ aspectRatio: 1, borderRadius: 16 }}
/>
```

---

## 10. Animation Standards

| Interaction | Duration | Notes |
|---|---|---|
| Tap feedback (scale) | `motion.tap` (100ms) | Scale to 0.97 |
| Micro (icon swap, badge) | `motion.micro` (150ms) | |
| Card open / route push | `motion.short` (220ms) | |
| Modal / sheet | `motion.medium` (280ms) | Spring preferred |
| Hero / large transitions | `motion.long` (360ms) | Use sparingly |

- **Worklets only** for gesture-driven animation.
- **No layout animation on lists** beyond `LinearTransition` opt-in per item.
- **No bounce** on standard buttons. Springs reserved for sheets/drags.
- **`useReducedMotion`** must be respected — guard non-essential animations.

```tsx
import { useReducedMotion } from 'react-native-reanimated';

const reduced = useReducedMotion();
const duration = reduced ? 0 : motion.short;
```

---

## 11. Bottom Sheets (Gorhom)

- All filters, action menus, item details, and pickers use sheets — not full-screen modals.
- Standard snap points: `['25%', '50%', '90%']`. Don't invent new ones without reason.
- Always include `BottomSheetBackdrop` with `disappearsOnIndex={-1}`.
- Sheet content: padded with `spacing.lg`, drag handle visible.

---

## 12. Haptics Policy

| Trigger | Haptic |
|---|---|
| Primary button press | `Light` impact |
| Destructive confirm | `Medium` impact |
| Success (bid placed, order confirmed) | `Notification.Success` |
| Error (validation, API fail) | `Notification.Error` |
| Selection change (tabs, chips) | `Selection` |
| Long-press / drag start | `Medium` impact |

Never on scroll, never on every keystroke.

---

## 13. Forms (react-hook-form + zod)

- All forms use `react-hook-form` with a `zod` schema. No ad-hoc `useState` validation.
- Errors render inline below the field via the `Input` component's `error` prop.
- Submit buttons show `loading` state during async work.

```tsx
const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
  resolver: zodResolver(schema),
});
```

---

## 14. Server State (TanStack Query)

- All network data goes through TanStack Query. No `useEffect` + `fetch`.
- Query keys are arrays: `['listings', { category, sort }]`.
- Default `staleTime`: 60s. Long-lived data: 5min. Real-time data (bids): 0.
- Optimistic updates for: favoriting, bid placement, cart add/remove.
- Mutations always invalidate the relevant query keys on success.

```ts
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
```

---

## 15. Client State (Zustand)

- One store per feature: `features/auth/store.ts`, `features/cart/store.ts`.
- Persist via MMKV when needed (auth tokens, cart, preferences).
- Never store server data in Zustand — that's TanStack Query's job.

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkv';

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cart', storage: createJSONStorage(() => mmkvStorage) }
  )
);
```

---

## 16. Loading, Empty, and Error States

**Every screen with async data ships all three.**

- **Loading:** skeleton matching the final layout shape. No spinners on full screens.
- **Empty:** `<EmptyState>` with icon, title, one-line description, primary CTA.
- **Error:** inline message + retry button. Toast for transient errors.

---

## 17. Accessibility (Non-negotiable)

- Every interactive element: `accessibilityRole` + `accessibilityLabel`.
- Touch targets ≥ 48×48.
- Color contrast ≥ 4.5:1 for body text, 3:1 for large text.
- Respect `useReducedMotion` and `useFontScale` (Dynamic Type).
- Form fields: `accessibilityLabel` matches visible label; errors announced via `accessibilityLiveRegion="polite"`.
- Images: meaningful `alt` (or `accessibilityLabel`); decorative images `accessibilityElementsHidden`.

---

## 18. Performance Rules

- Wrap list items in `React.memo`.
- `useCallback` for handlers passed to memoized children.
- `useMemo` only for genuinely expensive computations — not for every object.
- Never recreate functions inside `renderItem`.
- Use `InteractionManager.runAfterInteractions` for heavy work after navigation.
- Image: always set explicit `width`/`height` or `aspectRatio` to prevent reflow.
- Avoid inline styles where a token class exists.

---

## 19. Dark Mode

- Theme stored in Zustand + MMKV. Defaults to system.
- Use `useColorScheme()` from `nativewind`.
- All color references go through role tokens (`colors.light.*` / `colors.dark.*`), never raw hex.
- Dark mode surfaces use `neutral.950/900/800` — **never pure black**.

---

## 20. Internationalization

- All user-facing strings via `t('namespace.key')`.
- Layout tested with RTL: use `start`/`end` paddings, never `left`/`right` for logical direction.
- Numbers/currencies via `Intl.NumberFormat`.

---

## 21. What the AI Must NOT Do

- ❌ Inline hex colors, raw px sizes, raw font sizes.
- ❌ Use `FlatList`, `AsyncStorage`, RN core `Image`, `Modal` for sheets.
- ❌ Mix API calls into UI components.
- ❌ Create giant components (>200 lines is a smell, >300 is a refusal).
- ❌ Use `any` without `// @reason: ...` comment.
- ❌ Wrap navigation inside features that should expose hooks instead.
- ❌ Add bounce/elastic animations to buttons.
- ❌ Use gradients except on hero banners (and only subtly).
- ❌ Use pure black `#000` or pure white text on colored surfaces without contrast check.
- ❌ Generate forms without zod schemas.
- ❌ Generate screens without loading + empty + error states.

---

## 22. What the AI Must Always Do

- ✅ Import tokens from `@/constants/theme`.
- ✅ Use the `Text`, `Button`, `Card`, `Input` primitives.
- ✅ Wrap screens in `<Screen>`.
- ✅ Include `accessibilityRole`/`accessibilityLabel` on all touchables.
- ✅ Use FlashList with `estimatedItemSize`.
- ✅ Use `expo-image` with `placeholder` + `transition`.
- ✅ Use TanStack Query for any API data, Zustand for UI/client state.
- ✅ Respect `useReducedMotion`.
- ✅ Wrap user-facing strings in `t()`.
- ✅ For any list of >5 items, include loading skeleton + empty state.

---

## 23. Reference Screen Skeleton

Use this as the starting shape for any new feed/listing screen:

```tsx
// app/(tabs)/index.tsx
import { Screen } from '@/components/layout/Screen';
import { Text } from '@/components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useListings } from '@/features/listings/hooks/useListings';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { ListingSkeleton } from '@/features/listings/components/ListingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package } from 'lucide-react-native';
import { View } from 'react-native';
import { useCallback } from 'react';

export default function FeedScreen() {
  const { data, isLoading, isError, refetch, fetchNextPage, isFetchingNextPage } = useListings();

  const renderItem = useCallback(({ item }) => <ListingCard listing={item} />, []);

  if (isLoading) return <Screen><ListingSkeleton count={6} /></Screen>;
  if (isError)   return <Screen><EmptyState icon={Package} title="Couldn't load" description="Pull to retry" onAction={refetch} actionLabel="Retry" /></Screen>;

  return (
    <Screen padded={false}>
      <View className="px-lg pt-md pb-sm">
        <Text variant="title">Discover</Text>
      </View>
      <FlashList
        data={data?.pages.flatMap((p) => p.items) ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={280}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View className="h-md" />}
        onEndReached={() => fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<EmptyState icon={Package} title="Nothing here yet" description="Check back soon" />}
        ListFooterComponent={isFetchingNextPage ? <ListingSkeleton count={2} /> : null}
      />
    </Screen>
  );
}
```

---

## 24. Verification Checklist (AI runs this mentally before returning code)

1. Any inline hex, px, or fontSize? → replace with token.
2. Touchable without `accessibilityRole`/`Label`? → add.
3. List without `estimatedItemSize`? → add.
4. Async data without loading + empty + error? → add.
5. Form without zod schema? → add.
6. Component over 200 lines? → split.
7. API call inside a component? → move to a hook.
8. String hardcoded that a user sees? → wrap in `t()`.
9. Animation without `useReducedMotion` check? → add (if non-essential).
10. Pure black or pure white text on tinted surface? → use neutral.900/0 + contrast check.

If any answer is "yes" to 1–8 or "no" to 9–10, the code is not done.
