# App Store submission — GreenBidz (iOS)

Playbook for shipping `GreenBridgeApp` to the App Store. Target: **TestFlight first**, then
submit for review.

- **App shipped:** the **customer / lab fork** (`EXPO_PUBLIC_USER_TYPE=customer`) —
  `app/(lab)/` Home · Browse · Deals · Matches · Account, plus AI buy/sell chat.
  The seller fork (`app/(tabs)/`) is **not** what these store builds produce.
- **EAS project:** `@jame124dev/greenbridge` (`57cd3db7-90b1-4b57-a723-679bfe81ef69`)
- **Apple team:** Quippy AI Limited (Team ID `T642D4X34U`)
- **App record:** **created 2026-08-03** — name **GreenBidz**, ASC App ID **`6797434238`**, SKU `GREENBIDZ-IOS-001`, iOS 1.0 "Prepare for Submission". Now set as `submit.production.ios.ascAppId` in `eas.json`, so `--auto-submit` works.
- **Registered App ID:** `com.greenbidz.bridge` with Push Notifications enabled (portal description reads "101Lab" — an internal label only, harmless)
- **Bundle ID:** `com.greenbidz.bridge` — ⚠️ **permanent once the first build is uploaded.** Change it now or never.
- **Version:** `1.0.0`, build number auto-incremented by EAS (`appVersionSource: "remote"`)
- **Latest build: `1.0.0 (9)`** (`d9d6899e`, 2026-08-04) — uploaded via `--auto-submit`. Contains
  the chat send fix (`sender_role` was derived from `profile.role`, so the server dropped every
  sent message), the `joinChat` ack timeout, the Filters-bar inset fix, and the update-ready
  banner. All verified in the shipped IPA's embedded Hermes bundle, not just in config.
  ⚠️ When grepping a Hermes bundle: strings containing any non-ASCII character (e.g. an em dash)
  are stored as **UTF-16**, so an ASCII `grep` returns 0 hits for a string that is present.

Windows note: there is no local iOS toolchain and no simulator, so **every** iOS build goes
through EAS Build in the cloud and TestFlight on a real iPhone is the only way to test it.

---

## 1. Blockers — resolve before submitting for review

These do not block a TestFlight build. They do risk a rejection at review.

### 1.1 In-app account deletion (Guideline 5.1.1(v)) — **LIVE ON PROD 2026-08-03** ✅

Implemented. **Account ▸ Security → "Delete account"** → a dedicated confirm screen showing what
will happen and anything still outstanding, requiring the password to be re-entered.

- Design: `Docs/superpowers/specs/2026-08-03-account-deletion-design.md`
- Plan: `Docs/superpowers/plans/2026-08-03-account-deletion.md`
- Backend: `services/accountDeletionService.js` + `controller/accountDeletionController.js`,
  routes `GET /api/v1/user/me/deletion-preview` and `DELETE /api/v1/user/me`, both behind
  `protect` (the acting user is `req.user.id` only — never a body-supplied id).
  Branch **`feat/account-deletion`** off `dev`. 16 unit tests green.
- Mobile: `app/(lab)/account/delete.tsx`, `src/features/settings/useAccountDeletion.ts`,
  `DeleteAccountLink`, copy in all 6 locales. 5 render tests green; `tsc --noEmit` clean.

Semantics: **anonymise + disable, retain transactions.** Email/login/display name are
tombstoned, the password is randomised, PII metadata is deleted, `pw_user_status` is revoked,
still-on-market listings are withdrawn, and wants/wishlist/drafts/notifications/refresh
tokens/OTPs are deleted — all in one transaction. Orders, payments, bids and winner payments
are **kept with IDs intact** so accounting and dispute history stay whole; the counterparty's
message threads survive and render as "Deleted user".

**Deployed 2026-08-03.** Dev (`dev` → `greenbidz-test-backend` :6000) and **prod**
(`main` 152b12f → `greenbidz-backend` :4000, DB `greenbidz`). Both routes verified live: 401
unauthenticated while a bogus sibling path 404s, so the gate is real and not a catch-all.

⚠️ **Reaching `main` needed a cherry-pick, NOT a merge.** `dev` is 56 commits ahead of `main`
and `main` is 46 ahead of `dev` — merging `dev → main` would have shipped 56 unrelated,
unreviewed commits to production. Cherry-pick the single commit. Also note `.github/workflows/
deploy-backend.yml` fires on **push to `main`**, so pushing `main` *is* the prod deploy (it runs
`git reset --hard origin/main` + `npm ci --production` + `pm2 restart greenbidz-backend` —
check the prod checkout for local hot-patches first, since the reset discards them).

Verification performed, since the unit tests mock every model and prove logic only, not schema:
- Every column and enum value confirmed against the real `greenbidz_test` **and** `greenbidz`
  schemas. `jos_recycle_product_batch.seller_id` is correct — there is no `post_author` on that
  table.
- The full delete transaction run against real MySQL on dev with a throwaway user: tombstone
  applied, old password rejected afterwards, PII meta gone, `pw_user_status` revoked,
  `gb_deleted_at` stamped, second delete idempotent, throwaway row then removed.
- Read-only preview probe run against the prod DB on a real account (no writes).
- **Not** exercised: a delete against a real prod account (it is irreversible), and a non-zero
  `unpaidWinningBids` count — no buyer in either DB currently has a pending/failed winner
  payment, so only the mocked unit test covers that branch.

✅ **RESOLVED — the retention disclosure is live** (verified on `101lab.co` 2026-08-04). §8 "Data
retention" of the live privacy policy reads:

> We retain your information for as long as your account is active and as needed to provide our
> services, and afterwards only as long as necessary to comply with legal, tax, accounting and
> dispute-resolution obligations, after which it is deleted or anonymized.

That is exactly what the deletion implementation does (anonymise, retain orders/payments for
accounting and disputes), so Apple's post-deletion-retention disclosure requirement is satisfied.
No web deploy is outstanding for this.

### 1.2 App Review needs a pre-approved demo account

Login is mandatory at launch, and an unapproved user is routed to `app/(auth)/pending.tsx`.
**If the reviewer's account lands in `pending`, they see a wall and reject the build.**

Create a customer account on prod, confirm `pw_user_status` is approved, verify it reaches
Home in TestFlight, then put the credentials in App Review notes (§6).

### 1.3 `X_SYSTEM_KEY` ships inside the IPA — security exposure

`fa39812fec` is embedded in `extra.X_SYSTEM_KEY` and is therefore **extractable from any
downloaded build** — `strings` on the JS bundle is enough. Per the workspace `CLAUDE.md`,
this shared key gates privileged Node write routes that have no `protect` middleware and read
`seller_id` / `added_by_member_id` straight from the request body.

Today it is only shipped to internal Android testers. **Publishing on the App Store makes it
public.** This is a pre-existing architectural issue, not something introduced here, and it
does not block the build — but it should be a decision, not an accident. Options: move the
system-key routes the app needs behind JWT `protect`, or issue the app a distinct key that is
scoped to the endpoints it actually calls and can be rotated independently.

---

## 2. What was already changed (committed nothing — review the diff)

### `app.config.ts`

| Change | Why |
|---|---|
| `name`: `GreenBidz Seller` → `GreenBidz` | Config was named for the seller *fork*. The store app is the **umbrella brand**: one app intended to serve 101lab, 101it, 101machines and 101recycle, which the codebase already scopes by `site_id`/`allowed_sites`/`SITE_TYPE`. This is the home-screen name. |
| `version`: `0.1.0` → `1.0.0` | First public release. |
| OneSignal `mode` → `production` (via `APNS_MODE`) | `development` = APNs **sandbox**; TestFlight and App Store builds are production-signed, so push would silently never arrive. `development` build profile still overrides it back to sandbox for dev clients. |
| `ios.config.usesNonExemptEncryption: false` | Emits `ITSAppUsesNonExemptEncryption`, so App Store Connect stops asking export-compliance questions on every upload. App uses only standard HTTPS. |
| `ios.infoPlist` camera + photo purpose strings | Specific strings naming the actual use. Generic ones are a common rejection. |
| `ios.privacyManifests` (4 required-reason APIs) | Apple rejects uploads by email (ITMS-91053) when SDKs touch required-reason APIs undeclared. Covers file timestamps, `NSUserDefaults`, disk space, boot time (RN core, MMKV, expo-file-system, OneSignal). |
| `microphonePermission: false` (expo-camera) | Scan captures stills only. `false` **deletes** the key rather than falling back to the plugin's generic default. |
| `faceIDPermission: false` (expo-secure-store) | `requireAuthentication` is never used anywhere in the app. |
| `locationAlwaysAndWhenInUsePermission: false`, `locationAlwaysPermission: false`, `motionUsagePermission: false` (expo-location) | App is foreground-only. "Always" location is the most heavily scrutinised permission at review; motion is an unused plugin default. |

Resulting iOS permission set, verified in the **shipped IPA** (not just the config):
**Camera, Photo Library, Location (When In Use), Motion**.

### ⚠️ Build traps hit for real — read before trimming anything else

**1. `NSMotionUsageDescription` MUST stay declared.** Deleting it built fine but Apple
**rejected the upload** of build 6:

> `90683: Missing purpose string in Info.plist … should contain a NSMotionUsageDescription
> key … While your app might not use these APIs, a purpose string is still required.`

Apple statically analyses the linked **binary**, and `expo-location` links CoreMotion. "The app
never calls it" is not the test — "is the API referenced anywhere in the binary" is. The
microphone, Face ID and location-Always trims passed the same check and are safe.

**2. `expo-dev-launcher`'s Release strip phase does NOT work.** Build 6's shipped
`Payload/GreenBidz.app/Info.plist` still contained `NSBonjourServices: ['_expo._tcp']` and
`NSLocalNetworkUsageDescription: "Expo Dev Launcher uses the local network to discover and
connect to development servers running on your computer."` — dev-tooling wording in a store
binary. Fixed with `plugins/withStripDevLauncherLocalNetwork.js`, which must stay **last** in
the `plugins` array so its mod runs after the one that adds the keys.

**3. `channel` requires `expo-updates`.** The `production` profile declares
`channel: "production"`, so the build aborts without `updates.url` + `runtimeVersion` — and EAS
cannot write them into a dynamic `app.config.ts` itself.

**4. `npm ci --dry-run` does NOT catch a desynced lockfile.** It reported "up to date" while the
builder's real `npm ci --include=dev` failed with `Missing: typescript@5.9.3 from lock file`
(root pinned `~6.0.3`; the SDK 56 toolchain resolves `5.9.3`; local npm 11 hoisted one copy and
the builder's npm wanted a nested one). Always validate with the real command.

### Verified in the build-6 IPA

Parsed straight out of `Payload/GreenBidz.app/`:

| | |
|---|---|
| `CFBundleDisplayName` | `GreenBidz` |
| Version / build | `1.0.0` (6) |
| `MinimumOSVersion` | **16.4** — the minimum iOS a test device needs |
| `ITSAppUsesNonExemptEncryption` | `false` |
| `UIBackgroundModes` | `['remote-notification']` |
| `PrivacyInfo.xcprivacy` | all 4 required-reason declarations, `NSPrivacyTracking: false` |
| Absent as intended | microphone, Face ID, location-Always |
| OneSignal extension | `PlugIns/OneSignalNotificationServiceExtension.appex` present |

### `eas.json`

All three profiles now build the **customer fork against prod backends**. Previously the
`production` profile passed no feature flags at all, so a store build would have been the
**seller** app with every feature switched off.

```
EXPO_PUBLIC_USER_TYPE=customer      GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
EXPO_PUBLIC_LAB_CHAT=1              AI_BASE_URL=https://ai.greenbidz.com
EXPO_PUBLIC_WTB=1                   EXPO_PUBLIC_MARKETPLACE_URL=https://101lab.co
EXPO_PUBLIC_SMART_DETECT=1          WEB_APP_URL=https://101lab.co
EXPO_PUBLIC_SMART_DETECT_V2=1       SITE_TYPE=LabGreenbidz
EXPO_PUBLIC_DETECT_STREAM=1         EXPO_PUBLIC_ONESIGNAL_APP_ID=a9a5c723-…
EXPO_PUBLIC_DRAFTS=1
EXPO_PUBLIC_BACKGROUND_RECOGNITION=1
```

`api.101recycle.greenbidz.com` is confirmed prod (`DEPLOYMENTS.md`: `main`, pm2
`greenbidz-backend` :4000, DB `greenbidz`). Also added `autoIncrement: true` to `production`,
dropped the dead `QUIPPY_API_URL` placeholder (`src/api/quippyClient.ts` is imported nowhere),
and left `submit.production` empty so `eas submit` can prompt and create the ASC record.

### Checked and deliberately **not** changed

- **Icon** — `assets/images/icon.png` is 1024×1024 and, decoded, has **zero transparent and
  zero semi-transparent pixels**. Already App Store legal; no flattening needed.
- **`NSAllowsArbitraryLoads: true`** — appears in `expo config --type introspect` output but
  is only in `@expo/config-plugins`' *synthetic fallback* template used when no `ios/` dir
  exists. The real `expo-template-bare-minimum@56.0.32` Info.plist ships
  `NSAllowsArbitraryLoads=false` + `NSAllowsLocalNetworking=true`. Non-issue.
- **`NSBonjourServices` / "Expo Dev Launcher uses the local network…"** — `expo-dev-launcher`
  installs a Release build phase that strips exactly these keys when `$CONFIGURATION != Debug`.
  Non-issue.
- **`UIRequiredDeviceCapabilities: armv7`** — same introspect-fallback artifact; the real
  template says `arm64`.
- **21 out-of-date deps** (`expo-doctor`'s only failure) — all patch-level *within* SDK 56
  (e.g. `expo@56.0.4` → `56.0.18`). Left pinned so the first iOS build uses the exact
  tree that was verified on-device. If the cloud build fails on a native/config error,
  `npx expo install --check` is the first thing to try.
- **`android/`** is untracked, so EAS prebuilds iOS fresh. The stray `RECORD_AUDIO` in
  introspect output comes from that stale local prebuild, not from config — it will not be
  in a cloud build.

---

## 3. Build → TestFlight

Run from `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp`. **These need you at the keyboard** —
Apple sign-in triggers 2FA and I cannot answer that prompt.

```powershell
# 0. Commit the config changes first — EAS builds from git-tracked state.
git add app.config.ts eas.json Docs/APP_STORE_SUBMISSION.md
git commit -m "chore(ios): App Store config for the 101Lab customer build"

# 1. Build. Prompts for Apple sign-in, then registers the bundle ID and
#    generates the distribution cert + provisioning profile automatically.
npx eas-cli@latest build -p ios --profile production
```

Answer the prompts:
- *"Do you want to log in to your Apple account?"* → **yes**
- Apple ID for the **Quippy AI Limited** team, password, 2FA code
- *"Generate a new Apple Distribution Certificate?"* → **yes**
- *"Generate a new Apple Provisioning Profile?"* → **yes**

Build takes roughly 15–25 min. Then:

```powershell
# 2. Upload to App Store Connect → lands in TestFlight.
#    Offers to create the ASC app record if it does not exist yet.
npx eas-cli@latest submit -p ios --latest
```

Once §4's app record and metadata exist you can collapse both steps into
`npx eas-cli@latest build -p ios --profile production --auto-submit`.

After upload, Apple runs automated processing (~5–30 min). Add yourself as an Internal Tester
in App Store Connect → TestFlight, install via the TestFlight app, and work §5.

---

## 4. App Store Connect app record

**Apps → ✛ → New App:**

| Field | Value |
|---|---|
| Platform | iOS |
| Name | `GreenBidz` — created 2026-08-03 |
| Primary language | English (U.K.) or (U.S.) |
| Bundle ID | `com.greenbidz.bridge` — appears once step 3 registers it |
| SKU | `GREENBIDZ-IOS-001` (internal only, never shown) |
| User access | Full Access |

**App Information:** Primary category **Business**, secondary **Shopping**.
Age rating **4+**. Copyright `2026 Quippy AI Limited`.

**Store listing copy** — draft, edit freely (limits enforced by ASC):

- **Subtitle** (30): `Used lab & industrial gear`
- **Promotional text** (170): `Photograph any machine and our AI writes the listing for you. Browse verified used laboratory and industrial equipment, post what you're looking for, and deal direct.`
- **Keywords** (100, comma-separated, no spaces after commas):
  `used equipment,laboratory,industrial,machinery,B2B,marketplace,surplus,auction,resale,secondhand`
- **Description** (4000):

```
GreenBidz is a B2B marketplace for used laboratory and industrial equipment.

PHOTOGRAPH IT — THE AI WRITES THE LISTING
Point your camera at a machine. GreenBidz identifies it and drafts the listing for
you: title, category, specifications and description. Review, adjust anything you
like, and publish. Save a draft and pick it up later on any device.

BROWSE VERIFIED EQUIPMENT
Search thousands of used lab and industrial machines. Filter by category and
condition, view full specifications and photo galleries, and see live auction
lots alongside direct-sale listings.

TELL US WHAT YOU NEED
Can't find it? Post what you're looking for and GreenBidz matches it against
incoming equipment, scoring how closely each one fits. You get notified when
something relevant arrives.

TALK DIRECTLY TO SELLERS
Message sellers in-app about condition, specifications, logistics and price.
Everything stays in one thread.

ASK IN YOUR OWN WORDS
The built-in assistant answers questions about equipment, finds listings and
helps you post a request — in plain language, in any of six languages.

Available in English, Chinese (Simplified and Traditional), Japanese, Thai and
Vietnamese.

GreenBidz supports the circular economy through responsible industrial trade.
The app connects you to the 101lab marketplace, with 101machines, 101recycle
and 101IT joining it.
```

- **Support URL:** `https://101lab.co/faq` ✅ verified live — "Frequently Asked Questions |
  101lab by GreenBidz", and it publishes **support@greenbidz.com**, which satisfies Apple's
  requirement that the support page offer a way to reach you.
  (`101lab.co/contact` **404s** — there is no such route. `seller.greenbidz.com/contact`, which
  the app's own "Request an account" link opens, is a seller-facing GreenBidz enterprise page,
  not customer support.)
- **Marketing URL:** `https://101lab.co`
- **Privacy Policy URL:** `https://101lab.co/privacy-policy` ✅ verified live
- (Terms, if asked: `https://101lab.co/terms-of-service` ✅ verified live)

**Localizations** worth adding, since the app ships all six: English, Chinese (Simplified),
Chinese (Traditional), Japanese, Thai, Vietnamese.

### Pushing the listing copy — `store.config.json`

The copy above is committed as **`store.config.json`** at the repo root, field-length-validated
against Apple's limits (title 9/30, subtitle 26/30, promo 166/170, description 1352/4000,
keywords 96/100). Push it with:

```powershell
npx eas-cli@latest metadata:push
```

⚠️ **This command needs YOUR Apple ID at the keyboard.** The App Store Connect **API key** stored
on EAS (`2GW82U6AZW`, "[Expo] EAS Submit") is enough to *upload builds* — it submitted build 9 —
but the metadata API rejects it:

```
Auth error: Apple 401 detected … Authentication credentials are missing or invalid.
Log in to your Apple Developer account to continue
```

So `metadata:pull` / `metadata:push` fall back to Apple-ID cookie auth and prompt for 2FA. Either
run it yourself, or paste the §4 copy into the App Store Connect web UI — both produce the same
result.

**Demo-account credentials are deliberately NOT in `store.config.json`.** The file is committed to
git; the review credentials belong in **App Store Connect → App Review Information**, typed into
the web UI, so they never enter the repository. Same for the App Privacy questionnaire (§6) and
age rating — `eas metadata` does not manage screenshots or the privacy questionnaire at all.

### Screenshots — required

iPhone **6.9"**, portrait, `1290 × 2796` or `1320 × 2868`. Minimum 3, maximum 10. Since the app
does not support iPad (`supportsTablet: false`), no iPad set is needed. Capture from a real
device on TestFlight (Windows has no simulator):

1. Home
2. AI scan → the drafted listing it produced
3. Browse / marketplace
4. Matches (a want with relevance %)
5. A message thread

Do not show placeholder or lorem-ipsum content — that alone gets builds rejected.

---

## 5. TestFlight test pass

Ordered by how likely each is to be broken, based on what changed and what has never run on iOS:

1. **Push notifications.** Highest risk. `expo-notifications` *and* `react-native-onesignal`
   are both installed and both want to be the `UNUserNotificationCenter` delegate — this has
   never been exercised on iOS. Also confirm an **APNs auth key is uploaded to the OneSignal
   dashboard**, or iOS registration fails regardless of app code. (Android push is separately
   blocked on `INVALID_FCM_SENDER_ID`.)
2. **Login against prod** — email/password, then the approved account reaching Home rather
   than `pending`.
3. **AI scan end-to-end** — camera permission prompt shows the new string; photo →
   `SMART_DETECT_V2` + `DETECT_STREAM` SSE → draft appears. SSE over `react-native-sse`
   (XHR-based) has not been proven on iOS.
4. **Background recognition** — newly on in production for the first time. Start a scan, leave
   the screen, confirm the finished draft lands in Your drafts.
5. **Browse WebView** — `101lab.co/buyer-marketplace?app=1` renders, native token injection
   authenticates, and card taps stay in-app.
6. **Drafts** — save, kill the app, relaunch, resume.
7. **Messages** — Socket.io connects over prod. ⚠️ Sending writes to the **prod** database.
8. **All six languages** — switch locale; check the Chinese variants specifically (there is a
   history of `zh` falling back to English, and ~76 keys were still EN-fallback).
9. **Splash / icon** — navy `#002855` splash, correct icon, no white halo.

---

## 6. App Privacy questionnaire

Verified from the code: **no Sentry, no Firebase, no analytics, no ad or attribution SDKs.**
So: **"Data is not used to track you"** — no ATT prompt, no `NSUserTrackingUsageDescription`.

| Data type | Collected | Linked to user | Purpose |
|---|---|---|---|
| Email address | Yes | Yes | App Functionality (account) |
| Name / company | Yes | Yes | App Functionality |
| Photos | Yes | Yes | App Functionality (equipment images uploaded to listings) |
| Other user content | Yes | Yes | App Functionality (listing text, messages, requests) |
| Precise location | Yes — optional | Yes | App Functionality (auto-fills pickup address; user may decline) |
| Device ID | Yes | Yes | App Functionality (OneSignal push subscription) |
| Search history | Yes | Yes | App Functionality |

Tracking: **No**. Third-party advertising: **No**.

### App Review notes — paste this in

```
DEMO ACCOUNT
Email:    <fill in — must be an APPROVED customer account on production>
Password: <fill in>

This account is pre-approved. Accounts pending manual approval are shown a
"pending approval" screen by design.

ABOUT THE APP
GreenBidz is a B2B marketplace for used laboratory and industrial equipment.
Buyers browse and enquire about equipment; the AI
assistant drafts listings and purchase requests from photographs.

ACCOUNT CREATION
The app does not offer self-serve signup. Accounts are provisioned manually by
our team after a request submitted through our website, so account creation is
not possible from within the app.

ACCOUNT DELETION
Account > Security > "Delete account". The user re-enters their password, is
shown anything still outstanding on the account, and confirms. Personal data is
erased immediately and the account can no longer sign in. Order and payment
records are retained for accounting and dispute purposes, as disclosed in our
Privacy Policy at https://101lab.co/privacy-policy.

PERMISSIONS
- Camera: photographing equipment so the AI can identify it and draft a listing.
- Photos: attaching existing equipment images to a listing or message.
- Location (when in use, optional): auto-filling a listing's pickup address.
  The app works fully if declined.

TRANSACTIONS
All transactions concern physical industrial equipment fulfilled outside the
app. There are no digital goods, so no in-app purchases are used.
```

---

## 7. Order of operations

Status as of **2026-08-04**. Done: account deletion (§1.1) including the live privacy-policy
disclosure, the ASC app record, build `1.0.0 (9)` uploaded, and the listing copy in
`store.config.json`.

Remaining, in order — every one of these needs a human with an Apple login or a phone:

1. **Decide §1.3** — `X_SYSTEM_KEY` becomes public the moment the app ships. Also note the chat
   socket has **no authentication** (identity is whatever `user_id` a client claims via
   `joinRooms`; the web client is the same). Neither blocks the build; both should be a decision
   rather than an accident before the app is public.
2. **Create + approve a demo account on prod**, and confirm in TestFlight that it reaches Home
   rather than `app/(auth)/pending.tsx`. Hard blocker: a reviewer who lands on the pending wall
   rejects the build (Guideline 2.1).
3. **Capture 3–10 screenshots** at 6.9" `1290 × 2796` from a real iPhone on TestFlight — Windows
   has no simulator, so there is no other source. No placeholder content.
4. **Listing copy** — `metadata:push` (needs your Apple ID + 2FA) or paste §4 into the ASC UI.
5. **App Privacy questionnaire + age rating (4+) + App Review Information** — ASC web UI only;
   answers are all in §6. Put the demo credentials here, not in `store.config.json`.
6. **Submit for review.**
