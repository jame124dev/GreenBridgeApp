# 13 — Language-support (i18n) coverage checklist — (lab) customer app

**Purpose:** one bullet list per section of every place that still needs `t()` wiring
(en/zh/ja/th). Pattern is set by the Home + header pass: strings live under
`mobile.labHome.*` (or a new `mobile.lab<Screen>.*` block) in `src/i18n/locales/{en,zh,ja,th}.json`,
switched via the header globe chip → `LanguageSheet` (`i18n.changeLanguage`).

Legend: `[x]` done · `[ ]` pending · `[~]` partly (reuses an already-i18n'd shared component; verify).

---

## ✅ Done (reference)
- [x] **Home** (`app/(lab)/(tabs)/home.tsx`) — greeting (lead + accent), composer placeholder, send label
- [x] **Header** (`homeLabHeader.tsx`) — language chip; brand lockup left as-is (brand)
- [x] **Mode toggle** (`homeModeToggle.tsx`) — "I'm selling" / "I'm buying"
- [x] **Recent listings** (`HomeRecentListings.tsx`) — title, "See all", status labels, "N offers"
- [x] **Language picker** (`LanguageSheet.tsx`) — already i18n
- [x] ⚠️ **Home NOT 100%** — `homeAiComposer.tsx` still has ~2 hardcoded literals (internal composer text); audit + wire — done (mobile.labHome.*)

---

## Bottom navigation
- [x] Tab labels (`src/features/lab/components/tabConfig.ts`) — Home · Browse · Matches · Chat · Account — done (t(`mobile.labNav.*`) via FrostedTabBar, en/zh/ja/th)
- [ ] Tab badge a11y labels (if any)

## Chat screen (`app/(lab)/chat.tsx`)
- [x] Header title ("Sell with AI" / buy-mode equivalent) — done (`mobile.labChat.headerTitle`, mode-composed)
- [x] Composer placeholder ("Tell the AI more…" / "Ask a follow-up…") — done (`mobile.labChat.placeholder`)
- [x] Send / retry button labels + error-bubble copy — done (`mobile.labChat.send` + `genericError`)
- [ ] `ThinkingDots` a11y label

## Chat response cards (`src/features/lab/chat/cards.tsx`) — largest surface
- [x] Listing entry options card (Upload / Manual titles + subtitles) — done (`mobile.labCards.*`)
- [x] Listing draft card (field labels, completion meter, "Publish listing", ready/draft status) — done (`mobile.labCards.*`)
- [x] Listing created card ("View listing", product-id label) — done (`mobile.labCards.*`)
- [x] Product list / product detail / identify-confirm card ("Yes, that's it" / "Something else") — done (`mobile.labCards.*`)
- [x] Marketplace overview / catalog summary / recent-auctions / platform-info cards — done (`mobile.labCards.*`)
- [x] Bid list / received-bids cards — done (`mobile.labCards.*`)
- [x] WTB cards — draft, request, list, matches ("Save & alert me", "View matches", relevance %) — done (`mobile.labCards.*`)
- [x] Gate cards (login / seller-access messages + CTAs) — done (`mobile.labCards.*`)
- [x] Handoff card ("Connecting you with a person…") — done (`mobile.labCards.*`)
- [x] `cardKit.tsx` shared empty-state / blank-value strings — done (`mobile.labCards.*`)

## Processing (`app/(lab)/processing.tsx` + `ProcessingStepRow`/`ProcessingSpinner`)
- [x] Step labels + progress copy — done (`mobile.labProcessing.*`)

## Draft review (`app/(lab)/draft.tsx`)
- [x] Field labels, section headers, action buttons — done (mobile.labDraft.*)

## Published (`app/(lab)/(tabs)/published.tsx` + `publishedComponents.tsx`)
- [x] Celebration title/subtitle (mode-composed), match-count copy, "See your matches" / "Back to home" CTAs — done (`mobile.labPublished.*`)

## Matches / My Wants (`app/(lab)/(tabs)/matches.tsx` + `src/features/lab/wants/*`)
- [x] Summary strip (active wants · new matches · top fit) + All / Active / Paused filter labels — done (mobile.labWants.*)
- [x] Empty state + "New want" — done (mobile.labWants.*)
- [x] `WantCard.tsx` (status, relevance %, "View all N") — done (mobile.labWants.*)
- [x] **`AddWantSheet.tsx`** — the *create-want* FORM (labels, condition pills, budget, quantity, save) — done (`mobile.labWants.*`)
- [x] **`ManageWantSheet.tsx`** — the *manage-want* FORM (pause/resume, notify frequency, edit, delete) — done (`mobile.labWants.*`)
- [x] `MatchListCard.tsx` / `MatchProductCard.tsx` (match rows, relevance %, actions) — done (mobile.labWants.*)

## Matches feed cards (`src/features/lab/matches/components/*`)
- [x] `MatchesCard.tsx` (feed card labels/actions) — done (mobile.labMatch.*)

## Match detail (`app/(lab)/match/[id].tsx` + `src/features/lab/match/components/*`)
- [x] Headings, spec labels, "Contact seller" CTA — done (`mobile.labMatch.*`)
- [x] `WhyMatchedCard.tsx` (why-matched explanation labels) — done (`mobile.labMatch.*`)

## Want detail (`app/(lab)/want/[id].tsx`)
- [x] Headings, per-want match list labels — done (mobile.labMatch.*)

## Messages inbox (`app/(lab)/(tabs)/deals.tsx` + `src/features/lab/messages/*`)
- [x] Header, search placeholder, empty state ("See your matches"), `ConversationRow` timestamps/labels — done (`mobile.labMessages.*`)
- [x] **`messages/components/ChatComposer.tsx`** — the message-input FORM (placeholder/send) — done (`mobile.labMessages.*`)

## Deal thread (`app/(lab)/deal/[id].tsx` + `DealComposer`/`DealManagedBanner`/`DealMessageBubble`)
- [x] Composer placeholder, managed-deal banner, system/status bubbles — done (mobile.labDeal.*)

## Browse (`app/(lab)/(tabs)/browse.tsx`)
- [x] Native compact top bar + loading / offline / retry states (WebView content uses the web's own i18n; pass a `language` param so the embed follows app locale) — done (`mobile.labBrowse.*` / `mobile.labCommon.*`)

## Account (`app/(lab)/(tabs)/account.tsx`)
- [~] Reuses shared `src/features/settings/*` (already `t()` via `mobile.profile.*`) — verify all cards
- [x] Section headers + any lab-specific copy; `SELLER` role pill — done (mobile.profile.*)

## My listings (`app/(lab)/(tabs)/listings.tsx`)
- [~] Reuses `RecentSubmissionsList` (already `t()`); translate the screen title "My listings" + "All listings"

## Shared components used by (lab)
- [x] Location chips (`LabLocationChip` "Set location" / detecting; `LabLocationPromptStrip`) — done (mobile.labCommon.*)
- [x] `LabPlaceholder` (stub screens' title/subtitle) — done (mobile.labCommon.*)
- [x] `UploadSourceSheet` (currently dormant — translate if re-enabled) — done (mobile.labCommon.*)

## Scan flow (shared `app/scan/*`, now reachable from lab)
- [~] Already largely `t()` (seller app) — verify every camera/detection/review/success string resolves in zh/ja/th, and any lab-entry-specific copy

---

## Shared, pre-fork (the lab user still passes through these)
- [~] **Auth** (`app/(auth)/login.tsx`, `pending.tsx`) — the sign-in FORM already uses `t()` (`mobile.auth.*`); verify all fields/CTAs resolve in zh/ja/th
- [~] **Settings forms** (`src/features/settings/*` — AddressCard, NotificationPreferencesCard, SecurityCard, VerificationCard) — already `t()`; verify

## ⚠️ "Wired but maybe partial" — files that import `t()` yet may still hold literals (audit each)
- [x] `chat/LabListingEditSheet.tsx`, `chat/LabListingGapFiller.tsx` (draft-edit FORM) — done (mobile.labEdit.* / mobile.labGap.*)
- [x] Scan-flow forms `app/scan/{detail,grouped-edit,grouped-review,detection}.tsx` — done (mobile.*)
- [x] `LocationPrimerSheet.tsx` — done (mobile.labCommon.*)
- (`useTranslation` present ≠ every string translated — grep each for remaining `"English"` literals)

## Cross-cutting / follow-ups
- [ ] Persist the chosen language (confirm `src/i18n` has a persistence/detector; the seller app relies on it)
- [x] Toasts & `Alert`s fired from lab flows (e.g. location errors in `home.tsx` are still literal English) — done (mobile.labHome.*)
- [ ] Proofread zh / ja / th for every new `mobile.lab*` block (current values are best-effort, unreviewed)
- [ ] Number/date/currency formatting per locale where shown (prices, relative times)
