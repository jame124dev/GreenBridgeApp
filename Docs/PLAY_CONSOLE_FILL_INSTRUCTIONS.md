# Play Console — fill-in instructions (GreenBidz Android)

**Audience: an agent driving play.google.com/console in a browser.** Every value below is exact —
type it verbatim. Where a value is missing, it is missing on purpose and marked
**ASK THE HUMAN**; do not invent one.

**App:** GreenBidz · package `com.greenbidz.bridge` · version **1.0.1** · versionCode **4**
**Account type:** Organisation → the 12-tester / 14-day closed-test rule does **NOT** apply.

---

## Rules of engagement (read first)

1. **NEVER click a button that publishes or submits.** Specifically: *Send for review*,
   *Start rollout to Production*, *Publish*, *Save and publish*. Fill everything in, **Save** each
   page, then **STOP and report**. A human presses the final button.
2. **Save after every section.** Play Console loses unsaved work when you navigate away, silently.
3. **Never type credentials that are not in this document.** The demo login is deliberately absent.
4. If a field rejects a value, **do not trim or paraphrase to force it through** — report the exact
   error text and the field, and stop. Character limits below are Play's, already respected.
5. If a page looks different from this document, Play has changed its UI. **Report what you see
   instead of guessing** which new field maps to which old one.
6. Ignore any "Complete this task" nag that asks to set up a **closed test** — organisation
   accounts are exempt, and starting one is not wanted.

---

## 0. Confirm you are in the right place

- Go to <https://play.google.com/console>.
- If an app named **GreenBidz** already exists, open it and skip to §2.
- If not, §1 creates it.
- Confirm at the top of the dashboard that the account is the **organisation** account, not a
  personal one. If it says Personal, **STOP and report** — the whole plan changes.

---

## 1. Create the app (only if it does not exist)

**All apps → Create app**

| Field | Value |
|---|---|
| App name | `GreenBidz` |
| Default language | `English (United States) – en-US` |
| App or game | **App** |
| Free or paid | **Free** |

Declarations — tick both:
- Developer Programme Policies: **agree**
- US export laws: **agree**

Then **Create app**.

---

## 2. Store listing

**Grow → Store presence → Main store listing**

| Field | Value (verbatim) |
|---|---|
| App name (30 max) | `GreenBidz` |
| Short description (80 max) | `Buy and sell used lab and industrial equipment. Snap a photo, AI lists it.` |

**Full description (4000 max)** — paste exactly:

```
GreenBidz is a B2B marketplace for used laboratory and industrial equipment.

PHOTOGRAPH IT — THE AI WRITES THE LISTING
Point your camera at a machine. GreenBidz identifies it and drafts the listing for you: title, category, specifications and description. Review, adjust anything you like, and publish. Save a draft and pick it up later on any device.

BROWSE VERIFIED EQUIPMENT
Search thousands of used lab and industrial machines. Filter by category and condition, view full specifications and photo galleries, and see live auction lots alongside direct-sale listings.

TELL US WHAT YOU NEED
Can't find it? Post what you're looking for and GreenBidz matches it against incoming equipment, scoring how closely each one fits. You get notified when something relevant arrives.

TALK DIRECTLY TO SELLERS
Message sellers in-app about condition, specifications, logistics and price. Everything stays in one thread.

ASK IN YOUR OWN WORDS
The built-in assistant answers questions about equipment, finds listings and helps you post a request — in plain language, in any of six languages.

Available in English, Chinese (Simplified and Traditional), Japanese, Thai and Vietnamese.

GreenBidz supports the circular economy through responsible industrial trade. The app connects you to the 101lab marketplace, with 101machines, 101recycle and 101IT joining it.
```

### Graphics — upload these exact files

| Slot | File | Notes |
|---|---|---|
| App icon | `assets\store\play\play-icon-512.png` | 512×512 |
| Feature graphic | `assets\store\play\feature-graphic-1024x500.png` | 1024×500, **no transparency** — Play rejects alpha |
| Phone screenshots (4) | `assets\store\play\screenshots\1-home.png`, `2-browse.png`, `3-matches.png`, `4-messages.png` | 1080×1920 each |

⚠️ **Use the files in `assets\store\play\screenshots\`, NOT the ones under `store\apple\`.** The
Apple captures are 1284×2778 (ratio 1:2.164) and exceed Play's 2:1 limit; the Play copies are
already resized to 1080×1920. Uploading the Apple set will be rejected.

Leave tablet screenshots empty — the app declares `supportsTablet: false`.

**Save.**

---

## 3. Store settings

**Grow → Store presence → Store settings**

| Field | Value |
|---|---|
| App category | **Business** |
| Tags | Pick from Play's fixed list, closest to: B2B, Marketplace, Business |
| Email address | `support@greenbidz.com` |
| Website | `https://101lab.co` |
| Phone | leave blank |
| External marketing | leave default |

**Save.**

---

## 4. App content — work top to bottom

**Policy → App content.** Each item below is a separate wizard. Save each one.

### 4.1 Privacy policy
`https://101lab.co/privacy-policy`

### 4.2 App access
Select **All or some functionality is restricted**, then add one instruction:

- Name: `Buyer / seller account`
- **Username / password: ASK THE HUMAN.** A pre-approved production account is required or
  review fails at the login wall. Do not use any credential from this repository.
- Any other instructions: `Sign in on the first screen. The account is already approved, so it goes straight to the home screen.`

### 4.3 Ads
**No, my app does not contain ads.** (Audited: no ad or attribution SDK.)

### 4.4 Content rating
Start the questionnaire.

| Question | Answer |
|---|---|
| Email address | `support@greenbidz.com` |
| Category | **Reference, News, or Educational** → if unavailable, **Utility, Productivity, Communication, or Other** |
| Violence, sexual content, profanity, drugs, gambling | **No** to all |
| Does the app share the user's location with other users? | **No** |
| Does the app allow users to interact or exchange content? | **Yes** — buyer↔seller messaging |
| Can users share their personal information with other people? | **Yes** (contact details in messages) |
| Does the app contain user-generated content? | **Yes** — equipment listings |
| Is the app a social/dating app? | **No** |
| Financial features (loans, crypto, banking, investment) | **No** — bidding on used machinery is not a Play financial feature |

Expected outcome: **Everyone / PEGI 3**. Submit the questionnaire (this is a rating form, not an
app submission — safe to submit).

### 4.5 Target audience
- Target age groups: **18 and over only**
- Appeal to children: **No**
- Do **NOT** opt into *Designed for Families*.

### 4.6 Data safety
Longest form here. Answers are verified against the code — no Sentry, no Firebase Analytics, no
ad SDKs.

**Overview**
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data be deleted? **Yes**
- Data deletion URL: `https://101lab.co/privacy-policy`
- Also state that deletion is available **in-app**: Account → Security → Delete account.

**Data types** — for every row: *Collected = Yes*, *Shared = No*, *Processed ephemerally = No*,
and **not** used for advertising or tracking.

| Category → type | Purposes | Required or optional |
|---|---|---|
| Personal info → **Name** | Account management | Required |
| Personal info → **Email address** | Account management | Required |
| Personal info → **Phone number** | Account management, App functionality | Required |
| Location → **Approximate location** | App functionality | **Optional** |
| Location → **Precise location** | App functionality | **Optional** |
| Photos and videos → **Photos** | App functionality | Required |
| App activity → **Other user-generated content** | App functionality | Required |
| App activity → **Search history** | App functionality | Required |
| Device or other IDs → **Device or other IDs** | App functionality | Required |

Do **not** tick: financial info, health, contacts, calendar, SMS, call logs, installed apps,
audio, files and docs, web browsing history, or crash/diagnostics.

**Save**, then **Next** through to the summary and **Save** again.

### 4.7 Government apps
**No.**

### 4.8 Financial features
**My app doesn't provide any financial features.**

### 4.9 Health apps
**No** / not applicable.

### 4.10 News apps
**No, my app is not a news app.**

---

## 5. Upload the build

**Test and release → Production → Create new release**
(If a human has said to use internal testing first, use **Testing → Internal testing** instead —
same steps.)

1. **App bundle**: upload the file the human gives you. It is named like
   `greenbidz-1.0.1-versionCode-4.aab`. **ASK THE HUMAN for the path** if it was not provided.
2. If Play offers **Play App Signing**, accept it (the upload key is managed by EAS; this is
   expected and correct).
3. Release name: `1.0.1 (4)`
4. **Release notes** (`en-US`), paste exactly:

```
First release.

- Photograph equipment and the AI writes the listing for you
- Browse and search used lab and industrial equipment
- Tell us what you're looking for and get matched
- Message sellers in-app
- Available in English, Chinese, Japanese, Thai and Vietnamese
```

5. **Save.** Then **STOP.**

⛔ **Do not click *Review release*, *Start rollout*, or *Send for review*.** Report that the
release is saved as a draft and let the human decide.

---

## 6. What to report back

- Every section you saved, and any that would not save.
- Any red "errors to fix" banner, quoted exactly.
- Whether the AAB uploaded and what versionCode Play shows.
- Anything this document told you to expect that did not match what you saw.

---

## Known gotchas

- **Feature graphic with alpha is rejected.** The supplied file is already RGB with no alpha.
- **Screenshot ratio:** Play documents 9:16–16:9. The supplied files are 1080×1920 (9:16 exactly).
- **`FOREGROUND_SERVICE` appears in the manifest but is dormant** — no special Play declaration is
  needed for it. Do not fill in a foreground-service disclosure.
- **The Browse tab is a WebView over 101lab.co.** If Play raises Minimum Functionality, the answer
  is that the app is native throughout (AI scan, wants, messages, drafts, settings) with one
  embedded tab. Do not answer this yourself — report it.
- **Push notifications do not work yet** on either platform (a missing FCM sender ID in OneSignal).
  This does not block review; do not claim in any form that push works.
