# Authentication — Phase 1 (Login only)

**Scope:** Email + password login for the GreenBridge mobile app. No signup, no Google OAuth, no OTP/forgot-password in this phase — all of those exist on web and we will port later.
**Backend:** Reuse `101recycle-greenbidz-backend` exactly as the web app does. No mobile-specific endpoints.
**Storage:** `expo-secure-store` for tokens, MMKV for non-sensitive profile cache.

---

## 1. Backend endpoint (already exists — do not change)

The web app calls **`POST /api/v1/user/login`**, which under the hood is the same controller as `POST /api/v1/auth/login` (both routed to `loginV3` in [controller/authV3.controller.js:105](../../101recycle-greenbidz-backend/controller/authV3.controller.js)).

We will use **`POST /api/v1/auth/login`** from mobile (cleaner namespace, same behaviour).

### Request

```http
POST /api/v1/auth/login
Content-Type: application/json
x-system-key: <env: VITE_X_SYSTEM_KEY equivalent>
x-platform: <site_type: "labgreenbidz" | "101it" | "101machine">

{
  "email": "user@example.com",
  "password": "plaintext"
}
```

Validation (server, Joi — [validators/userValidator.js:31](../../101recycle-greenbidz-backend/validators/userValidator.js)):
- `email` — valid email, required.
- `password` — non-empty string, required.

### Success response (200)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT, 15 min>",
    "refreshToken": "<JWT, 7 days>",
    "data": {
      "user": {
        "id": 533,
        "email": "user@example.com",
        "username": "user",
        "name": "Display Name",
        "role": "seller",                 // "admin" | "seller" | "buyer"
        "wp_role": "customer",
        "greenbidz_user_type": "seller"
      },
      "role": "seller"
    },
    "userDetail": {
      "company": "Acme Labs",
      "member_id": "ML-001",
      "user_status": "approved",
      "greenbidz_user_type": "seller",
      "greenbidz_company_name": "Acme Labs",
      "documents": {
        "business_registration_certificate": [{ "id": 123, "url": "..." }],
        "waste_disposal_permit": [{ "id": 124, "url": "..." }]
      }
    },
    "analytics": { /* GA4 fields — ignore on mobile */ }
  }
}
```

### Error responses (we must handle all four)

| HTTP | Body shape | Meaning | Mobile UX |
|---|---|---|---|
| **400** | `{ success: false, message: "..." }` | Validation failed (missing/invalid fields) | Inline form error |
| **401** | `{ success: false, message: "Email does not exist" \| "Password incorrect" }` | Bad credentials | Toast: "Invalid email or password" (don't reveal which is wrong) |
| **403** | `{ success: false, code: "EMAIL_NOT_VERIFIED", message: "..." }` | Email not verified | Modal: "Please verify your email" + "Resend link" (link button can defer to web for v1) |
| **403** | `{ success: false, code: "ACCOUNT_PENDING", message: "...", token, refreshToken, userId }` | Account awaiting admin approval | Store the tokens anyway, route to a "Pending approval" screen. The web does this too — issuing tokens lets the user reach settings to upload missing docs. |
| **500** | `{ success: false, message: "Internal server error" }` | Server crash | Toast: "Something went wrong, try again" |

**Reference:** error branching mirrors web's `handleSignIn` in [src/pages/auth/Auth.tsx:243](../../101lab-2/src/pages/auth/Auth.tsx).

---

## 2. Which roles can log in on mobile?

Backend returns `role: "admin" | "seller" | "buyer"`. Decision for Phase 1:

- **Allow `seller`** — primary mobile persona (the recycler scanning equipment).
- **Allow `admin`** — for internal QA/testing.
- **Block `buyer`** with a friendly screen: *"The mobile app is for sellers. Please use the website to bid and browse."* — buyer browsing/bidding stays on web (§1 of [STARTER_KIT.md](./STARTER_KIT.md)).

This gate lives client-side after login. We do NOT modify the backend.

---

## 3. Token handling

Two tokens are issued, mirror the web behaviour exactly:

| Token | Lifetime | Sent as | Storage on mobile |
|---|---|---|---|
| Access token (`token`) | 15 minutes | `Authorization: Bearer <token>` | `expo-secure-store` key `auth.accessToken` |
| Refresh token (`refreshToken`) | 7 days | `x-refresh-token: <refreshToken>` header | `expo-secure-store` key `auth.refreshToken` |

Non-sensitive profile (`userId`, `role`, `name`, `company`) goes to **MMKV** under `auth.profile` for fast synchronous reads (no `await` on app boot for the splash/redirect logic).

### Refresh strategy (Phase 1)

- Send `x-refresh-token` on every authenticated request — the backend will issue a new access token in a response header / body when it detects expiry (matches web pattern in [src/rtk/api/axiosInstance.ts:23](../../101lab-2/src/rtk/api/axiosInstance.ts)).
- On any **401** response: clear secure-store + MMKV, redirect to `/login`. (Phase 2: silent refresh-and-retry.)

---

## 4. Mobile-side wiring

### 4.1 Env vars (`app.config.ts` + `.env`)

```
GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
X_SYSTEM_KEY=<copy from web's VITE_X_SYSTEM_KEY>
SITE_TYPE=labgreenbidz
```

### 4.2 Axios client — `src/api/greenbidzClient.ts`

```ts
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const { GREENBIDZ_API_URL, X_SYSTEM_KEY, SITE_TYPE } = Constants.expoConfig!.extra!;

export const greenbidz = axios.create({
  baseURL: GREENBIDZ_API_URL,
  timeout: 20_000,
  headers: {
    'x-system-key': X_SYSTEM_KEY,
    'x-platform':   SITE_TYPE,
  },
});

greenbidz.interceptors.request.use(async (config) => {
  const access  = await SecureStore.getItemAsync('auth.accessToken');
  const refresh = await SecureStore.getItemAsync('auth.refreshToken');
  if (access)  config.headers.Authorization     = `Bearer ${access}`;
  if (refresh) config.headers['x-refresh-token'] = refresh;
  return config;
});
```

### 4.3 Zod schema — `src/features/auth/schema.ts`

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

### 4.4 Service — `src/services/auth/login.ts` (no React)

```ts
import * as SecureStore from 'expo-secure-store';
import { greenbidz } from '@/api/greenbidzClient';
import { mmkv } from '@/lib/mmkv';

export type LoginPayload = { email: string; password: string };

export type LoginSuccess = {
  user: { id: number; email: string; name: string; role: 'admin' | 'seller' | 'buyer' };
  token: string;
  refreshToken: string;
  company: string | null;
};

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_PENDING'
  | 'BUYER_NOT_ALLOWED'
  | 'NETWORK'
  | 'UNKNOWN';

export class LoginError extends Error {
  constructor(public code: LoginErrorCode, message: string, public extra?: any) {
    super(message);
  }
}

export async function login(payload: LoginPayload): Promise<LoginSuccess> {
  let res;
  try {
    res = await greenbidz.post('/auth/login', payload);
  } catch (err: any) {
    const status = err.response?.status;
    const body   = err.response?.data;
    if (status === 401) throw new LoginError('INVALID_CREDENTIALS', 'Invalid email or password');
    if (status === 403 && body?.code === 'EMAIL_NOT_VERIFIED') throw new LoginError('EMAIL_NOT_VERIFIED', body.message);
    if (status === 403 && body?.code === 'ACCOUNT_PENDING') {
      // Backend gives us tokens — persist so user can reach pending screen
      await persist({
        token: body.token,
        refreshToken: body.refreshToken,
        userId: body.userId,
      });
      throw new LoginError('ACCOUNT_PENDING', body.message, body);
    }
    if (!err.response) throw new LoginError('NETWORK', 'Network error — check your connection');
    throw new LoginError('UNKNOWN', body?.message ?? 'Login failed');
  }

  const payloadData = res.data?.data;
  const user        = payloadData?.data?.user;
  const role        = user?.role;

  if (role === 'buyer') {
    throw new LoginError('BUYER_NOT_ALLOWED', 'The mobile app is for sellers. Use the website to browse and bid.');
  }

  await persist({
    token:        payloadData.token,
    refreshToken: payloadData.refreshToken,
    userId:       user.id,
  });
  mmkv.set('auth.profile', JSON.stringify({
    id:      user.id,
    email:   user.email,
    name:    user.name,
    role:    user.role,
    company: payloadData.userDetail?.company ?? null,
  }));

  return {
    user,
    token:        payloadData.token,
    refreshToken: payloadData.refreshToken,
    company:      payloadData.userDetail?.company ?? null,
  };
}

async function persist({ token, refreshToken, userId }: { token: string; refreshToken: string; userId: number }) {
  await SecureStore.setItemAsync('auth.accessToken', token);
  await SecureStore.setItemAsync('auth.refreshToken', refreshToken);
  mmkv.set('auth.userId', userId);
}

export async function logout() {
  await SecureStore.deleteItemAsync('auth.accessToken');
  await SecureStore.deleteItemAsync('auth.refreshToken');
  mmkv.remove('auth.profile');
  mmkv.remove('auth.userId');
}
```

### 4.5 Zustand store — `src/stores/authStore.ts`

```ts
import { create } from 'zustand';
import { mmkv } from '@/lib/mmkv';

type Profile = { id: number; email: string; name: string; role: 'admin' | 'seller'; company: string | null };

type AuthState = {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  hydrate: () => void;
  isAuthed: () => boolean;
};

export const useAuth = create<AuthState>((set, get) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  hydrate: () => {
    const raw = mmkv.getString('auth.profile');
    if (raw) set({ profile: JSON.parse(raw) });
  },
  isAuthed: () => !!get().profile,
}));
```

Call `useAuth.getState().hydrate()` once in the root `_layout.tsx` before rendering.

### 4.6 React Query mutation — `src/features/auth/useLogin.ts`

```ts
import { useMutation } from '@tanstack/react-query';
import { login, LoginError, type LoginPayload } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

export function useLogin() {
  const setProfile = useAuth((s) => s.setProfile);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (res) => {
      setProfile({
        id:      res.user.id,
        email:   res.user.email,
        name:    res.user.name,
        role:    res.user.role as 'admin' | 'seller',
        company: res.company,
      });
    },
  });
}
```

### 4.7 Screen — `app/(auth)/login.tsx`

```tsx
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { loginSchema, type LoginInput } from '@/features/auth/schema';
import { useLogin } from '@/features/auth/useLogin';
import { LoginError } from '@/services/auth/login';
import { gradients } from '@/theme/gradients';

export default function LoginScreen() {
  const { control, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mut = useLogin();

  const onSubmit = (values: LoginInput) =>
    mut.mutate(values, {
      onSuccess:  ()    => router.replace('/(tabs)'),
      onError:    (err) => {
        if (err instanceof LoginError) {
          if (err.code === 'EMAIL_NOT_VERIFIED') return Alert.alert('Verify your email', err.message);
          if (err.code === 'ACCOUNT_PENDING')    return router.replace('/(auth)/pending');
          if (err.code === 'BUYER_NOT_ALLOWED')  return Alert.alert('Sellers only', err.message);
          return Alert.alert('Login failed', err.message);
        }
        Alert.alert('Login failed', 'Please try again');
      },
    });

  return (
    <View className="flex-1 bg-background">
      <LinearGradient colors={gradients.hero} className="h-44 px-6 justify-end pb-6">
        <Text className="text-white text-3xl font-bold">Welcome back</Text>
        <Text className="text-white/80 mt-1">Sign in to keep listing</Text>
      </LinearGradient>

      <View className="px-6 pt-8 gap-4">
        <Controller
          control={control} name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <View>
              <Text className="text-sm text-muted-foreground mb-1">Email</Text>
              <TextInput
                value={value} onChangeText={onChange} onBlur={onBlur}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email"
                className="h-12 px-3 rounded border border-border bg-card"
                placeholder="you@example.com"
              />
              {errors.email && <Text className="text-destructive text-xs mt-1">{errors.email.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control} name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <View>
              <Text className="text-sm text-muted-foreground mb-1">Password</Text>
              <TextInput
                value={value} onChangeText={onChange} onBlur={onBlur}
                secureTextEntry autoComplete="password"
                className="h-12 px-3 rounded border border-border bg-card"
                placeholder="••••••••"
              />
              {errors.password && <Text className="text-destructive text-xs mt-1">{errors.password.message}</Text>}
            </View>
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={mut.isPending}
          className="h-12 rounded bg-primary items-center justify-center mt-2 active:opacity-90"
        >
          <Text className="text-primary-foreground font-semibold">
            {mut.isPending ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <Pressable onPress={() => Alert.alert('Use the website', 'Forgot password is on the website for now.')}>
          <Text className="text-center text-primary mt-2">Forgot password?</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

### 4.8 Root guard — `app/_layout.tsx`

```tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/stores/authStore';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const profile  = useAuth((s) => s.profile);
  const hydrate  = useAuth((s) => s.hydrate);

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    if (!profile && !inAuth)       router.replace('/(auth)/login');
    else if (profile && inAuth)    router.replace('/(tabs)');
  }, [profile, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

## 5. Test plan (manual + automated)

### Manual (every branch from §1 table)

| Case | Steps | Expected |
|---|---|---|
| Happy path — seller | Real seller creds | Lands on `/(tabs)`, profile in MMKV, tokens in secure store |
| Happy path — admin | Real admin creds | Same as seller |
| Buyer blocked | Real buyer creds | Alert "Sellers only", no tokens persisted |
| Bad password | Real email, wrong password | Alert "Invalid email or password" |
| Unknown email | `nobody@x.com` | Alert "Invalid email or password" (don't leak existence) |
| Email not verified | Test account with `email_verified != "1"` | Alert "Verify your email" |
| Pending approval | Test account with `pw_user_status != "approved"` | Tokens persisted, routes to `/(auth)/pending` |
| Network down | Airplane mode, submit | Alert "Network error — check your connection" |
| Restart app while logged in | Force-kill, reopen | Skips login, lands on `/(tabs)` |
| Token expired | Wait 15+ min, hit protected endpoint | Server returns 401 → clear store → bounce to login |

### Automated (`__tests__/auth.test.ts`)

- `login()` happy path returns the right shape and writes to secure-store + MMKV (mock `expo-secure-store` and `mmkv`, mock axios).
- Each error branch in §1 throws the right `LoginError.code`.
- Buyer role triggers `BUYER_NOT_ALLOWED` *and* does NOT persist tokens.

---

## 6. Out of scope for Phase 1

- Signup (web does `/user/signup-with-link` flow — port in Phase 3).
- Google OAuth ([web's GoogleCallback.tsx](../../101lab-2/src/pages/auth/GoogleCallback.tsx)) — needs native Google Sign-In SDK config; defer.
- Forgot password / OTP — link out to website for v1 (a single `Linking.openURL(...)`).
- Silent refresh — Phase 2; for now, 401 forces re-login.
- Biometric unlock on relaunch — Phase 2.
- Account-pending document upload flow — show static "pending" screen; uploads happen on web.

---

## 7. Open questions

1. **`X_SYSTEM_KEY` for mobile** — do we share the same key as web or mint a mobile-specific one? Sharing is fine for v1; mint a separate key once we add abuse logging.
2. **Block `buyer` role?** Recommended yes (§2). Confirm with product before shipping.
3. **`SITE_TYPE` per build or per binary?** Suggest per build via EAS profile (`SITE_TYPE=labgreenbidz` in prod profile, `101it` in the 101IT profile), one binary per site.
4. **Pending-approval screen content** — what info do we show? Probably "Your account is awaiting approval. Visit greenbidz.com to upload missing documents." with a button that deep-links to the web settings page.

---

## 8. References

- Backend route (mobile target): [routes/authRoute.js:25](../../101recycle-greenbidz-backend/routes/authRoute.js)
- Backend controller: [controller/authV3.controller.js:105](../../101recycle-greenbidz-backend/controller/authV3.controller.js)
- Backend validator: [validators/userValidator.js:31](../../101recycle-greenbidz-backend/validators/userValidator.js)
- Web sign-in handler (error branching reference): [src/pages/auth/Auth.tsx:243](../../101lab-2/src/pages/auth/Auth.tsx)
- Web axios setup (header pattern): [src/rtk/api/axiosInstance.ts](../../101lab-2/src/rtk/api/axiosInstance.ts)
- Starter kit: [./STARTER_KIT.md](./STARTER_KIT.md)
