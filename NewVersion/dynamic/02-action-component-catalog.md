# 02 — Action → Response-Component Catalog

> **The centerpiece doc for making GreenBridgeApp dynamic.**
> For every assistant action / tool / stream-event the backend can emit, this catalog names: where it fires, the exact output payload, the **web** component that renders it today, and the **mobile** component to build (name, props, loading/empty/error states, interactive callbacks it fires back). Split into Buyer and Seller sections.
>
> Sibling docs:
> - Foundation, tokens, animation recipes → `../00-foundation.md`
> - Screen specs (static build) → `../01-home-tell-ai.md`, `../02-processing.md`, `../03-draft-review.md`, `../04-published.md`, `../05-matches-feed.md`, `../06-match-detail.md`, `../07-deal-room.md`, `../08-bottom-nav.md`
> - This folder's siblings: `01-chat-architecture.md` (the SSE transport + frame parser that feeds every component here), `03-api-contract.md` (the wire contract), `04-mobile-integration-plan.md` (stores, React Query hooks, per-screen buyer/seller wiring), `05-mobile-ux.md` (streaming UX), `06-roadmap-risks.md`

---

## 0. How to read this catalog

The customer app is an **AI-first chat surface**. Almost nothing is a plain REST screen; everything is a **card** the assistant streams into a conversation thread. The web app already implements this exact model in a single shared engine (`useAIChat.ts` + `AIChatThread.tsx` + `aiChatShared.tsx`). The mobile job is to reproduce that engine natively.

**The pipeline every row in this doc plugs into:**

```
composer send ──► POST /chat/stream  OR  POST /detect/stream   (SSE)
                        │
                 EventSource (react-native-sse)
                        │
        ┌───────────────┼────────────────┬──────────────┐
     event:token    event:data       event:done     event:error
     {delta}       {type, data}     {used_tools}    {detail}
        │               │                │              │
   append to      DISPATCH ON         tool badge     error bubble
   bot bubble     data.type ───────►  strip          + Retry
                  (this catalog)
```

- **`event: token`** → text delta, appended to the current bot bubble (Markdown). Not a card.
- **`event: data`** → `{ "type": "<card_type>", "data": {...} }`. **`type` is the dispatch key for this entire catalog.** Every table below is keyed by that `type`.
- **`event: done`** → `{ used_tools: [...] }` → render a "Sources" tool-badge strip.
- **`event: error`** → terminal; render error bubble with Retry.
- **`event: warning`** (`MAX_TURNS_EXCEEDED`), **`event: heartbeat`** → non-terminal; ignore in UI (heartbeat just resets the watchdog).

**Two endpoints, one parser.** Text turns hit `/chat/stream` (agent + tools). Turns carrying `image_urls`/`document_urls` hit `/detect/stream` (Python smart-detect, live `draft` frames) when the detect flag is on. Both emit the same `event: data` `{type, data}` envelope, so **one mobile parser + one dispatcher renders all cards** — mirror the web's `streamInto()` (`useAIChat.ts:300-562`).

**Reuse anchor (seller app already ships this).** The seller scanner has a complete SSE pipeline that is the exact template:
- Transport: `src/services/scanner/smartDetectStream.ts` (`react-native-sse`, `addEventListener` pattern, 45s watchdog reset on heartbeat, `pollingInterval:0`).
- Event taxonomy: `src/features/scanner/smartDetectStreamTypes.ts` (discriminated union `SmartStreamEvent` — the shape to copy for a `LabStreamEvent` union).
- Mutation + live callback: `src/features/scanner/useSmartDetect.ts` (`onEvent?: (e) => void`, v1 blocking vs v2 SSE fork at `smartDetectV2Enabled()`).
- Field mapper: `src/features/scanner/mapSmartDetection.ts` (`pickPrice`, `pickAiPrices`, marketplace derive) — reuse verbatim for listing-draft cards.
- HTTP client + auth: `src/api/greenbidzClient.ts` + `src/api/interceptors.ts` (Bearer + `x-refresh-token` + `x-platform` + `x-system-key`).
- Query client: `src/lib/queryClient.ts`. Auth store: `src/stores/authStore.ts`. Flags: `src/lib/flags.ts`.

**Mode plumbing.** Every `/chat/stream` body carries `mode: "buyer" | "seller"` (or omitted → agent infers from JWT role). Mobile reads mode from the composer store (`src/features/lab/stores/composerStore.ts`, `mode: 'sell' | 'buy'`) and maps `sell→seller`, `buy→buyer`. Backend gates tools by mode (`assistant.py:880-896`): seller hides `get_my_bids`; buyer hides `get_bids_on_my_listings`. **A card `type` can therefore only appear in the section (buyer/seller) where its tool is exposed** — noted per row.

**Card component naming convention (mobile).** Prefix new components `Lab*Card` and place under `src/features/lab/cards/`. Each takes `{ data, busy?, onAction? }` where `onAction` fires a follow-up turn or REST call. Every card must implement three visual states: **loading** (skeleton while the frame is mid-stream / draft is partial), **empty** (tool returned zero rows), **error** (bad payload — fail soft, never crash the thread; the seller stream's malformed-token rule applies: render completed fields only).

**Global UX rules for all cards (mobile lens):**
- Cards render **inside the scrolling thread**, right under the bot bubble — not modals (except the listing edit sheet). Keep them full-bleed-minus-gutter, tap targets ≥44px.
- **Optimistic + idempotent.** Any card action that writes (save-want, publish, place-bid) must guard against double-fire on re-render. Copy the web's synchronous `wtbSavedRef` guard (`useAIChat.ts:897-935`, `canSaveWant` in `wtb.ts:157-158`).
- **Persistence.** Cards are message fields; persist the thread to MMKV keyed like web (`gb_ai_conv_id`, `gb_ai_msgs_<id>`) so a card survives app backgrounding.
- **Streaming replace-in-place.** `listing_draft` and detect `draft` frames arrive repeatedly for the *same* message index — the card must replace, not append (web: `setLast({ draft })`).

---

## 1. Shared / mode-neutral cards

These fire in **both** buyer and seller threads (and the neutral Home thread). Build once, render everywhere.

| `type` (dispatch key) | Trigger / where it fires | Assistant OUTPUT payload | Web component (file) | Mobile component to BUILD | States & interactive actions |
|---|---|---|---|---|---|
| `product_list` | Agent calls `search_products`; also arrives with `identified` on image search | `{ query, results: [{id, batch_id, name, price, currency, condition, category, country, image_url}], total }` | `ProductCard` (`aiChatShared.tsx:474-507`) in a grid, tier-split by `RelevanceBanner.tsx` | **`LabProductCardList`** wrapping **`LabProductCard`** (props `{ card, showActions? }`) | **loading:** 2–3 skeleton cards while frames stream. **empty:** handled by `LabRelevanceBanner` (see below), not a blank list. **error:** drop malformed rows. **actions:** tap card → open batch/product detail (`GET /api/v1/product/detail/:id` or batch route); reuse seller `mapSmartDetection` image handling for `image_url`. |
| (relevance split) | Same `product_list`, but no card scores ≥0.95 with a query-token in title | Derived client-side from Meili `_rankingScore` (EXACT≥0.95, FLOOR 0.40) | `RelevanceBanner` + `splitCardsByTier()` (`RelevanceBanner.tsx:43-119`) | **`LabRelevanceBanner`** (props `{ query, onSaveWant? }`) rendered above the related-tier list | **states:** shown only when `exact.length===0`. **action:** "Save a Want-To-Buy" → `onSaveWant()` (buyer only; hide button in seller thread). Port the pure `relevanceTier`/`splitCardsByTier` logic verbatim — no API. |
| `product` | Agent calls `get_product` | `{ found, id, batch_id, name, post_content, price, currency, condition, category, country, image_url, batch_status, approval_status, visibility }` | `ProductDetailCard` (`aiChatShared.tsx`) | **`LabProductDetailCard`** (props `{ data }`) | **empty:** `found:false` → "couldn't find that item" state. `post_content` is server-sanitized → render as trusted-ish HTML/Markdown. Read-only (no actions). |
| `overview` | `get_marketplace_overview` | `{ live_lots, sold_lots }` | `MarketplaceOverviewCard` | **`LabOverviewCard`** (props `{ data }`) | Two big stat tiles. Read-only. Trivial; low priority. |
| `catalog_summary` | `get_catalog_summary` | `{ total_products, categories[], countries[], conditions[] }` | `CatalogSummaryCard` | **`LabCatalogSummaryCard`** (props `{ data }`) | Chips/counts. Read-only. Tapping a category chip *may* fire a follow-up search turn (nice-to-have, defer). |
| `batch_list` | `get_recent_batches` | `{ batches: [{id, title, live_for_bids, created_at, product_count, image_url}], total }` | `BatchListCard` | **`LabBatchListCard`** (props `{ data, onOpenBatch? }`) | **loading/empty/error** standard. **action:** row tap → batch detail. |
| `platform_info` | `get_platform_info(topic)` | `{ topic, title, sections:[{step,label,description}] }` (web also sees `steps`/`points`) | `PlatformInfoCard` | **`LabPlatformInfoCard`** (props `{ data }`) | Numbered steps list. Read-only educational card. |
| `handoff` | `request_handoff` (flag `zoho_handoff_enabled`) | `{ thread_id, reason, priority, department, message }` | (in-window support thread on web) | **`LabHandoffCard`** (props `{ data }`) → then a live support thread | **states:** "connecting" vs "queued_ticket" vs email-fallback copy (Node always returns 200; branch on message). **NOTE:** Node's `/request-handoff` returns `status: connecting | queued_ticket | email-only`; surface all three gracefully. Real-time replies are 20s-poll on web today — mobile can poll or reuse the deal-room socket later. See `../07-deal-room.md`. |
| — (`event: done`) | Every turn end | `{ used_tools: [...], conversation_id }` | Tool-badge strip (labels from `TOOL_LABELS`, `aiChatShared.tsx:340-360`) | **`LabToolBadges`** (props `{ tools }`) | Map raw tool names → friendly labels (port `TOOL_LABELS`). Read-only. |
| — (`event: error`) | Preflight / stream failure | `{ detail \| message, code }` | inline red bubble + Retry (`AIChatThread.tsx:106-108`) | **`LabErrorBubble`** (props `{ text, retryMessage, onRetry }`) | **action:** Retry → re-stream the same turn (store the outgoing message on the errored bot msg as `retry`). Handle codes `RATE_LIMITED`(429), `SPEND_CAP_EXCEEDED`(503), `PREFLIGHT_ERROR`(413) with specific copy. |
| — (`event: warning`) | Agent hit `max_turns=12` | `{ code: "MAX_TURNS_EXCEEDED" }` | (soft note) | inline muted note; non-terminal | Do not treat as error; stream continues to `done`. |
| — (user attachments) | On the user's own message after upload | `attachments: [{name, isImage, url?}]` | img thumbs / file chips in user bubble | **`LabUserAttachments`** | Images: HTTPS thumb (persists). Docs: file-icon chip (name only). **action:** none post-send; pre-send removal handled in composer. |

**Common product card contract (mobile).** `LabProductCard` is the single most-reused card — it appears inside `product_list`, `wtb_request`, and `wtb_matches`. Build it once with a `variant` for grid vs. compact-row. Fields present in every producty payload: `id, batch_id, name, image_url, price, currency, condition, country`. Use `condLabel` mapping (port `CONDITION_LABELS`, `aiChatShared.tsx:306-325`).

---

## 2. BUYER section

Buyer thread = `mode:"buyer"`. Exposes `search_from_image`, the four WTB tools, `get_my_bids`; **hides** `get_bids_on_my_listings`. WTB cards are **flag-gated** (`wtb_enabled` on Python; web mirrors with `wtbEnabled()` in `wtb.ts:22-29`) — when off, all WTB branches render nothing and the thread degrades to plain search. Mobile must ship the same flag (add `WTB_ENABLED` to `src/lib/flags.ts`).

### 2.1 Buyer flow overview

```
Home (buy mode) ──► /chat/stream (mode:buyer)
  "used spectrophotometer"        │
                          product_list ──► LabProductCardList (+ LabRelevanceBanner if no exact)
                          wtb_draft   ──► LabWtbDraftCard  (editable: condition / budget / qty)
        buyer taps "Save & alert me"  │  onSave → createWant() (idempotent guard)
                          wtb_request ──► LabWtbRequestCard (saved + matches grid)
  Photo upload (no stock) ─► product_list w/ identified ─► LabIdentifyConfirmCard ─► "Yes" ─► wtb flow
  "My Wants" tab ─► list_my_wants ─► LabWtbListCard ─► "View matches" ─► wtb_matches ─► LabWtbMatchesCard
```

This maps directly onto the static screens: Matches feed (`../05-matches-feed.md`), Match detail (`../06-match-detail.md`). The chat-native WTB cards below are the *conversational* counterpart of those dashboard screens; both read the same underlying WTB records.

### 2.2 Buyer card catalog

| `type` | Trigger / where it fires | Assistant OUTPUT payload | Web component (file) | Mobile component to BUILD | States & interactive actions | Buyer vs seller |
|---|---|---|---|---|---|---|
| `product_list` | `search_products` (buyer intent = sourcing) | see §1 | `ProductCard` grid | `LabProductCardList` (§1, reused) | tap → product/batch page | Same card, buyer intent framing only |
| (`identified` on `product_list`) | `search_from_image`: photo recognized, **no in-stock match** → `product_list` carries `identified:{name,brand,model,keywords}` and empty/absent cards | envelope has `identified` + `match_count`; web reads `data.identified` (`useAIChat.ts:529-534`) | `IdentifyConfirmCard` (`IdentifyConfirmCard.tsx:15-51`) | **`LabIdentifyConfirmCard`** (props `{ name, onConfirm, onReject }`) | **states:** shown only when `identified.name` set AND no cards. **actions:** Confirm → send `"Yes, that's the item."` (kicks WTB draft); Reject → send `"That's not quite it — let me describe…"`. Sparkle icon + two buttons. | **Buyer-intent** (`search_from_image` is always registered + unauthenticated, but only the BUYER prompt routes photo turns to it; a seller-mode image upload goes to detect/listing, not identify). |
| `wtb_draft` | Agent calls `draft_want_to_buy` after buyer describes a want | `{ draft:{title, category, keywords, condition_wanted, max_price, quantity}, preview_matches / immediate_matches, ... }` | `WtbDraftCard` (`WtbCards.tsx:69-283`) inside `BuyerWtbCards` renderer (`WtbCards.tsx:450-496`) | **`LabWtbDraftCard`** (props `{ data, onSave, busy?, saved? }`) | **editable fields:** title (read-only), 3 condition pills + "Any", budget input + quick-chips, quantity stepper, preview match count. **action:** "Save & alert me" → `onSave(editedDraft)` → `saveWant(idx, edited)`, **fire exactly once** (port `wtbSavedRef` guard). On 401/403 → roll back + show `LabWtbGateCard`; else toast. **loading:** none (draft arrives complete). **error:** if fields missing, render what exists. | **Buyer only.** Flag-gated. |
| `wtb_request` | `create_want_to_buy` success (after Save) | `{ id, title, max_price, condition_wanted / status:"active", immediate_matches:[product rows], created_at }` | `WtbRequestCard` (`WtbCards.tsx:287-335`) + `ProductCard` grid | **`LabWtbRequestCard`** (props `{ data }`) | "Saved" banner + email-alert notice + match count + grid of `LabProductCard` + link "View it in My Wants" (deep-link to Matches/My-Wants tab, cf. `../05-matches-feed.md`). Read-only after save. | **Buyer only.** |
| `wtb_gate` | `create_want_to_buy` while unauthenticated | `{ reason: "login" \| "guest_lead_capture", message }` | `GateCard` via `WtbCards.tsx:489` | **`LabWtbGateCard`** (props `{ reason }`) | **actions:** login → navigate to auth (`../08-bottom-nav.md` for nav); guest_lead_capture → prompt name/email inline. Sign-out variant only. | **Buyer only.** |
| `wtb_request_list` | `list_my_wants` (or My-Wants tab load) | `{ requests:[{id, title, status:active|paused|expired, match_count, created_at}], total }` | `WtbListCard` (`WtbCards.tsx:344-408`) | **`LabWtbListCard`** (props `{ data, onViewMatches }`) | rows: title, status badge, match count, date, "View matches". **action:** `onViewMatches(id, title)` → send the natural-language `wantMatchesMessage(id,title)` so the **agent** calls `get_want_matches` (never call the tool directly). **empty:** "No wants saved yet" CTA back to composer. **loading:** skeleton rows. | **Buyer only.** Also powers a non-chat My-Wants screen. |
| `wtb_matches` | `get_want_matches(wtb_id)` | `{ wtb_id, title, matches:[product rows], match_count }` | `WtbMatchesCard` (`WtbCards.tsx:412-441`) + `ProductCard` grid | **`LabWtbMatchesCard`** (props `{ data }`) | header "Matches (N)" + `LabProductCard` grid. **empty:** "No matches yet — we'll alert you." **action:** tap product → detail. | **Buyer only.** |
| `bid_list` | `get_my_bids` (buyer's placed bids) | `{ bids:[{id, product_id, batch_id, product_name, amount, currency, status: winning\|outbid\|expired\|closed, placed_at, closes_at}] }` or `{ status:"login_required" }` | `BidListCard` (`aiChatShared.tsx`) | **`LabBidListCard`** (props `{ data }`) | rows with status pill (winning=green, outbid=amber, expired/closed=grey). **empty:** "no bids yet". **gate:** if `status:"login_required"` render `LabWtbGateCard`-style login prompt. **action (optional):** tap → batch page; "increase bid" defer to REST place-bid. | **Buyer only** (seller's "my bids" = received bids). |

**Buyer REST note.** WTB CRUD is Python-owned (`/wtb`, `/wtb/{id}`, `/wtb/{id}/matches`) and driven by the agent via tools — mobile should prefer the chat-tool path (send a message) over hitting REST directly, matching web. Direct REST is only for a dedicated non-chat My-Wants list screen if you build one; auth = buyer JWT (Bearer + `x-refresh-token` fallback). See `03-api-contract.md` (WTB REST) + `04-mobile-integration-plan.md` (query hooks).

**Place-a-bid (buyer, non-chat).** Placing an actual bid is **not** a chat card — it's `POST /api/v1/buyer/bid/place` (multipart, body-based `buyer_id`). If the buyer taps through from a product/`bid_list` card into a bid action, that's a REST mutation screen, not an SSE card. Keep it out of the thread; document under buyer-flow wiring.

---

## 3. SELLER section

Seller thread = `mode:"seller"`. Exposes the listing-builder tools (`present_listing_options`, `detect_listing_from_images`, `get_listing_draft`, `update_listing_draft`, `create_listing`), `get_seller_summary` (defined in `app/tools/get_seller_activity.py`, but the registered tool name the model sees is `get_seller_summary`), `get_bids_on_my_listings`; **hides** `get_my_bids`. Listing tools additionally require `node_base_url` configured server-side. The whole seller listing flow is the **exact analog of the seller scanner app** the customer app already ships — reuse `mapSmartDetection`, the detail-card components under `src/features/scanner/components/detail/`, and `useSmartDetect`'s streaming.

### 3.1 Seller flow overview

```
Home (sell mode) ──► present_listing_options ──► LabListingEntryOptionsCard
   ├─ "Upload photos/documents" ─► pick files ─► GCS upload ─► /detect/stream
   │        stage/draft frames ──► LabListingDraftCard (fills live, replace-in-place)
   │        listing_group_choice ─► LabGroupChoiceCard (N separate vs 1 product)
   │        listing_queue        ─► LabMultiProductQueueRail
   │   seller taps "Edit details" ─► LabListingEditSheet (PUT /listing-draft) ─► draft updates
   │   seller taps "Publish"      ─► send "CONFIRM CREATE" ─► listing_created ─► LabListingCreatedCard
   └─ "Enter details manually"    ─► send "I'll enter details manually"
  "How am I doing?" ─► get_seller_summary ─► LabSellerActivityCard
  "Who bid on my items?" ─► get_bids_on_my_listings ─► LabReceivedBidsCard
```

Maps onto static screens: Draft review (`../03-draft-review.md`) is the mobile home for `LabListingDraftCard`; Published (`../04-published.md`) is where `listing_created` lands.

### 3.2 Seller card catalog

| `type` | Trigger / where it fires | Assistant OUTPUT payload | Web component (file) | Mobile component to BUILD | States & interactive actions | Buyer vs seller |
|---|---|---|---|---|---|---|
| `listing_entry_options` | `present_listing_options` (seller starts a listing) | `{ options:[{id:"upload",label},{id:"manual",label}], prompt? }` | `ListingEntryOptionsCard` (`aiChatShared.tsx:1188-1216`) | **`LabListingEntryOptionsCard`** (props `{ onUpload, onManual }`) | two big buttons ("Upload photos/documents — Fastest" + "Enter details manually"). **actions:** Upload → open native file picker; Manual → send `"I'll enter details manually"`. | **Seller only.** |
| `listing_draft` | `detect_listing_from_images` and every `/detect/stream` `draft` frame; also `get_listing_draft` / `update_listing_draft` return | `{ fields:{ product_title:{value,confidence}, item_condition, category, brand, model, price_per_unit, quantity, price_currency, ... }, image_urls, missing_required[], low_confidence[] }` | `ListingDraftCard` (`aiChatShared.tsx:823-1100`) | **`LabListingDraftCard`** (props `{ data, onEdit, onPublish, busy? }`) | **loading:** partial draft while detect streams — **replace-in-place** per frame; show shimmer on not-yet-arrived fields, badge `low_confidence` fields, flag `missing_required`. Reuse `mapSmartDetection` + the scanner **detail cards** (`IdentityCard`, `PricingCard`, `SpecsCard`, `CategoryConditionCard`, `PhotosCard`, `RequiredChecklist` under `src/features/scanner/components/detail/`). **actions:** "Edit details" → open `LabListingEditSheet`; "Publish Listing" → send `"CONFIRM CREATE"`. **error:** malformed field → render others. | **Seller only.** This is the highest-value card to build; it is the whole draft screen (`../03-draft-review.md`). |
| (edit) | Seller taps "Edit details" on the draft card | GET/PUT `/ai-chat/listing-draft` (Node/Python) with `{ conversationId, siteType, seed }` | `ListingEditModal` (`ListingEditModal.tsx:263-270`) + `ListingGapFiller.tsx` | **`LabListingEditSheet`** (bottom sheet, props `{ open, conversationId, seed, onClose, onSaved }`) | field sections + photo editor + cascading category selects + per-field AI/verify/needs badges. **flow:** seed pre-fills; Save → PUT `/listing-draft` → `onSaved(payload)` → parent replaces `messages[idx].draft` (web `applySavedDraft`). This is the **one modal** (not an inline card). Reuse scanner `useDetailController.ts` + `formMapping.ts`. | **Seller only.** |
| `listing_group_choice` | Detect finds multiple products in the upload | `{ total, items, first_payload, mode }` | `GroupChoiceCard` (`aiChatShared.tsx:619-662`) | **`LabGroupChoiceCard`** (props `{ total, onSeparate, onCombine, busy? }`) | two buttons: "N separate products" + "One product". **actions:** Separate → `POST /ai-chat/detect/split-products`; Combine → `POST /ai-chat/detect/combine-products`; both re-emit `listing_draft`/`listing_queue`. **busy** disables during call. | **Seller only.** |
| `listing_queue` | Multi-product batch in progress | `{ total, index, items, remaining }` | `MultiProductQueueRail` (`aiChatShared.tsx:676-821`) | **`LabMultiProductQueueRail`** (props `{ index, total, items, published, onJump?, onPublishAll? }`) | segmented dots (≤8) or progress bar (>8); expandable "View all N" with per-item status + tap-to-jump. **actions:** tap → `onJump(i)` → `POST /ai-chat/detect/load-product`; "Publish all ready" → `POST /ai-chat/detect/publish-batch`. **loading/empty** per item. | **Seller only.** |
| `listing_created` | `create_listing` with `confirmation:"CONFIRM CREATE"` succeeds | `{ product_id, batch_id, title, approval_status: pending\|approved, note, product_category_ids, image_count, url? }` | `ListingCreatedCard` (`aiChatShared.tsx:1103-1134`) | **`LabListingCreatedCard`** (props `{ data }`) | success badge + title + approval-status line (pending → "awaiting admin approval" copy) + "View listing" link. This is the **Published** moment (`../04-published.md`). Read-only + one nav action. | **Seller only.** |
| `listing_gate` | `create_listing` blocked, or non-seller / guest | `{ reason: "login" \| "seller_access" \| "guest_seller_capture" \| status:"needs_confirmation", missing_required, fields }` | `GateCard` (`aiChatShared.tsx:1282-1380`) | **`LabGateCard`** (props `{ reason, missingRequired? }`) | branch on `reason`: `login`→auth CTA; `seller_access`→"upgrade to seller" CTA; `guest_seller_capture`→collect contact; `needs_confirmation`→re-surface draft with missing fields highlighted (don't publish). | **Seller only** for `seller_access`/create gates. `login` variant shared. |
| `seller_summary` | `get_seller_summary` | `{ listings:[{id, title, approval_status: pending\|approved\|rejected\|archived, status: live_for_bids\|closed\|sold\|draft, created_at, bid_count, image_url}] }` or `{ status:"login_required" }` | `SellerActivityCard` (`aiChatShared.tsx`) | **`LabSellerActivityCard`** (props `{ data }`) | rows: thumb, title, dual badges (approval + live status), bid count. **empty:** "no listings yet" → CTA to start one. **gate:** login_required prompt. **action (optional):** tap → batch page. **loading:** skeleton rows. | **Seller only.** |
| `received_bids` (`bid_list` shape) | `get_bids_on_my_listings` | `{ bids:[{id, product_id, batch_id, product_name, buyer_id?(redacted), amount, status, placed_at, closes_at}] }` or `{ status:"login_required" }` | `ReceivedBidsCard` (`aiChatShared.tsx`) | **`LabReceivedBidsCard`** (props `{ data }`) | rows: product name, amount, status, time; buyer identity redacted. **empty:** "no bids received". **gate:** login prompt. Distinct from buyer `LabBidListCard` even though the wire `type` may be `bid_list` — **dispatch by message field / mode, not just `type`** (web keys the message field `receivedBids` vs `bids`). | **Seller only.** |

**Seller upload contract (mobile, reuse scanner).**
1. Pick files (native picker, `LISTING_FILE_ACCEPT`: JPG/PNG/WEBP + PDF/DOC(X)/XLS(X)/PPT(X), ≤10).
2. Upload to Node GCS: `POST /api/v1/gcs/upload` — multipart, headers `Authorization: Bearer`, `X-Refresh-Token`, `x-platform`, `x-system-key: <SYSTEM_KEY>`; body `images[]`, `sellerId`, `sessionType`, `validate:"false"`. Returns `{ image_urls, document_urls }`. **This is exactly what `useSmartDetect.ts` already does** — reuse its GCS step; do not re-implement.
3. Stream: `POST /detect/stream` with `{ conversation_id, site_type, language:"en", image_urls, document_urls }` when the detect flag is on; else `/chat/stream`.
4. Parse `stage`/`draft`/`listing_draft`/`listing_group_choice`/`listing_queue` → cards above.

**Detect vs chat routing (mobile).** Mirror web `useAIChat.ts` endpoint selection: `useDetect = hasAttachments && detectStreamEnabled()`. Add `DETECT_STREAM_ENABLED` to `src/lib/flags.ts` (seller app already has `SMART_DETECT_V2_ENABLED` — same concept). When off, attachments still upload but the turn goes to `/chat/stream` and the agent calls `detect_listing_from_images` itself (blocking, no live `draft` frames).

---

## 4. Build inventory — exists vs. must-create

### 4.1 Reuse as-is (already in the app)

| Need | Existing file | Use for |
|---|---|---|
| HTTP client + auth interceptors | `src/api/greenbidzClient.ts`, `src/api/interceptors.ts` | all chat/detect/GCS/WTB calls |
| Auth store (Zustand + MMKV) | `src/stores/authStore.ts` | `mode` resolution, sellerId, Bearer token |
| Query client | `src/lib/queryClient.ts` | non-chat REST hooks (My-Wants list, seller activity refresh) |
| SSE transport template | `src/services/scanner/smartDetectStream.ts` | copy → `labChatStream.ts` (generic `/chat|/detect` EventSource) |
| Event union template | `src/features/scanner/smartDetectStreamTypes.ts` | copy → `LabStreamEvent` (token/data/done/error/warning/heartbeat) |
| Streaming mutation pattern | `src/features/scanner/useSmartDetect.ts` | copy → `useLabChatTurn` |
| Field mapper | `src/features/scanner/mapSmartDetection.ts` | verbatim in `LabListingDraftCard` |
| Listing detail sub-cards | `src/features/scanner/components/detail/*` | inside `LabListingDraftCard` + `LabListingEditSheet` |
| Composer store | `src/features/lab/stores/composerStore.ts` | `mode` (`sell/buy`) → chat `mode` (`seller/buyer`) |
| Flags | `src/lib/flags.ts` | add `DETECT_STREAM_ENABLED`, `WTB_ENABLED` |

### 4.2 Must create (new mobile components)

**Engine (see `01-chat-architecture.md` §11 build order + `04-mobile-integration-plan.md` §1.5):** `labChatStream.ts` (EventSource), `LabStreamEvent` union, `useLabChatTurn` (send → stream → dispatch), `useLabThread` store (messages + MMKV persist, `setLast`/`applyDraftAt`/`saveWant` guards), `dispatchDataFrame(type, data)` → sets the right message field.

**Cards — shared (§1):** `LabProductCard`, `LabProductCardList`, `LabRelevanceBanner`, `LabProductDetailCard`, `LabOverviewCard`, `LabCatalogSummaryCard`, `LabBatchListCard`, `LabPlatformInfoCard`, `LabHandoffCard`, `LabToolBadges`, `LabErrorBubble`, `LabUserAttachments`.

**Cards — buyer (§2):** `LabIdentifyConfirmCard`, `LabWtbDraftCard`, `LabWtbRequestCard`, `LabWtbGateCard`, `LabWtbListCard`, `LabWtbMatchesCard`, `LabBidListCard`.

**Cards — seller (§3):** `LabListingEntryOptionsCard`, `LabListingDraftCard`, `LabListingEditSheet` (modal/bottom-sheet), `LabGroupChoiceCard`, `LabMultiProductQueueRail`, `LabListingCreatedCard`, `LabGateCard`, `LabSellerActivityCard`, `LabReceivedBidsCard`.

**Non-chat REST screens (optional, out of thread):** My-Wants list (`GET /wtb`), place-bid mutation (`POST /api/v1/buyer/bid/place`).

---

## 5. Priority for builders

1. **Engine first** — `labChatStream.ts` + `useLabChatTurn` + `dispatchDataFrame` + thread store. Nothing renders without it. (Reuse seller scanner template.)
2. **`LabProductCard` + `LabProductCardList` + `LabRelevanceBanner`** — unblocks the entire buyer search path and is reused by WTB cards.
3. **`LabListingDraftCard`** (with live `draft`-frame replace-in-place) + GCS upload reuse — the seller centerpiece; it *is* the draft screen.
4. **Buyer WTB trio** (`LabWtbDraftCard` → `LabWtbRequestCard` → `LabWtbListCard`/`LabWtbMatchesCard`) behind `WTB_ENABLED`.
5. **`LabListingEditSheet` + `LabGroupChoiceCard` + `LabMultiProductQueueRail`** — multi-product seller polish.
6. **Read-only cards** (`overview`, `catalog_summary`, `batch_list`, `platform_info`, activity/bids) — cheap, do last.
7. **`LabHandoffCard`** + support thread — after core buy/sell loops work.

---

## 6. Gotchas (mobile lens)

- **Dispatch by field, not only `type`.** `bid_list` is used for BOTH buyer `bids` and seller `received_bids`; the web disambiguates via the message field it sets. In mobile, resolve using current `mode` (buyer→`LabBidListCard`, seller→`LabReceivedBidsCard`) so the same `type` renders the right card.
- **`listing_draft` streams many times per message.** Replace-in-place at the same message index; never append a second draft card.
- **Idempotent writes.** Save-want and publish must fire once. Port the synchronous ref-guard; a re-render or double-tap must not double-create. On failure, roll back the guard so retry works.
- **Auth headers everywhere.** `/chat/stream`, `/detect/stream`, `/wtb`, GCS all need Bearer + `X-Refresh-Token`; GCS additionally needs `x-system-key`. The seller interceptor already injects these — route lab calls through the same client.
- **`site_type` is mandatory and constrained.** Never send `"all"`/`"*"` (422). Send the tenant value (`labgreenbidz`/`send` = site 2; public buyer search federates 5/2/6 server-side).
- **Heartbeats + watchdog.** Ignore `heartbeat` in UI but reset the 45s watchdog on it (scanner already does this). Detect streams can idle during PDF extraction.
- **Never crash the thread on a bad frame.** A malformed `data` payload renders the fields that parsed and drops the rest — the stream must reach `done`.
- **Flags gate whole card families.** `WTB_ENABLED` off → buyer thread has no WTB cards (search-only). `DETECT_STREAM_ENABLED` off → no live `draft` frames (agent still produces a final `listing_draft`). Ship both flags default-off, matching backend.
