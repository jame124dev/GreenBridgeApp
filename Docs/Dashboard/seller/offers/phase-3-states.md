# Phase 3 — states, edges and sign-off

Phase 1 proved it draws. Phase 2 proved it fetches. This proves it survives.

## States that must each be seen on the device

| State | How to force it |
|---|---|
| Loading | throttle the network, or cold-start the screen |
| Empty | an account with no records — **the empty state carries the action that fills it**, never just a way out (`UX_DESIGN_RULES.md`) |
| Error | airplane mode mid-fetch; `SectionNote` with a retry, not a dead screen |
| Longest real title | AI-written titles here run past 90 characters. `minWidth: 0` on the flex text column or the trailing element is pushed off screen |
| Missing image | a record with no photo |
| Guest | if reachable signed-out, gate through `requireAuth(reason, action)` |

## Then

- Both schemes, on glass. This design carries its structure in hairlines and
  washes, which is exactly what stops working when the ground changes.
- Every control pressed, and its effect observed. N controls means N presses.
- If the screen has a search or filter field, `FORM_INPUT_RULES.md` § 4 applies
  — measure the visible slot with the keyboard open, not just whether the
  footer clears the focused field.

## Done when

- `npx tsc --noEmit` clean, full `npx jest` with no new failures.
- The six states above have each been seen on the device.
- A screenshot of the empty state and the longest-title state is in
  `Docs/AuthScreenImg/` or alongside this file.
