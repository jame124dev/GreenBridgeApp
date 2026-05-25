# GreenBridge React Native — Starter Kit

**Purpose:** Initial scaffold decisions for the GreenBridge mobile app (the scanner-first companion to the 101lab-2 / GreenBidz web app).
**Date:** 2026-05-22
**Status:** Scaffold created (Expo SDK 56). Auth/scanner flows not wired yet.

---

## 1. Goal of the app (v1)

Mobile-first front-end for the workflows defined in [../../meeting_discuss/sop_mobile_app_scan_disscuss.md](../../meeting_discuss/sop_mobile_app_scan_disscuss.md) and [../../meeting_discuss/SOP_AI_INTEGRATION_PLAN.md](../../meeting_discuss/SOP_AI_INTEGRATION_PLAN.md):

1. **Scanner MVP** — recyclers scan equipment, vision LLM extracts metadata, one-click create draft listing.
2. **Listing review** — view/edit drafts created from scans, publish to the marketplace.
3. **SOP chat (Phase 2)** — staff query the Quippy KB from the field.
4. **Notifications** — bid/offer/payment alerts from the existing GreenBidz backend.

Buyer-facing browsing and bidding stay on web for now.

### Guiding principle

> Build the **end-to-end scanner flow first** — `Capture → Upload → AI extract → Edit → Save`. Then optimise architecture.

The hard problems live in the *network path*, not the folder structure: image compression, upload queue, offline retry, request cancellation, slow-network UX. Pick the simplest libs that don't get in the way and iterate.

---

## 2. Recommended starter kit

### Framework: **Expo (managed workflow) + Expo Router**

**Why Expo over bare React Native CLI:**

| Need | Expo wins because |
|---|---|
| Scanner MVP needs camera fast | `expo-camera` works out-of-the-box, no native linking |
| Mid-next-week deadline | EAS Build + OTA updates skip Xcode/Android Studio setup for first demo |
| Pilot 100 recyclers (§15) | `eas update` pushes JS fixes without re-submitting to stores |
| Image upload / picking | `expo-image-picker`, `expo-file-system` mature |
| Push notifications | `expo-notifications` works on both stores in one wrapper |
| Single dev environment | Pure JS — no Android Studio required for daily work |

The existing bare stub at [101lab-2/react-native/recycleapp](../../101lab-2/react-native/recycleapp/) is empty (only `App.tsx` + `package.json`, no native folders). **We are not blocked by it** — delete or ignore it; build a fresh Expo project here.

**If we later need native modules Expo doesn't ship:** Expo's CNG (continuous native generation) lets you eject *partially* via config plugins. We can grow into bare without rewriting.

### Concrete create command

```powershell
cd C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp
npx create-expo-app@latest . --template default
```

Pin to **Expo SDK 54** (current stable, RN 0.81, React 19 — matches modern toolchain).

---

## 3. Core dependency stack

Grouped by concern. Versions to be locked at install time.

### Routing & navigation
- **`expo-router`** — file-based routing, matches Next-style mental model the web team already uses.
- **`react-native-screens`**, **`react-native-safe-area-context`** — peer deps for navigation.

### State & data

Two layers, two tools — keep them clearly separated.

- **`zustand`** — UI / app state (auth user, draft scan, theme toggle, modal visibility). Tiny, no boilerplate, no provider tree. *Not RTK.* The web uses RTK because it grew large; the mobile app is scanner-first and benefits from staying lean. We can adopt RTK later if state genuinely sprawls.
- **`@tanstack/react-query`** — *all* server state (listings, scans, profile, KB chat). Handles cache, retries, optimistic updates, mutation queues, request cancellation — most of the resilience requirements from §1 come from React Query for free.
- **`axios`** — HTTP client. Port the interceptor patterns from web's `src/services`, but the slice/RTK plumbing stays out of mobile.

### Forms & validation
- **`react-hook-form`** + **`zod`** + **`@hookform/resolvers`** — identical stack to web. No new mental model.

### Styling
- **NativeWind v4** (Tailwind for RN) — lets us port the web's Tailwind tokens 1:1.
- **`tailwindcss`** (peer of NativeWind) — same config shape as web.
- See §5 for the shared theme.

### UI primitives
- **`@gorhom/bottom-sheet`** — sheets for scan-result review.
- **`react-native-reanimated`** + **`react-native-gesture-handler`** — required by most modern RN libs.
- **`lucide-react-native`** — same icon set as web (`lucide-react` there).
- **`sonner-native`** — toast library matching web's `sonner`.
- **`@shopify/flash-list`** — performant lists for listings/bids feed.

### Scanner-critical
- **`expo-camera`** — capture nameplate photos.
- **`expo-image-picker`** — fallback for gallery uploads.
- **`expo-image-manipulator`** — resize/compress before upload (target ≤1 MB per image).
- **`expo-file-system`** — local cache of pending uploads.
- **`expo-barcode-scanner`** — optional, for future barcode workflow (skip for MVP).
- **`@react-native-community/netinfo`** — detect online/offline state to drive the upload queue.

### Future (not for MVP)
- **`@shopify/react-native-skia`** — adopt when we need bounding-box overlays on scans, annotation tools, or any custom canvas drawing. Skip until that requirement appears.

### Auth & storage
- **`expo-secure-store`** — JWT / refresh token (Keychain / EncryptedSharedPreferences). Sensitive data only.
- **`react-native-mmkv`** — hot-path storage: drafts, scanner temp data, user prefs, React Query persisted cache. **~30× faster than AsyncStorage**, synchronous reads, smaller bundle. Default for everything non-sensitive.
- **`@react-native-async-storage/async-storage`** — *only* if a library hard-requires it (some auth SDKs do). Otherwise skip.

### Notifications & realtime
- **`expo-notifications`** — push.
- **`socket.io-client`** — match the web's socket layer ([101lab-2/src/socket](../../101lab-2/src/socket/)).

### i18n
- **`i18next`** + **`react-i18next`** — same as web. Reuse [101lab-2/src/i18n](../../101lab-2/src/i18n/) message catalogs where keys overlap.
- **`expo-localization`** — device locale detection.

### Dev / quality
- **`typescript`**, **`eslint-config-expo`**, **`prettier`** — match web's config style.
- **`@testing-library/react-native`** + **`jest-expo`** — unit & component tests.
- **`maestro`** (CLI, separate install) — E2E smoke tests for scanner happy path.

### Build/deploy
- **EAS Build** + **EAS Submit** — Expo's cloud build (no local Xcode for iOS).
- **EAS Update** — OTA JS updates between store releases.

---

## 4. Folder layout

Three layers, intentionally separated to avoid "god folders":

- **`api/`** — raw HTTP clients. No business logic. One file per backend.
- **`services/`** — cross-cutting concerns that wrap `api/` (upload queue, auth, notifications, analytics). Plain TS modules, no React.
- **`features/`** — UI-facing feature slices. React Query hooks + Zustand stores + screens compose `services/`.

```
GreenBridgeApp/
├── app/                          # expo-router routes (file-based)
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── pending.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Home / listings feed
│   │   ├── scan.tsx              # Scanner MVP entry
│   │   ├── inbox.tsx             # Notifications
│   │   └── profile.tsx
│   ├── listing/[id].tsx
│   ├── scan/review.tsx           # Edit extracted JSON before save
│   └── +not-found.tsx
├── src/
│   ├── api/                      # Raw HTTP clients — NO business logic
│   │   ├── greenbidzClient.ts    # → 101recycle-greenbidz-backend
│   │   ├── quippyClient.ts       # → QuippyAzureServer (KB only)
│   │   └── interceptors.ts       # auth, retry, error normalisation
│   ├── services/                 # Cross-cutting, no React
│   │   ├── auth/                 # token refresh, secure-store I/O
│   │   ├── upload/               # image compression + offline queue (see §11)
│   │   ├── notifications/        # push + in-app
│   │   └── analytics/
│   ├── features/                 # UI-facing slices
│   │   ├── auth/                 # screens + react-query hooks + zustand store
│   │   ├── listings/
│   │   ├── scanner/
│   │   └── inbox/
│   ├── components/
│   │   ├── ui/                   # Buttons, Inputs, Cards (NativeWind primitives)
│   │   ├── scanner/              # CameraView, ScanPreview, ExtractedFields
│   │   └── listing/              # ListingCard, ListingForm
│   ├── stores/                   # Zustand stores (auth, draft, theme)
│   ├── hooks/                    # Shared React hooks
│   ├── i18n/
│   ├── lib/                      # mmkv instance, query client, axios instance
│   ├── theme/
│   │   ├── colors.ts             # Mirrors 101lab-2/src/index.css tokens
│   │   ├── typography.ts
│   │   ├── gradients.ts
│   │   └── branding.ts           # per-SITE_TYPE overrides
│   └── utils/
├── assets/                       # Fonts, icons, splash
├── Docs/                         # This folder — design notes
├── app.config.ts                 # Expo config (env-driven)
├── eas.json
├── tailwind.config.js
├── nativewind-env.d.ts
├── tsconfig.json
└── package.json
```

**Rule of thumb:** if a file imports from `react`, it goes in `features/`, `components/`, `hooks/`, or `app/` — never in `api/` or `services/`.

---

## 5. Theme — port from web

The web's full theme lives in [101lab-2/src/index.css](../../101lab-2/src/index.css) and [101lab-2/tailwind.config.ts](../../101lab-2/tailwind.config.ts). The **mobile app uses the light-mode palette** (the dark theme on web is sidebar-only — confirmed in the project memory).

### Color tokens to copy as-is

| Role | Web token (HSL) | Hex equivalent | Notes |
|---|---|---|---|
| `primary` / `accent` / `success` | `hsl(155 72% 17%)` | **`#0a4a2f`** | Deep emerald — the brand green. Buttons, links, focus rings. |
| `primary-light` | `hsl(155 55% 25%)` | `#1d6647` | Hover/pressed |
| `primary-dark` | `hsl(155 80% 12%)` | `#053823` | Active/depressed |
| `primary-foreground` | white | `#ffffff` | Text on primary |
| `background` | `hsl(210 20% 98%)` | `#f7f9fb` | Screen background |
| `foreground` | `hsl(220 25% 10%)` | `#13171f` | Body text |
| `card` | `#ffffff` | `#ffffff` | Cards, sheets |
| `muted` | `hsl(210 20% 96%)` | `#f1f4f7` | Subtle backgrounds |
| `muted-foreground` | `hsl(220 10% 46%)` | `#6b7280` | Secondary text |
| `border` / `input` | `hsl(220 13% 90%)` | `#e1e5ec` | Hairlines |
| `destructive` | `hsl(0 72% 51%)` | `#dc3737` | Errors |
| `warning` | `hsl(38 92% 50%)` | `#f59e0b` | |
| `info` | `hsl(215 70% 50%)` | `#3b82f6` | |
| `brand.glow` | — | `#4edea3` | Accent highlights (gradients) |
| `brand.deep` | — | `#003824` | Hero gradient end |

### Gradients (port from web)

```ts
// src/theme/gradients.ts
export const gradients = {
  hero:    ['#0a4a2f', '#1d6647'] as const,  // hsl(155 72% 17%) → hsl(155 55% 25%)
  primary: ['#0a4a2f', '#1d6647'] as const,
  success: ['#0a4a2f', '#1d6647'] as const,
} as const;
```

Use `expo-linear-gradient` to render.

### Typography

- **UI font:** Inter (use `@expo-google-fonts/inter`, weights 300–800).
- **Mono:** JetBrains Mono (use `@expo-google-fonts/jetbrains-mono`).
- Scale should match web's Tailwind defaults — NativeWind handles this automatically once `tailwind.config.js` is shared.

### Radius / spacing

- Base radius: **4 px** (`--radius: 0.25rem` on web). Buttons/inputs use this.
- Cards: **16 px** (`borderRadius.card: '1rem'` on web).
- Spacing scale: standard Tailwind (`p-2`, `p-4`, ...) via NativeWind.

### Sample `tailwind.config.js` (mobile)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary:     { DEFAULT: '#0a4a2f', light: '#1d6647', dark: '#053823', foreground: '#ffffff' },
        accent:      { DEFAULT: '#0a4a2f', foreground: '#ffffff' },
        background:  '#f7f9fb',
        foreground:  '#13171f',
        card:        '#ffffff',
        muted:       { DEFAULT: '#f1f4f7', foreground: '#6b7280' },
        border:      '#e1e5ec',
        destructive: { DEFAULT: '#dc3737', foreground: '#ffffff' },
        warning:     { DEFAULT: '#f59e0b', foreground: '#ffffff' },
        info:        { DEFAULT: '#3b82f6', foreground: '#ffffff' },
        brand:       { DEFAULT: '#10b981', glow: '#4edea3', deep: '#003824' },
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        mono: ['JetBrainsMono_400Regular'],
      },
      borderRadius: {
        DEFAULT: '4px',
        card:    '16px',
      },
    },
  },
};
```

---

## 6. Configuration & env

Use **`app.config.ts`** (not static `app.json`) so secrets stay in `.env`:

```ts
// app.config.ts
import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'GreenBridge',
  slug: 'greenbridge',
  scheme: 'greenbridge',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  ios:     { bundleIdentifier: 'com.greenbidz.bridge' },
  android: { package: 'com.greenbidz.bridge' },
  extra: {
    GREENBIDZ_API_URL: process.env.GREENBIDZ_API_URL,
    QUIPPY_API_URL:    process.env.QUIPPY_API_URL,
    SITE_TYPE:         process.env.SITE_TYPE ?? 'labgreenbidz', // mirrors VITE_SITE_TYPE
    SENTRY_DSN:        process.env.SENTRY_DSN,
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-image-picker',
    'expo-secure-store',
    'expo-notifications',
  ],
});
```

`.env.example`:
```
GREENBIDZ_API_URL=https://api-staging.greenbidz.com
QUIPPY_API_URL=https://quippy-staging.example.com
SITE_TYPE=labgreenbidz
SENTRY_DSN=
```

**Site-type fork:** keep the same `SITE_TYPE` switch the web uses (`101it` vs `labgreenbidz`) so we can ship the same binary with two brand skins later. Add a `src/theme/branding.ts` that returns logo + accent overrides per site.

---

## 7. Initial install commands

```powershell
# from C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp
npx create-expo-app@latest . --template default

# Core
npx expo install expo-router react-native-screens react-native-safe-area-context `
  expo-camera expo-image-picker expo-image-manipulator expo-file-system `
  expo-secure-store expo-notifications expo-localization expo-linear-gradient `
  react-native-reanimated react-native-gesture-handler

# State / data
npm install zustand @tanstack/react-query axios

# Hot-path storage
npm install react-native-mmkv

# Network awareness (drives upload queue)
npx expo install @react-native-community/netinfo

# Forms / validation
npm install react-hook-form zod @hookform/resolvers

# Styling
npm install nativewind tailwindcss
npx tailwindcss init

# UI
npm install @gorhom/bottom-sheet @shopify/flash-list lucide-react-native sonner-native

# i18n
npm install i18next react-i18next

# Storage
npm install @react-native-async-storage/async-storage

# Realtime
npm install socket.io-client

# Fonts
npx expo install @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono expo-font

# Dev
npm install --save-dev eslint-config-expo prettier `
  @testing-library/react-native jest-expo @types/jest
```

---

## 7a. Upload & resilience pipeline (the real complexity)

Most "scanner app" pain shows up here, not in screens. Bake this in from day one:

1. **Compression on capture** — `expo-image-manipulator`: resize longest edge to 1600 px, JPEG quality 0.75. Target ≤1 MB per upload. Do this on the JS thread *before* writing to disk.
2. **Persist as draft locally** — write the compressed image + provisional metadata to MMKV-tracked `expo-file-system` cache before any network call. Scan is *never* lost if the app dies.
3. **Upload queue** — single `services/upload/queue.ts` module:
   - In-flight + pending queue stored in MMKV.
   - Worker loop kicked by `NetInfo` "online" event or manual retry.
   - One upload at a time (mobile networks hate parallel large uploads).
   - Exponential backoff: 2s → 4s → 8s → cap at 60s, max 6 attempts.
4. **Request cancellation** — wrap every axios call with an `AbortController`; cancel on screen unmount and on app background.
5. **Optimistic UI** — React Query `useMutation` with `onMutate` that adds the draft to the list immediately; rollback on failure.
6. **Slow-network UX** — show a banner after 8s of inflight; let user "save offline" without waiting; never block the camera screen on a previous upload.
7. **Background upload (later)** — `expo-task-manager` + `expo-background-fetch` so uploads continue when the app is backgrounded. Not required for v1 but design the queue interface to support it.

This is owned by **`services/upload/`**. The scanner feature consumes it via a single `useUpload()` hook.

---

## 8. Phase-1 deliverables (week 1–2)

Aligned with the integration plan's Track A (Scanner MVP):

1. Project boots on iOS sim and Android emulator with NativeWind + theme tokens applied.
2. Login screen (email + password — see [AUTH.md](./AUTH.md); not wired in scaffold yet).
3. Camera screen → capture → preview → POST to `/api/v1/scanner/extract` (when backend route exists).
4. Extracted-JSON review screen with editable form (react-hook-form + zod).
5. "Save as draft" → POST `/api/v1/scanner/quick-list` → toast success.
6. Bottom-tab shell: Home / Scan / Inbox / Profile.

Out of scope for phase 1: bidding UI, SOP chat, push notifications, payments.

---

## 9. Open decisions for team

1. **Bundle ID / store accounts.** Who owns Apple Developer + Google Play listings? Need before EAS Submit.
2. **Sentry vs Logtail vs none for crash reporting.** Default suggestion: Sentry (free tier OK for pilot).
3. **One app or two binaries?** Mirror web's `VITE_SITE_TYPE` fork at runtime (one binary, two themes) — *recommended* — or build two apps via EAS profiles. Runtime switching is simpler.
4. **OTA channel strategy.** `preview` (internal pilot) and `production` channels via EAS Update.
5. **Delete or keep [101lab-2/react-native/recycleapp](../../101lab-2/react-native/recycleapp/)?** It's an empty bare-RN stub. Recommend removing once this scaffold exists to avoid confusion.

---

## 9a. Final recommended stack (TL;DR)

```
Expo SDK 54           — framework
Expo Router           — file-based routing
TypeScript            — type safety
NativeWind v4         — Tailwind for RN (port web tokens 1:1)
React Query           — all server state (cache, retry, optimistic, cancel)
Zustand               — UI/app state (no Redux/RTK in v1)
MMKV                  — hot-path storage (drafts, prefs, query cache)
expo-secure-store     — JWT / refresh token only
React Hook Form + Zod — forms (same as web)
Axios                 — HTTP
FlashList             — performant lists
Expo Camera           — capture
expo-image-manipulator — compression
NetInfo               — drives upload queue
EAS Build + Update    — cloud build + OTA
```

**Avoid in v1:** Redux/RTK, Skia, heavy abstraction layers, premature folder splits.

---

## 10. References

- Meeting: [../../meeting_discuss/sop_mobile_app_scan_disscuss.md](../../meeting_discuss/sop_mobile_app_scan_disscuss.md)
- Integration plan: [../../meeting_discuss/SOP_AI_INTEGRATION_PLAN.md](../../meeting_discuss/SOP_AI_INTEGRATION_PLAN.md)
- Web theme source: [../../101lab-2/src/index.css](../../101lab-2/src/index.css), [../../101lab-2/tailwind.config.ts](../../101lab-2/tailwind.config.ts)
- Web i18n: [../../101lab-2/src/i18n/](../../101lab-2/src/i18n/)
- Web RTK setup: [../../101lab-2/src/rtk/](../../101lab-2/src/rtk/)
- Web sockets: [../../101lab-2/src/socket/](../../101lab-2/src/socket/)
- Backend (item listing, Zoho): [../../101recycle-greenbidz-backend/](../../101recycle-greenbidz-backend/)
- Backend (KB/SOP): [../../QuippyAzureServer/](../../QuippyAzureServer/)
