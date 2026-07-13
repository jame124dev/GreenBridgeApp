# 09 — Chat Components Coverage Report

**Audience:** the team deciding what is ready to ship and what is left to build.
**Scope:** the GreenBridge customer app `app/(lab)/` AI chat surface — every response-card renderer, the chat shell, and the buyer + seller automation loops.
**Method:** grounded in code discovery of the mobile renderers (`cards.tsx`, `cardKit.tsx`, `ChatMessage.tsx`, `chat.tsx`, `useLabTurn.ts`, `threadStore.ts`, `useTypewriter.ts`, `ThinkingDots.tsx`, `labStreamTypes.ts`), cross-checked against the web reference (`aiChatShared.tsx`, `WtbCards.tsx`, `cardActions.tsx`, `ListingEditModal.tsx`) and the assistant SSE emission catalogue (`app/tools/*`).

**Cross-links:**
- [../dynamic/02-action-component-catalog.md](../dynamic/02-action-component-catalog.md) — per-card action catalogue this report scores against.
- [../dynamic/01-chat-architecture.md](../dynamic/01-chat-architecture.md) — stream/store/turn architecture.
- [../dynamic/03-api-contract.md](../dynamic/03-api-contract.md) — SSE event and data.type contract.
- Screen specs: [01-home-tell-ai.md](../01-home-tell-ai.md), [02-processing.md](../02-processing.md), [03-draft-review.md](../03-draft-review.md), [04-published.md](../04-published.md), [05-matches-feed.md](../05-matches-feed.md), [06-match-detail.md](../06-match-detail.md), [07-deal-room.md](../07-deal-room.md).

---

## 1. Executive Summary

The mobile chat **shell** is production-grade and the **card dispatch layer** is complete and forward-compatible: `renderCard(type, data, ctx)` (`cards.tsx:962-974`) resolves against a `REGISTRY` (`cards.tsx:935-954`) keyed on the assistant's `data.type`, and unknown types degrade silently in production (`LabUnknownCard`, `cards.tsx:922-929`). Every assistant `data.type` that the Python service can emit has a mobile renderer — there are **no unhandled card types** in the fallback bucket.

**Headline coverage.** Counting the 24 assistant-emittable card types against mobile renderers:

| Dimension | Count | % |
|---|---|---|
| Assistant card types with a mobile renderer | 20 / 20 shared+lab types | 100% render coverage |
| Renderers with the **correct interactive action wired** (matches web action-for-action) | 9 / ~14 action-bearing cards | ~64% action coverage |
| End-to-end flows fully automated (compose → stream → card → action → next turn) | 6 / 11 target flows | ~55% flow automation |
| Web-only cards with **no mobile equivalent** (multi-product) | 3 (`GroupChoiceCard`, `MultiProductQueueRail`, `ListingEditModal`) | — |

**Composite readiness: roughly 70%.** The single-item buyer and seller happy paths are done; the gaps are concentrated in three areas.

**Biggest gaps (detail in §7):**
1. **Multi-product seller flow is absent on mobile.** The web app has `GroupChoiceCard` (separate vs. combine), `MultiProductQueueRail` (jump/publish-all), and their `/ai-chat/detect/*` endpoints. Mobile has none of these; a multi-item photo upload has no queue UI. This is the largest single gap.
2. **No in-place draft editor.** Web has a full `ListingEditModal` (photos, cascading category, price, condition, market metrics — `ListingEditModal.tsx:263-1323`). Mobile's `LabListingDraftCard` is **view + publish only**; every field correction must be typed as a chat message. This also affects the buyer WTB draft, which web makes editable (condition pills / budget / quantity) but mobile renders **read-only**.
3. **Read-tool result cards are display-only.** `batch_list`, `seller_activity`, `bid_list`, `received_bids`, `catalog_summary`, `platform_info` render but have zero tap affordances — no batch detail, no bid management, no deal-room entry. The deal-room screen spec ([07-deal-room.md](../07-deal-room.md)) has no chat-card on-ramp yet.

Everything below marks status honestly as **Done / Partial / Stub / Missing**.

---

## 2. Chat Shell

The shell is the strongest part of the mobile implementation. It is feature-complete and defensive.

| Capability | Status | Evidence | What works / what's thin |
|---|---|---|---|
| **Streaming / typewriter reveal** | Done | `useTypewriter.ts:19-75`, consumed by `LiveBotBubble` at `chat.tsx:302` | RAF loop reveals ~1/6 of backlog per frame, accelerates when behind, commits instantly when `settled` or reduced-motion. No added latency. Solid. |
| **Thinking indicator** | Done | `ThinkingDots.tsx:36-45`; trigger `isThinking = !revealed && !hasCards` (`chat.tsx:304`, `ChatMessage.tsx:104`) | Three staggered pulsing dots, a11y-hidden, respects reduced-motion. Only shows pre-first-token. |
| **Error + retry** | Done | `ChatMessage.tsx:117-131`; `onRetry` → `send(text)` at `chat.tsx:147-153`; error sourced from `turn.error.detail` via `turnToMessage()` (`chat.tsx:42-60`) | Destructive-tint bubble, optional `errorDetail`, GhostButton re-sends the original message when `msg.retry` is set. Thin spot: retry re-sends *text only* — if the errored turn carried attachments they are not restaged (attachments are cleared on turn open, `useLabTurn.ts:71`). |
| **Multi-turn continuity** | Done | `chat.tsx:119-144`; `conversation_id` persisted in `sessionStore` (`useLabTurn.ts:78`) | Each send opens a fresh turn on the same `conversation_id`; committed turns fold into the `messages` array via `turnToMessage()`. Single in-flight turn model (`threadStore`). |
| **Attachments** | Partial | UI `chat.tsx:264-269`; `useAttachmentPicker`; routing `useLabTurn.ts:81-131` | Camera + file picker + `AttachmentChips` staging works; upload to GCS then `/detect/stream` when `DETECT_STREAM_ENABLED` and `attachments.length>0`, else `/chat/stream`. **Thin:** no attachment *preview* before send (chips only), and detect path is flag-gated — off by default it silently falls back to text chat. |
| **Autoscroll** | Done | `chat.tsx:93-196`; pinned-to-bottom via `atBottomRef` (threshold <80px, `chat.tsx:187`); scroll-down FAB (`chat.tsx:248-258`) | Auto-scrolls on send, on content-size change while pinned, and via the scroll-down pill. Correct "don't yank the user who scrolled up" behavior. |
| **Unknown-card fallback** | Done | `LabUnknownCard` `cards.tsx:922-929` (dev-only, returns null in prod via `!__DEV__`) | Forward-compatible: a new assistant card type never crashes and is invisible in prod until a renderer ships. |
| **Per-card error boundary** | Done | `CardBoundary` `ChatMessage.tsx:162-174` | React error boundary per card → silent null on render error; a single bad frame can't take down the thread. |
| **Payload coercion** | Done | `asObj` (`cards.tsx:58-59`), `asArr` (`cards.tsx:60`), `isBlankValue` (`cardKit.tsx:63-67`) | Malformed/missing fields render empty states rather than throwing. |
| **Single-flight guard** | Done | `useLabTurn.ts:50-76` AbortController | Fast re-taps abort the previous turn; no double-send. |
| **Stage/phase events** | Stub | `threadStore.applyFrame` sets `turn.phase` on `stage` (`threadStore.ts:61`) but **no UI consumes it** | The `stage` SSE event (progress phases, e.g. detect steps) is stored but never rendered. Processing screen ([02-processing.md](../02-processing.md)) would want this. |
| **`warning` / `heartbeat` events** | Done (by design) | `threadStore.ts:79` no-op | Heartbeat is watchdog-only; warnings are intentionally swallowed. Acceptable, but warnings are never surfaced to the user. |

**Net:** shell is ready. The two shell-level follow-ups are (a) restage attachments on retry and (b) render `stage`/`phase` progress during long detect turns.

---

## 3. BUYER Operations Table

Columns: Operation | Assistant `data.type` / tool | Mobile component (file) | Interactive actions & wiring | Automation status | Notes / gaps.

| Operation | Assistant type / tool | Mobile component (file) | Interactive actions & wiring | Status | Notes / gaps |
|---|---|---|---|---|---|
| **Text product search** | `product_list` / `search_products` | `LabProductCardList` (`cards.tsx:121-159`) | Tap product row → `onSend("Tell me more about the [name].")` (`cards.tsx:148-154`) + `haptics.tap()`. Actions only in buyer mode (`cards.tsx:125`). | **Done** | Empty state "No matching items right now." (`cards.tsx:136`). Shows 5 + "+N more" footer. |
| **Image search → identify** | `product_list` + `identified` / `search_from_image` | `LabIdentifyConfirmCard` (`cards.tsx:163-192`) | "Yes, that's it" → `onSend("Yes, that's the item.")` (`cards.tsx:181`); "Something else" → `onSend("That's not quite it…")` (`cards.tsx:186`). | **Done** | Fallback when `product_list` has 0 rows but `identified.name` truthy (`cards.tsx:129`). Matches web `IdentifyConfirmCard`. |
| **Product detail** | `product` / `get_product` | `LabProductDetailCard` (`cards.tsx:196-223`) | None (read-only). | **Done (read-only)** | `found===false` → "I couldn't find that listing." (`cards.tsx:201`). No "watch"/"view on web" action (web ProductCard has Watch + Alert). |
| **Marketplace overview** | `overview` / `get_marketplace_overview` | `LabOverviewCard` (`cards.tsx:227-237`) | None. | **Done (read-only)** | Two stat tiles (Active Lots / Completed). |
| **Catalog summary** | `catalog_summary` / `get_catalog_summary` | `LabCatalogSummaryCard` (`cards.tsx:239-269`) | None. | **Partial (display-only)** | Facet chips (categories/countries/conditions) are not tappable → no "filter by this facet". |
| **Recent auctions** | `batch_list` / `get_recent_batches` | `LabBatchListCard` (`cards.tsx:273-317`) | None. | **Partial (display-only)** | No tap-to-view-batch → no bid entry. Shows closes-time as static `relTime`, **no live countdown**. |
| **My bids** | `bid_list` (mode=buyer) / `get_my_bids` | `LabBidListCard` (`cards.tsx:414-416`) | None. | **Partial (display-only)** | `login_required` → `LabGateCard` (`cards.tsx:376`). No withdraw/counter-offer. |
| **WTB draft** | `wtb_draft` / `draft_want_to_buy` | `LabWtbDraftCard` (`cards.tsx:675-720`) | "Save & alert me" → `setSaved(true)` + `haptics.success()` + `onSend("Yes, save this want and alert me about matches.")` (`cards.tsx:710-715`); idempotent guard (`cards.tsx:712`). | **Partial** | Save is wired and idempotent, but the card is **read-only on criteria** — condition/budget/quantity are display chips, not editable. Web `WtbDraftCard` (`WtbCards.tsx:69-283`) makes them editable pills/input/stepper and passes edits into the save payload. Mobile save carries no edited fields. |
| **WTB saved + matches** | `wtb_request` / `create_want_to_buy` | `LabWtbRequestCard` (`cards.tsx:722-749`) | Renders matched products as `LabProductCard` **without** `onPress` → read-only (`cards.tsx:743`). | **Partial** | Confirmation + match teaser works. No deep-link "View it in My Wants" (web `WtbCards.tsx:317-323`), matched cards not tappable. |
| **My Wants list** | `wtb_request_list` / `list_my_wants` | `LabWtbListCard` (`cards.tsx:751-793`) | "View matches" per row → `onSend("Show me matches for my want '[title]'.")` (`cards.tsx:780`) + `haptics.tap()`. | **Done** | Empty state (`cards.tsx:757-761`). Round-trips to `wtb_matches`. |
| **Matches for one want** | `wtb_matches` / `get_want_matches` | `LabWtbMatchesCard` (`cards.tsx:795-811`) | Matched products read-only (no `onPress`, `cards.tsx:805`). | **Partial** | Renders matches; cards not tappable, no relevance-score badge shown (web surfaces `score` %). |
| **WTB login gate** | `wtb_gate` / `create_want_to_buy` (login) | `LabGateCard` (registry alias, `cards.tsx:948`) | None in card — navigation handled upstream. | **Stub** | Card is a message only; no in-card "Create account" CTA (web `GateCard` links to `/auth`). Mobile relies on upstream nav that isn't shown wired. |
| **Guest lead capture** | status `guest_lead_capture` / `guest_lead_captured` (bare dict, not a card) | — (agent handles via chat text) | Agent asks for name/email in prose; user types reply. | **Done (conversational)** | No dedicated form card; handled as free-text turn. Acceptable but unvalidated (no email field). |
| **Watch / wishlist a product** | (web `ProductCardActions`, POST `/wishlist/{userId}/toggle`) | **none** | — | **Missing** | Web has a Watch button on every ProductCard (`cardActions.tsx:29-109`). Mobile product cards have no watch/wishlist action at all. |
| **Handoff to live agent** | `handoff` / `request_handoff` | `LabHandoffCard` (`cards.tsx:815-826`) | None. | **Stub** | Renders "Connecting you with a person…" message; actual handoff orchestration is upstream in the assistant. No in-window agent chat surface on mobile. |

---

## 4. SELLER Operations Table

| Operation | Assistant type / tool | Mobile component (file) | Interactive actions & wiring | Status | Notes / gaps |
|---|---|---|---|---|---|
| **Entry fork (upload vs. manual)** | `listing_entry_options` / `present_listing_options` | `LabListingEntryOptionsCard` (`cards.tsx:634-651`) | "Upload photos/documents" → `onSend("I'd like to upload photos or documents.")` (`cards.tsx:641`); "Enter details manually" → `onSend("I'll enter details manually.")` (`cards.tsx:647`). | **Done** | Both branches send follow-up turns; no internal state machine (relies on agent). Web routes "upload" to a real file picker; mobile just sends a message and expects the composer's own camera/paperclip to be used. |
| **Listing draft (centerpiece)** | `listing_draft` / `detect_listing_from_images`, `get_listing_draft`, `update_listing_draft` | `LabListingDraftCard` (`cards.tsx:490-605`) | "Publish listing" → `haptics.impact()` + `onSend('CONFIRM CREATE')` (`cards.tsx:597-598`), only when `ready_to_create===true` (`cards.tsx:592-602`). | **Partial** | Hero image, title, category/condition chips, price bar (green when set / warning chip when missing), key-field rows, completion meter (0–100%, `cards.tsx:570-589`), Draft/Ready status. **No Edit action** — web has `onEdit()` → `ListingEditModal` (PUT `/ai-chat/listing-draft`, `aiChatShared.tsx:1077-1085`). On mobile, every field fix must be typed. `update_listing_draft` exists server-side but no mobile UI drives it directly. |
| **Publish (CONFIRM CREATE)** | message → `create_listing` → `listing_created` | (driven from `LabListingDraftCard`) | `onSend('CONFIRM CREATE')` string. | **Done** | The confirm gate is a magic string, matching web. Works, but there is no explicit confirmation dialog before firing (single tap publishes). |
| **Listing created success** | `listing_created` / `create_listing` | `LabListingCreatedCard` (`cards.tsx:607-632`) | "View listing" → `Linking.openURL(url)` (`cards.tsx:621-622`) + `haptics.tap()`, safe catch. | **Done** | Shows name + Product ID + deep-link. Matches web. |
| **Seller activity / my listings** | `seller_summary` / `seller_activity` / `get_seller_summary` | `LabSellerActivityCard` (`cards.tsx:319-361`) | None. | **Partial (display-only)** | Empty state (`cards.tsx:328`). No tap-to-manage a listing. |
| **Bids received on my listings** | `received_bids` / `bid_list` (mode=seller) / `get_bids_on_my_listings` | `LabReceivedBidsCard` (`cards.tsx:417-421`) | None. | **Partial (display-only)** | Registry disambiguates by mode: seller `bid_list` or `received_bids` → `LabReceivedBidsCard`; buyer → `LabBidListCard` (`cards.tsx:967-970`). `login_required` → `LabGateCard`. **No accept/counter/decline** — this is the deal-room on-ramp that's missing (see [07-deal-room.md](../07-deal-room.md)). |
| **Seller access gate** | `listing_gate` / `detect_listing_from_images` (reason=`seller_access` or `login`) | `LabGateCard` (`cards.tsx:655-671`) | None in card. | **Stub** | Renders "Seller access required" / "Create a free account"; no in-card CTA button (nav upstream). |
| **Multi-product: group choice** | `listing_group_choice` (web) / `/ai-chat/detect/split-products`\|`combine-products` | **none** | — | **Missing** | Web `GroupChoiceCard` (`aiChatShared.tsx:619-663`) asks "Separate listings vs. One product". No mobile renderer; assistant may emit it and mobile would drop it via `LabUnknownCard`. |
| **Multi-product: queue rail** | `listing_queue` (web) / `/ai-chat/detect/load-product`, `publish-batch` | **none** | — | **Missing** | Web `MultiProductQueueRail` (`aiChatShared.tsx:676-821`) does jump-to-item, publish-all-ready, per-item status. Mobile has no queue concept; a multi-item photo can't be worked as N drafts. |
| **Full-form draft editor** | (client modal over `listing_draft`) | **none** | — | **Missing** | Web `ListingEditModal` (`ListingEditModal.tsx:263-1323`): photos grid, cascading category, price/condition/currency/duration, market metrics, changed-fields PUT. No mobile equivalent — biggest seller-quality gap after multi-product. |

---

## 5. Coverage Matrix — Mobile vs. Web vs. Assistant

Rows are assistant `data.type` emissions (from the SSE catalogue). "Mobile" = has a `cards.tsx` renderer. "Web" = has a component in the web reference.

| Assistant `data.type` | Assistant tool | Web component | Mobile renderer (file) | Parity verdict |
|---|---|---|---|---|
| `product_list` | `search_products` | ProductCard grid | `LabProductCardList` (`cards.tsx:121-159`) | Mobile ✓ — tap-to-ask, but no Watch action (web has it) |
| `identified` (in `product_list`) | `search_from_image` | `IdentifyConfirmCard` | `LabIdentifyConfirmCard` (`cards.tsx:163-192`) | Full parity |
| `search_from_image_error` | `search_from_image` | (inline text) | (no dedicated card; agent text) | Acceptable — both handle via prose |
| `product` | `get_product` | ProductCard detail | `LabProductDetailCard` (`cards.tsx:196-223`) | Mobile read-only; web has actions |
| `overview` | `get_marketplace_overview` | inline | `LabOverviewCard` (`cards.tsx:227-237`) | Full parity (read-only both) |
| `catalog_summary` | `get_catalog_summary` | inline facets | `LabCatalogSummaryCard` (`cards.tsx:239-269`) | Parity (display-only both) |
| `batch_list` | `get_recent_batches` | batch list | `LabBatchListCard` (`cards.tsx:273-317`) | Parity display; neither has live countdown |
| `platform_info` | `get_platform_info` | inline structured | `LabPlatformInfoCard` (`cards.tsx:425-459`) | Full parity |
| `bid_list` (buyer) | `get_my_bids` | bid list | `LabBidListCard` (`cards.tsx:414-416`) | Parity (display-only) |
| `received_bids` / `bid_list` (seller) | `get_bids_on_my_listings` | received bids | `LabReceivedBidsCard` (`cards.tsx:417-421`) | Parity (display-only); no bid mgmt either side |
| `seller_summary` | `get_seller_summary` | seller rows | `LabSellerActivityCard` (`cards.tsx:319-361`) | Parity (display-only) |
| `wtb_draft` | `draft_want_to_buy` | `WtbDraftCard` (editable) | `LabWtbDraftCard` (`cards.tsx:675-720`) | **Mobile weaker** — read-only criteria vs. web editable pills/budget/qty |
| `wtb_request` | `create_want_to_buy` | `WtbRequestCard` | `LabWtbRequestCard` (`cards.tsx:722-749`) | Mobile lacks deep-link + tappable matches |
| `wtb_request_list` | `list_my_wants` | `WtbListCard` | `LabWtbListCard` (`cards.tsx:751-793`) | Full parity (view-matches wired) |
| `wtb_matches` | `get_want_matches` | `WtbMatchesCard` (score badges) | `LabWtbMatchesCard` (`cards.tsx:795-811`) | Mobile lacks score % + tappable cards |
| `wtb_gate` | `create_want_to_buy` (login) | `GateCard` (CTA link) | `LabGateCard` (`cards.tsx:948`) | Mobile lacks in-card CTA |
| `listing_entry_options` | `present_listing_options` | `ListingEntryOptionsCard` | `LabListingEntryOptionsCard` (`cards.tsx:634-651`) | Parity (mobile "upload" defers to composer picker) |
| `listing_draft` | `detect_listing_from_images` etc. | `ListingDraftCard` + `ListingEditModal` | `LabListingDraftCard` (`cards.tsx:490-605`) | **Mobile weaker** — view+publish only, no edit modal |
| `listing_gate` | `detect_listing_from_images` | `GateCard` | `LabGateCard` (`cards.tsx:655-671`) | Mobile lacks in-card CTA |
| `listing_created` | `create_listing` | `ListingCreatedCard` | `LabListingCreatedCard` (`cards.tsx:607-632`) | Full parity |
| `handoff` | `request_handoff` | (handoff surface) | `LabHandoffCard` (`cards.tsx:815-826`) | Mobile message-only stub |
| **`listing_group_choice`** | `/detect/split`\|`combine` | `GroupChoiceCard` | **— (falls back)** | **Web-only** — mobile drops via `LabUnknownCard` |
| **`listing_queue`** | `/detect/load-product`, `publish-batch` | `MultiProductQueueRail` | **— (falls back)** | **Web-only** — mobile has no queue |

**Unhandled on mobile (silently dropped in prod):** any multi-product frame (`listing_group_choice`, `listing_queue`). Every other type has a renderer. There are **no cards mobile handles that web does not**; mobile is a strict subset.

---

## 6. Automation Assessment — End-to-End Flows

For each flow: is it **fully automated** (compose → stream → card → action → next turn, no manual detours) or does it need manual steps / is it stubbed?

| Flow | Path | Status | Where it breaks |
|---|---|---|---|
| **Multi-turn conversation** | `send()` → `useLabTurn.start()` → `labStream` SSE → `threadStore.applyFrame` → commit (`chat.tsx:119-144`, `threadStore.ts:47-81`) | **Fully automated** | — |
| **Text product search → refine** | search → `product_list` → tap row → "Tell me more" turn | **Fully automated** | — |
| **Image search → identify → refine** | attach photo → detect/search → `identified` → Yes/No → next turn | **Fully automated** (when `DETECT_STREAM_ENABLED`) | Flag-gated; off by default falls back to text (`useLabTurn.ts:81`). |
| **WTB draft → save → matches** | `wtb_draft` → "Save & alert me" → `wtb_request`/`wtb_request_list` → "View matches" → `wtb_matches` | **Automated but lossy** | Save sends a fixed string with **no edited criteria** — buyer cannot adjust budget/condition/qty before saving on mobile (web can). Functionally saves, but not the *edited* want. |
| **Seller: upload → detect → draft → publish** | entry options → photo upload → `/detect/stream` → `listing_draft` → "Publish" → `CONFIRM CREATE` → `listing_created` | **Automated for a single, complete draft** | If the draft is missing fields, there is **no edit affordance** — the seller must correct via chat prose (no `ListingEditModal`). Publish is a single tap with no confirm dialog. |
| **Seller: multi-product upload** | multi-item photo → `listing_group_choice` → `listing_queue` → per-item drafts → publish-batch | **Missing** | No mobile renderer for group choice or queue; the whole multi-item automation is absent. |
| **Publish CONFIRM CREATE** | `onSend('CONFIRM CREATE')` → `create_listing` → `listing_created` (`cards.tsx:598`) | **Automated** | Works; magic-string coupling to the agent. |
| **Error → retry** | `turn.status='error'` → error bubble → Retry → `send(text)` (`chat.tsx:147-153`) | **Automated** | Retry loses attachments (text-only re-send). |
| **Login/seller gate → auth → resume** | gate card rendered; nav upstream | **Stubbed** | Gate cards have no in-card CTA (`LabGateCard`); the auth round-trip and resume-into-chat is not wired in the discovered code. |
| **Handoff to live agent** | `handoff` card message | **Stubbed** | Message-only; no in-window agent conversation surface on mobile. |
| **Deal-room realtime** | (seller bid → deal room) | **Missing** | No chat-card on-ramp to the deal-room screen ([07-deal-room.md](../07-deal-room.md)); `received_bids` is display-only, no accept/counter, no realtime channel. |

**Summary:** 6 of 11 flows are fully automated end-to-end. WTB-save and single-item seller-publish are automated but degraded (no editing). Multi-product, gate-resume, handoff, and deal-room are the four not-automated flows.

---

## 7. Gaps & Recommendations (Prioritized)

Ranked by impact on shippable automation. Each item names the missing/weak component and the concrete next build.

### P0 — Blocks a whole seller journey
1. **Multi-product seller flow (Missing).** Build `LabGroupChoiceCard` (separate vs. combine → POST `/ai-chat/detect/split-products`|`combine-products`) and `LabQueueRail` (jump-to-item, publish-all-ready → `/detect/load-product`, `/detect/publish-batch`). Register both in `REGISTRY` and add `listing_group_choice` / `listing_queue` to `LabCardType`. Until then, any seller who photographs more than one item hits a dead end (frame silently dropped). Ref web: `aiChatShared.tsx:619-663`, `676-821`.

### P1 — Degrades a working flow
2. **In-place draft editor (Missing → Partial fix).** Add an edit affordance to `LabListingDraftCard` opening a mobile draft editor (photos, category, condition, price, currency, duration) that PUTs changed fields to `/ai-chat/listing-draft` and re-renders the card. Without it, field correction is chat-prose only. Ref web: `ListingEditModal.tsx:263-1323`; hook point `cards.tsx:490-605`. Aligns with [03-draft-review.md](../03-draft-review.md).
3. **Editable WTB draft (Partial fix).** Make `LabWtbDraftCard` criteria editable (condition pills, budget input, quantity stepper) and thread the edits into the save payload instead of the fixed `"Yes, save this want…"` string. Ref web `WtbCards.tsx:69-283`; hook point `cards.tsx:675-720`.

### P2 — Missing buyer conversions & navigation
4. **Product Watch / wishlist action (Missing).** Add a Watch button to `LabProductCardList` / `LabProductDetailCard` rows (POST `/wishlist/{userId}/toggle`) plus an "Alert me for more" → createWant, mirroring web `cardActions.tsx:29-109`. High-value, low-effort buyer conversion.
5. **Tappable match/product cards + score badges.** In `LabWtbRequestCard` and `LabWtbMatchesCard`, pass `onPress` to the rendered product cards and surface the relevance `score` %. Currently read-only (`cards.tsx:743`, `805`).
6. **Deep-link "View in My Wants".** Add the web deep-link CTA to `LabWtbRequestCard` (web `WtbCards.tsx:317-323`) → matches feed ([05-matches-feed.md](../05-matches-feed.md)).

### P3 — Gate & handoff completion
7. **In-card gate CTA + auth resume (Stub → Done).** Give `LabGateCard` a "Create account / Sign in" button that routes to auth and resumes the chat turn on return. Applies to `wtb_gate`, `listing_gate`. Currently message-only.
8. **Live-agent handoff surface (Stub).** Wire `LabHandoffCard` to a real in-window agent conversation (or at least a status/poll indicator), mirroring the web handoff work.

### P4 — Read-tool interactivity & realtime
9. **Batch detail + bid entry (Partial → Done).** Make `LabBatchListCard` rows tappable to a batch detail / place-bid surface. Add a live countdown (currently static `relTime`).
10. **Bid management + deal-room on-ramp (Missing).** Add accept/counter/decline actions to `LabReceivedBidsCard` and a tap-through to the deal room ([07-deal-room.md](../07-deal-room.md)); wire the realtime channel. No deal-room chat on-ramp exists today.
11. **Facet filtering.** Make `LabCatalogSummaryCard` facet chips tappable to re-query by category/country/condition.

### P5 — Shell polish
12. **Render `stage`/`phase` progress.** `turn.phase` is stored (`threadStore.ts:61`) but unused; surface it during long detect turns per [02-processing.md](../02-processing.md).
13. **Restage attachments on retry.** Retry currently re-sends text only; preserve attachments for failed detect turns.
14. **Attachment preview before send.** Chips exist; add tap-to-preview.

---

## Appendix — Status Legend & Counts

- **Done** — renders and its primary action is wired and works end-to-end.
- **Partial** — renders and is useful, but an expected action is read-only, degraded, or flag-gated.
- **Stub** — renders a placeholder/message; the real behavior lives upstream or is not wired.
- **Missing** — no mobile component; assistant frame would be dropped by `LabUnknownCard`.

**Buyer cards:** 6 Done, 6 Partial, 2 Stub, 1 Missing (Watch).
**Seller cards:** 3 Done, 3 Partial, 1 Stub, 3 Missing (group-choice, queue, edit-modal).
**Shell:** 9 Done, 1 Partial (attachments), 1 Stub (stage rendering).

*All line citations reference the discovery snapshot of `app/(lab)/` chat sources; verify against the current tree before implementation.*
