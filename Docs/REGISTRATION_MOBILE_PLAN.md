# Mobile Registration — Implementation Plan (1.0.1)

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone sign up in the app with three fields and use it immediately as a buyer; ask for
company details and admin approval only when they want to **list** something.

**Architecture:** No production backend change. `loginV3` returns HTTP 403 `ACCOUNT_PENDING` for any
account whose `pw_user_status !== "approved"` — but that response already carries a **real, working
JWT**. The app stops treating that as a dead end and starts treating it as a valid *buyer* session.
Selling is gated behind the seller-upgrade flow that already exists on prod
(`/api/v1/seller-upgrade/*`). One choke point (`launchSellerScan`) guards every entry to the sell
path.

**Tech Stack:** Expo SDK 56 · expo-router (typed routes) · React Hook Form + zod · Zustand
(`authStore`) · MMKV · React Query · axios (`greenbidz` client) · i18next (6 locales) · Jest +
@testing-library/react-native

---

## Global Constraints

Every task's requirements implicitly include this section.

1. **NEVER link an auth screen to a web page.** App Review rejected build 14 under **Guideline
   3.1.1** for opening `greenbidz.com/contact-us/`. `src/__tests__/externalLinks.test.ts` fails the
   build if any banned URL or outbound navigation returns to `login.tsx` / `pending.tsx` /
   `register.tsx`. Terms and Privacy links are the **only** permitted exception (legal notices, not
   a purchase or registration mechanism).
2. **`company` must stay OPTIONAL at signup.** A required company field turns signup into
   "business and organization registration" — the exact 3.1.1 finding. There is a test enforcing it.
3. **Locale files are edited by TEXT INSERTION, never `json.dump`.** `src/i18n/locales/*.json`
   contain duplicate keys (`signingIn` ×2, `welcomeBack` ×3) and CRLF that a dump silently destroys.
   Locate a parent object by **brace matching**, not a first-match regex. Verify every locale diff is
   `+N/-0` before committing.
4. **All three `eas.json` profiles point at PRODUCTION.** Any signup run from a dev build creates a
   real account on the live site and emails real admins. Use a throwaway address, never a customer's.
5. **No production backend changes in this plan.** Anything requiring one is listed in
   "Deferred to 1.0.2" and must not be started without explicit approval.
6. **Do not press "Release This Version"** in App Store Connect. Build 1.0.0 (16) is approved and
   awaiting a human decision; that is not this plan's business.
7. **Verify the artifact, not the config.** Before submitting, confirm the strings are inside the
   IPA. Hermes stores any string containing a non-ASCII character as **UTF-16**, so an ASCII grep
   reports present strings as missing — search `utf-16-le` too.
8. **`eas build` does NOT upload to App Store Connect** (the `production` profile has no
   `autoSubmit`). Always follow with `eas submit -p ios --profile production --id <buildId>`.

---

## Backend facts this plan depends on (all verified on `origin/main` = production)

| Endpoint | Body | Notes |
|---|---|---|
| `POST /user/signup-initiate` | `{ email, password, role: 'buyer' }` | emails a 6-digit code; pending record held **in memory, 10-min expiry** |
| `POST /user/verify-signup-code` | `{ email, code }` | marks the in-memory record verified |
| `POST /user/complete-signup` | `{ email, first_name, last_name, phone?, company?, country? }` | creates the user with `pw_user_status = "pending"`; only `email` is strictly required |
| `POST /user/resend-verification-code` | `{ email }` | |
| `POST /seller-upgrade/request` | multipart: `company_name, company_tax_id, business_type, reason, phone, country` + optional files `doc_business_reg_cert`, `doc_waste_disposal_permit` | requester derived from **JWT**, never the body; emails admins |
| `GET /seller-upgrade/my-status` | — | `{ success, data: <request row or null> }`; `status ∈ pending \| approved \| rejected` |

**`loginV3` pending branch** (`controller/authV3.controller.js:211-226`): when
`pw_user_status !== "approved"` it returns 403 with `code: "ACCOUNT_PENDING"`, plus `token`
(15 min), `refreshToken` (7 days, row persisted) and `userId`. **It does not return a user object** —
no name, email, role or company. That is why Task 1 must synthesise a profile locally.

### ⚠️ Two constraints that shape the design

- **Approving a seller-upgrade request does NOT unblock login.**
  `services/sellerUpgradeService.js:272-280` sets `greenbidz_user_type = "seller"` and the request's
  `status = "approved"`, but **never touches `pw_user_status`**. So a user approved as a seller is
  still `pending` and still gets the 403 at login. The app's "can I sell?" gate must therefore key
  off `/seller-upgrade/my-status`, **not** off having a normal (non-pending) session.
- **Duplicate submissions are rejected by the server** with a 400 and a human-readable message:
  "You already have a pending seller upgrade request." / "Your seller upgrade has already been
  approved." (`services/sellerUpgradeService.js:100-116`). The UI must surface these, not swallow
  them.

---

## Known consequence, accepted for 1.0.1

Buyers keep `pw_user_status = "pending"` forever. Therefore:

- The **same account can browse in the app but is still blocked on the website.**
- The **admin users queue fills with buyers who never needed approving.**

This is the price of not touching a live auth path this week. See "Deferred to 1.0.2".

---

## File Structure

**Create**

| Path | Responsibility |
|---|---|
| `src/services/seller/sellerUpgrade.ts` | The two seller-upgrade API calls + typed errors |
| `src/features/seller/useSellerUpgrade.ts` | React Query hooks: status query + submit mutation |
| `src/features/seller/schema.ts` | zod schema for the application form |
| `app/(lab)/sell/apply.tsx` | The "tell us about your business" form |
| `src/features/seller/SellerStatusCard.tsx` | Renders pending / approved / rejected + admin notes |
| `src/features/auth/__tests__/pendingSession.test.ts` | Pending login yields a usable buyer session |
| `src/features/seller/__tests__/useSellerUpgrade.test.ts` | Status + submit, including duplicate errors |
| `src/features/lab/scan/__tests__/launchSellerScan.gate.test.ts` | The sell gate |

**Modify**

| Path | Change |
|---|---|
| `src/services/auth/login.ts` | On `ACCOUNT_PENDING`, persist a synthesised profile as well as the tokens |
| `app/_layout.tsx` | Delete the `isPending` redirect (lines 82-85) |
| `src/features/auth/schema.ts` | Add `name` to the credentials step; drop the signup profile step |
| `src/features/auth/useRegistration.ts` | Three steps → two; carry `name`; auto-complete after code |
| `app/(auth)/register.tsx` | Two steps + Terms/Privacy line; remove `ProfileStep` |
| `src/features/lab/scan/launchSellerScan.ts` | Gate: not approved → the application screen |
| `app/(auth)/pending.tsx` | Becomes the seller-application status screen |
| `src/i18n/locales/{en,zh-Hans,zh-Hant,ja,th,vi}.json` | New strings |
| `app.config.ts` | `version: '1.0.1'`; `checkAutomatically: 'ALWAYS'` |
| `src/__tests__/externalLinks.test.ts` | Permit the two legal links; keep banning everything else |

---

## Task 1: A pending login becomes a usable buyer session

**Files:**
- Modify: `src/services/auth/login.ts` (the `ACCOUNT_PENDING` branch)
- Modify: `app/_layout.tsx:76-95`
- Test: `src/features/auth/__tests__/pendingSession.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: after a pending login, `useAuth().profile` is a `Profile` and `useAuth().isPending` is
  `true`. `isPending` now means **"not approved in the main users queue"** and MUST NOT be used to
  block navigation. Later tasks rely on `profile` being non-null for a pending user.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/auth/__tests__/pendingSession.test.ts
import { login, LoginError } from '@/services/auth/login';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn() },
}));
jest.mock('@/lib/secureStorage', () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
}));

import { greenbidz } from '@/api/greenbidzClient';
import { mmkv } from '@/lib/mmkv';

const post = greenbidz.post as jest.Mock;

it('persists a usable buyer profile when the account is pending', async () => {
  post.mockRejectedValue({
    response: {
      status: 403,
      data: {
        code: 'ACCOUNT_PENDING',
        message: 'Your account is pending approval.',
        token: 'tok',
        refreshToken: 'ref',
        userId: 4242,
      },
    },
  });

  await expect(login({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(LoginError);

  const raw = mmkv.getString('auth.profile');
  expect(raw).toBeTruthy();
  const profile = JSON.parse(raw as string);
  expect(profile).toEqual({
    id: 4242,
    email: 'a@b.com',
    name: 'a',           // derived from the address; replaced on first approved login
    role: 'buyer',
    company: null,
  });
  expect(mmkv.getBoolean('auth.pending')).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/features/auth/__tests__/pendingSession.test.ts`
Expected: FAIL — `auth.profile` is null, because the current branch persists only tokens.

- [ ] **Step 3: Persist a synthesised profile**

In `src/services/auth/login.ts`, inside the `ACCOUNT_PENDING` branch, after the existing
`await persist({...})` and `mmkv.set('auth.pending', true)`:

```ts
      // loginV3's pending response carries NO user object — only token/refreshToken/userId
      // (controller/authV3.controller.js:220-225). Synthesise the minimum the app needs so a
      // pending user can actually USE the app as a buyer instead of hitting a wall. The real
      // profile replaces this on the first approved login.
      const pendingProfile = {
        id: Number(body.userId),
        email: payload.email,
        name: payload.email.split('@')[0],
        role: 'buyer' as const,
        company: null,
      };
      mmkv.set('auth.profile', JSON.stringify(pendingProfile));
      useAuth.getState().setProfile(pendingProfile);
      useAuth.getState().setPending(true);
```

Add the import: `import { useAuth } from '@/stores/authStore';`

- [ ] **Step 4: Run the test — it should pass**

Run: `npx jest src/features/auth/__tests__/pendingSession.test.ts`
Expected: PASS

- [ ] **Step 5: Stop the guard from bouncing pending users**

In `app/_layout.tsx`, replace lines 82-85:

```ts
    // ⚠️ DO NOT re-add a redirect here. `isPending` means "not approved in the main
    // users queue", which is the state EVERY new app signup starts in. Bouncing
    // those users to /(auth)/pending is what made a fresh install a dead end.
    // A pending account is a working BUYER account: browse, search, prices, AI
    // chat, messaging and wants all work. Only the SELL path is gated, and that
    // gate lives in launchSellerScan() keyed off /seller-upgrade/my-status.
```

Delete the `onPending` const on line 80 if nothing else uses it.

- [ ] **Step 6: Full suite + type-check**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: tsc exit 0; all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/auth/login.ts app/_layout.tsx src/features/auth/__tests__/pendingSession.test.ts
git commit -m "feat(auth): a pending account is a working buyer session"
```

---

## Task 2: Signup drops to three fields plus a name

**Files:**
- Modify: `src/features/auth/schema.ts`, `src/features/auth/useRegistration.ts`,
  `app/(auth)/register.tsx`
- Test: `src/features/auth/__tests__/useRegistration.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1's pending session (after signup the user is signed in, not parked).
- Produces: `useRegistration()` exposes `submitCredentials(email, password, name)` and
  `submitCode(code)`. There is **no** `submitProfile` any more — the profile fields move to Task 3.
  `RegistrationStep` becomes `'credentials' | 'code' | 'done'`.

- [ ] **Step 1: Write the failing test for the name split**

```ts
it('splits one name field into first and last for the API', async () => {
  mockInitiate.mockResolvedValue(undefined);
  mockVerify.mockResolvedValue(undefined);
  mockComplete.mockResolvedValue({ user_id: 1, email: 'a@b.com', name: 'Ada Lovelace' });

  const { result } = renderHook(() => useRegistration());
  await act(async () => {
    await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'Ada Lovelace');
  });
  await act(async () => {
    await result.current.submitCode('123456');
  });

  expect(mockComplete).toHaveBeenCalledWith({
    email: 'a@b.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
  });
  expect(result.current.state.step).toBe('done');
});

it('uses a single-word name for both fields', async () => {
  mockInitiate.mockResolvedValue(undefined);
  mockVerify.mockResolvedValue(undefined);
  mockComplete.mockResolvedValue({ user_id: 1, email: 'a@b.com', name: 'Ada' });
  const { result } = renderHook(() => useRegistration());
  await act(async () => {
    await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'Ada');
  });
  await act(async () => {
    await result.current.submitCode('123456');
  });
  // The server would otherwise fall back to the email prefix, which reads as broken in chat.
  expect(mockComplete).toHaveBeenCalledWith({
    email: 'a@b.com',
    first_name: 'Ada',
    last_name: 'Ada',
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/features/auth/__tests__/useRegistration.test.ts`
Expected: FAIL — `submitCredentials` takes two arguments and there is still a profile step.

- [ ] **Step 3: Add `name` to the schema**

In `src/features/auth/schema.ts`, add to `registerCredentialsSchema`:

```ts
    name: z.string().trim().min(1, 'mobile.auth.register.nameRequired'),
```

Keep `registerProfileSchema` in place — Task 3 reuses it for the seller application.

- [ ] **Step 4: Collapse the hook to two steps**

In `src/features/auth/useRegistration.ts`:

```ts
export type RegistrationStep = 'credentials' | 'code' | 'done';

/** "Ada Lovelace" -> ['Ada','Lovelace']; "Ada" -> ['Ada','Ada'].
 *  Duplicating a single word beats letting the server fall back to the email
 *  prefix, which shows up as e.g. "abhay" in a seller's chat thread. */
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts.slice(1).join(' ') : first;
  return [first, last];
}
```

`submitCredentials(email, password, name)` stores `name` in state alongside `email`.
`submitCode` becomes: verify the code, then immediately call `completeSignup` and land on `'done'`:

```ts
  const submitCode = useCallback(
    async (code: string) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        await verifySignupCode(state.email, code);
        const [first_name, last_name] = splitName(state.name);
        const result = await completeSignup({ email: state.email, first_name, last_name });
        setState((s) => ({ ...s, busy: false, step: 'done', result }));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [state.email, state.name, fail],
  );
```

Delete `submitProfile`. Add `name: string` to `RegistrationState` and `INITIAL`.

- [ ] **Step 5: Run the tests — they should pass**

Run: `npx jest src/features/auth/__tests__/useRegistration.test.ts`
Expected: PASS (the old `submitProfile` tests must be deleted, not skipped).

- [ ] **Step 6: Update the screen**

In `app/(auth)/register.tsx`: `STEP_ORDER` becomes `['credentials', 'code']`; delete `ProfileStep`;
add a `name` field to `CredentialsStep` after the email input; and add the legal line under the CTA:

```tsx
      {/* The ONLY external links permitted on an auth screen — legal notices, not a
          registration or purchase mechanism (see Global Constraint 1). */}
      <RNText style={styles.legal}>
        {t('mobile.auth.register.legalPrefix')}{' '}
        <RNText style={styles.legalLink} onPress={() => Linking.openURL('https://101lab.co/terms-of-service')}>
          {t('mobile.auth.register.terms')}
        </RNText>
        {' '}{t('mobile.auth.register.legalAnd')}{' '}
        <RNText style={styles.legalLink} onPress={() => Linking.openURL('https://101lab.co/privacy-policy')}>
          {t('mobile.auth.register.privacy')}
        </RNText>
      </RNText>
```

Styles:

```ts
  legal: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, textAlign: 'center', marginTop: 12 },
  legalLink: { color: FOREST, fontWeight: '600' },
```

`DoneStep` now sends the user into the app, not back to sign-in:

```tsx
      <Button label={t('mobile.auth.register.startBrowsing')} onPress={() => router.replace('/(lab)/(tabs)/home')} fullWidth />
```

- [ ] **Step 7: Allow the two legal links in the link test**

In `src/__tests__/externalLinks.test.ts`, the `register.tsx` case must permit exactly these two URLs
and nothing else:

```ts
  it('the registration screen opens nothing except the legal pages', () => {
    const ALLOWED = ['https://101lab.co/terms-of-service', 'https://101lab.co/privacy-policy'];
    const lines = codeLines(read('app/(auth)/register.tsx'));
    const urls = lines
      .filter(({ line }) => /['"`]https?:\/\//.test(line))
      .flatMap(({ line, n }) => {
        const m = line.match(/https?:\/\/[^'"`\s]+/g) ?? [];
        return m.filter((u) => !ALLOWED.includes(u)).map((u) => `${n}: ${u}`);
      });
    expect(urls).toEqual([]);
  });
```

- [ ] **Step 8: Type-check, full suite, commit**

```bash
npx tsc --noEmit && npx jest --silent
git add -A && git commit -m "feat(auth): three-field signup with a name, plus legal links"
```

---

## Task 3: Seller application — service and hooks

**Files:**
- Create: `src/services/seller/sellerUpgrade.ts`, `src/features/seller/useSellerUpgrade.ts`,
  `src/features/seller/schema.ts`
- Test: `src/features/seller/__tests__/useSellerUpgrade.test.ts`

**Interfaces:**
- Consumes: an authenticated (possibly pending) session from Task 1 — `protect` accepts the pending
  JWT because it validates the token only, never `pw_user_status`.
- Produces:
  - `submitSellerUpgrade(values: SellerApplicationInput, files?: SellerDocs): Promise<void>`
  - `getSellerUpgradeStatus(): Promise<SellerUpgradeStatus | null>` where
    `SellerUpgradeStatus = { status: 'pending' | 'approved' | 'rejected'; company_name: string | null; admin_notes: string | null; reviewed_at: string | null }`
  - `useSellerUpgradeStatus()` → React Query result; `useSubmitSellerUpgrade()` → mutation
  - `useCanSell(): boolean` — **the single source of truth for the sell gate**, true only when
    `status === 'approved'`. Task 4 depends on this exact name.
- Error codes: `'DUPLICATE_PENDING' | 'ALREADY_APPROVED' | 'VALIDATION' | 'NETWORK' | 'UNKNOWN'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/seller/__tests__/useSellerUpgrade.test.ts
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { post: jest.fn(), get: jest.fn() } }));
import { greenbidz } from '@/api/greenbidzClient';
import { getSellerUpgradeStatus, submitSellerUpgrade, SellerUpgradeError } from '@/services/seller/sellerUpgrade';

const post = greenbidz.post as jest.Mock;
const get = greenbidz.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('returns null when the user has never applied', async () => {
  get.mockResolvedValue({ data: { success: true, data: null } });
  await expect(getSellerUpgradeStatus()).resolves.toBeNull();
});

it('maps an approved row', async () => {
  get.mockResolvedValue({
    data: { success: true, data: { status: 'approved', company_name: 'Acme', admin_notes: null, reviewed_at: '2026-08-11' } },
  });
  await expect(getSellerUpgradeStatus()).resolves.toEqual({
    status: 'approved', company_name: 'Acme', admin_notes: null, reviewed_at: '2026-08-11',
  });
});

it('surfaces the server duplicate-submission message', async () => {
  post.mockRejectedValue({
    response: { status: 400, data: { message: 'You already have a pending seller upgrade request.' } },
  });
  await expect(
    submitSellerUpgrade({ companyName: 'Acme', taxId: '1', businessType: 'Dealer', phone: '1', country: 'IN', reason: 'x' }),
  ).rejects.toMatchObject({ code: 'DUPLICATE_PENDING' });
});

it('sends multipart so the optional documents can ride along', async () => {
  post.mockResolvedValue({ data: { success: true } });
  await submitSellerUpgrade(
    { companyName: 'Acme', taxId: '1', businessType: 'Dealer', phone: '1', country: 'IN', reason: 'x' },
  );
  const [url, body, config] = post.mock.calls[0];
  expect(url).toBe('/seller-upgrade/request');
  expect(body).toBeInstanceOf(FormData);
  expect(config.headers['Content-Type']).toBe('multipart/form-data');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/features/seller/__tests__/useSellerUpgrade.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the service**

`src/services/seller/sellerUpgrade.ts` — note the field names are **snake_case on the wire**
(`company_name`, `company_tax_id`, `business_type`) and camelCase in the app:

```ts
export type SellerApplicationInput = {
  companyName: string; taxId: string; businessType: string;
  phone: string; country: string; reason: string;
};
export type SellerDocs = {
  businessRegCert?: { uri: string; name: string; type: string };
  wasteDisposalPermit?: { uri: string; name: string; type: string };
};
export type SellerUpgradeStatus = {
  status: 'pending' | 'approved' | 'rejected';
  company_name: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
};
```

`submitSellerUpgrade` builds `FormData` with the six text fields plus any files under
`doc_business_reg_cert` / `doc_waste_disposal_permit`, POSTs to `/seller-upgrade/request` with
`headers: { 'Content-Type': 'multipart/form-data' }`, and maps 400 messages containing
`already have a pending` → `DUPLICATE_PENDING`, `already been approved` → `ALREADY_APPROVED`.

- [ ] **Step 4: Write the hooks**

`src/features/seller/useSellerUpgrade.ts`:

```ts
export const SELLER_UPGRADE_KEY = ['seller-upgrade', 'my-status'] as const;

export function useSellerUpgradeStatus() {
  return useQuery({ queryKey: SELLER_UPGRADE_KEY, queryFn: getSellerUpgradeStatus, staleTime: 60_000 });
}

/** THE sell gate. Selling requires an APPROVED seller-upgrade request — not a
 *  non-pending session, because approving an upgrade does NOT flip
 *  pw_user_status (services/sellerUpgradeService.js:272-280). */
export function useCanSell(): boolean {
  const { data } = useSellerUpgradeStatus();
  return data?.status === 'approved';
}
```

The submit mutation must `invalidateQueries({ queryKey: SELLER_UPGRADE_KEY })` on success.

- [ ] **Step 5: Run the tests — they should pass**

Run: `npx jest src/features/seller/__tests__/useSellerUpgrade.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/seller src/features/seller && git commit -m "feat(seller): seller-upgrade service and hooks"
```

---

## Task 4: Gate the sell path at its single choke point

**Files:**
- Modify: `src/features/lab/scan/launchSellerScan.ts`
- Test: `src/features/lab/scan/__tests__/launchSellerScan.gate.test.ts`

**Interfaces:**
- Consumes: `useCanSell()` from Task 3. Because `launchSellerScan` is a plain function (not a hook),
  read the cached query directly via the query client rather than converting four call sites to
  hooks.
- Produces: `launchSellerScan()` routes to `/(lab)/sell/apply` when the user may not sell.

**Context:** there are four call sites — `app/(lab)/(tabs)/home.tsx:120` and `:129`,
`app/(lab)/chat.tsx:511` and `:517`, plus `src/features/lab/chat/controllers/useChatController.ts:186`.
Gating inside the function covers all of them at once.

- [ ] **Step 1: Write the failing test**

```ts
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
import { router } from 'expo-router';
import { launchSellerScan } from '../launchSellerScan';
import { queryClient } from '@/lib/queryClient';
import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';

it('sends an unapproved user to the application form', () => {
  queryClient.setQueryData(SELLER_UPGRADE_KEY, null);
  launchSellerScan();
  expect(router.push).toHaveBeenCalledWith('/(lab)/sell/apply');
});

it('lets an approved seller straight into the scan flow', () => {
  queryClient.setQueryData(SELLER_UPGRADE_KEY, { status: 'approved', company_name: 'Acme', admin_notes: null, reviewed_at: null });
  launchSellerScan();
  expect(router.push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/features/lab/scan/__tests__/launchSellerScan.gate.test.ts`
Expected: FAIL — the unapproved case currently opens the camera.

- [ ] **Step 3: Add the gate**

At the top of `launchSellerScan()`, before the draft reset:

```ts
  // Listing requires an APPROVED seller-upgrade request. Read the cache rather
  // than a hook: this is a plain function called from four places (lab home ×2,
  // lab chat ×2, chat controller), and gating here covers all of them.
  const status = queryClient.getQueryData<SellerUpgradeStatus | null>(SELLER_UPGRADE_KEY);
  if (status?.status !== 'approved') {
    router.push('/(lab)/sell/apply');
    return;
  }
```

- [ ] **Step 4: Run the tests — they should pass**

Run: `npx jest src/features/lab/scan/__tests__/launchSellerScan.gate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seller): gate the sell path behind an approved upgrade"
```

---

## Task 5: The application screen and the status screen

**Files:**
- Create: `app/(lab)/sell/apply.tsx`, `src/features/seller/SellerStatusCard.tsx`,
  `src/features/seller/schema.ts`
- Modify: `app/(auth)/pending.tsx`

**Interfaces:**
- Consumes: `useSubmitSellerUpgrade`, `useSellerUpgradeStatus` (Task 3).
- Produces: route `/(lab)/sell/apply`. Regenerate typed routes before type-checking (see below).

**UX requirements — `UX_DESIGN_RULES.md` is mandatory, not advisory:**
one dominant CTA (**Submit application**), sticky on this long form; document uploads optional and
visibly so; every field error recoverable in place; on success the screen switches to the status
view rather than navigating away; server duplicate/approved messages shown verbatim.

- [ ] **Step 1: Write the form schema**

```ts
// src/features/seller/schema.ts
export const sellerApplicationSchema = z.object({
  companyName: z.string().trim().min(1, 'mobile.seller.apply.companyRequired'),
  taxId: z.string().trim().min(1, 'mobile.seller.apply.taxIdRequired'),
  businessType: z.string().trim().min(1, 'mobile.seller.apply.businessTypeRequired'),
  phone: z.string().trim().min(1, 'mobile.seller.apply.phoneRequired'),
  country: z.string().trim().min(1, 'mobile.seller.apply.countryRequired'),
  reason: z.string().trim().min(1, 'mobile.seller.apply.reasonRequired'),
});
export type SellerApplicationValues = z.infer<typeof sellerApplicationSchema>;
```

- [ ] **Step 2: Build `app/(lab)/sell/apply.tsx`**

Three states in one screen, decided by `useSellerUpgradeStatus()`:
`null` → the form · `pending` → "with our team" · `rejected` → reason + resubmit · `approved` →
"you can list now" plus a button into the scan flow. Reuse the input styles from
`app/(auth)/register.tsx` so it reads as the same product. Use `expo-document-picker` for the two
optional documents (already a dependency — confirm with
`node -e "require('expo-document-picker')"` before writing the import).

- [ ] **Step 3: Repoint `app/(auth)/pending.tsx`**

It is no longer a blocking wall. Keep the approval checklist, but render `SellerStatusCard` and
remove any implication that the user cannot use the app. Global Constraint 1 still applies: **no
outbound navigation from this screen.**

- [ ] **Step 4: Regenerate typed routes, then type-check**

expo-router generates `.expo/types/router.d.ts` from the filesystem; a new route will not type-check
until Metro has run once.

```bash
CI=1 npx expo start --port 8099 &   # wait ~5s for the file to regenerate, then kill it
grep -c "sell/apply" .expo/types/router.d.ts   # must be > 0
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seller): application form and status screen"
```

---

## Task 6: Translations for every new string

**Files:** `src/i18n/locales/{en,zh-Hans,zh-Hant,ja,th,vi}.json`

- [ ] **Step 1** — Write a scratchpad python script that inserts the new
  `mobile.auth.register.*` and `mobile.seller.apply.*` keys by **text insertion**, locating parent
  objects by brace matching. Re-read Global Constraint 3 before starting.
- [ ] **Step 2** — Run it, then verify every locale diff is `+N/-0`:
  `git diff --numstat -- src/i18n/locales/`
- [ ] **Step 3** — `npx jest src/i18n` — `authCoverage.test.ts` derives its expectations from
  `en.json`, so a missing translation fails automatically. Add a key to `INTENTIONALLY_SAME` only
  when a locale genuinely uses the English word (as Vietnamese does for "Email").
- [ ] **Step 4** — Commit.

---

## Task 7: Version, updates, and the build

- [ ] **Step 1** — `app.config.ts`: `version: '1.0.1'`, and restore
  `checkAutomatically: 'ALWAYS'` (it was set to `'NEVER'` only for the 1.0.0 review cycle, because
  the update check ran before the first frame and blocked launch — the Guideline 2.1 rejection).
- [ ] **Step 2** — `npx tsc --noEmit && npx jest --silent`. Everything green before building.
- [ ] **Step 3** — Build, redirecting output to a file (a pipe kills the CLI via SIGPIPE **after**
  it has reserved a build number — that is how build numbers 11 and 12 were burned):
  `npx eas-cli@latest build -p ios --profile production --non-interactive --no-wait > build.log 2>&1`
- [ ] **Step 4** — Upload it. **`eas build` does not do this for you:**
  `npx eas-cli@latest submit -p ios --profile production --id <buildId> --non-interactive`
- [ ] **Step 5** — Verify the IPA, searching both ASCII **and** UTF-16LE:
  `1.0.1`, `EXUpdatesCheckOnLaunch: ALWAYS`, `seller-upgrade/request` present,
  `greenbidz.com/contact-us` **absent**, `101lab.co/terms-of-service` present.

---

## Task 8: The verification gauntlet

Three assumptions this plan rests on. **Each must be proven against production before 1.0.1 ships.**

- [ ] **Step 1: Does `protect` accept a pending token?**
  Sign up a throwaway account, capture the 403's `token`, then call each write endpoint with it:
  `POST /chat/send`, the wants create route, `POST /seller-upgrade/request`. All three use the same
  middleware, which checks the JWT and not `pw_user_status`, so they *should* work — but the whole
  design collapses if they 403. **If they reject it, stop and escalate:** the fallback is the Task-1
  gate plus read-only browsing, which is a different product.
- [ ] **Step 2: Does the 6-digit code email actually arrive?**
  Different code path from the welcome email, which is broken (see below), but it gates every new
  user. Check the inbox, and check spam.
- [ ] **Step 3: Does token refresh work for a pending session?**
  Access tokens last 15 minutes and a refresh row is created. Idle past expiry and confirm the app
  does not silently sign the user out mid-browse.
- [ ] **Step 4: Full journey on a throwaway address**
  signup → code → browse with prices → AI chat → message a seller → post a want → tap Sell → apply →
  see "with our team" → admin approves → Sell opens the camera.
  ⚠️ **This writes real rows to the production database and emails real admins.** Agree the address
  with the user first; never use a customer's.
- [ ] **Step 5** — Record the results in this file under a "Verified" heading, with dates.

---

## Deferred to 1.0.2 (needs explicit approval — touches production)

1. **Seller-upgrade approval should also flip `pw_user_status` to `approved`**
   (`services/sellerUpgradeService.js` around line 272). Without it, an approved seller is still
   `pending`, so the **website keeps blocking them** even though the app works.
2. **Buyers should not sit in the admin approval queue.** Either approve app buyer signups on
   creation, or split buyer status from seller status.
3. **The welcome email has never been sent to anyone.** `completeSignup` calls
   `BuyerEmailTemplate.welcomeUser(emailData, lang)` and **`lang` is undefined** — not in the
   function, not at module scope, identical on `main`. It throws inside a `try/catch`, so every
   registration logs "Welcome email failed: lang is not defined" and moves on. **Website signups are
   affected too.** One-word fix; prod change, so it waits for a go-ahead.
4. **Pending signups live in an in-memory Map** — lost on API restart, not shared across instances.
   The app already recovers by returning to step 1 with an explanation.
5. **The chat socket has no authentication** — identity is whatever `user_id` a client claims. Not
   introduced by this plan, but registration makes it reachable by anyone who downloads the app.

---

## Self-review (completed before hand-off)

- **Spec coverage:** simple signup → Task 2. Immediate buyer access → Tasks 1, 4. Details-then-
  approval for sellers → Tasks 3, 5. Consent links → Task 2 Step 6. Auto-updates → Task 7.
- **Placeholders:** none. Every code step carries real code; every test step carries a command and
  an expected result.
- **Type consistency:** `useCanSell` / `SELLER_UPGRADE_KEY` / `SellerUpgradeStatus` are defined in
  Task 3 and consumed under those exact names in Task 4. `submitCredentials(email, password, name)`
  is defined in Task 2 and used nowhere earlier.
- **Known gap, stated rather than hidden:** Task 8 Step 1 can invalidate the whole approach. It is
  sequenced as a gauntlet rather than a final smoke test for that reason, and it is cheap to run
  first if the implementer prefers.
