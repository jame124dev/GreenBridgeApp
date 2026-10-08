# Solutions — AI chat (`app/(lab)/chat.tsx`)

Answers [`../ProblemScreen/lab-chat.md`](../ProblemScreen/lab-chat.md).

**§1 is the single required code change in the whole multi-marketplace programme**, and it ships
OTA. Everything else here is improvement or decision.

---

## 1 Stop stamping 101lab — resolve the marketplace the way the scan path does

`app/(lab)/chat.tsx:176` passes `getSiteType()`. Replace that third argument with a resolved
marketplace, in this precedence:

1. **the marketplace the seller confirmed**, if the chat listing flow has captured one (it does
   not today — see §3);
2. **the AI's own answer** — the chat draft carries `site_type` (`cards.tsx:1372` deletes it
   before overlaying buyer edits, so it is on the object), mapped through
   `marketplaceFromSiteType()` (`constants.ts:139`);
3. **`getSiteType()`** as the last-resort fallback, matching the `?? '101lab'` convention used
   throughout the scan path.

Note that `draftReq.ts` takes a `siteType: string` (`:27`) and writes it as `site_type` (`:42`),
while the scan path works in `MarketplaceKey`. Decide at the boundary which currency this function
speaks and convert once — `marketplaceToPlatform()` (`constants.ts:129`) goes key → platform
string if the payload must stay a site-type string.

### Watch the delete

`cards.tsx:1372` does `delete draft.site_type` before spreading buyer edits. If the new value is
read from the draft, read it **before** that delete runs, or the resolution silently falls through
to the fallback and the bug survives the fix while looking fixed.

### Acceptance — read the row, not the response

Create a listing through chat for something plainly 101machine or 101it, submit, then fetch the
**stored** record and assert `site_id` / `allowed_sites` is the right marketplace. A 200 is not
evidence. This is the exact failure shape the workspace has been bitten by before: a success
response from a write that stored the wrong thing.

### Test that pins it

Assert the chat draft request carries the resolved marketplace, not `getSiteType()`. Without it
the next refactor restores the env fallback and nothing fails.

---

## 2 Nothing extra needed

§2 of the problem doc is not a separate defect — it is the observation that the data and the
mapper for §1 already exist. Fixing §1 consumes it.

---

## 3 Ask the seller, or at least tell them — **DECISION**

The scan flow treats routing as a question worth asking, because it is right only ~89% of the
time. Chat asks nothing.

Options, cheapest first:

| option | what the seller sees |
|---|---|
| **tell** | the save confirmation names the destination — *"Draft saved for 101IT"* instead of *"Draft saved"* |
| **confirm** | a marketplace line in the listing card before saving, tappable to change |
| **ask** | a full `RoutingChip` equivalent in the chat listing flow |

**"Tell" is the recommended first step** — it is one string, it ships with §1, and it converts a
silent mis-route into a visible one. Whether chat should go further is a product call about how
much structure belongs in a conversational flow.

⚠️ Whatever is chosen must respect `CHATBOT_RULES.md`, which governs every AI chat surface
regardless of which one is being edited.

---

## 4 Search and save now agree

Resolved by §1. Once a chat listing routes by its own marketplace, both halves of the screen share
one model: search spans the three federated sites, saving targets the item's own.

No further work — recorded only so the inconsistency is not re-raised as a separate task.

---

## 5 Catalogue questions vs search — **DECISION, and it is not in this repo**

`get_catalog_summary.py:143` and `get_marketplace_overview.py` use the narrow resolver while
`search_products.py:154` uses the federated one.

The decision — *is "what do you have?" this storefront's catalogue, or the federated one?* — and
the change both live in `greenbidz-ai-assistant`. Full write-up in
[`../../greenbidz-ai-assistant/UPDATES.md`](../../greenbidz-ai-assistant/UPDATES.md) §2, including
the fail-closed property any change must preserve.

Flagged here because this screen is the only place a user experiences the inconsistency.

---

## 6 Verify on a real conversation before shipping

The chat findings were traced through code, not observed. Before the OTA, walk one conversation
end to end on a device: ask a question that returns results from more than one marketplace, then
save a listing, then read the stored row.

Chat is the surface where a wrong scope is invisible — a search quietly missing two marketplaces
looks exactly like a marketplace with no stock, and the no-match path leads with "save a want"
rather than an error. Code reading cannot distinguish those two outcomes; a conversation can.
