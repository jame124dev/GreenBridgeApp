/**
 * Start a scan FROM INSIDE v2, landing on v2's INTAKE screen.
 *
 * ⚠️ IT LANDS ON INTAKE, NOT THE CAMERA (changed 2026-09-23, Phase 1 / P6).
 *
 * It used to `push(routes.v2Camera)` while Home's "Scan it"
 * (`SellingPane.tsx:233`) pushes `routes.v2Intake` — so the SAME action opened
 * a viewfinder from the `drafts.tsx` / `listings.tsx` empty states and the
 * two-door intake from Home. Intake is the entry point by design
 * (`routes.ts:51-60`: *"This is the entry point, not `v2Camera`"*), and it is
 * the only door that accepts a PDF or a spreadsheet — a seller whose inventory
 * arrives as a file was handed a camera and had no way through. Both callers
 * are empty states, i.e. the screens whose whole job is to not be a dead end.
 *
 * `routes.v2Camera` is untouched and still reachable from intake's photo door.
 *
 * ⚠️ DO NOT call `launchSellerScan()` from a v2 screen. It ends in
 * `router.push(routes.scanCamera)` — the OLD `/scan/camera` — so it walks a v2
 * user straight out of v2 and leaves the six v2 scan screens unreachable. That
 * was found on 2026-09-17 by pressing "Scan it" on Home and landing in the old
 * flow, and `SellingPane`'s `onScan` docblock records it at length.
 *
 * `launchSellerScan` itself is deliberately unchanged: five callers in the
 * SHIPPED UI (lab home ×2, lab chat ×2, the chat controller) must keep landing
 * in the old flow, because the old flow is what they belong to.
 *
 * ⚠️ IT DOES NOT ASK A GUEST TO SIGN IN, AND MUST NOT.
 *
 * It used to open with `requireAuth('sell', …)`, copied from `launchSellerScan`
 * back when v2 gated at the door. `SellingPane.onScan` then had that gate
 * REMOVED so a guest can photograph a machine before committing to an account —
 * matching `nextjs-port`, which gates at publish — and its docblock states it:
 * *"Scan it and type the details do NOT [gate] — they are open to a guest"*.
 *
 * This helper kept the gate, and its two callers are the EMPTY STATES of
 * `app/v2/drafts.tsx` and `app/v2/listings.tsx`, both of which render for a
 * guest (their queries are `enabled: !isGuest`, and a disabled query is not
 * loading and has no data, so it falls straight through to the empty state).
 * The same action therefore opened the camera from Home and demanded an account
 * two screens over — on the one screen whose entire job is to not be a dead end.
 *
 * The old TODO here said *"`SellingPane.onScan` still inlines this. Point it
 * here when that file is next touched"* — which would have silently RE-GATED
 * Home. Pointing it here is now safe, and is still worth doing.
 *
 * The account is asked for where it is genuinely needed: `usePublishDraft`
 * (publish) and `useSaveDraft` (save), each of which gates itself.
 *
 * So the one thing it does is FLUSH-ALWAYS — reset any half-finished scan draft
 * so the flow starts clean. Skipping it resumes an abandoned draft into a fresh
 * scan.
 *
 * `push`, not `replace`, so Back returns to wherever the scan was started.
 */
import { router } from 'expo-router';

import { useScanDraft } from '@/stores/scanDraftStore';
import { routes } from '@/lib/routes';

export function startV2Scan(): void {
  useScanDraft.getState().reset();
  // ⚑ The OLD scan flow — v2 everywhere else, previous scan (2026-09-23).
  // Same decision as `SellingPane.onScan`; see its note. Both empty states that
  // call this ("Scan an item" on v2 drafts/listings) must land where Home does,
  // or the same action means two different things one screen apart — which is
  // exactly the defect this helper was created to fix.
  router.push(routes.scanCamera);
}

/**
 * The SECOND door: describe the machine instead of photographing it.
 *
 * Home offers both ("Scan it" / "or type the details") and every empty state
 * that invites a seller to start should too — a seller at a desk, or one whose
 * nameplate is painted over, cannot use the camera at all, and a screen with a
 * single camera-shaped door is a dead end for them.
 *
 * Ungated for the same reason as `startV2Scan`, and checked rather than
 * assumed: `app/scan/listing-method.tsx` reads no profile and makes no seller
 * assumption — it is a chooser that pushes on to the camera, exactly as the
 * web's `/sell` chooser is public.
 *
 * TODO(v2-nav): it lands in the SHIPPED listing-method picker because the v2
 * manual-entry screen is not drawn. Same hand-off `SellingPane.onTypeDetails`
 * already makes, named once here so the two cannot drift.
 *
 * ⚠️ NO FLUSH, deliberately — and this is an ASYMMETRY, not a decision.
 * `SellingPane.onTypeDetails` does not reset either, so this matches Home
 * exactly, which is the point of the task. But "Scan it" flushes and "type the
 * details" does not, on both screens, so a seller with an abandoned draft gets
 * a clean start through one door and a resumed draft through the other. Adding
 * a reset here would fix half of it and put the two doors out of step again, so
 * it is reported rather than quietly changed — see the task file.
 */
export function startV2TypeDetails(): void {
  router.push(routes.scanListingMethod);
}
