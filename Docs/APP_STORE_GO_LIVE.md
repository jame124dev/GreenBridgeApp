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

Required: **3 to 10** images, iPhone **6.9"**, portrait, **1290 × 2796** px. No iPad set is needed
(the app doesn't support iPad). They must come from a real phone — Windows has no iOS simulator.

Take these on TestFlight with the demo account, then AirDrop/email them to your PC:

- [ ] Home screen
- [ ] AI scan → the listing it drafted
- [ ] Browse / marketplace
- [ ] Matches (a want showing a relevance %)
- [ ] A message thread

- [ ] Upload them in ASC → **GreenBidz → 1.0 Prepare for Submission → Previews and Screenshots**

> No placeholder or lorem-ipsum content in any screenshot — that alone gets builds rejected.

---

## Step 4 — Listing text

Already written and length-checked, in [`store.config.json`](../store.config.json).

Pick **one**:

- [ ] **Option A** — run `npx eas-cli@latest metadata:push` from `GreenBridgeApp`
      (it will ask for your Apple ID and a 2FA code — it cannot run without you)
- [ ] **Option B** — paste it manually in ASC from §4 of `APP_STORE_SUBMISSION.md`

Either way, confirm these are set in ASC:

- [ ] Subtitle: `Used lab & industrial gear`
- [ ] Description, promotional text, keywords
- [ ] Support URL `https://101lab.co/faq`
- [ ] Marketing URL `https://101lab.co`
- [ ] Privacy Policy URL `https://101lab.co/privacy-policy`
- [ ] Category: **Business** (primary), **Shopping** (secondary)
- [ ] Copyright: `2026 Quippy AI Limited`

---

## Step 5 — App Review Information

ASC → **App Review Information**. This is where the demo account goes — **not** into any file in
the repo.

- [ ] Sign-in required: **Yes**
- [ ] Demo username + password from Step 2
- [ ] Contact name, email and phone number (a real number Apple can reach)
- [ ] Paste the notes below

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

---

## Step 6 — App Privacy questionnaire

ASC → **App Privacy**. There is no analytics, ads or tracking SDK in the app, so:

- [ ] **"Data is not used to track you"** — tracking: **No**
- [ ] Declare each of these as **collected, linked to the user, purpose: App Functionality**:
  - [ ] Email address
  - [ ] Name / company
  - [ ] Photos
  - [ ] Other user content (listing text, messages, requests)
  - [ ] Precise location — mark **optional** (user may decline; app still works)
  - [ ] Device ID (push subscription)
  - [ ] Search history
- [ ] Third-party advertising: **No**

---

## Step 7 — Final settings and submit

- [ ] Age rating: **4+**
- [ ] Pricing: **Free** (or set your tier)
- [ ] Availability: choose countries
- [ ] Select build **1.0.0 (9)**
- [ ] Version release: **Manually release this version** (so you control the go-live moment)
- [ ] **Submit for Review**

---

## Step 8 — After submitting

- [ ] Apple review — usually 24–48 hours
- [ ] If **rejected**: read the exact guideline number they cite, then fix and resubmit
- [ ] If **approved**: press **Release This Version**
- [ ] App is live 🎉 — confirm it opens from the public App Store link

---

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
