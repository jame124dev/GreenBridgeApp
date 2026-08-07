# GreenBidz — App Store go-live checklist

Work top to bottom. Tick each box as it's done. Nothing here is optional unless it says so.

**Where things stand:** build `1.0.0 (9)` is uploaded to TestFlight, the App Store Connect app
record exists (ASC App ID `6797434238`), account deletion works, and the privacy policy is correct.
Full detail behind every step lives in [`APP_STORE_SUBMISSION.md`](./APP_STORE_SUBMISSION.md).

App Store Connect: https://appstoreconnect.apple.com → **Apps → GreenBidz**

---

## Step 1 — Confirm build 9 actually works on your iPhone ✅

**Confirmed working on device 2026-08-04.** Ticked on the user's report from a real iPhone — not
from a test run here (there is no iOS device or simulator on this machine).

- [x] Install **build 9** from TestFlight
- [x] **Browse** tab → the "Filters" bar sits **above** the bottom tab bar, not hidden behind it
- [x] **Chat** → send a message → a bubble appears with a delivered tick
- [x] Leave the thread, come back → the message is **still there**
- [x] **Account** → scroll to the bottom → the version line renders

So the two bugs from TestFlight build 8 are fixed on iOS, and they are fixed **in the binary** —
build 9 carries them embedded, with no dependency on an over-the-air update.

---

## Step 2 — Demo account for Apple's reviewer ✅

**Resolved 2026-08-04 by reusing an existing approved account — no new account was created.**

| | |
|---|---|
| Account | `jame124d@gmail.com` — user **id 877**, display name "Test User", company "Jammer" |
| Status | `user_status: "approved"` — prod `POST /api/v1/auth/login` returns **HTTP 200** |
| Role | `seller` (`greenbidz_user_type: seller`) |
| Password | **in App Store Connect only** — deliberately not recorded in this repo |

This is the same account used to verify the chat send fix on-device, so the reviewer's login is one
already proven to work end-to-end in the app.

- [x] Approved customer account exists on **production**
- [x] Verified with the one-liner below — returns **HTTP 200**, `user_status: approved`
- [x] Already exercised in the app (login + Messages) during the build-9 verification
- [x] Credentials ready for Step 5

Two things to keep in mind rather than fix:

- The account's role is **seller**, not buyer, so the reviewer sees the seller-role code path. That
  is the path the `sender_role` chat bug lived on, and it is fixed in build 9 — but it is worth
  knowing that is what gets tested.
- Its analytics `site_type` is `101machine` while the store build ships `SITE_TYPE=LabGreenbidz`.
  It logs in and works; content emphasis may differ from the listing copy.

⚠️ **If a reviewer taps Account ▸ Security ▸ Delete account, this account is destroyed** — anonymised,
password randomised, status revoked, listings withdrawn, no undo. Guideline 5.1.1(v) compliance is
exactly what reviewers verify, so treat that as likely rather than hypothetical. It is a test
account, which is why this is acceptable; do **not** substitute a real trading account here.

<details>
<summary>Original instructions, if a fresh account is ever needed</summary>

- Create a customer account on **production**
- Approve it (`pw_user_status` approved) so it is not pending
- Verify with the one-liner below — it must return **HTTP 200**
- Sign in with it in TestFlight and confirm it reaches **Home**
</details>

> Use a dedicated account for this, not a real customer's. Apple's reviewers do log in and click
> around.

**Who can do which half.** Creating the account is a public prod signup
(`POST /auth/signup` → delegates to `greenbidz.com/wp-json/recycle_greenbidz/v1/register`, i.e. it
creates a real WordPress user on the live site). **Approving it requires an admin login** — the only
route is `PUT /admin/users/status` behind `requirePermission("users.approve")`, and there is
deliberately **no `x-system-key` bypass** for it. So the approval half cannot be automated from here
without admin credentials. Admin panel → Users → find the account → set status **approved**.

Note the local backend `.env` points at **`greenbidz_test`** (dev), not prod, so there is no local
shortcut to a prod user either.

**Signup paths on prod, probed 2026-08-04 — read this before trying to automate account creation:**

| Endpoint | State |
|---|---|
| `POST /api/v2/auth/signup` | **Broken.** Proxies to `greenbidz.com/wp-json/recycle_greenbidz/v1/register`, which replies *"No route was found matching the URL and request method."* The WP plugin route is gone, so v2 signup cannot create anyone. |
| `POST /api/v1/user/signup-initiate` → `verify-signup-code` → `complete-signup` | The working flow. Step 1 **emails a 6-digit code** (10-min expiry, held in an in-memory `pendingVerifications` map — so it does not survive a backend restart). |
| `PUT /admin/users/status` | The only approval route. `requirePermission("users.approve")`. |

And `complete-signup` writes `pw_user_status: "pending"` unconditionally:

```js
{ user_id: userId, meta_key: "pw_user_status", meta_value: "pending" }
```

So **there is no path to a self-serve account that is already approved.** Creating a demo account
always needs (a) a readable mailbox for the emailed code and (b) an admin to flip the status.

⚡ **Fastest route: skip creation entirely.** Any *already-approved* customer account on prod works
as the reviewer's demo account — verify it with the curl above and Step 2 is done.

**The exact pass/fail condition.** The gate is server-side, not in the app: `POST /auth/login`
returns **403 with `code: "ACCOUNT_PENDING"`** while the account is unapproved, and the app routes
that straight to the pending wall. So the test is simply whether prod login returns 200:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://api.101recycle.greenbidz.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'x-platform: LabGreenbidz' \
  -d '{"email":"DEMO_EMAIL","password":"DEMO_PASSWORD"}'
```

- `200` → approved. Apple's reviewer will reach Home. ✅
- `403` → still pending. **This is the rejection.** Approve the account and re-run.
- `400`/`401` → wrong email or password.

This is a read-only check — it creates nothing and changes nothing.

---

## Step 3 — Screenshots

Required: **3 to 10** images, portrait. ⚠️ **The size is 1284 × 2778, not 1290 × 2796.** This app's
ASC page exposes a single iPhone slot labelled **6.5" Display**, accepting `1242 × 2688`,
`2688 × 1242`, `1284 × 2778` or `2778 × 1284`. A 1290 × 2796 ("6.9"") upload is **rejected**:
*"The dimensions of one or more screenshots are wrong."* ASC then reuses the one set "for all display
sizes and localizations", so a single 1284 × 2778 set is enough. No iPad set is needed (the app
doesn't support iPad).

**4 are generated and committed** in [`assets/store/ios/`](../assets/store/ios/), all exactly
1284 × 2778, RGB, no alpha:

- [x] `1-home.png` — "What are you selling?" + AI describe box + real Recent listings
- [x] `2-browse.png` — marketplace, "2029 results open for bidding", real lots
- [x] `3-matches.png` — My Wants with **92% MATCH** rings on real lab equipment
- [x] `4-messages.png` — a seller thread with the delivered tick and quick-replies
- [x] **Uploaded to ASC 2026-08-04** — all 4 present in order, `4 of 10 Screenshots`, no dimension error

Regenerate with `python scripts/make-ios-screenshots.py <capture-dir>`.

**How they were made, and the caveat.** There is no iOS device or simulator on this machine, so they
are **Android emulator captures** of the same React Native screens, with the emulator forced to true
iPhone 16 Pro Max geometry:

```bash
adb shell wm size 1290x2796     # 1290x2796 @3x = 430x932 pt — iPhone 16 Pro Max
adb shell wm density 480        # 480dpi = 3x, so the app lays out at 430x932 dp
```

`policy_control immersive.full=*` no longer works on API 34, so the Android status bar and gesture
pill are cropped off and the image is uniformly rescaled back to 1284 × 2778 (no stretching; ~3%
centre crop horizontally).

⚠️ The **content is genuine** — real listings, real match scores, captured while signed in as the
actual demo account (`jame124d@gmail.com`) — but the **pixels are Android renders**. Safe-area
insets and font metrics differ slightly from iOS. Replace any of them with real iPhone captures if
you want a perfect match; these are good enough to submit and far better than being blocked.

> No placeholder or lorem-ipsum content in any screenshot — that alone gets builds rejected. These
> use live production data, so that box is ticked.

**Deliberately excluded**, having captured and reviewed them:
- **Messages inbox** — lists real counterparty names (real people and companies). Not something to
  publish on a public store page.
- **Batch detail** — shows internal seller fields (`Comm. 15%`, `PENDING`) and a mis-tagged Thai
  category on an English screen.

---

## Step 4 — Listing text ✅

**Pushed and verified in App Store Connect 2026-08-04** via `eas metadata:push`, then read back with
`metadata:pull` rather than trusting the success message:

- [x] Version **1.0.0**, `automaticRelease: false`
- [x] Title `GreenBidz` · Subtitle `Used lab & industrial gear`
- [x] Description (1352 chars) + promotional text (166 chars)
- [x] Keywords (96 chars) `used equipment,laboratory,industrial,machinery,B2B,marketplace,surplus,auction,resale,secondhand`
- [x] Support URL `https://greenbidz.com/contact-us/` — verified live; publishes a contact form,
      `info@greenbidz.com`, `+886-02-7715-9166` and WhatsApp, which satisfies Apple's requirement
      that the support page offer a way to reach you
- [x] Marketing URL `https://greenbidz.com` — the GreenBidz Group site (verified 200,
      *"GreenBidz Group – Circular B2B Marketplaces"*), updated 2026-08-04
- [x] Privacy Policy URL `https://101lab.co/privacy-policy`
- [x] Category **Business** (primary), **Shopping** (secondary)
- [x] Copyright `2026 GreenBidz. All rights reserved.` — note the leading "Copyright ©" was dropped
      on purpose: Apple renders the © glyph itself and the field spec is *year + entity*, so
      "Copyright © 2026 …" would display as "© Copyright © 2026 …" on the product page

### Two things that went wrong, and why they matter

**1. The first push half-failed.** It reported `✔ Updated localized info for en-US` yet
`✖ Failed updating version and release info for 1.0` →
*"You must provide a value for the attribute 'versionString'"*.

The trap: App Store Connect splits localizations in two. **App-level** info (title, subtitle,
privacy policy URL) succeeded, but **version-level** info — description, keywords, promo text,
support and marketing URLs — rides along with the version update, which had failed. So the success
line was real and the listing was still half-empty. Cause: `store.config.json` had no
`apple.version`. Fixed by adding `"version": "1.0.0"`.

**Always `metadata:pull` after a push and diff it.** A partial push looks like a successful one.

**2. ASC's version string was `1.0` while every build is `1.0.0`.** App Store Connect matches builds
to a version by version string, so build 9 could not have been attached to a version named `1.0`.
The push renamed it to `1.0.0`. Confirm build `1.0.0 (9)` is now selectable under **Build**.

**3. `automaticRelease` was `true`** in ASC — the app would have gone live the moment Apple approved.
Now `false`, so releasing is a deliberate act (Step 8).

### Auth note

`metadata:push`/`pull` do **not** work with the App Store Connect API key stored on EAS
(`2GW82U6AZW`) — Apple returns 401, because that key is scoped for build submission only. They fall
back to Apple-ID cookie auth. Once you have logged in interactively **once**, the session is cached
at `~/.app-store/auth/<apple-id>/cookie` and subsequent runs work headlessly with
`EXPO_APPLE_ID=<apple-id>` set. That is how the corrected push was run without a second 2FA prompt.

---

## Step 5 — App Review Information ✅

**Pushed to ASC 2026-08-04** via `eas metadata:push` — `✔ Created store review details for 1.0.0`.

- [x] Sign-in required: **Yes**
- [x] Demo username + password (the Step 2 account)
- [x] Contact: Abhay Dixit · abhay@greenbidz.com · +916386511382
- [x] Review notes (1355 chars — the block below)

⚠️ **The demo credentials and review contact are NOT in `store.config.json`.** They were added, pushed,
then removed from the file, so they exist only in App Store Connect. A tracked config must never carry
a password. Consequence: a future `metadata:push` prints *"Skipped store review details, not
configured"* and leaves the ASC values untouched — which is the intended behaviour.

⚠️ **`advisory` was also removed from the config**, for the same class of reason. The first review push
printed `✔ Updated age rating declaration`, writing ASC's own (inaccurate) values back — harmless that
time, but any later push would have silently reverted a corrected age-rating questionnaire. Age rating
is now owned by the ASC UI alone. See Step 7.

<details>
<summary>The notes that were pushed</summary>

```
DEMO ACCOUNT
This account is pre-approved. Accounts pending manual approval are shown a
"pending approval" screen by design.

ABOUT THE APP
GreenBidz is a B2B marketplace for used laboratory and industrial equipment.
Buyers browse and enquire about equipment; the AI assistant drafts listings and
purchase requests from photographs.

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

</details>

---

## Step 6 — App Privacy questionnaire ✅

**Published 2026-08-04** ("Published a few seconds ago by Jam User"). Driven through the ASC UI via
browser automation, then read back to verify every row before publishing.

**9 data types**, each *Used for App Functionality* · *Linked to the user's identity* · **not** used
for tracking:

- [x] Name
- [x] Email Address
- [x] Phone Number — added because Account collects and verifies one
- [x] Precise Location
- [x] Photos or Videos
- [x] Other User Content
- [x] Search History
- [x] **User ID** — added beyond the original list: the app assigns account IDs and display names,
      which is exactly Apple's definition. Under-declaring is the real rejection risk.
- [x] Device ID
- [x] Tracking: **No** everywhere → "Data is not used to track you". No analytics, ads or
      attribution SDK exists in the app.

**UI gotcha for anyone repeating this:** ASC's radios and "Set Up X" controls are styled `div`/`P`
elements with no `role`, so accessibility-tree clicks time out. Clicking the `<label>` (or dispatching
a full pointerdown→mousedown→mouseup→click sequence on the wrapper `div`) works. Each data type is a
5-screen wizard: purpose → linked? → two tracking explainers → tracking?

---

## Step 7 — Final settings and submit

⚠️ **Check the age-rating answers before accepting 4+.** `metadata:pull` shows App Store Connect
currently holds:

```
messagingAndChat:     false
userGeneratedContent: false
```

Both look **wrong for this app**: it has in-app buyer↔seller messaging (the Chat tab) and its entire
catalogue is user-generated (listings, descriptions, photos, wants, messages). Apple's current
age-rating questionnaire asks about exactly these, and answering them accurately may raise the rating
above 4+ and/or trigger the user-generated-content obligations (moderation, reporting, blocking).

That is a product/compliance decision, not a config tweak, so it was deliberately **not** pushed —
`store.config.json` carries the pulled `advisory` block only as a record of ASC's current state.
Answer the questionnaire honestly in the ASC UI.

- [x] Select build **1.0.0 (9)** — attached and saved 2026-08-04. The picker offered builds 9, 8 and 7,
      all at version 1.0.0, confirming the `1.0` → `1.0.0` version rename made them attachable.
- [x] Version release: **Manually release this version** (set via `metadata:push`)
- [x] **Age rating — completed 2026-08-04, and the honest answers cost nothing.** The 7-step
      questionnaire was corrected and saved; result is still **4+ across 172 regions**.

      | Question | Was | Now | Why |
      |---|---|---|---|
      | User-Generated Content | NO | **YES** | The catalogue is entirely seller-supplied — listings, descriptions, photos |
      | Messaging and Chat | NO | **YES** | Buyer↔seller chat is a core feature |
      | Social Media | unanswered | **NO** | No feed, no resharing or amplification — a marketplace catalogue is not social distribution |
      | Social Media Disabled for Under 13 | unanswered | **NO** | Only meaningful if Social Media were YES. **YES would falsely claim the app calls Apple's Declared Age Range API** — it does not |
      | Unrestricted Web Access | NO | NO | The Browse WebView is scoped to the marketplace, not free browsing |
      | Parental Controls / Age Assurance / Advertising | NO | NO | None exist |

      Steps 2–7 (mature themes, medical, sexuality, violence, chance-based) are all **NONE**.
      Verified independently with `metadata:pull`: `userGeneratedContent: true`,
      `messagingAndChat: true`, `ageRatingOverrideV2: "NONE"`.

      Worth noting: declaring UGC and chat truthfully did **not** raise the rating above 4+, so the
      earlier worry about losing the 4+ audience was unfounded. It does still imply the usual
      user-generated-content duties (moderation, reporting, blocking) as a product matter.
- [x] Pricing: **Free** — set 2026-08-04. Base country United States (USD), price `$0.00`; the
      per-country confirmation table was read before confirming and every one of the 175 territories
      showed 0.00 (`$0.00`, `kr 0.00`, `฿0.00`, `₫0.00`, …). ASC renders no amount for free apps, so
      "Current Price / 175 Countries or Regions" with a blank price column is the expected display.
- [x] Availability: **All Countries or Regions — 175 Available**

- [x] **Apple Silicon Mac and visionOS availability turned OFF** (both were ON by default) and saved;
      verified still off after a page reload. The app is iPhone-only (`supportsTablet: false`) and
      camera-first — the AI-scan flow is the core feature — so opting into Mac/Vision Pro invites
      reviewers to test it on hardware where that experience degrades. iOS availability unchanged at
      175 regions.
- [x] **Content Rights** — this was the one hidden blocker: *"You must set up Content Rights
      Information in App Information."* Answered **"Yes, it contains, shows, or accesses third-party
      content, and I have the necessary rights"** — the catalogue is entirely seller-supplied photos
      and descriptions, and it is the only answer consistent with declaring
      `userGeneratedContent: true` in the age rating. The rights half rests on your seller terms.
- [x] **SUBMITTED FOR REVIEW 2026-08-04** — state is **`1.0.0 Waiting for Review`**, verified after a
      page reload. Apple quotes up to 48 hours. Release remains **manual**, so nothing becomes public
      without an explicit Release click.

---

## Step 8 — After submitting

⚠️ **Fix before you press Release** — found while smoke-testing the prod API on submission day:

1. **Unauthenticated PII leak.** `GET /api/v1/chat/buyer/:id/sellers` returns 200 with **no token and
   no system key**, exposing `display_name` + `user_email` for every conversation partner of any user
   id (574 → 160 rows, 877 → 69 rows). A classic IDOR. Needs `protect` **plus** an ownership check
   that the JWT subject matches `:id` — the middleware alone still lets any signed-in user read
   everyone else's inbox. `/chat/conversation/:id/messages` sits in the same unprotected route family.
2. **`GET /api/v1/batch/:id/products` 500s on some ids** (2478, 2477, 1 fail; 2731, 5407 succeed).
   In-app this breaks product detail and "Contact seller" (`fetchBatchSeller`) — and **2478 is the
   listing attached to the demo account's chat thread**, so App Review can reach it.

- [x] Apple review — usually 24–48 hours
- [x] **REJECTION 1 (2026-08-04, Guideline 2.1)** — app wouldn't launch on their iPhone 17 Pro Max.
      Root cause: the OTA update check ran **before** the first frame and blocked launch. Fixed by
      `checkAutomatically: 'NEVER'` for the review cycle (`app.config.ts`). **Confirmed fixed** — on
      the next review Apple got *into* the app and reported a different, in-app problem.
- [x] **REJECTION 2 (2026-08-06, Guideline 2.1(a))** — *"An error message displayed at the account
      registration"*, reviewed on build 10. Their screenshot showed the browser on
      `seller.greenbidz.com/contact` → **404**, reached from the **Contact us** link on the sign-in
      screen.
      ⚠️ **Why my earlier check missed it:** I validated those URLs with `curl` status codes. These are
      SPAs — they return **HTTP 200** and render "404" client-side. A status check can never catch
      this; you must read the rendered page. A regression test
      (`src/__tests__/externalLinks.test.ts`) now **hard-fails** on the known-dead URLs.
      A full audit of every outbound link then found **a second 404 Apple never reached** —
      `greenbidz.com/dashboard/settings` on the pending-approval screen.
- [x] **RESUBMITTED 2026-08-07 with build 14** — verified `1.0.0 Waiting for Review`, item reads
      `iOS App 1.0.0 (14) — Waiting for Review`, release still **Manually release**.
      Build 14 carries, and was verified **inside the IPA** (not just in source):
      | Guideline | Fix | Proof in the binary |
      |---|---|---|
      | 2.1(a) | Contact → `greenbidz.com/contact-us/`; pending → `seller.greenbidz.com/dashboard/settings` | both dead URLs **absent**, replacement **present** |
      | 5.1.1(iv) | Location pre-prompt: single **Continue**, no skip path (swipe-dismiss also reaches the OS prompt) | `locationPrimerContinue` present, `'Not now'` absent |
      | 1.2 (proactive) | Report + Block in every Messages thread; blocked user leaves the inbox, composer replaced | `labReport.*` + `chat.blockedUserIds` present |
      | 2.1 (proactive) | Account → Help / About open real pages (were "coming soon" toasts) | `profile.helpComingSoon` absent |
      Review notes in ASC tell the reviewer **where** report/block is, so they don't have to hunt.
- [ ] If **rejected again**: read the exact guideline number they cite, then fix and resubmit
- [ ] If **approved**: press **Release This Version** — but clear the blockers below first
- [ ] App is live 🎉 — confirm it opens from the public App Store link

### Verify-the-artifact rule (earned the hard way)

Every claim above was checked against the **IPA / Hermes bundle**, never the config or the source.
This practice caught real problems more than once. Two traps when you do it:

- **Hermes stores any string containing a non-ASCII character as UTF-16** — an ASCII `grep` returns 0
  matches for a string that is definitely present. Search `utf-16-le` too before concluding anything
  is missing.
- **Read `Payload/<App>.app/Expo.plist`** for the OTA settings (`EXUpdatesCheckOnLaunch`), not
  `Info.plist`.

---

## ⛔ Blocking RELEASE (not review) — status 2026-08-07

- [x] **Deploy the chat auth fix to production — DONE 2026-08-06, `main` `d3595ca`, verified live.**
      Re-applied per branch (not cherry-picked) exactly as the warning below said to.
      ⚠️ **Merge hazard, still live:** a future `dev → main` merge must NOT drag `dev`'s four
      `/direct/*` chat routes into `main`'s `chatRoute.js` — their controllers don't exist on `main`,
      so the import would throw on pm2 restart and take prod down.
- [ ] **The chat SOCKET is still unauthenticated** — identity is whatever `user_id` a client claims
      via `joinRooms`. A separate code path from the REST fix above, and a larger change; the web
      client behaves the same way.

<details>
<summary>Original note (kept for the record)</summary>

- **Deploy the chat auth fix to production.** Built, tested and pushed as
      `fix/chat-auth-batch404` (`e4da751`) on the **backend** repo, branched off `dev`. It closes an
      unauthenticated IDOR that returned `display_name` + `user_email` for any user id, and opens
      admin chat routes to anyone. **Not on prod yet** — reaching prod means a cherry-pick onto
      `main`, and pushing `main` IS the deploy. Must be a cherry-pick, never a merge: `dev` is 58
      commits ahead of `main`.
      ⚠️ Re-apply per branch rather than cherry-pick blind — `dev` carries 4 chat routes `main` does
      not, two of which need guards.
- **The chat SOCKET is still unauthenticated** — identity is whatever `user_id` a client claims
      via `joinRooms`. A separate code path from the REST fix above, and a larger change; the web
      client behaves the same way.

</details>

## Not blocking, but decide before/soon after launch

- [ ] **iPhone push notifications are dead** until `AuthKey_ZL766GXRJL.p8` is uploaded to OneSignal
      (app `a9a5c723-9a00-438f-a522-2bd9178ff99f`, Key ID `ZL766GXRJL`, Team `T642D4X34U`).
      ⚠️ Apple will not let you download that file again — back it up somewhere safe.
- [ ] **`X_SYSTEM_KEY` (`fa39812fec`) is extractable from the app** and gates Node write routes that
      have no `protect` middleware. Public download = public key. Fix options: scope a separate
      rotatable key to the app, or move those routes behind JWT.
- [ ] **The chat socket has no authentication** — identity is whatever `user_id` a client claims.
      The web client is the same, so this is not app-specific.
- [ ] **Android / Play Store** is a separate track — blocked on Play Console Owner granting
      "Create, edit and delete draft apps". See [`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md).
