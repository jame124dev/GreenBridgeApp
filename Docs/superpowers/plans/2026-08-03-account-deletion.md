# In-app Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user delete their own account from inside the iOS app, satisfying App Store Guideline 5.1.1(v), by anonymising the account while retaining financial records.

**Architecture:** One new backend service (`accountDeletionService.js`) does all mutation inside a single Sequelize transaction; a thin controller maps its result to HTTP; two routes on `/api/v1/user` sit behind `protect`. Mobile adds an API service, two React Query hooks, a dedicated confirm screen, and a quiet entry link on the Account tab.

**Tech Stack:** Node ESM + Sequelize/MySQL + Jest (`--experimental-vm-modules`); Expo/React Native + React Query + Zustand + react-i18next.

**Spec:** `Docs/superpowers/specs/2026-08-03-account-deletion-design.md`

## Global Constraints

- **Two repos.** Backend = `c:\Users\Pc\Desktop\greenBridge\101recycle-greenbidz-backend`. Mobile = `c:\Users\Pc\Desktop\greenBridge\GreenBridgeApp`.
- **Backend branch:** HEAD is `release/rbac-prod` — do NOT build on it. `git checkout dev && git checkout -b feat/account-deletion` before Task 1.
- **Dev stack only.** DB `greenbidz_test`, API `testapi.greenbidz.com`. Never run a prod migration. No migration is needed — `gb_deleted_at` is a `jos_usermeta` row, not a column.
- **The acting user ID comes ONLY from `req.user.id`.** No route reads a user ID from body, query or params.
- **Single test command form (backend):** `node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/<file>` — calling `jest` directly fails on `import`.
- **Mobile UI obeys `UX_DESIGN_RULES.md`** (repo root, mandatory): exactly one primary CTA, sticky on the confirm screen; explanatory loading states not bare spinners; feedback on every action; every error has recovery.
- **All six locales** must be filled: `en`, `zh-Hans`, `zh-Hant`, `ja`, `th`, `vi`. Both Chinese variants — there is a history of `zh` silently falling back to English.
- **Model import shapes** (verified): every model default-exports EXCEPT `otpModel.js`, which is `export const PasswordResetOtp`. `userModel.js` is `export { User, UserMeta }`. `config/dbConnection.js` default-exports the sequelize instance. `User` primary key is `ID`.
- **`jos_recycle_password_reset_otps` keys on `email`, not `user_id`** — capture the original email BEFORE tombstoning, or OTP rows are unreachable.
- **Password hashing:** `WPHash.HashPassword(plain)` from `wordpress-hash-node`; verification `wpCheckPassword(password, hash)` from `helper/wpPassword.js`.
- **`WinnerPayment` has no Sequelize association to `BuyerBid`** (it is commented out in the model), so no `include` — query `BuyerBid` ids first, then `WinnerPayment` by `buyer_bid_id`.
- **`hasOutstanding` = `liveListings > 0 || openOrders > 0 || unpaidWinningBids > 0`.** `activeWants` is informational and does NOT count as an obligation.

---

### Task 1: Backend — deletion preview

**Files:**
- Create: `services/accountDeletionService.js`
- Test: `__tests__/accountDeletion.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getAccountDeletionPreview(userId)` → `Promise<{liveListings:number, openOrders:number, unpaidWinningBids:number, activeWants:number, hasOutstanding:boolean}>`. Also exports the constants `LIVE_BATCH_STATUSES: string[]`, `CLOSED_ORDER_STATUSES: string[]`, `PII_META_KEYS: string[]`, `DELETED_AT_META_KEY: 'gb_deleted_at'`, and the class `AccountDeletionError` with `.code: string` and `.status: number`.

- [ ] **Step 1: Create the branch**

```bash
cd /c/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
git checkout dev
git checkout -b feat/account-deletion
git status --porcelain --untracked-files=no   # expect empty
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/accountDeletion.test.js`:

```js
import { jest } from "@jest/globals";

// Mock every model + the sequelize instance so no test touches a database.
const mockBatch = { count: jest.fn(), update: jest.fn() };
const mockOrder = { count: jest.fn() };
const mockBuyerBid = { findAll: jest.fn() };
const mockWinnerPayment = { count: jest.fn() };
const mockProductRequest = { count: jest.fn(), destroy: jest.fn() };
const mockWishlist = { destroy: jest.fn() };
const mockListingDraft = { destroy: jest.fn() };
const mockNotification = { destroy: jest.fn() };
const mockRefreshToken = { destroy: jest.fn() };
const mockOtp = { destroy: jest.fn() };
const mockUser = { findByPk: jest.fn(), update: jest.fn() };
const mockUserMeta = { destroy: jest.fn(), findAll: jest.fn(), bulkCreate: jest.fn(), update: jest.fn() };
const mockTransaction = jest.fn();

jest.unstable_mockModule("../models/batch.Model.js", () => ({ default: mockBatch }));
jest.unstable_mockModule("../models/orderModel.js", () => ({ default: mockOrder }));
jest.unstable_mockModule("../models/BuyerBidModel.js", () => ({ default: mockBuyerBid }));
jest.unstable_mockModule("../models/winnnerModel.js", () => ({ default: mockWinnerPayment }));
jest.unstable_mockModule("../models/productRequest.model.js", () => ({ default: mockProductRequest }));
jest.unstable_mockModule("../models/wishlistModel.js", () => ({ default: mockWishlist }));
jest.unstable_mockModule("../models/listingDraftModel.js", () => ({ default: mockListingDraft }));
jest.unstable_mockModule("../models/notification.model.js", () => ({ default: mockNotification }));
jest.unstable_mockModule("../models/refreshToken.model.js", () => ({ default: mockRefreshToken }));
jest.unstable_mockModule("../models/otpModel.js", () => ({ PasswordResetOtp: mockOtp }));
jest.unstable_mockModule("../models/userModel.js", () => ({ User: mockUser, UserMeta: mockUserMeta }));
jest.unstable_mockModule("../config/dbConnection.js", () => ({
  default: { transaction: mockTransaction },
}));

const { getAccountDeletionPreview } = await import("../services/accountDeletionService.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAccountDeletionPreview", () => {
  test("counts obligations and flags hasOutstanding", async () => {
    mockBatch.count.mockResolvedValue(3);
    mockOrder.count.mockResolvedValue(2);
    mockBuyerBid.findAll.mockResolvedValue([{ bid_id: 11 }, { bid_id: 12 }]);
    mockWinnerPayment.count.mockResolvedValue(1);
    mockProductRequest.count.mockResolvedValue(4);

    const preview = await getAccountDeletionPreview(7);

    expect(preview).toEqual({
      liveListings: 3,
      openOrders: 2,
      unpaidWinningBids: 1,
      activeWants: 4,
      hasOutstanding: true,
    });
  });

  test("a clean account has nothing outstanding", async () => {
    mockBatch.count.mockResolvedValue(0);
    mockOrder.count.mockResolvedValue(0);
    mockBuyerBid.findAll.mockResolvedValue([]);
    mockWinnerPayment.count.mockResolvedValue(0);
    mockProductRequest.count.mockResolvedValue(0);

    const preview = await getAccountDeletionPreview(7);

    expect(preview.hasOutstanding).toBe(false);
    expect(preview.activeWants).toBe(0);
  });

  test("active wants alone do NOT make an account outstanding", async () => {
    mockBatch.count.mockResolvedValue(0);
    mockOrder.count.mockResolvedValue(0);
    mockBuyerBid.findAll.mockResolvedValue([]);
    mockWinnerPayment.count.mockResolvedValue(0);
    mockProductRequest.count.mockResolvedValue(5);

    const preview = await getAccountDeletionPreview(7);

    expect(preview.activeWants).toBe(5);
    expect(preview.hasOutstanding).toBe(false);
  });

  test("skips the WinnerPayment query when the user has no bids", async () => {
    mockBatch.count.mockResolvedValue(0);
    mockOrder.count.mockResolvedValue(0);
    mockBuyerBid.findAll.mockResolvedValue([]);
    mockProductRequest.count.mockResolvedValue(0);

    const preview = await getAccountDeletionPreview(7);

    expect(mockWinnerPayment.count).not.toHaveBeenCalled();
    expect(preview.unpaidWinningBids).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/accountDeletion.test.js
```

Expected: FAIL — cannot find module `../services/accountDeletionService.js`.

- [ ] **Step 4: Write the minimal implementation**

Create `services/accountDeletionService.js`:

```js
// Self-service account deletion (App Store Guideline 5.1.1(v)).
//
// Anonymise-and-disable, NOT hard delete: orders, payments, bids and winner
// payments keep referencing the user ID so accounting and dispute history stay
// whole, while every piece of personal data is scrubbed. Contrast
// services/Admin/AdminService.js -> deleteUsersService, which DELETEs jos_users
// + jos_usermeta and orphans exactly those financial rows.
import { Op } from "sequelize";
import crypto from "crypto";
import WPHash from "wordpress-hash-node";

import sequelize from "../config/dbConnection.js";
import { User, UserMeta } from "../models/userModel.js";
import Batch from "../models/batch.Model.js";
import OrderModel from "../models/orderModel.js";
import BuyerBid from "../models/BuyerBidModel.js";
import WinnerPayment from "../models/winnnerModel.js";
import ProductRequest from "../models/productRequest.model.js";
import Wishlist from "../models/wishlistModel.js";
import ListingDraft from "../models/listingDraftModel.js";
import Notification from "../models/notification.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { PasswordResetOtp } from "../models/otpModel.js";

/** Batch.status values that mean "still on the market" (Batch.status ENUM). */
export const LIVE_BATCH_STATUSES = [
  "publish",
  "inspection_schedule",
  "inspection_complete",
  "bid-schedule",
  "live_for_bids",
  "under_review",
];

/** Order.status values that mean the order needs nothing further. */
export const CLOSED_ORDER_STATUSES = ["delivered", "cancelled", "rejected"];

/** jos_usermeta keys holding personal data. Deleted on account deletion. */
export const PII_META_KEYS = [
  "first_name",
  "last_name",
  "greenbidz_phone",
  "billing_phone",
  "greenbidz_company",
  "company",
  "seller_company",
  "seller_name",
  "company_tax_id_number",
  "assigned_company_name",
  "assigned_company_tax_id",
  "greenbidz_address_country",
  "billing_country",
  "greenbidz_industry",
  "greenbidz_interested_categories",
  "greenbidz_last_login",
];

export const DELETED_AT_META_KEY = "gb_deleted_at";

export class AccountDeletionError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "AccountDeletionError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Count what the user still has open, so the app can warn before deleting.
 * `hasOutstanding` is decided HERE, never re-derived by the client, so the
 * warning copy can never disagree with the numbers.
 */
export async function getAccountDeletionPreview(userId) {
  const [liveListings, openOrders, activeWants, ownBids] = await Promise.all([
    Batch.count({
      where: {
        seller_id: userId,
        batch_status: "active",
        status: { [Op.in]: LIVE_BATCH_STATUSES },
      },
    }),
    OrderModel.count({
      where: {
        [Op.or]: [{ buyer_id: userId }, { seller_id: userId }],
        status: { [Op.notIn]: CLOSED_ORDER_STATUSES },
      },
    }),
    ProductRequest.count({ where: { user_id: userId } }),
    BuyerBid.findAll({ where: { buyer_id: userId }, attributes: ["bid_id"] }),
  ]);

  // WinnerPayment has no association to BuyerBid (commented out in the model),
  // so resolve the bid ids first rather than using `include`.
  const bidIds = ownBids.map((b) => b.bid_id);
  const unpaidWinningBids = bidIds.length
    ? await WinnerPayment.count({
        where: {
          buyer_bid_id: { [Op.in]: bidIds },
          status: { [Op.in]: ["pending", "failed"] },
        },
      })
    : 0;

  return {
    liveListings,
    openOrders,
    unpaidWinningBids,
    activeWants,
    // Wants are data we delete, not an obligation — they do not gate the warning.
    hasOutstanding: liveListings > 0 || openOrders > 0 || unpaidWinningBids > 0,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/accountDeletion.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add services/accountDeletionService.js __tests__/accountDeletion.test.js
git commit -m "feat(account-deletion): preview of a user's outstanding obligations"
```

---

### Task 2: Backend — the deletion itself

**Files:**
- Modify: `services/accountDeletionService.js` (append)
- Modify: `__tests__/accountDeletion.test.js` (append)

**Interfaces:**
- Consumes: `AccountDeletionError`, `PII_META_KEYS`, `DELETED_AT_META_KEY`, `LIVE_BATCH_STATUSES`, `getAccountDeletionPreview` from Task 1.
- Produces: `deleteOwnAccount({ userId, password })` → `Promise<{deletedAt: string} | {alreadyDeleted: true}>`. Throws `AccountDeletionError` with codes `PASSWORD_REQUIRED` (400), `INVALID_PASSWORD` (401), `USER_NOT_FOUND` (404), `ADMIN_ACCOUNT` (409).

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/accountDeletion.test.js`:

```js
describe("deleteOwnAccount", () => {
  const CUSTOMER = {
    ID: 7,
    user_email: "real@example.com",
    user_pass: "$P$Bvalidhash",
  };

  /** Make the transaction callback run immediately with a fake tx handle. */
  function runTransactionInline() {
    mockTransaction.mockImplementation(async (cb) => cb({ id: "tx" }));
  }

  function seedCleanPreview() {
    mockBatch.count.mockResolvedValue(0);
    mockOrder.count.mockResolvedValue(0);
    mockBuyerBid.findAll.mockResolvedValue([]);
    mockWinnerPayment.count.mockResolvedValue(0);
    mockProductRequest.count.mockResolvedValue(0);
  }

  test("rejects a missing password without touching anything", async () => {
    const { deleteOwnAccount } = await import("../services/accountDeletionService.js");
    await expect(deleteOwnAccount({ userId: 7, password: "" })).rejects.toMatchObject({
      code: "PASSWORD_REQUIRED",
      status: 400,
    });
    expect(mockUser.update).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a wrong password and mutates nothing", async () => {
    const { deleteOwnAccount } = await import("../services/accountDeletionService.js");
    mockUser.findByPk.mockResolvedValue(CUSTOMER);
    mockUserMeta.findAll.mockResolvedValue([]);
    jest.spyOn(WPHashModule, "wpCheckPassword").mockReturnValue(false);

    await expect(deleteOwnAccount({ userId: 7, password: "wrong" })).rejects.toMatchObject({
      code: "INVALID_PASSWORD",
      status: 401,
    });
    expect(mockUser.update).not.toHaveBeenCalled();
    expect(mockUserMeta.destroy).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("refuses to delete an administrator account", async () => {
    const { deleteOwnAccount } = await import("../services/accountDeletionService.js");
    mockUser.findByPk.mockResolvedValue(CUSTOMER);
    mockUserMeta.findAll.mockResolvedValue([
      { meta_key: "jos_capabilities", meta_value: 'a:1:{s:13:"administrator";b:1;}' },
    ]);
    jest.spyOn(WPHashModule, "wpCheckPassword").mockReturnValue(true);

    await expect(deleteOwnAccount({ userId: 7, password: "right" })).rejects.toMatchObject({
      code: "ADMIN_ACCOUNT",
      status: 409,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("is idempotent — an already-deleted account short-circuits", async () => {
    const { deleteOwnAccount } = await import("../services/accountDeletionService.js");
    mockUser.findByPk.mockResolvedValue(CUSTOMER);
    mockUserMeta.findAll.mockResolvedValue([
      { meta_key: "gb_deleted_at", meta_value: "2026-08-01T00:00:00.000Z" },
    ]);

    const result = await deleteOwnAccount({ userId: 7, password: "anything" });

    expect(result).toEqual({ alreadyDeleted: true });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("tombstones the user, scrubs PII, withdraws listings and revokes tokens", async () => {
    const { deleteOwnAccount, PII_META_KEYS } = await import(
      "../services/accountDeletionService.js"
    );
    mockUser.findByPk.mockResolvedValue(CUSTOMER);
    mockUserMeta.findAll.mockResolvedValue([
      { meta_key: "jos_capabilities", meta_value: 'a:1:{s:8:"customer";b:1;}' },
    ]);
    jest.spyOn(WPHashModule, "wpCheckPassword").mockReturnValue(true);
    seedCleanPreview();
    runTransactionInline();

    const result = await deleteOwnAccount({ userId: 7, password: "right" });

    expect(result.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // jos_users tombstoned — unique columns made collision-proof by ID.
    const [userPatch] = mockUser.update.mock.calls[0];
    expect(userPatch.user_email).toBe("deleted-7@deleted.101lab.co");
    expect(userPatch.user_login).toBe("deleted_7");
    expect(userPatch.display_name).toBe("Deleted user");
    expect(userPatch.user_status).toBe(1);
    expect(userPatch.user_pass).toEqual(expect.any(String));
    expect(userPatch.user_pass).not.toBe(CUSTOMER.user_pass);
    expect(userPatch.user_pass.length).toBeGreaterThan(0);

    // PII meta removed by key.
    const piiDestroy = mockUserMeta.destroy.mock.calls.find(
      ([opts]) => opts?.where?.meta_key?.[Symbol.for("in")] ?? opts?.where?.meta_key
    );
    expect(piiDestroy).toBeDefined();

    // Live listings withdrawn, not deleted.
    const [batchPatch] = mockBatch.update.mock.calls[0];
    expect(batchPatch).toEqual({ batch_status: "deactive" });

    // Signed out everywhere; OTPs cleared by ORIGINAL email.
    expect(mockRefreshToken.destroy).toHaveBeenCalled();
    const [otpOpts] = mockOtp.destroy.mock.calls[0];
    expect(otpOpts.where.email).toBe("real@example.com");

    // Content removed.
    expect(mockProductRequest.destroy).toHaveBeenCalled();
    expect(mockWishlist.destroy).toHaveBeenCalled();
    expect(mockListingDraft.destroy).toHaveBeenCalled();
    expect(mockNotification.destroy).toHaveBeenCalled();

    // Financial records never touched — these mocks have no destroy at all.
    expect(mockOrder).not.toHaveProperty("destroy");
    expect(mockWinnerPayment).not.toHaveProperty("destroy");
  });

  test("a failure mid-transaction propagates so the tx rolls back", async () => {
    const { deleteOwnAccount } = await import("../services/accountDeletionService.js");
    mockUser.findByPk.mockResolvedValue(CUSTOMER);
    mockUserMeta.findAll.mockResolvedValue([]);
    jest.spyOn(WPHashModule, "wpCheckPassword").mockReturnValue(true);
    seedCleanPreview();
    runTransactionInline();
    mockUser.update.mockRejectedValue(new Error("db exploded"));

    await expect(deleteOwnAccount({ userId: 7, password: "right" })).rejects.toThrow("db exploded");
  });
});
```

Add this import at the top of the test file, below the existing `jest` import — the password
helper is spied on rather than mocked wholesale, so the real module stays loadable:

```js
import * as WPHashModule from "../helper/wpPassword.js";
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/accountDeletion.test.js
```

Expected: FAIL — `deleteOwnAccount is not a function`.

- [ ] **Step 3: Implement `deleteOwnAccount`**

Append to `services/accountDeletionService.js`:

```js
/** True when a WP capabilities blob names the administrator role. */
function isAdministrator(capabilitiesBlob) {
  return typeof capabilitiesBlob === "string" && /s:\d+:"administrator";b:1/.test(capabilitiesBlob);
}

/**
 * Delete the caller's own account.
 *
 * `userId` MUST come from the verified JWT (req.user.id) — never from the
 * request body. `password` re-authenticates; it never identifies.
 */
export async function deleteOwnAccount({ userId, password }) {
  if (!password) throw new AccountDeletionError("PASSWORD_REQUIRED", 400);

  const user = await User.findByPk(userId);
  if (!user) throw new AccountDeletionError("USER_NOT_FOUND", 404);

  const metaRows = await UserMeta.findAll({ where: { user_id: userId } });
  const metaByKey = new Map(metaRows.map((r) => [r.meta_key, r.meta_value]));

  // Idempotent: a second delete is a success, not an error. Checked BEFORE the
  // password test, because a deleted account's password is random by design.
  if (metaByKey.get(DELETED_AT_META_KEY)) return { alreadyDeleted: true };

  if (!wpCheckPassword(password, user.user_pass)) {
    throw new AccountDeletionError("INVALID_PASSWORD", 401);
  }

  // Staff deletion would silently strip RBAC assignments — admin-panel job.
  if (isAdministrator(metaByKey.get("jos_capabilities")) || metaByKey.get("greenbidz_admin_role_id")) {
    throw new AccountDeletionError("ADMIN_ACCOUNT", 409);
  }

  const originalEmail = user.user_email;
  const deletedAt = new Date().toISOString();

  await sequelize.transaction(async (tx) => {
    // 1. Tombstone the identity. Unique columns get the ID appended so they
    //    can never collide with another deleted account.
    await User.update(
      {
        user_email: `deleted-${userId}@deleted.101lab.co`,
        user_login: `deleted_${userId}`,
        user_nicename: `deleted-${userId}`,
        display_name: "Deleted user",
        // Random, properly hashed — NOT blank. wpCheckPassword against an
        // empty hash is not reliably a rejection.
        user_pass: WPHash.HashPassword(crypto.randomBytes(64).toString("hex")),
        user_status: 1,
      },
      { where: { ID: userId }, transaction: tx }
    );

    // 2. Scrub personal metadata.
    await UserMeta.destroy({
      where: { user_id: userId, meta_key: { [Op.in]: PII_META_KEYS } },
      transaction: tx,
    });

    // 3. Slam the approval gate shut so the account can never be re-approved.
    await UserMeta.update(
      { meta_value: "revoked" },
      { where: { user_id: userId, meta_key: "pw_user_status" }, transaction: tx }
    );

    // 4. Stamp the tombstone marker every other check reads.
    await UserMeta.bulkCreate(
      [{ user_id: userId, meta_key: DELETED_AT_META_KEY, meta_value: deletedAt }],
      { transaction: tx }
    );

    // 5. Withdraw still-on-market listings. Withdrawn, not deleted — sold and
    //    completed batches are financial records and stay exactly as they are.
    await Batch.update(
      { batch_status: "deactive" },
      {
        where: {
          seller_id: userId,
          batch_status: "active",
          status: { [Op.in]: LIVE_BATCH_STATUSES },
        },
        transaction: tx,
      }
    );

    // 6. Remove the user's own content.
    await ProductRequest.destroy({ where: { user_id: userId }, transaction: tx });
    await Wishlist.destroy({ where: { user_id: userId }, transaction: tx });
    await ListingDraft.destroy({ where: { creator_user_id: userId }, transaction: tx });
    await Notification.destroy({
      where: { [Op.or]: [{ user_id: userId }, { buyer_id: userId }, { seller_id: userId }] },
      transaction: tx,
    });

    // 7. Sign out everywhere and kill any password-reset path back in.
    await RefreshToken.destroy({ where: { user_id: userId }, transaction: tx });
    // OTPs key on email, so this MUST use the pre-tombstone address.
    await PasswordResetOtp.destroy({ where: { email: originalEmail }, transaction: tx });
  });

  return { deletedAt };
}
```

Add `wpCheckPassword` to the import block at the top of the file:

```js
import { wpCheckPassword } from "../helper/wpPassword.js";
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/accountDeletion.test.js
```

Expected: PASS, 10 tests. If the wrong-password test fails because the spy did not
apply, the import in Step 1 was omitted — `wpCheckPassword` must be spied via the
namespace import, not mocked with `unstable_mockModule`.

- [ ] **Step 5: Commit**

```bash
git add services/accountDeletionService.js __tests__/accountDeletion.test.js
git commit -m "feat(account-deletion): anonymise account in one transaction, retain financials"
```

---

### Task 3: Backend — controller and routes

**Files:**
- Create: `controller/accountDeletionController.js`
- Modify: `routes/userRoutes.js`

**Interfaces:**
- Consumes: `getAccountDeletionPreview`, `deleteOwnAccount`, `AccountDeletionError` from Tasks 1–2.
- Produces: `GET /api/v1/user/me/deletion-preview` and `DELETE /api/v1/user/me`, both requiring `Authorization: Bearer <jwt>`.

- [ ] **Step 1: Write the controller**

Create `controller/accountDeletionController.js`:

```js
// HTTP surface for self-service account deletion. Thin on purpose: all rules
// live in services/accountDeletionService.js.
//
// A separate file rather than growing controller/userController.js, which
// already mixes signup, login, profile and interests.
import {
  getAccountDeletionPreview,
  deleteOwnAccount,
  AccountDeletionError,
} from "../services/accountDeletionService.js";

export const getDeletionPreviewController = async (req, res) => {
  try {
    // req.user is set by `protect` from the verified JWT. Never req.body.
    const data = await getAccountDeletionPreview(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("[account-deletion] preview failed:", error);
    return res.status(500).json({ success: false, message: "Could not load account summary" });
  }
};

export const deleteOwnAccountController = async (req, res) => {
  try {
    const data = await deleteOwnAccount({
      userId: req.user.id,
      password: req.body?.password,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return res.status(error.status).json({ success: false, code: error.code });
    }
    console.error("[account-deletion] delete failed:", error);
    return res.status(500).json({ success: false, message: "Could not delete the account" });
  }
};
```

- [ ] **Step 2: Register the routes**

In `routes/userRoutes.js`, add to the import block near the other controller imports:

```js
import { getDeletionPreviewController, deleteOwnAccountController } from "../controller/accountDeletionController.js";
import { protect } from "../middleware/authMiddleware.js";
```

Then add the routes (place them next to `router.put("/settings", updateUserSettings);`):

```js
// Self-service account deletion (App Store Guideline 5.1.1(v)).
// `protect` — NOT `attachUser`. The sibling routes in this file fall back to a
// client-supplied id when the token is missing; here that would mean "delete any
// account by ID", so an invalid token must 401 rather than fall through.
router.get("/me/deletion-preview", protect, getDeletionPreviewController);
router.delete("/me", protect, deleteOwnAccountController);
```

- [ ] **Step 3: Verify the routes are wired and the app still boots**

```bash
node --input-type=module -e "
import('./routes/userRoutes.js').then(m => {
  const paths = m.default.stack.filter(l => l.route).map(l => Object.keys(l.route.methods)[0].toUpperCase() + ' ' + l.route.path);
  const mine = paths.filter(p => p.includes('/me'));
  console.log(mine.join('\n'));
  if (mine.length !== 2) { console.error('EXPECTED 2 ROUTES, got', mine.length); process.exit(1); }
  console.log('OK');
});
"
```

Expected: `GET /me/deletion-preview`, `DELETE /me`, then `OK`.

- [ ] **Step 4: Confirm the full backend suite still passes**

```bash
npm test
```

Expected: no NEW failures versus the pre-change baseline. Record the baseline first with
`git stash && npm test && git stash pop` if the suite already has failures.

- [ ] **Step 5: Commit**

```bash
git add controller/accountDeletionController.js routes/userRoutes.js
git commit -m "feat(account-deletion): protected preview + delete routes on /api/v1/user"
```

---

### Task 4: Mobile — API service and hooks

**Files:**
- Create: `src/services/account/accountDeletion.ts`
- Create: `src/features/settings/useAccountDeletion.ts`

**Interfaces:**
- Consumes: the two routes from Task 3; the `greenbidz` axios instance from `src/api/greenbidzClient.ts` (baseURL already includes `/api/v1`, and `src/api/interceptors.ts` already attaches `Authorization: Bearer`).
- Produces: type `DeletionPreview = {liveListings:number; openOrders:number; unpaidWinningBids:number; activeWants:number; hasOutstanding:boolean}`; `fetchDeletionPreview(): Promise<DeletionPreview>`; `deleteOwnAccount(password: string): Promise<void>`; `AccountDeletionErrorCode = 'PASSWORD_REQUIRED'|'INVALID_PASSWORD'|'ADMIN_ACCOUNT'|'UNKNOWN'`; `getAccountDeletionErrorCode(error: unknown): AccountDeletionErrorCode`; hooks `useDeletionPreview()` and `useDeleteAccount()`.

- [ ] **Step 1: Write the API service**

Create `src/services/account/accountDeletion.ts`:

```ts
import { greenbidz } from '@/api/greenbidzClient';

export type DeletionPreview = {
  liveListings: number;
  openOrders: number;
  unpaidWinningBids: number;
  activeWants: number;
  hasOutstanding: boolean;
};

export type AccountDeletionErrorCode =
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'ADMIN_ACCOUNT'
  | 'UNKNOWN';

/** Counts of what the user still has open. `hasOutstanding` is decided server-side. */
export async function fetchDeletionPreview(): Promise<DeletionPreview> {
  const res = await greenbidz.get('/user/me/deletion-preview');
  return res.data.data as DeletionPreview;
}

/**
 * Delete the signed-in user's account. The password re-authenticates — the
 * account acted on is always the one in the JWT.
 */
export async function deleteOwnAccount(password: string): Promise<void> {
  // axios needs `data` for a DELETE body.
  await greenbidz.delete('/user/me', { data: { password } });
}

/** Map an axios failure to a code the UI can turn into recovery copy. */
export function getAccountDeletionErrorCode(error: unknown): AccountDeletionErrorCode {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  if (
    code === 'PASSWORD_REQUIRED' ||
    code === 'INVALID_PASSWORD' ||
    code === 'ADMIN_ACCOUNT'
  ) {
    return code;
  }
  return 'UNKNOWN';
}
```

- [ ] **Step 2: Write the hooks**

Create `src/features/settings/useAccountDeletion.ts`:

```ts
import { useMutation, useQuery } from '@tanstack/react-query';

import {
  deleteOwnAccount,
  fetchDeletionPreview,
  type DeletionPreview,
} from '@/services/account/accountDeletion';
import { logout } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

/** Outstanding-obligation counts for the delete-account screen. */
export function useDeletionPreview() {
  return useQuery<DeletionPreview>({
    queryKey: ['account', 'deletion-preview'],
    queryFn: fetchDeletionPreview,
    staleTime: 0,
  });
}

/**
 * Delete the account, then tear down local state exactly as sign-out does.
 *
 * The teardown runs even if the logout call fails: the account is already gone
 * server-side, so leaving a token in storage would strand the user on a dead
 * session.
 */
export function useDeleteAccount() {
  const reset = useAuth((s) => s.reset);

  return useMutation({
    mutationFn: async (password: string) => {
      await deleteOwnAccount(password);
      try {
        await logout();
      } catch {
        /* server-side account is gone; local teardown below is what matters */
      }
      reset();
    },
  });
}
```

- [ ] **Step 3: Type-check**

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx tsc --noEmit
```

Expected: no errors (the project type-checks clean today, so any error is yours).

- [ ] **Step 4: Commit**

```bash
git add src/services/account/accountDeletion.ts src/features/settings/useAccountDeletion.ts
git commit -m "feat(account-deletion): mobile API service + preview/delete hooks"
```

---

### Task 5: Mobile — i18n copy in six locales

**Files:**
- Modify: `src/i18n/locales/en.json`, `zh-Hans.json`, `zh-Hant.json`, `ja.json`, `th.json`, `vi.json`

**Interfaces:**
- Produces: the `mobile.profile.delete*` and `mobile.deleteAccount.*` keys consumed by Tasks 6–7.

Add to the `mobile` object of each file. Existing `settings.deleteAccount` (web namespace) is
left alone — mobile does not read it.

- [ ] **Step 1: Add the English keys**

In `src/i18n/locales/en.json`, inside `mobile`, add a `deleteAccount` block and one
`profile.deleteAccountLink` key:

```json
"deleteAccount": {
  "link": "Delete account",
  "title": "Delete your account",
  "whatHappensTitle": "What happens",
  "bulletSignedOut": "You'll be signed out on every device",
  "bulletProfileErased": "Your name, phone and company details are erased",
  "bulletContentRemoved": "Your saved items, wants and drafts are removed",
  "bulletListingsWithdrawn": "Any listings still on the market are withdrawn",
  "retentionNote": "Order and payment records are kept for accounting and dispute purposes, as described in our Privacy Policy.",
  "checking": "Checking your account…",
  "outstandingTitle": "Before you delete",
  "outstandingListings_one": "{{count}} listing still on the market",
  "outstandingListings_other": "{{count}} listings still on the market",
  "outstandingOrders_one": "{{count}} open order",
  "outstandingOrders_other": "{{count}} open orders",
  "outstandingBids_one": "{{count}} unpaid winning bid",
  "outstandingBids_other": "{{count}} unpaid winning bids",
  "outstandingNote": "Deleting your account does not cancel money already owed. Our team will be in touch using the details on the order.",
  "passwordLabel": "Password",
  "passwordHint": "Confirm your password to continue",
  "confirmCta": "Delete my account",
  "deleting": "Deleting your account…",
  "cancel": "Cancel",
  "errorInvalidPassword": "That password is not correct. Try again.",
  "errorAdminAccount": "Staff accounts can't be deleted from the app. Contact support@greenbidz.com.",
  "errorNetwork": "We couldn't reach the server. Nothing has been deleted.",
  "retry": "Retry",
  "success": "Your account has been deleted"
}
```

- [ ] **Step 2: Add the same block to the five other locales**

`zh-Hans.json`:

```json
"deleteAccount": {
  "link": "删除帐户",
  "title": "删除您的帐户",
  "whatHappensTitle": "将会发生什么",
  "bulletSignedOut": "您将在所有设备上退出登录",
  "bulletProfileErased": "您的姓名、电话和公司信息将被清除",
  "bulletContentRemoved": "您的收藏、求购和草稿将被删除",
  "bulletListingsWithdrawn": "仍在售的商品将被撤下",
  "retentionNote": "根据我们的隐私政策，订单和付款记录将出于会计和争议处理目的予以保留。",
  "checking": "正在检查您的帐户…",
  "outstandingTitle": "删除前请注意",
  "outstandingListings_other": "{{count}} 件商品仍在售",
  "outstandingOrders_other": "{{count}} 个未完成订单",
  "outstandingBids_other": "{{count}} 个未付款的中标出价",
  "outstandingNote": "删除帐户不会取消您已欠的款项。我们的团队将通过订单上的联系方式与您联系。",
  "passwordLabel": "密码",
  "passwordHint": "请确认密码以继续",
  "confirmCta": "删除我的帐户",
  "deleting": "正在删除您的帐户…",
  "cancel": "取消",
  "errorInvalidPassword": "密码不正确，请重试。",
  "errorAdminAccount": "员工帐户无法在应用内删除，请联系 support@greenbidz.com。",
  "errorNetwork": "无法连接服务器，未删除任何内容。",
  "retry": "重试",
  "success": "您的帐户已删除"
}
```

`zh-Hant.json`:

```json
"deleteAccount": {
  "link": "刪除帳戶",
  "title": "刪除您的帳戶",
  "whatHappensTitle": "將會發生什麼",
  "bulletSignedOut": "您將在所有裝置上登出",
  "bulletProfileErased": "您的姓名、電話和公司資訊將被清除",
  "bulletContentRemoved": "您的收藏、徵求和草稿將被刪除",
  "bulletListingsWithdrawn": "仍在售的商品將被下架",
  "retentionNote": "依據我們的隱私政策，訂單與付款記錄將為會計及爭議處理目的予以保留。",
  "checking": "正在檢查您的帳戶…",
  "outstandingTitle": "刪除前請注意",
  "outstandingListings_other": "{{count}} 件商品仍在售",
  "outstandingOrders_other": "{{count}} 筆未完成訂單",
  "outstandingBids_other": "{{count}} 筆未付款的得標出價",
  "outstandingNote": "刪除帳戶不會取消您已欠的款項。我們的團隊將透過訂單上的聯絡方式與您聯繫。",
  "passwordLabel": "密碼",
  "passwordHint": "請確認密碼以繼續",
  "confirmCta": "刪除我的帳戶",
  "deleting": "正在刪除您的帳戶…",
  "cancel": "取消",
  "errorInvalidPassword": "密碼不正確，請重試。",
  "errorAdminAccount": "員工帳戶無法在應用程式內刪除，請聯絡 support@greenbidz.com。",
  "errorNetwork": "無法連線伺服器，未刪除任何內容。",
  "retry": "重試",
  "success": "您的帳戶已刪除"
}
```

`ja.json`:

```json
"deleteAccount": {
  "link": "アカウントを削除",
  "title": "アカウントを削除します",
  "whatHappensTitle": "削除すると",
  "bulletSignedOut": "すべての端末からサインアウトされます",
  "bulletProfileErased": "氏名・電話番号・会社情報は消去されます",
  "bulletContentRemoved": "保存した商品・買いたいリスト・下書きは削除されます",
  "bulletListingsWithdrawn": "出品中の商品は取り下げられます",
  "retentionNote": "注文および支払いの記録は、プライバシーポリシーに記載のとおり、会計および紛争対応の目的で保持されます。",
  "checking": "アカウントを確認しています…",
  "outstandingTitle": "削除する前にご確認ください",
  "outstandingListings_other": "出品中の商品 {{count}} 件",
  "outstandingOrders_other": "進行中の注文 {{count}} 件",
  "outstandingBids_other": "未払いの落札 {{count}} 件",
  "outstandingNote": "アカウントを削除しても、未払いの代金は取り消されません。ご注文の連絡先より担当者がご連絡いたします。",
  "passwordLabel": "パスワード",
  "passwordHint": "続行するにはパスワードを入力してください",
  "confirmCta": "アカウントを削除する",
  "deleting": "アカウントを削除しています…",
  "cancel": "キャンセル",
  "errorInvalidPassword": "パスワードが正しくありません。もう一度お試しください。",
  "errorAdminAccount": "スタッフアカウントはアプリから削除できません。support@greenbidz.com までご連絡ください。",
  "errorNetwork": "サーバーに接続できませんでした。何も削除されていません。",
  "retry": "再試行",
  "success": "アカウントを削除しました"
}
```

`th.json`:

```json
"deleteAccount": {
  "link": "ลบบัญชี",
  "title": "ลบบัญชีของคุณ",
  "whatHappensTitle": "สิ่งที่จะเกิดขึ้น",
  "bulletSignedOut": "คุณจะออกจากระบบในทุกอุปกรณ์",
  "bulletProfileErased": "ชื่อ เบอร์โทร และข้อมูลบริษัทของคุณจะถูกลบ",
  "bulletContentRemoved": "รายการที่บันทึก ประกาศต้องการซื้อ และฉบับร่างจะถูกลบ",
  "bulletListingsWithdrawn": "ประกาศขายที่ยังอยู่ในตลาดจะถูกถอนออก",
  "retentionNote": "บันทึกคำสั่งซื้อและการชำระเงินจะถูกเก็บไว้เพื่อวัตถุประสงค์ทางบัญชีและการระงับข้อพิพาท ตามที่ระบุในนโยบายความเป็นส่วนตัวของเรา",
  "checking": "กำลังตรวจสอบบัญชีของคุณ…",
  "outstandingTitle": "ก่อนที่จะลบ",
  "outstandingListings_other": "ประกาศขายที่ยังอยู่ในตลาด {{count}} รายการ",
  "outstandingOrders_other": "คำสั่งซื้อที่ยังไม่เสร็จสิ้น {{count}} รายการ",
  "outstandingBids_other": "การประมูลที่ชนะแต่ยังไม่ชำระเงิน {{count}} รายการ",
  "outstandingNote": "การลบบัญชีไม่ได้ยกเลิกยอดเงินที่ค้างชำระ ทีมงานของเราจะติดต่อคุณตามข้อมูลในคำสั่งซื้อ",
  "passwordLabel": "รหัสผ่าน",
  "passwordHint": "ยืนยันรหัสผ่านของคุณเพื่อดำเนินการต่อ",
  "confirmCta": "ลบบัญชีของฉัน",
  "deleting": "กำลังลบบัญชีของคุณ…",
  "cancel": "ยกเลิก",
  "errorInvalidPassword": "รหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง",
  "errorAdminAccount": "ไม่สามารถลบบัญชีพนักงานจากในแอปได้ โปรดติดต่อ support@greenbidz.com",
  "errorNetwork": "เราไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ยังไม่มีการลบข้อมูลใด ๆ",
  "retry": "ลองอีกครั้ง",
  "success": "บัญชีของคุณถูกลบแล้ว"
}
```

`vi.json`:

```json
"deleteAccount": {
  "link": "Xóa tài khoản",
  "title": "Xóa tài khoản của bạn",
  "whatHappensTitle": "Điều gì sẽ xảy ra",
  "bulletSignedOut": "Bạn sẽ bị đăng xuất trên mọi thiết bị",
  "bulletProfileErased": "Tên, số điện thoại và thông tin công ty của bạn sẽ bị xóa",
  "bulletContentRemoved": "Các mục đã lưu, tin cần mua và bản nháp sẽ bị xóa",
  "bulletListingsWithdrawn": "Các tin đăng còn trên sàn sẽ bị rút xuống",
  "retentionNote": "Hồ sơ đơn hàng và thanh toán được lưu giữ cho mục đích kế toán và giải quyết tranh chấp, như nêu trong Chính sách bảo mật của chúng tôi.",
  "checking": "Đang kiểm tra tài khoản của bạn…",
  "outstandingTitle": "Trước khi bạn xóa",
  "outstandingListings_other": "{{count}} tin đăng còn trên sàn",
  "outstandingOrders_other": "{{count}} đơn hàng đang mở",
  "outstandingBids_other": "{{count}} lượt đấu giá thắng chưa thanh toán",
  "outstandingNote": "Xóa tài khoản không hủy các khoản tiền bạn đang nợ. Đội ngũ của chúng tôi sẽ liên hệ theo thông tin trên đơn hàng.",
  "passwordLabel": "Mật khẩu",
  "passwordHint": "Xác nhận mật khẩu để tiếp tục",
  "confirmCta": "Xóa tài khoản của tôi",
  "deleting": "Đang xóa tài khoản của bạn…",
  "cancel": "Hủy",
  "errorInvalidPassword": "Mật khẩu không đúng. Vui lòng thử lại.",
  "errorAdminAccount": "Không thể xóa tài khoản nhân viên từ ứng dụng. Vui lòng liên hệ support@greenbidz.com.",
  "errorNetwork": "Không thể kết nối tới máy chủ. Chưa có gì bị xóa.",
  "retry": "Thử lại",
  "success": "Tài khoản của bạn đã được xóa"
}
```

- [ ] **Step 2b: Note on plurals**

`en` gets `_one` and `_other`. CJK and Thai have a single plural category, so `_other` alone is
correct and i18next resolves it for every count; Vietnamese likewise. Do not add `_one` to
those five files — an unused `_one` key is dead weight, not a bug, but keep them out.

- [ ] **Step 3: Verify every locale parses and has the full key set**

```bash
node -e "
const need = ['link','title','whatHappensTitle','bulletSignedOut','bulletProfileErased','bulletContentRemoved','bulletListingsWithdrawn','retentionNote','checking','outstandingTitle','outstandingNote','passwordLabel','passwordHint','confirmCta','deleting','cancel','errorInvalidPassword','errorAdminAccount','errorNetwork','retry','success'];
let bad = 0;
for (const l of ['en','zh-Hans','zh-Hant','ja','th','vi']) {
  const j = require('./src/i18n/locales/' + l + '.json');
  const d = j.mobile && j.mobile.deleteAccount;
  if (!d) { console.log(l, 'MISSING mobile.deleteAccount'); bad++; continue; }
  const missing = need.filter(k => !d[k]);
  const english = l !== 'en' && need.filter(k => d[k] && j.mobile.deleteAccount[k] === require('./src/i18n/locales/en.json').mobile.deleteAccount[k] && k !== 'retry');
  console.log(l, missing.length ? 'MISSING: ' + missing.join(',') : 'complete', english && english.length ? '| still-English: ' + english.join(',') : '');
  if (missing.length) bad++;
}
process.exit(bad ? 1 : 0);
"
```

Expected: every locale `complete`, exit 0, and no `still-English` list (the check catches a
copy-paste that forgot to translate).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n(account-deletion): delete-account copy in en, zh-Hans, zh-Hant, ja, th, vi"
```

---

### Task 6: Mobile — the confirm screen

**Files:**
- Create: `app/(lab)/account/delete.tsx`
- Test: `app/(lab)/account/__tests__/delete.test.tsx`

**Interfaces:**
- Consumes: `useDeletionPreview`, `useDeleteAccount` (Task 4); `getAccountDeletionErrorCode` (Task 4); the `mobile.deleteAccount.*` keys (Task 5); existing primitives `Screen`, `Text`, `Button`, `Card` from `@/components/ui/*`; `brand`, `spacing` from `@/constants/theme`; `haptics` from `@/lib/haptics`; `toast` from `sonner-native`.
- Produces: route `/(lab)/account/delete`, pushed by Task 7.

- [ ] **Step 1: Write the screen**

Create `app/(lab)/account/delete.tsx`:

```tsx
// Delete-account confirmation. Its own screen, not a sheet on the Account tab:
// UX_DESIGN_RULES requires exactly one primary action per screen, and Account
// already ends in a full-width destructive "Sign out".
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  useDeleteAccount,
  useDeletionPreview,
} from '@/features/settings/useAccountDeletion';
import { getAccountDeletionErrorCode } from '@/services/account/accountDeletion';
import { brand, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const preview = useDeletionPreview();
  const deleteMut = useDeleteAccount();

  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const submit = () => {
    if (!password || deleteMut.isPending) return;
    setErrorKey(null);
    haptics.warning();
    deleteMut.mutate(password, {
      onSuccess: () => {
        toast.success(t('mobile.deleteAccount.success'));
        router.replace('/(auth)/login');
      },
      onError: (error) => {
        const code = getAccountDeletionErrorCode(error);
        setErrorKey(
          code === 'INVALID_PASSWORD'
            ? 'mobile.deleteAccount.errorInvalidPassword'
            : code === 'ADMIN_ACCOUNT'
              ? 'mobile.deleteAccount.errorAdminAccount'
              : 'mobile.deleteAccount.errorNetwork',
        );
      },
    });
  };

  const p = preview.data;
  const outstanding = p?.hasOutstanding
    ? [
        p.liveListings > 0 &&
          t('mobile.deleteAccount.outstandingListings', { count: p.liveListings }),
        p.openOrders > 0 &&
          t('mobile.deleteAccount.outstandingOrders', { count: p.openOrders }),
        p.unpaidWinningBids > 0 &&
          t('mobile.deleteAccount.outstandingBids', { count: p.unpaidWinningBids }),
      ].filter(Boolean as unknown as (v: unknown) => v is string)
    : [];

  return (
    <Screen scroll edges={['top']} contentContainerStyle={{ paddingBottom: spacing['4xl'] }}>
      <View className="px-lg">
        <Text variant="h2" className="mt-lg mb-md">
          {t('mobile.deleteAccount.title')}
        </Text>

        {/* What happens — plain, before any input is asked for. */}
        <Card>
          <View className="gap-2 p-md">
            <Text variant="caption" tone="tertiary" className="font-bold uppercase tracking-widest">
              {t('mobile.deleteAccount.whatHappensTitle')}
            </Text>
            <Text>{`\u2022 ${t('mobile.deleteAccount.bulletSignedOut')}`}</Text>
            <Text>{`\u2022 ${t('mobile.deleteAccount.bulletProfileErased')}`}</Text>
            <Text>{`\u2022 ${t('mobile.deleteAccount.bulletContentRemoved')}`}</Text>
            <Text>{`\u2022 ${t('mobile.deleteAccount.bulletListingsWithdrawn')}`}</Text>
            <Text variant="caption" tone="tertiary" className="mt-sm">
              {t('mobile.deleteAccount.retentionNote')}
            </Text>
          </View>
        </Card>

        {/* Adaptive: an explaining loader, then the warning ONLY if it applies. */}
        {preview.isLoading ? (
          <View className="flex-row items-center mt-lg" style={{ gap: 8 }}>
            <ActivityIndicator color={brand.primary} />
            <Text tone="secondary">{t('mobile.deleteAccount.checking')}</Text>
          </View>
        ) : outstanding.length > 0 ? (
          <View
            className="mt-lg rounded-md p-md"
            style={{ backgroundColor: brand.destructiveSurface }}
            accessibilityLabel={t('mobile.deleteAccount.outstandingTitle')}
          >
            <Text className="font-bold mb-xs">{t('mobile.deleteAccount.outstandingTitle')}</Text>
            {outstanding.map((line) => (
              <Text key={line}>{`\u2022 ${line}`}</Text>
            ))}
            <Text variant="caption" tone="secondary" className="mt-sm">
              {t('mobile.deleteAccount.outstandingNote')}
            </Text>
          </View>
        ) : null}

        {/* Re-authentication. */}
        <Text variant="caption" tone="tertiary" className="mt-xl mb-xs font-bold uppercase tracking-widest">
          {t('mobile.deleteAccount.passwordLabel')}
        </Text>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errorKey) setErrorKey(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          testID="delete-account-password"
          accessibilityLabel={t('mobile.deleteAccount.passwordLabel')}
          placeholder={t('mobile.deleteAccount.passwordHint')}
          placeholderTextColor={brand.textMuted}
          className="rounded-md px-md"
          style={{ borderWidth: 1, borderColor: errorKey ? brand.destructiveStrong : brand.border, height: 48 }}
        />
        {errorKey ? (
          <Text tone="danger" variant="caption" className="mt-xs" testID="delete-account-error">
            {t(errorKey)}
          </Text>
        ) : null}
      </View>

      {/* Sticky action pair — the primary CTA is never behind a scroll. */}
      <View
        className="px-lg pt-md"
        style={{ borderTopWidth: 1, borderTopColor: brand.border, marginTop: spacing.xl }}
      >
        <Button
          label={
            deleteMut.isPending
              ? t('mobile.deleteAccount.deleting')
              : t('mobile.deleteAccount.confirmCta')
          }
          onPress={submit}
          variant="danger"
          loading={deleteMut.isPending}
          disabled={!password || deleteMut.isPending}
          fullWidth
          testID="delete-account-submit"
        />
        <Button
          label={t('mobile.deleteAccount.cancel')}
          onPress={() => router.back()}
          variant="ghost"
          fullWidth
        />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Confirm the theme tokens and Button variants used above actually exist**

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
grep -nE "destructiveSurface|destructiveStrong|border:|textMuted" src/constants/theme.ts | head
grep -nE "'danger'|'ghost'|variant" src/components/ui/Button.tsx | head
grep -nE "tone=|'danger'" src/components/ui/Text.tsx | head
```

If `brand.destructiveSurface`, the `ghost` Button variant, or `tone="danger"` on `Text` does not
exist, substitute the nearest existing token/variant rather than adding new ones — the screen
must match the existing design system, per the Consistency rule.

- [ ] **Step 3: Write the render test**

Create `app/(lab)/account/__tests__/delete.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';

const mockUseDeletionPreview = jest.fn();
const mockMutate = jest.fn();

jest.mock('@/features/settings/useAccountDeletion', () => ({
  useDeletionPreview: () => mockUseDeletionPreview(),
  useDeleteAccount: () => ({ mutate: mockMutate, isPending: false }),
}));

import DeleteAccountScreen from '../delete';

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows an explaining loader while the preview loads', () => {
  mockUseDeletionPreview.mockReturnValue({ isLoading: true, data: undefined });
  render(<DeleteAccountScreen />);
  expect(screen.getByText(/Checking your account/i)).toBeTruthy();
});

test('lists outstanding obligations when the account has them', () => {
  mockUseDeletionPreview.mockReturnValue({
    isLoading: false,
    data: {
      liveListings: 3,
      openOrders: 0,
      unpaidWinningBids: 1,
      activeWants: 2,
      hasOutstanding: true,
    },
  });
  render(<DeleteAccountScreen />);
  expect(screen.getByText(/3 listings still on the market/i)).toBeTruthy();
  expect(screen.getByText(/1 unpaid winning bid/i)).toBeTruthy();
  // openOrders is 0 — it must not render a "0 open orders" line.
  expect(screen.queryByText(/open order/i)).toBeNull();
});

test('renders no warning block for a clean account', () => {
  mockUseDeletionPreview.mockReturnValue({
    isLoading: false,
    data: {
      liveListings: 0,
      openOrders: 0,
      unpaidWinningBids: 0,
      activeWants: 0,
      hasOutstanding: false,
    },
  });
  render(<DeleteAccountScreen />);
  expect(screen.queryByText(/Before you delete/i)).toBeNull();
});

test('the delete CTA is disabled until a password is entered', () => {
  mockUseDeletionPreview.mockReturnValue({
    isLoading: false,
    data: { liveListings: 0, openOrders: 0, unpaidWinningBids: 0, activeWants: 0, hasOutstanding: false },
  });
  render(<DeleteAccountScreen />);
  expect(screen.getByTestId('delete-account-submit').props.accessibilityState.disabled).toBe(true);
});
```

- [ ] **Step 4: Run the mobile tests**

```bash
npm test -- delete.test
```

Expected: PASS, 4 tests. If `toBeTruthy` on translated text fails, the test env is not loading
`en.json` — check `jest.config.js` / `__mocks__` for how other screens' tests resolve `t()`, and
follow that existing pattern rather than inventing a new i18n mock.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add "app/(lab)/account/delete.tsx" "app/(lab)/account/__tests__/delete.test.tsx"
git commit -m "feat(account-deletion): confirm screen with obligation warning + re-auth"
```

---

### Task 7: Mobile — Account tab entry point

**Files:**
- Create: `src/features/settings/DeleteAccountLink.tsx`
- Modify: `src/features/settings/index.ts` (add the export)
- Modify: `app/(lab)/(tabs)/account.tsx:144-155` (the Security section)

**Interfaces:**
- Consumes: route `/(lab)/account/delete` (Task 6); `mobile.deleteAccount.link` (Task 5).
- Produces: `<DeleteAccountLink />`, reusable by the seller fork's `app/(tabs)/profile.tsx` later.

- [ ] **Step 1: Write the link component**

Create `src/features/settings/DeleteAccountLink.tsx`:

```tsx
// Quiet entry point to the delete-account flow.
//
// Deliberately a low-emphasis text link, NOT a second red button: the Security
// section already ends in a full-width destructive "Sign out", and two equally
// loud destructive controls violate the one-primary-action and no-duplicate-
// controls rules in UX_DESIGN_RULES.md. The weight of the decision lives on the
// confirm screen, not on this row.
import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';

export function DeleteAccountLink() {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push('/(lab)/account/delete' as unknown as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.deleteAccount.link')}
      testID="delete-account-link"
      className="items-center py-md"
      hitSlop={8}
    >
      <Text variant="caption" tone="tertiary" className="underline">
        {t('mobile.deleteAccount.link')}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Export it**

In `src/features/settings/index.ts`, add alongside the existing exports:

```ts
export { DeleteAccountLink } from './DeleteAccountLink';
```

- [ ] **Step 3: Mount it in the Security section**

In `app/(lab)/(tabs)/account.tsx`, add `DeleteAccountLink` to the existing import from
`@/features/settings`, then place it directly after the Sign out `<Button>`, inside the same
`<View className="gap-6">`:

```tsx
              <Button
                label={logoutMut.isPending ? t('mobile.profile.signingOut') : t('mobile.profile.signOut')}
                onPress={handleSignOut}
                variant="danger"
                loading={logoutMut.isPending}
                leftIcon={<LogOut color={brand.destructiveStrong} size={18} />}
                fullWidth
              />
              <DeleteAccountLink />
```

- [ ] **Step 4: Verify the route resolves and nothing regressed**

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean; test suite shows no NEW failures versus baseline.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/DeleteAccountLink.tsx src/features/settings/index.ts "app/(lab)/(tabs)/account.tsx"
git commit -m "feat(account-deletion): quiet Delete account entry in Account ▸ Security"
```

---

### Task 8: Close the loop on the submission doc

**Files:**
- Modify: `Docs/APP_STORE_SUBMISSION.md` §1.1 and §6

- [ ] **Step 1: Update §1.1**

Replace the "no in-app account deletion" blocker with a resolved note: the flow exists at
Account ▸ Security → Delete account, backed by `DELETE /api/v1/user/me`; state that it
anonymises and retains order/payment records, and that this retention is disclosed in the
privacy policy. Record that it is **live on dev only** until the backend branch is merged and
deployed.

- [ ] **Step 2: Update the App Review notes in §6**

Delete the "If shipping without in-app deletion" paragraph and replace the ACCOUNT CREATION
section's deletion sentence with:

```
ACCOUNT DELETION
Account ▸ Security ▸ Delete account. The user re-enters their password, is
shown anything still outstanding, and confirms. Personal data is erased
immediately and the account can no longer sign in. Order and payment records
are retained for accounting and dispute purposes, as disclosed in our Privacy
Policy at https://101lab.co/privacy-policy.
```

- [ ] **Step 3: Add the privacy-policy follow-up**

Add a line under §1.1 noting that `https://101lab.co/privacy-policy` must state the retention of
order/payment records after account deletion — Apple checks that the disclosure exists when an
app retains data post-deletion. This is a web content change, outside both repos.

- [ ] **Step 4: Commit**

```bash
git add Docs/APP_STORE_SUBMISSION.md
git commit -m "docs(app-store): account deletion implemented — update blocker + review notes"
```

---

## Deployment (requires explicit approval — do not run unprompted)

The backend change is on `feat/account-deletion` off `dev`. It reaches the app only once merged
to `dev` and deployed to `testapi.greenbidz.com` (pm2 `greenbidz-test-backend` :6000).

**But the iOS production build points at prod `api.101recycle.greenbidz.com`** (see `eas.json`).
So the App Store build's Delete-account button 404s until the endpoint is on `main` and deployed
to prod. Sequence: verify on dev → get explicit approval → merge to `main` → deploy → then
build for TestFlight. Never push `main` without that approval.

## Self-review notes

- Spec coverage: §1 API → Tasks 1–3. §2 anonymisation table → Task 2 Step 3. §3 backend files →
  Tasks 1–3. §4 mobile files → Tasks 4–7. §4 UX rules → Task 6 Step 1 + Task 7 Step 1. §4 i18n →
  Task 5. §5 testing → Task 1 Step 2, Task 2 Step 1, Task 6 Step 3. §6 out-of-scope items are
  not implemented, as intended.
- `hasOutstanding` is defined once, in Global Constraints, and used identically in Task 1's
  implementation, Task 1's tests and Task 6's screen.
- Names are consistent across tasks: `getAccountDeletionPreview`, `deleteOwnAccount`,
  `AccountDeletionError`, `DeletionPreview`, `fetchDeletionPreview`,
  `getAccountDeletionErrorCode`, `useDeletionPreview`, `useDeleteAccount`, `DeleteAccountLink`.
- Task 6 Step 2 is a verification step rather than an assumption because the exact theme tokens
  and Button variants were not read while planning; the plan says what to do if they differ.
