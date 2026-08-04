# GreenBidz — App Store go-live checklist

Work top to bottom. Tick each box as it's done. Nothing here is optional unless it says so.

**Where things stand:** build `1.0.0 (9)` is uploaded to TestFlight, the App Store Connect app
record exists (ASC App ID `6797434238`), account deletion works, and the privacy policy is correct.
Full detail behind every step lives in [`APP_STORE_SUBMISSION.md`](./APP_STORE_SUBMISSION.md).

App Store Connect: https://appstoreconnect.apple.com → **Apps → GreenBidz**

---

## Step 1 — Confirm build 9 actually works on your iPhone

Do this first. If something is broken here, there's no point submitting it.

- [ ] Install **build 9** from TestFlight
- [ ] **Browse** tab → the "Filters" bar sits **above** the bottom tab bar, not hidden behind it
- [ ] **Chat** → send a message → a bubble appears with a delivered tick
- [ ] Leave the thread, come back → the message is **still there**
- [ ] **Account** → scroll to the bottom → note the small grey line (e.g. `GreenBidz 1.0.0 · production · built-in`)

If any of these fail, stop and say so — that changes the diagnosis.

---

## Step 2 — Demo account for Apple's reviewer

**This is the hard blocker.** Login is mandatory in the app, and an unapproved account is sent to a
"pending approval" screen. A reviewer who sees that wall rejects the app (Guideline 2.1).

- [ ] Create a customer account on **production**
- [ ] Approve it (`pw_user_status` approved) so it is not pending
- [ ] Sign in with it **in TestFlight on a real phone** and confirm it reaches **Home**
- [ ] Write the email + password down for Step 5

> Use a dedicated account for this, not a real customer's. Apple's reviewers do log in and click
> around.

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
