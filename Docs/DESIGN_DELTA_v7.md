# Design Delta — match Claude "Capture v7" artifact, design-only

**Rule:** Only restyle what we **already have**. No new fields, no new data sources, no new flows. If the artifact shows something we don't have a value for today, it stays out.

**Reference artifact:** `c:\Users\Pc\Downloads\Claude.html` (GreenBidz Capture v7 · One Flow)
**Reference screenshots:** [`.tmp-screenshots/artifact-01-camera.png`](../../.tmp-screenshots/artifact-01-camera.png), [`artifact-02-submitted.png`](../../.tmp-screenshots/artifact-02-submitted.png), [`07-claude-artifact.png`](../../.tmp-screenshots/07-claude-artifact.png)

---

## Status (updated 2026-05-25)

| # | Screen | File | Status |
|---|---|---|---|
| 1 | **Home** | [app/(tabs)/index.tsx](../app/(tabs)/index.tsx) | ✅ Done — v7-match pass: greeting "Hi, **Akash**.", tall green CTA card, language pill in header, recent-uploads list, dropped NetInfo dot + "Industrial Equipment Capture" subtitle + bento grid (resume still works via the Scan card → "Resume?" dialog) |
| 2 | **Recent uploads list** | [src/components/scanner/RecentSubmissionsList.tsx](../src/components/scanner/RecentSubmissionsList.tsx) | ✅ Done — section header "RECENT UPLOADS" + N items caption, photo-count badge, colour-coded status pill (LIVE / PENDING / SOLD) |
| 3 | **Camera** | [app/scan/camera.tsx](../app/scan/camera.tsx) | ✅ Done — 4-corner viewfinder brackets, centered "Capture" title, TIP / "Good!" pill at viewfinder center, NEXT button with circular count chip, empty-state hint |
| 4 | **Processing** | [app/scan/processing.tsx](../app/scan/processing.tsx) | ✅ Done — "✨ AI WORKING" pill, "Reading your photos…" + "5–10 seconds" subtitle, rotating sub-status ("Detecting equipment…" → "Reading nameplate text…" → "Drafting title & description…") |
| 5 | **Detail** | [app/scan/detail.tsx](../app/scan/detail.tsx) | ✅ Done — UPPERCASE section labels with `*` for required + "✨ AI" tag on AI-prefilled fields, character counters on Title/Description, bigger chip styling, **persistent REQUIRED bar** (amber → green when complete), Submit disabled until all 3 required done, dropped silent-validation Alert |
| 6 | **Success** | [app/scan/success.tsx](../app/scan/success.tsx) | ✅ Done — 96px check in green circle wrap, "Item submitted", "Sent to GreenBidz for review. Goes live within 24h after approval." caption, summary card (BATCH # · PHOTOS · CONDITION · PRICE) captured lazily before draft reset, primary "Capture next" + secondary "View batch summary" |
| 7 | **History** | [app/activity/history.tsx](../app/activity/history.tsx) | ✅ Done — "History" heading + artifact subtitle, single **TOTAL N** stat card, restyled rows via shared `RecentSubmissionsList` (heading "ALL UPLOADS") |
| — | Tabs layout | [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx) | Already matched — no change |

### Decisions locked in this pass

1. **Greeting copy:** "Hi, **Akash**." (artifact verbatim) — replaces time-aware "Good morning".
2. **Section name:** "RECENT UPLOADS" (artifact verbatim) — replaces "Recent submissions".
3. **Success heading:** "Item submitted" (artifact verbatim) — replaces "Listing submitted!".
4. **REQUIRED bar replaces validation Alert** — persistent in-form bar shows what's missing; Submit stays disabled until all 3 done.
5. **History stats:** show only **TOTAL N** card — no Live/Pending/Sold breakdown (no backend support yet).
6. **All 6 PRs shipped in one pass** — see commit history per file above.

### Home — second pass (this revision)

User feedback: "Home screen still looks differ I want same — also the lang option".

Changes:
- ✅ Added **language switcher pill** `🌐 EN ▼` in the header. Tap opens an Alert action sheet with English / 中文 (Traditional) / 中文 (Simplified). Calls `i18n.changeLanguage(...)`. Translation catalogues not yet populated — UI strings stay English until we ship them.
- ✅ Removed the **NetInfo online/offline status pill** — artifact doesn't show it on Home.
- ✅ Removed the **"Industrial Equipment Capture" subtitle** — artifact has only the greeting.
- ✅ Removed the **bento grid** (Saved Drafts / Recent Batches counters) — artifact goes CTA → list. Resume still works through the Scan card → "Resume?" dialog (`verifyScanSessionFiles` flow intact).
- ✅ Cleaned up dead code: `useState/useMemo/useRef`, `Animated`, `NetInfo`, `handleDraftCardPress`, `scrollToSubmissions`, `getGreeting`, `FileText` / `CheckCircle2` imports.

### Home — third pass (side-by-side cleanup)

User feedback: "The reference doesn't have GreenBidz brand text at top — and well-managed — and the history icon also not showing, only the lang". Provided side-by-side screenshots.

Changes:
- ✅ Removed **brand text** (`GreenBidz` / `logoLabel`) from header — reference has nothing there.
- ✅ Removed **History clock icon** from header — History is still reachable via the bottom-tab.
- ✅ Header now contains **only** the language pill + avatar, right-aligned.
- ✅ Bumped **greeting size** from 28→32px — matched the larger "Hi, Marcus." in the reference.
- ✅ Tightened header padding (14 vertical instead of 16) and dropped the bottom border + shadow so the header reads as plain white like the reference.
- ✅ Cleaned up dead `getBranding`, `logoText`, `headerActions`, `History` icon imports and styles.

### Home — fourth pass (greeting moves into header + viewfinder scan icon)

User feedback: "Still not matched — see the scan button area and see the user name in ref image at header so match that as well".

Changes:
- ✅ **Greeting "Hi, Akash." moves INTO the header row** — left-aligned, with language pill + avatar on the right. Mirrors the reference where "Hi, Marcus." sits on the same row as `🌐 EN ▼` and `M`. Removed the separate `welcomeContainer` block.
- ✅ **Scan card icon** changed from `ScanLine` (single horizontal line) → `Scan` (viewfinder-bracket style: corner brackets with a center line) — matches the camera-with-brackets icon in the reference's CTA card.
- ✅ Greeting font size adjusted to **22px** so it fits one line alongside the lang pill + avatar (was 32px when it had its own row).
- ✅ Scroll top-padding reduced from 24→8px now that the welcome block is gone — the CTA card sits closer to the header like the reference.

### Side-by-side: matches that ARE possible vs. data we don't have

**Fully matched:**
- ✅ Header layout: greeting (L) · language pill + avatar (R), no brand text, no history icon
- ✅ Greeting style "Hi, **Akash**." (bold name)
- ✅ Tall green CTA card with viewfinder-bracket icon, "Scan & Upload" title, multi-line subtitle
- ✅ "RECENT UPLOADS" small-caps section header with N items count in green
- ✅ Row layout: count badge · title · ID · status pill
- ✅ Status pills colour-coded (LIVE green, PENDING amber, SOLD indigo)
- ✅ Bottom tab pills (Home · Scan · History · Me) — already matched in prior pass

**Still differs (no data):**
- Price chip per row (`$32k`) — `/batch/seller/:id` doesn't return price
- Thumbnail image per row — no thumb URL on the endpoint
- `✨ AI` badge per row — we don't track AI usage
- "STAFF M001" header badge — no member ID field on profile
- "12 this week" weekly counter — we only have a page count, not weekly

### What still differs (data we don't have)

The reference shows extra per-row detail we can't render without backend changes:

- **Price chip** (`$32k`, `$8.9k`) — `/batch/seller/:id` doesn't return price. Adding it would be a feature change.
- **Thumbnail image** — same; no thumb URL on the seller-batches endpoint.
- **`✨ AI` badge on rows** — we don't track whether a listing was AI-assisted.
- **"STAFF M001" badge** — no member ID field on the user profile.
- **"12 this week" counter** — we have `data.length` for the current page, not a true weekly count; rendering as "N items" instead.

If you want any of these, they're additive backend tickets, not this design-only PR.

### Verification after each pass

```
npx tsc --noEmit  →  exit 0 (one pre-existing app.config.ts error, not from this PR)
npm run lint      →  0 errors, 2 warnings (pre-existing — RHF watch() + typed-routes warning)
```

---

## 1. Home — [app/(tabs)/index.tsx](../app/(tabs)/index.tsx)

| Visual element | Source field on our app | Change |
|---|---|---|
| Greeting "Hi, **Akash**" | `useAuth().profile.name` | Already there. Keep. Optionally change "Good morning, X" → "Hi, **X**" with bold name (matches artifact tone). |
| Big primary CTA card with icon + title + subtitle | `routes.scanListingMethod` | We already have a button; **restyle as a tall green card** with `Camera` icon on top, "Scan & Upload" title, "Photograph equipment · AI fills the details · review and submit" subtitle. |
| Section header "RECENT UPLOADS" + count "**N** this week" | `useRecentSubmissions().data.length` | Rename "Recent submissions" → "Recent uploads" (matches artifact). Show count if we have it (we have `.length` for the page). |
| Item card: photo-count badge · title · ID · status chip · price | Existing fields on `SellerBatch` | Restyle the row inside [RecentSubmissionsList.tsx](../src/components/scanner/RecentSubmissionsList.tsx) to: left photo-count badge (numeric), middle title + small grey ID + status pill, right price chip if we have it. |
| Bottom tab pill | Already in place | No change. |

### ❌ Not porting (we don't have the data)
- "STAFF M001" badge — no member ID field.
- "12 this week" — we have `.length` of last 10 batches, not a true "this week" count. Either show `data.length` as "**N** items" (honest), or hide the counter.
- "✨ AI" sparkle badge per row — we don't track whether a listing used AI assistance.

---

## 2. Camera — [app/scan/camera.tsx](../app/scan/camera.tsx)

| Visual element | We have? | Change |
|---|---|---|
| Full-screen black + viewfinder frame | ✅ | Already close. **Add a 4-corner viewfinder bracket overlay** (4 L-shaped corners, semi-transparent white). |
| Header: ✕ close · "Capture" title · flash icon | ✅ | Reorder header to: `✕` left, **"Capture"** title centered, flash icon right. We have the X and flash already; just centre the title. |
| TIP pill at viewfinder centre | ✅ | We can show "**TIP** Take multiple photos · all stay with this item" — purely informational, no data needed. Show only when 0 photos taken. |
| "Good!" feedback pill after 1+ photos | ✅ | We can show **"Good!**  Add more angles · or tap NEXT" when photos.length ≥ 1. Pure UI state. |
| Photo counter chip ("**3**" next to NEXT) | ✅ | We already show `Next (N)`. Restyle: show a small **circular counter chip** to the left of NEXT instead of inline `(N)`. |
| Bottom shutter (large circle) | ✅ | Already large. Match the artifact's white-on-black look. |

### ❌ Not porting
- **VOICE button** — we have no voice-note feature.
- Bottom-left thumbnail strip in artifact is implicit — we already have a strip; keep ours.

---

## 3. Processing — [app/scan/processing.tsx](../app/scan/processing.tsx)

| Visual element | We have? | Change |
|---|---|---|
| "✨ AI WORKING" green pill | ✅ visual | Add static pill at top of screen. |
| Big heading "Reading your photos…" | ✅ | Already there. |
| Subtitle "5–10 seconds" | ✅ visual | Add as a static subtitle under heading. |
| Spinner / progress dots | ✅ | Keep ours. |
| Sub-status "Detecting equipment…" | ✅ visual | Add a static rotating sub-status (cycle 2–3 strings every ~2s while pending — pure UI, no API change). |

### ❌ Not porting
- "Calculating value & marketplace…" — we don't actually calculate scrap value or marketplace.

---

## 4. Review + Detail merger — **keep ours separate, only restyle Detail**

The artifact merges Review and Detail into one screen. **User said no flow changes**, so we keep two screens. Only restyle the existing **[Detail screen](../app/scan/detail.tsx)** to look closer to the artifact.

| Visual element | We have? | Change |
|---|---|---|
| Header: ← back · "Item · Review" · Save | ✅ | Restyle current header to match. (We don't have a Save button — current submit-only flow stays. Skip Save.) |
| Section header bar with **section names in caps** + small ✨ AI badge | ✅ | Replace plain labels (Title, Description, etc.) with **UPPERCASE small labels** + small "✨ AI" badge on AI-prefilled ones (Title, Description). |
| Photo strip with numbered chips (01, 02, ⭐ on cover) | ✅ | We have photos; render as a horizontal strip of small thumbs with numeric label and a ⭐ on the first. |
| TITLE input + character counter "37/80" | ✅ (max length on schema) | Add character counter under input. |
| DESCRIPTION multiline + counter | ✅ | Same. |
| Inline "Brand · Model" + "Year" small read-only chips | ❌ (we don't pull brand/model/year separately from AI; it's in description) | **Skip.** Adding this would require parsing AI output for brand/model/year — that's a feature change. |
| CONDITION 4-chip row | ✅ (we have 5 chips: NEW, USED — functional, FOR PARTS, WASTE DISPOSAL, DEMOLITION) | Keep 5 chips. **Restyle** to large pill chips with uppercase labels — matches artifact look but keeps our conditions. |
| INSTALLATION row (INSTALLED / DEINSTALLED) | ❌ | **Skip** — no field for this on our schema. |
| PRICE: Set Price / Make Offer toggle | ✅ ("Buy now" / "Make offer" — same idea) | Already there. Restyle to match the artifact's chip-toggle look (already very close). |
| AI suggests "$X · tap to use" inline chip | ❌ | **Skip.** We don't surface an AI-suggested price separately. (When we do, this is the first thing to port.) |
| LISTING DURATION (30 / 60 / 90 day chips + custom field) | ❌ | **Skip** — no listing duration field today. |
| MARKETPLACE 3-chip selector (101LAB / 101MACHINE / 101RECYCLE) | ✅ (single `SITE_TYPE` per build — not user-selectable) | **Skip** — we don't let the user pick the marketplace; it's set by `SITE_TYPE`. Adding chips would be a feature change. |
| Bottom **REQUIRED: N OF 3 DONE** card with green checks per item | ✅ (we already have these required fields) | **Port** — this is a visual surfacing of state we already have (photos count, selected condition, price entered). No new data, just persistent visibility. Replaces our "Category is required" inline-only error. Will list: Photos · N added, Condition · pick one / `<selected>`, Price · enter amount / `$<value>`. |
| Sticky **+ Add another** + **Submit →** button pair at bottom | Partial: Submit ✅, Add another only in grouped mode | **Submit only** — keep our current single-flow Submit. Skip "+ Add another" (already exists on grouped-review screen, no need to add to single). |

### ❌ Not porting
- Item ID display "ITM-2024-EACU" — our IDs are server-assigned only after submit. We don't have a draft ID we want to show.
- "USED EQUIPMENT VALUE $32,400 · Range $28k–38k · 8 comps" — no comp pricing service.
- "SCRAP FLOOR $1,300 · ~6.5t steel" — no scrap calc.
- "AI · 96%" confidence badge — we don't get confidence back from the AI endpoint.

---

## 5. Submitted — [app/scan/success.tsx](../app/scan/success.tsx)

| Visual element | We have? | Change |
|---|---|---|
| Big green checkmark | ✅ | Keep, maybe enlarge to artifact scale (72px → 96px). |
| "Item submitted" heading | ✅ ("Listing submitted!") | Optional copy tweak to match artifact: **"Item submitted"** or keep ours. |
| Caption "Sent to GreenBidz for review. Goes live within 24h after approval." | ✅ (we have similar) | Match artifact wording verbatim — it's clearer than ours. |
| Summary card with PHOTOS / CONDITION / PRICE / DURATION rows | ✅ for photos, condition, price; ❌ for duration | Add summary card showing **Photos count · Condition · Price** (the 3 fields we collected). Skip Duration row. |
| Home / Capture next buttons | ✅ | Keep current; restyle to match artifact button hierarchy (primary "Capture next", secondary "Home"). |
| Item ID display | Partial (we have batch number) | Show **Batch #N** in place of artifact's Item ID. We have this already. |

### ❌ Not porting
- DURATION row — no listing duration field.

---

## 6. History — [app/activity/history.tsx](../app/activity/history.tsx)

| Visual element | We have? | Change |
|---|---|---|
| Title "History" + subtitle "Every item you've submitted · tap to view or re-edit" | ✅ | Match artifact wording. |
| Stat cards: TOTAL / LIVE / PENDING / SOLD with counts | ✅ for total; ❌ for status-grouped counts (need backend aggregation) | **Show only TOTAL** unless we add a query. Skip Live/Pending/Sold/Drafts/Rejected breakdown. |
| Filter chip row (All N, Live N, …) | ❌ | **Skip** — we don't have status filters wired. |
| Per-row item: photo-count badge · title · ID · relative date · status chip · price · marketplace tag | ✅ for everything except photo count and AI badge | Restyle row to match: photo count on left (or hide if we don't have it on this endpoint), title bold, ID grey small, relative date "today, 9:14 AM", status pill colour-coded, price right, marketplace tag below. |

### ❌ Not porting
- Photo-count badges on history rows if `/batch/seller/:id` doesn't return them — verify before promising.
- "**N** OFFERS" badge — we don't surface offer count on the batch list.
- "+$2,400" sold-profit badge — not in our data.
- Filter chips by status — no API support.

---

## 7. Bottom tabs — [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx)

| Visual element | We have? | Change |
|---|---|---|
| Pill on active tab with icon + label | ✅ | **Already matches** the artifact. No change. |

---

## What this PR is NOT

- ❌ Combining Review + Detail into one screen (flow change).
- ❌ Adding "+ Add another" to the single-listing flow (flow change).
- ❌ Adding LISTING DURATION, MARKETPLACE picker, INSTALLATION, OCR brand/model, comp pricing, scrap floor, AI confidence, offer count, sold-profit, status-grouped history (feature changes / new data).
- ❌ Wiring AI price suggestion chip (no backend field yet).
- ❌ Replacing the per-screen "Make offer" toggle UX.

If we want any of those, they're separate tickets — flagged in `Docs/UX_DELTA_v7.md` (not written yet) when you're ready.

---

## Order I'd ship

Small, reviewable PRs in this order:

1. **Home card + recent uploads row** — visible win, lowest risk.
2. **Camera viewfinder bracket + TIP/Good! pills + counter chip** — pure UI, no logic.
3. **Submitted screen summary card** — small, satisfying.
4. **Detail screen** — section labels in caps, ✨ AI badges, character counters, restyled chips, **bottom REQUIRED bar** (replaces our silent-validation patch). Biggest one.
5. **Processing pills + sub-statuses** — quick polish.
6. **History row restyle** — last because lowest-traffic.

Each step is a single PR. Stop after any if you want to ship and iterate.

---

## Open decisions

1. **Greeting copy**: keep "Good morning, X" (time-aware) or switch to "Hi, **X**" (artifact)?
2. **"RECENT UPLOADS" vs "Recent submissions"**: match artifact or keep current?
3. **Submit copy**: "Item submitted" (artifact) vs "Listing submitted!" (current)?
4. **Should the REQUIRED bar replace the validation Alert** added in our last patch, or sit alongside it?
5. **History stat row** — show only **Total** for v1, or drop the stats card entirely until we have grouped counts?
