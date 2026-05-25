# Implementation Plan 2 - Redesign Progress Tracking

## Checklist

- `[x]` **1. Route Mappings & Brand Helper Refactor**
  - `[x]` Update `routes.scanHome` to `'/(tabs)'` in [routes.ts](../src/lib/routes.ts).
  - `[x]` Apply lowercase normalization to lookup keys in [branding.ts](../src/theme/branding.ts).
- `[x]` **2. String Literal Cleanups**
  - `[x]` Scan and replace all hardcoded `/(tabs)/scan` literals with `routes.scanHome` in [detail.tsx](../app/scan/detail.tsx), [review.tsx](../app/scan/review.tsx), and [success.tsx](../app/scan/success.tsx).
- `[x]` **3. Re-architect Bottom Tab Navigation**
  - `[x]` Consolidate navigation screens in [_layout.tsx](../app/(tabs)/_layout.tsx) and hide text labels.
  - `[x]` Build custom `tabBarIcon` rendering focused item background capsule pills.
- `[x]` **4. Rewrite and Redesign Home Dashboard**
  - `[x]` Replace tab home with scanner dashboard in [index.tsx](../app/(tabs)/index.tsx) (moved logic from deleted `scan.tsx`).
  - `[x]` Design safe-area app bar header, initials avatar, and time-of-day greeting.
  - `[x]` Build giant circular scan button with radar expansion rings, connection indicator dot, and accessibility settings.
  - `[x]` Build Bento card grid for Saved Drafts (fast-path verification) and Recent Batches (anchor scroll-to-list action).
- `[x]` **5. Project Verification**
  - `[x]` Confirm linter passes cleanly (`npm run lint`).
  - `[x]` Confirm TypeScript compiles (`npx tsc --noEmit`).

---

## 6. Post-redesign follow-ups (2026-05-25 review)

- `[x]` **6.1 Remove ghost `scan` tab**
  - `[x]` Deleted `Tabs.Screen name="scan"` from [_layout.tsx](../app/(tabs)/_layout.tsx) after `scan.tsx` was removed (stale Expo route entry).
- `[x]` **6.2 Activity history on home**
  - `[x]` Header History icon → `routes.activityHistory` on [index.tsx](../app/(tabs)/index.tsx).
- `[x]` **6.3 Single recent-submissions query on home**
  - `[x]` [index.tsx](../app/(tabs)/index.tsx) owns `useRecentSubmissions()`; passes `query` into [RecentSubmissionsList.tsx](../src/components/scanner/RecentSubmissionsList.tsx) (`enabled: false` on internal hook when external query provided).
- `[x]` **6.4 Bento drafts UX**
  - `[x]` Hide **PENDING** badge on Saved Drafts card when `draftCount === 0`.
- `[x]` **6.5 NetInfo initial state**
  - `[x]` Hide online/offline chip until `isInternetReachable` is known (`null` → no chip; avoids false “Offline” flash).
- `[x]` **6.6 Lint / import cleanup**
  - `[x]` Remove unused import in [invalidateRecentSubmissions.ts](../src/features/scanner/invalidateRecentSubmissions.ts).
  - `[x]` Merge duplicate imports in [analyzeImages.ts](../src/services/scanner/analyzeImages.ts).
  - `[x]` `T[]` style in [fetchBatchDetail.ts](../src/services/scanner/fetchBatchDetail.ts).
- `[x]` **6.7 Docs alignment**
  - `[x]` [SCANNER_FLOW.md](./SCANNER_FLOW.md) — home path `app/(tabs)/index.tsx`, `routes.scanHome`, success CTAs.
  - `[x]` [routes.ts](../src/lib/routes.ts) — add `routes.profile`.
- `[x]` **6.8 Re-verify build**
  - `[x]` `npx tsc --noEmit` — pass.
  - `[x]` `npm run lint` — pass (0 errors).

**Note:** Regenerate Expo typed routes (`npx expo start` once) so `.expo/types/router.d.ts` drops `/(tabs)/scan`.
