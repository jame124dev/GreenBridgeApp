# Google Play submission — GreenBidz (Android)

Companion to `Docs/APP_STORE_SUBMISSION.md`. Same app, same **customer / lab fork**
(`EXPO_PUBLIC_USER_TYPE=customer`), same `eas.json` production profile.

- **Play account:** Quippy AI — **Organization account**, Account ID `9033951522021606822`
- **Package:** `com.greenbidz.bridge` (matches the iOS bundle ID) — **permanent once uploaded**
- **Version:** `1.0.0`; `versionCode` auto-incremented by EAS (`appVersionSource: "remote"`)

## Two pieces of good news vs iOS

1. **The Android build needs no Google account access at all.** EAS generates its own upload
   keystore, so a signed release AAB can be produced right now — unlike iOS, which is blocked on
   an Apple distribution certificate.
2. **No 12-tester / 14-day closed-testing requirement.** That rule applies only to *personal*
   developer accounts created after 13 Nov 2023. Quippy AI is an **Organization** account, so it
   is exempt and can go straight to production review.

## Blocker

`Create app` is greyed out: **"You need permission to create new apps."** The signed-in Google
account lacks the *Create, edit, and delete draft apps* permission.

Fix: the account **Owner** grants it in Play Console → **Users and permissions** → select the
user → **Account permissions** → tick **Create, edit and delete draft apps** (plus *Release to
production* if this account will also publish). Nothing else here is blocked by it — the build,
the metadata, and the answers below can all be prepared first.

For automated submission later (`eas submit -p android`), the Owner also needs to create a
**Google Cloud service account** with the *Service Account User* role, grant it access in Play
Console → Users and permissions, and download the JSON key. Until that exists, upload the AAB
by hand in Play Console → Release → Production → Create new release.

---

## 1. Permissions the app requests

**Verified 2026-08-03 against the real shipped AAB** (build `37b9852f`, versionCode 2) with
`bundletool dump manifest` — not from the config and not from the local `android/` directory,
which is gitignored, dated **29 May**, and predates the trims. The complete requested set:

| Permission | Why | User-visible? |
|---|---|---|
| `CAMERA` | Photographing equipment for AI recognition | Yes — runtime prompt |
| `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | Optional — auto-fills a listing's pickup address | Yes — runtime prompt |
| `POST_NOTIFICATIONS` | Push (OneSignal) | Yes — runtime prompt |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | Legacy | No — both carry `android:maxSdkVersion="32"` (verified), so they are inert on Android 13+ |
| `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` | Networking | No — normal permissions |
| `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK` | Push delivery | No |
| `FOREGROUND_SERVICE` | See the note below — dormant | No |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | Pulled in by `expo-secure-store`; the app never gates a read on biometrics | No |
| `READ_APP_BADGE` + ~20 OEM launcher badge permissions (Samsung, Huawei, Oppo, HTC, Sony, Everything) | OneSignal's ShortcutBadger, for unread counts on the launcher icon | No |
| `com.google.android.c2dm.permission.RECEIVE`, `…permission.C2D_MESSAGE` | FCM transport | No |
| `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | Play install referrer | No |
| `…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX-internal, self-scoped | No |

Only **three** permissions produce a runtime prompt: camera, location, notifications. Everything
else is normal-level or capped.

### `FOREGROUND_SERVICE` — declared but dormant, no Play declaration needed

`expo-location` statically ships `LocationTaskService` with
`android:foregroundServiceType="0x00000008"` (= location), and that drags in bare
`FOREGROUND_SERVICE`. Two things make this a non-issue, both checked:

- **No code path can start it.** There is no `startLocationUpdatesAsync`, no `TaskManager`, no
  `defineTask`, no geofencing anywhere in `src/` or `app/`, and
  `isAndroidBackgroundLocationEnabled: false`. The service is never started.
- **No typed permission is requested.** The manifest has *only* `FOREGROUND_SERVICE` — not
  `FOREGROUND_SERVICE_LOCATION`. Play's *Foreground service permissions* declaration form is
  triggered by the typed permissions, so it does not apply.

Worth knowing: because the typed permission is absent, if a future change ever *did* start that
service it would throw a `SecurityException` on Android 14+. Do not start it without adding
`FOREGROUND_SERVICE_LOCATION` — and adding that permission means filling in Play's declaration
form and justifying background location, which is a much harder review.

**Explicitly blocked** in `app.config.ts` via `android.blockedPermissions`
(`tools:node="remove"`, which wins over any library manifest merge):

- `RECORD_AUDIO` — the scan flow captures stills only. Source was **`expo-image-picker`**, not
  expo-camera: its plugin adds it unless `microphonePermission: false` is passed, which is now
  set (the plugin then self-blocks it too).
- `SYSTEM_ALERT_WINDOW` ("Display over other apps") — React Native only needs this in its
  **debug** source set; it must never ship.

Both were present in the app manifest generated by the stale **2026-05-29** prebuild.
`android/` is gitignored (`.gitignore:44`), so EAS always prebuilds fresh — `blockedPermissions`
is the only thing controlling this.

✅ **Both confirmed absent in the shipped AAB.** The trims worked.

Nothing in the final set is a Play *sensitive* permission, so **no permissions declaration form
is required**. Swept the AAB and confirmed all of these are absent: `ACCESS_BACKGROUND_LOCATION`,
`QUERY_ALL_PACKAGES`, `MANAGE_EXTERNAL_STORAGE`, `REQUEST_INSTALL_PACKAGES`,
`PACKAGE_USAGE_STATS`, `BIND_ACCESSIBILITY_SERVICE`, `READ_CONTACTS`, SMS/Call Log, and
`READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` — the image picker uses the Android Photo Picker, which
needs no permission and sidesteps Play's Photo and Video Permissions policy entirely.

## 2. Store listing

- **App name** (30): `GreenBidz`
- **Short description** (80): `Buy and sell used lab and industrial equipment. Snap a photo, AI lists it.`
- **Full description** (4000): reuse the App Store description in
  `Docs/APP_STORE_SUBMISSION.md` §4 verbatim — it is within Play's limit and needs no changes.
- **Category:** Business (alternative: Shopping)
- **Tags:** choose from Play's fixed list — B2B / Marketplace / Business
- **Contact email:** `support@greenbidz.com`
- **Website:** `https://101lab.co`
- **Privacy Policy URL:** `https://101lab.co/privacy-policy` ✅ verified live

### Graphics — required

| Asset | Spec | Status |
|---|---|---|
| App icon | **512 × 512** PNG, 32-bit | ✅ `assets/store/play/play-icon-512.png` |
| Feature graphic | **1024 × 500** PNG/JPG, **no alpha** | ✅ `assets/store/play/feature-graphic-1024x500.png` |
| Phone screenshots | **min 2, max 8**; 16:9 or 9:16; each side 320–3840 px | ⏳ needs a capture session |
| Tablet screenshots | Not needed — `supportsTablet: false` | n/a |

Both generated by `scripts/make-play-assets.py` (re-runnable). Verified 1024×500 / 512×512,
mode **RGB with no alpha channel** — Play rejects a feature graphic containing transparency.

Brand colours are sampled from `greenbidz_logo.png` itself rather than the brand guide, so the
graphic matches the mark that actually ships: navy **`#001951`**, turquoise **`#00C0A1`**.
Typeface is **Inter** — what the app really renders in (`@expo-google-fonts/inter`); the brand
guide's Poppins is not in the project and using it would make the graphic diverge from the app.
The logo's navy strokes are recoloured to white so the mark reads on the dark field.

The **feature graphic is Android-only** and has no iOS equivalent.

**Aspect-ratio caveat — do not assume the iOS screenshots drop straight in.** Play documents
phone screenshots as 9:16 to 16:9 (0.5625–1.7778). Modern phone captures are taller than that:

| Source | Size | Ratio | Within documented 9:16–16:9? |
|---|---|---|---|
| Pixel 7 emulator | 1080 × 2400 | 0.450 | ✗ taller |
| iPhone (iOS set) | 1290 × 2796 | 0.461 | ✗ taller |

The Console has historically accepted taller captures, so try the native files first — but if it
rejects them, crop to **1080 × 1920** (9:16) rather than padding, which looks obviously letterboxed.
Either way the two stores need the same treatment; the earlier note in this doc claiming the iOS
set "satisfies Play's phone requirements" was wrong — they are the same ratio class.

## 3. Data safety form

Verified from the code: **no Sentry, no Firebase Analytics, no ad or attribution SDKs.**

- Does your app collect or share user data? **Yes**
- Is all data encrypted in transit? **Yes** (HTTPS only; ATS-equivalent posture)
- Do you provide a way to delete user data? **Yes — in-app.**
  **Account ▸ Security ▸ Delete account**, live on prod since 2026-08-03. Also give the
  deletion URL `https://101lab.co/privacy-policy` (§9 "Account deletion" documents the flow and
  what is retained).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | No | Account management | Required |
| Email address | Yes | No | Account management | Required |
| Phone number | Yes | No | Account management, seller↔buyer contact | Required |
| Approximate / precise location | Yes | No | App functionality (pickup address) | **Optional** |
| Photos | Yes | No | App functionality (equipment images) | Required for listing |
| Other user content | Yes | No | App functionality (listings, messages, requests) | Required |
| Device or other IDs | Yes | No | App functionality (push subscription) | Required |
| Search history | Yes | No | App functionality | Required |

None of it is used for advertising or tracking.

## 4. Remaining console questionnaires

- **App access:** login is required, so provide the demo account under *All or some
  functionality is restricted* — same pre-approved prod customer account as App Review. Without
  it, review fails at the login wall.
- **Ads:** No ads.
- **Content rating:** IARC questionnaire → expect **Everyone / 3+**. No violence, no user-generated
  public content beyond B2B listings, no gambling. Note messaging exists (buyer↔seller threads).
- **Target audience:** 18+ (a B2B marketplace, not for children). Do **not** opt into
  Designed for Families.
- **Government / financial features:** No. Bidding on used equipment is not a Play "financial
  feature" (that category means loans, crypto, banking, investment).
- **Data deletion:** covered in §3.

### Play Billing — does not apply

Audited: **no payment SDK of any kind** in the app (no Stripe, no PayPal, no Play Billing, no
`expo-in-app-purchases`). The only payment-adjacent code is
`src/features/lab/marketplace/MarketplaceWebView.tsx`, whose `isInternalUrl()` allowlist keeps
only `101lab.co` / `*.greenbidz.com` inside the WebView and pushes **everything else — including
payment redirects — out to the system browser via `Linking`**. That is the compliant pattern.

Even if payment were in-app, Play Billing would not apply: the app sells **physical goods**
(used lab and industrial equipment), which Payments policy explicitly exempts.

One thing to be aware of, not a blocker: the Browse tab is a WebView over `101lab.co`. Play's
*Minimum Functionality* / repackaging policy targets apps that are **only** a website wrapper.
This app is native throughout (AI scan, wants, messages, drafts, settings) with one embedded
tab, so it is well clear — but do not let the WebView grow into the whole app.

## 5. Build and verify

```powershell
cd C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp

# Signed release AAB. No Google account access needed — EAS creates the upload keystore.
npx eas-cli@latest build -p android --profile production
```

Then confirm the permission trim actually landed in the artifact — the whole point of §1.
`bundletool` is not installed; grab the jar (needs Java, 17 is fine):

```bash
curl -sL -o bundletool.jar \
  https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar
curl -sL -o app.aab "$(npx eas-cli@latest build:view <id> --json | jq -r .artifacts.applicationArchiveUrl)"
java -jar bundletool.jar dump manifest --bundle=app.aab | grep uses-permission
```

Expect **no** `RECORD_AUDIO` and **no** `SYSTEM_ALERT_WINDOW`. If either appears, the block did
not apply and the listing would show "Microphone" / "Display over other apps" to users.

### Results — build `37b9852f`, versionCode 2, verified 2026-08-03

| Check | Result |
|---|---|
| `RECORD_AUDIO` | ✅ absent |
| `SYSTEM_ALERT_WINDOW` | ✅ absent |
| `targetSdkVersion` | ✅ **36** (Play floor is 35) |
| `minSdkVersion` | 24 |
| `versionName` / `versionCode` | 1.0.0 / 2 |
| `package` | `com.greenbidz.bridge` |
| Native ABIs | ✅ all four — `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| JS bundle | ✅ `base/assets/index.android.bundle` present |
| Storage permission caps | ✅ `maxSdkVersion="32"` on both |
| Sensitive-permission sweep | ✅ 12/12 clean |
| AAB size | 115 MB (Play's limit is 150 MB) |

**Upload key** (EAS-generated keystore `hYLhddEPac`, valid to 2053):

- SHA-1 `26:F4:BF:37:72:CF:30:42:CF:AA:90:A2:7B:7E:B0:BB:A4:43:B0:7F`
- SHA-256 `BC:97:9B:14:2E:D2:49:C1:66:A9:80:73:D0:EA:CB:0E:43:4D:61:8C:65:99:CC:7C:46:28:6F:F7:E2:56:EC:4F`

Note the cert's DN is **empty** (`CN=, OU=, O=, L=, ST=, C=US`) — normal for an EAS auto-generated
keystore and fine for Play, since Play App Signing re-signs with its own key. Keep the SHA-1: any
SHA-1-keyed Google API (Sign-In, Maps) would be registered against it. **EAS holds the only copy
of this keystore** — run `eas credentials` and back it up before it becomes the one thing standing
between you and shipping an update.

### Running the AAB locally (first real test of a store build)

An AAB cannot be `adb install`ed. Convert and install it — bundletool falls back to the debug
keystore, so it needs no production credentials:

```bash
java -jar bundletool.jar build-apks --bundle=app.aab --output=app.apks --connected-device \
  --ks=~/.android/debug.keystore --ks-pass=pass:android --ks-key-alias=androiddebugkey --key-pass=pass:android
java -jar bundletool.jar install-apks --apks=app.apks
```

Traps hit doing this:

- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** if any older `com.greenbidz.bridge` is present — the
  debug signature will not match an EAS-signed one. Uninstall first.
- **The emulator's GPU dies under this app.** With the default host GPU, `glTexImage2D` returned
  `0x505` (out of memory) and `screencap`/`pidof` hung indefinitely while `adb devices` still
  reported healthy. Boot with **`-gpu swiftshader_indirect -memory 4096`**. Not an app bug.
- Boot the emulator with **`-dns-server 8.8.8.8`** or networking silently fails in a way that
  looks like auth errors.

**Result: the release build boots clean on Android 14** — no crash, no red box, login screen
renders, app name shows as "GreenBidz". Notification permission correctly recorded as
`granted=false, USER_SET` after a deny, so no push subscription is created against prod.

Set `adb shell settings put secure autofill_service null` before testing. Android Autofill
otherwise silently populates the login form from the host's saved Google passwords — it filled a
real account on first run here, and this build points at **prod**.

### Two quality findings from that run — neither blocks submission

**1. The notification prompt fires on cold launch, at the login screen.** Reproducible on a clean
install: the OS dialog appears over the sign-in form before the user has done anything or been
given any reason to say yes. Both stores' guidelines and `UX_DESIGN_RULES.md` want permission
requests tied to the moment of value. Asking cold is the pattern most likely to get a permanent
deny, which then silently kills push for that user. Better: ask after first sign-in, or when they
first save a want / message a seller.

**2. Nine of the fourteen strings on the login screen are not localised** — in *every* one of the
five non-English locales (zh-Hans, zh-Hant, ja, th, vi). Verified in the release build: switching
to 简体中文 correctly renders 欢迎回来 / 密码 / 登录, but the subtitle, `EMAIL ADDRESS`, `FORGOT?`,
`SUSTAINABILITY FIRST`, the tagline and "Request an account" all stay English.

Two distinct causes, needing different fixes:

| Cause | Keys | Fix |
|---|---|---|
| Missing from **every** locale incl. `en.json` — the code relies on inline `defaultValue`, so they are hardcoded English and *cannot* be translated | `contactOpenFailed`, `emailLabelCaps`, `forgotShort`, `noAccount`, `sustainabilityFirst`, `tagline` | Add to `en.json` first, then all 5 locales |
| Present in `en.json`, missing or identical-to-English elsewhere | `emailPlaceholderCompany`, `requestAccount`, `welcomeSubtitle` | Add the 5 translations |

This is the app's *first screen*, so it is the first thing a reviewer browsing in a non-English
locale sees. Not a rejection cause, but it undercuts listing the app in those locales. Fixing it
requires a new build — the verified AAB above predates any such change.

Later, once the service account JSON exists, add to `eas.json`:

```json
"submit": { "production": { "android": { "serviceAccountKeyPath": "./play-service-account.json", "track": "internal" } } }
```

and use `--auto-submit`. Gitignore that key — never commit it.

## 6. Order of operations

1. ~~Build the AAB~~ ✅ **done** — `37b9852f`, versionCode 2, verified (§5).
2. ~~Design the 1024×500 feature graphic~~ ✅ **done** (§2).
3. **Owner grants *Create, edit and delete draft apps*** ← the only hard blocker left.
4. **Get a pre-approved prod demo account** — blocks Play *App access* AND Apple review notes.
5. Capture phone screenshots (needs the demo account to show anything past the login wall).
6. Create the app in Play Console; fill listing (§2) + data safety (§3) + questionnaires (§4).
7. Upload the AAB to Internal testing → verify on a device → promote to Production.

Steps 3 and 4 are both waiting on someone else. Everything that could be done without them is done.

## Shared with iOS — do once, use twice

- The pre-approved prod demo account (Play *App access* and Apple *App Review notes*).
- Phone screenshots.
- The full description.
- `101lab.co/privacy-policy` must keep disclosing post-deletion retention — both stores check.
