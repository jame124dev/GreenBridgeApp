# In-app account deletion — design

**Date:** 2026-08-03
**Why:** App Store Guideline 5.1.1(v). It is the one blocker standing between the 101Lab iOS
build and submission (see `Docs/APP_STORE_SUBMISSION.md` §1.1).
**Spans two repos:** `101recycle-greenbidz-backend` (API) and `GreenBridgeApp` (mobile).

## Decisions

| Question | Decision |
|---|---|
| What happens to the data | **Anonymise + disable**, retain transaction records |
| User with live listings / open orders / unpaid winning bid | **Warn with real counts, then let them proceed** |
| Architecture | Explicit anonymisation service, one Sequelize transaction |
| Re-authentication | Password re-entry required |
| Timing | Immediate — no grace period, no staff queue |

Rejected: hard-deleting the `jos_users` row (orphans financial rows — there are no FK cascades);
soft-delete flag only (that is deactivation, which Apple names explicitly as insufficient);
30-day scrub job (needs a worker plus an admin restore surface; layerable later).

## Target branch

Backend HEAD is currently `release/rbac-prod`. **Do not build on it.** Branch from `dev`:

```
git checkout dev && git checkout -b feat/account-deletion
```

Dev stack only: DB `greenbidz_test`, API `testapi.greenbidz.com`. No migration is required —
no new tables, and `gb_deleted_at` is a `jos_usermeta` row, not a column.

---

## 1. API

Both routes go in `routes/userRoutes.js` (mounted at `/api/v1/user`) behind `protect`.

**The acting user ID is read only from `req.user.id`.** No user ID is accepted from body, query
or params. This matters here more than anywhere else in the codebase: sibling routes in this
same file use the lenient `attachUser` and fall back to a client-supplied id, and `GET /profile`
takes an id outright. Copying that convention would make this endpoint "delete any account by
ID". `protect` rejects rather than falling through, so an expired token is a 401, never an
unauthenticated delete.

### `GET /api/v1/user/me/deletion-preview`

```jsonc
200 { "success": true, "data": {
        "liveListings": 3,
        "openOrders": 2,
        "unpaidWinningBids": 1,
        "activeWants": 4,
        "hasOutstanding": true
}}
```

`hasOutstanding` is computed server-side — the client never re-derives it, so the warning copy
cannot disagree with the data. Counts, with exact enum values read from the models:

| Field | Query |
|---|---|
| `liveListings` | `Batch` where `seller_id = me`, `batch_status = 'active'`, `status IN ('publish','inspection_schedule','inspection_complete','bid-schedule','live_for_bids','under_review')` |
| `openOrders` | `Order` where `(buyer_id = me OR seller_id = me)` and `status NOT IN ('delivered','cancelled','rejected')` |
| `unpaidWinningBids` | `WinnerPayment` where `status IN ('pending','failed')`, joined to `BuyerBid` on `buyer_bid_id` with `BuyerBid.buyer_id = me` — `WinnerPayment` has no user column of its own |
| `activeWants` | `ProductRequest` where `user_id = me` |

### `DELETE /api/v1/user/me`

```jsonc
// body
{ "password": "…" }        // re-authentication, NOT identification

200 { "success": true,  "data": { "deletedAt": "2026-08-03T…Z" } }
400 { "success": false, "code": "PASSWORD_REQUIRED" }
401 { "success": false, "code": "INVALID_PASSWORD" }
409 { "success": false, "code": "ADMIN_ACCOUNT" }      // staff cannot self-delete
200 { "success": true,  "data": { "alreadyDeleted": true } }   // idempotent
```

Password check uses `wpCheckPassword(password, user.user_pass)` from `helper/wpPassword.js`
directly. Not `verifyPasswordLocal(email, password)` — that helper looks the user up *by email*,
whereas here the user is already identified by the JWT and only needs their password confirmed.
No new crypto is introduced either way.

`ADMIN_ACCOUNT` guard: refuse when `jos_capabilities` parses to `administrator` or
`greenbidz_admin_role_id` is set. Self-service deletion of a staff account would silently strip
RBAC assignments; that is an admin-panel operation.

## 2. What deletion does

One `sequelize.transaction()`. Any step throwing rolls back everything — a half-anonymised
account that can still log in is the worst possible outcome.

**Tombstone `jos_users`:**

| Column | New value |
|---|---|
| `user_email` | `deleted-<ID>@deleted.101lab.co` (unique index safe) |
| `user_login` | `deleted_<ID>` (unique index safe) |
| `user_nicename` | `deleted-<ID>` |
| `display_name` | `Deleted user` |
| `user_pass` | freshly hashed random 64-byte value — unusable, not blank |
| `user_status` | `1` |

`user_pass` is randomised rather than emptied because `wpCheckPassword` against an empty hash is
not reliably a rejection.

**`jos_usermeta`** — delete these keys (enumerated from keys actually in use):
`first_name`, `last_name`, `greenbidz_phone`, `billing_phone`, `greenbidz_company`, `company`,
`seller_company`, `seller_name`, `company_tax_id_number`, `assigned_company_name`,
`assigned_company_tax_id`, `greenbidz_address_country`, `billing_country`, `greenbidz_industry`,
`greenbidz_interested_categories`, `greenbidz_last_login`.

Then set `pw_user_status` to `revoked` (so the approval gate can never re-open the account) and
insert `gb_deleted_at` = ISO timestamp (the marker every other check reads).

**Content:**

| Target | Action |
|---|---|
| Live listings (the `liveListings` set) | `batch_status = 'deactive'` — withdrawn, not deleted, matching existing `deactivateBatch` semantics. Sold/delivered/complete batches untouched |
| `jos_recycle_product_request` | deleted |
| `jos_wishlists` | deleted |
| `gb_listing_drafts` | deleted (`creator_user_id`) |
| `jos_recycle_notifications` | deleted |
| `jos_recycle_refresh_tokens` | deleted — signs the user out on every device |
| `jos_recycle_password_reset_otps` | deleted — no post-deletion password reset |
| **Orders, buyer payments, winner payments, bids, biddings** | **untouched, IDs intact** |
| `jos_recycle_conversations` / `_messages` | untouched; they render as "Deleted user" through the tombstoned `display_name`, so the counterparty keeps their thread |

**Not reused:** `deleteUsersService` in `services/Admin/AdminService.js` hard-deletes
`jos_usermeta` then `jos_users`, orphaning exactly the financial rows above. Once this service
is proven, that admin path is a candidate to switch over to it — out of scope here.

## 3. Backend files

```
services/accountDeletionService.js     NEW  getAccountDeletionPreview(userId)
                                            deleteOwnAccount({ userId, password })
controller/accountDeletionController.js NEW  thin — maps service result/codes to HTTP
routes/userRoutes.js                    EDIT +2 routes, both `protect`
__tests__/accountDeletion.test.js       NEW
```

A separate controller file rather than growing `userController.js`, which is already large and
mixes signup, login, profile and interests.

## 4. Mobile

```
src/services/account/accountDeletion.ts          NEW  API calls
src/features/settings/useAccountDeletion.ts      NEW  useDeletionPreview + useDeleteAccount
src/features/settings/DeleteAccountLink.tsx      NEW  the quiet entry row
app/(lab)/account/delete.tsx                     NEW  the confirm screen
app/(lab)/(tabs)/account.tsx                     EDIT mount the link in Security
src/i18n/locales/{en,zh-Hans,zh-Hant,ja,th,vi}.json  EDIT new mobile.profile.delete* keys
```

`DeleteAccountLink` is a shared component in `features/settings/` so the seller fork's
`app/(tabs)/profile.tsx` can adopt it in one line later. Not wired into the seller screen now —
the store build is the customer fork.

### UX

Constrained by `UX_DESIGN_RULES.md` (mandatory). The Account screen's Security section already
ends in a full-width red **Sign out** button; a second red button there would be two competing
destructive actions with equal weight, which the rules forbid. So the entry point is a quiet
text link below it, and the decision happens on its own screen with exactly one primary action.

```
Account ▸ Security                      app/(lab)/account/delete.tsx
┌──────────────────────────┐            ┌──────────────────────────────┐
│  [ Sign out ]      (red) │            │ ←  Delete your account       │
│                          │            │                              │
│      Delete account      │──tap──▶    │ What happens:                │
│      (quiet link)        │            │  • Signed out everywhere     │
└──────────────────────────┘            │  • Profile details erased    │
                                        │  • Wants & drafts removed    │
                                        │  • Live listings withdrawn   │
                                        │  Order and payment records   │
                                        │  are kept for accounting.    │
                                        │                              │
                                        │ ⚠ You have 3 live listings   │
                                        │   and 1 unpaid winning bid   │
                                        │                              │
                                        │ Password  [___________]      │
                                        ├──────────────────────────────┤
                                        │ [ Delete my account ] sticky │
                                        │         Cancel               │
                                        └──────────────────────────────┘
```

Rule-by-rule:
- **One primary action** — `Delete my account`, sticky footer, never behind a scroll. `Cancel`
  is secondary/text.
- **Adaptive to progress** — while the preview loads, an explaining line ("Checking your
  account…"), not a bare spinner. The ⚠ block renders only when `hasOutstanding`; when there is
  nothing outstanding it is absent, not an empty box.
- **Feedback** — success toast, then `router.replace('/(auth)/login')`. Never silent.
- **Error recovery** — `INVALID_PASSWORD` is an inline field error, retryable, nothing else
  lost. Network failure shows **Retry**. The button is disabled while the password is empty and
  shows a pending state during the call, so it cannot be double-submitted.
- **Progressive disclosure** — nothing about deletion appears until the user opens the screen.

Local teardown reuses the `useLogout` path (`logout()` + `useAuth.reset()`) so token, MMKV
cache and React Query state are cleared exactly as they are on sign-out. Deletion clears local
state even if the sign-out network call fails — the account is already gone server-side.

### i18n

Correction to an earlier assumption: the only existing strings are `settings.deleteAccount` and
`settings.deleteAccountWarning`, and they live in the **web** `settings.*` namespace, unused by
mobile. This flow needs a fresh `mobile.profile.delete*` set (~12 keys) authored in all six
locales: `en`, `zh-Hans`, `zh-Hant`, `ja`, `th`, `vi`. Follow the `mobile.labWants.delete*`
keys as the tone model. Both Chinese variants must be filled — there is a history of `zh`
silently falling back to English.

## 5. Testing

Jest under native ESM. Single file:
`node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/accountDeletion.test.js`.
Service layer mocked with `jest.unstable_mockModule` + dynamic `import()` per repo convention,
so no test touches a database.

| Case | Expected |
|---|---|
| Preview returns each count | counts match seeded fixtures; `hasOutstanding` true iff any > 0 |
| Preview with a clean account | all zero, `hasOutstanding: false` |
| Wrong password | 401 `INVALID_PASSWORD`, **and no mutation of any table** |
| Missing password | 400 `PASSWORD_REQUIRED` |
| Administrator account | 409 `ADMIN_ACCOUNT`, no mutation |
| Happy path | email/login/display_name tombstoned, PII meta gone, `gb_deleted_at` set, tokens deleted |
| Happy path retention | orders, payments, winning bids still resolve by ID afterwards |
| Live listings | flipped to `batch_status='deactive'`; a `sold` batch is untouched |
| A step throws mid-transaction | full rollback — user still logs in, nothing scrubbed |
| Delete twice | second call returns `alreadyDeleted: true`, no error, no double mutation |
| No user ID from the body | passing another user's id in the body does not affect whose account is deleted |

Mobile: a render test for `app/(lab)/account/delete.tsx` covering the three states (loading,
outstanding warning, clean) and that the CTA is disabled with an empty password.

## 6. Out of scope

Deliberately excluded, tracked in `Docs/APP_STORE_SUBMISSION.md`:
- `X_SYSTEM_KEY` hardening — separate security project.
- Switching the admin `deleteUsersService` to this service.
- Web (`nextjs-port`) parity for the deletion screen.
- Seller fork entry point (`app/(tabs)/profile.tsx`) — component is built to allow it.
- Google-only accounts have no password to re-enter. Mobile login is email/password
  (`loginV3`); native Google Sign-In is deferred per `Docs/AUTH.md`, so every mobile account
  has a usable password. If native Google login lands, this flow needs a re-auth alternative.
