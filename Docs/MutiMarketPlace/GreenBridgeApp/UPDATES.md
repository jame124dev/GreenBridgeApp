# `GreenBridgeApp/` — what has to change

The only repo in this programme with a required **code** change. Everything else here is
verification and release.

Audited 2026-10-08. See [`../README.md`](../README.md) for the programme-level picture.

---

## 1 ⛔ A listing saved from chat is always stamped 101lab

**Severity: the one real defect.** Scan routes correctly; chat does not. The same item saved two
ways lands on two different marketplaces.

### What happens

`app/(lab)/chat.tsx:176` builds the draft request with the **build-time** site type:

```tsx
buildLabChatDraftReq(
  chat.latestDraft,
  mode,
  getSiteType(),                         // ← always the binary's own marketplace
  useSession.getState().getConversationId(),
),
```

`getSiteType()` reads `Constants.expoConfig.extra.SITE_TYPE`
(`src/services/scanner/buildFormData.ts:290`), and every profile in `eas.json` pins
`"SITE_TYPE": "LabGreenbidz"` (lines 15, 36, 57). So the value is `101lab` for every user, on every
build, regardless of what the item is or what the AI decided it was.

`draftReq.ts:42` then writes it straight into the payload as `site_type`.

### Why the scan path does not have this bug

Scan treats the marketplace picker as the single source of truth and never falls back to env unless
the mapper returns empty:

- `src/services/scanner/buildFormData.ts:223` — `marketplaceToAllowedSite(item.marketplace) || opts.siteType`
- `src/services/scanner/createProduct.ts:25`, `createBatch.ts:32`, `submitGroupedListings.ts:171` —
  `marketplaceToPlatform(...) ?? siteType`

### What to do

Give the chat draft the same source of truth the scan path uses. In order of preference:

1. the marketplace the seller confirmed, if the chat flow has one;
2. otherwise the AI's `site_type` from the chat draft, mapped through
   `marketplaceFromSiteType()` (`src/features/scanner/constants.ts:139`);
3. only then `getSiteType()` as the last-resort fallback, matching `?? '101lab'` elsewhere.

Note `cards.tsx:1372` already `delete`s `draft.site_type` before overlaying buyer edits — check
that interaction before changing the payload shape, or the delete may strip the new value.

### Acceptance

Create a listing through chat for an item that is plainly 101machine or 101it, submit it, then
**read the stored row** and assert `site_id` / `allowed_sites` is the chosen marketplace and not
LabGreenbidz. A success response is not proof — fetch the artefact.

### Test to add

There is no test pinning this. Add one that asserts the chat draft request carries the chosen
marketplace, not `getSiteType()` — otherwise the next refactor silently restores the env fallback.

---

## 2 ✅ Yes — the chat fix can ship OTA, with no EAS build and no App Store submission

Checked 2026-10-08; every precondition is already met.

| precondition | state |
|---|---|
| `expo-updates` installed | `~56.0.23` |
| `updates.url` configured | `https://u.expo.dev/57cd3db7-…` (`app.config.ts:52`) |
| update check enabled in the shipped build | `checkAutomatically: 'ON_LOAD'` (`app.config.ts:92`) — restored for 1.0.1 onward |
| runtime policy | `appVersion` (`app.config.ts:94-95`) |
| shipped build's runtime / channel | **1.0.4 / `production`** (EAS build 25) |
| current `version` in `app.config.ts` | still **1.0.4** — unchanged since the shipped commit |
| the fix itself | pure TypeScript, no native code |

Because the runtime version still matches, an update published to the `production` channel today
**would reach the installed 1.0.4 binary**. Apple permits JS-only OTA updates that do not change
the app's purpose; a routing bug fix is squarely inside that.

So the shipping path is `eas update --branch <branch> --channel production`, not a build.

### ⛔ But do NOT publish from the current working tree

This is the part that matters more than the mechanics. Measured against the shipped commit
`023715f7`:

```
136 files changed, 11,601 insertions(+), 197 deletions(-)   committed since the shipped build
 34 files changed,    914 insertions(+), 330 deletions(-)   uncommitted on top
```

None of that has been through App Review or any release QA, and **the runtime version matches**,
so a careless `eas update` pushes all 11,601 lines straight onto every 1.0.4 user. The matching
runtime is what makes the fix shippable and what makes the mistake possible — same property.

Publish from a branch cut off the **shipped commit** carrying only the intended change:

```bash
git switch -c ota/chat-site-type 023715f7b230c363a7fc06e256ab7893682bb856
# apply ONLY the §1 fix
npx eas-cli@latest update --branch ota/chat-site-type --channel production \
  --message "fix: chat listings keep the chosen marketplace"
```

Confirm before publishing that `app.config.ts` still says `version: '1.0.4'` — bumping it changes
the runtime version and the update silently reaches nobody.

### What users actually experience

`ON_LOAD` fetches in the **background** and runs the new bundle on a **later** launch. So it is not
instant per user: they get it on their second launch after you publish, not their first. Plan any
"it's fixed" message around that.

### What cannot go OTA

Anything native: a new native dependency, permissions, app icon/splash, `app.config.ts` native
keys, or a `version` bump. For reference, `countries-list` — added 2026-10-08 — is pure JS and
carries no native directories, so it would not block an OTA on its own.

### Rollback

`eas update:republish` the previous update on the same channel, or `eas channel:edit` to point
`production` back at a known-good branch. Verify by relaunching twice, not once — see the timing
note above.

---

## 3 The three-marketplace picker has never been watched on a store build

Everything in §"Where it already stands" of the README was established by reading the shipped
commit and curling prod. That proves the code and the config, **not the behaviour**.

Outstanding: install the live App Store build (1.0.4), scan an item that should route to 101machine
or 101it, and confirm the picker appears, the category tree loads for that marketplace, and the
submitted row carries the right site. Until that is done, "it works" is an inference.

⚠️ The dev client on the bench is **not** a substitute — it points at `testapi` and is built from
the working tree, so it can pass while the store build fails.

---

## 4 Android is not published, so none of this reaches Android users

The Play listing page returns no title — the app is not live there. The AAB was built and
artifact-verified (versionCode 4 / 1.0.1 per the submission notes) and the listing was filled to
**draft**, with Data safety left mid-way at the types step.

So the multi-marketplace unlock is **iOS-only in users' hands today**. If the client is expecting
"mobile", that gap matters more than anything else in this document.

`<VERIFY>` the current Play Console state before planning — the submission notes are from
2026-08-13 and the App Store notes from the same period were seven weeks stale and wrong.

---

## 5 101recycle — ready in code, held on product

The `101recycle` branch of `endpointForMarketplace`
(`src/services/scanner/fetchCategories.ts:65`) is in the shipped 1.0.4 commit, with
`recycleCategoryEndpoint.test.ts` and `recycleCategoryShape.test.ts` covering it. Integration
constraint C2 is therefore satisfied and recycle needs **no app release** — only the server env.

Do not enable it on the strength of that. See the README's 101recycle section: category accuracy is
46%, the taxonomy fix was not approved, and recycle is one of the two marketplaces where the
"photo isn't clear enough" prompt concentrates.

---

## 6 Housekeeping, not blocking

- `master` is at version **0.1.0** while the live app is **1.0.4**. It is not the release branch and
  nothing is built from it. Either retire it or sync it — it has already caused one wrong answer
  about what is shipped (`MISTAKES.md`, 2026-10-08).
- Releases are built from feature branches. `eas build:list` plus the build's commit is the only
  reliable way to answer "is this shipped?"; branch names are not.
