# Screen: AI chat — `app/(lab)/chat.tsx`

The conversational assistant: buyers search, sellers can turn a conversation into a listing.
Problems below are **multi-marketplace only**. No fixes.

---

## 1 ⛔⛔ Every listing saved from chat is stamped 101lab

`app/(lab)/chat.tsx:176` builds the draft request with the **build-time** site type:

```tsx
buildLabChatDraftReq(
  chat.latestDraft,
  mode,
  getSiteType(),                 // ← the binary's own marketplace, not the item's
  useSession.getState().getConversationId(),
),
```

`getSiteType()` reads `Constants.expoConfig.extra.SITE_TYPE`
(`src/services/scanner/buildFormData.ts:290`), and **every** profile in `eas.json` pins
`"SITE_TYPE": "LabGreenbidz"` (lines 15, 36, 57). `draftReq.ts:42` writes it straight into the
payload as `site_type`.

So the value is `101lab` for every user, on every build, regardless of what the item is.

**The same item saved two ways lands in two places.** Through the scan flow it routes correctly —
`buildFormData.ts:223` takes `allowed_sites[]` from the item's marketplace, and
`createProduct.ts:25` / `createBatch.ts:32` take `?type=` from it. Through chat it does not. The
discrepancy is entirely in this screen's call.

This is the single required code change in the whole multi-marketplace programme.

---

## 2 The AI's own routing opinion is available here and unused

Chat drafts carry `site_type` — `cards.tsx:1372` explicitly does
`delete draft.site_type` before overlaying buyer edits, so the field exists on the object this
screen is working with.

The app also has a mapper for exactly this, `marketplaceFromSiteType()`
(`src/features/scanner/constants.ts:139`), used throughout the scan flow.

So the information needed to route a chat listing correctly is present on the draft and the
conversion function is already in the codebase; the screen reaches past both for the env value.

---

## 3 The seller is never asked, and never told

The scan flow treats routing as a question worth asking — `RoutingChip` exists because routing is
right only about 89% of the time, and `missingRouting()` blocks submit until it is answered.

This screen has no equivalent. There is no marketplace control in the chat listing flow, no
confirmation step, and nothing in the save confirmation (`mobile.drafts.saved` — *"Draft saved"*)
that names a destination. A seller using chat to list a network switch gets a 101lab draft with no
point at which the question is raised.

---

## 4 Search spans three marketplaces while saving targets one — in the same conversation

Buyer-side search here is federated across exactly the three marketplaces by design:
`search_products.py:154` uses `resolve_marketplace_site_ids`, which folds site ids `[5, 2, 6]` —
machines, LabGreenbidz, 101IT — into one searchable marketplace
(`greenbidz-ai-assistant/app/db/site_scope.py:70-88`). Image search inherits it by delegating to
the same implementation.

So within one chat the assistant can show a seller results from three marketplaces and then save
their own item to one. The two halves of the same screen hold different models of what "the
marketplace" means.

---

## 5 "What do you have?" answers for one marketplace while search answers for three

Not this screen's code, but it surfaces here and only here.

`get_catalog_summary.py:143` and `get_marketplace_overview.py` use the **narrow** resolver
(`resolve_site_ids`, one site) while search uses the federated one. So in a single conversation a
catalogue-size question and a search question cover different inventories, and nothing
distinguishes them to the person reading the answers.

Whether that is a bug or an intentional "this storefront's own catalogue" is an open product
question — recorded in
[`../../greenbidz-ai-assistant/UPDATES.md`](../../greenbidz-ai-assistant/UPDATES.md) §2.

---

## 6 The chat findings have not been watched happening

§1–§4 were traced through code on 2026-10-08, not observed on a device or a live conversation.
The chain is short and each link is cited, but the behaviour itself is unverified.

Worth flagging because a wrong scope is invisible in chat: a search that quietly omits two
marketplaces looks exactly like a marketplace with no matching stock, and the no-match path leads
with "save a want" rather than an error.
