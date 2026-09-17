# Guest vs signed in — what each person should see

The canvas draws one state per screen. This is the second state, worked out
per screen from the code on 2026-09-16.

**The rule the app already follows, and should keep following:** never block at
the door. Browsing, the assistant and viewing a lot are open to everyone;
anything account-shaped asks for an identity **at the moment it is pressed**,
through `requireAuth(reason, action)`. That is not a style preference — a build
that redirected a fresh install to login was rejected by App Review on
2026-08-24 under Guideline 5.1.1(v), and the comment recording that is still in
`app/index.tsx`.

## Where each screen stands today

| Screen | Guest handling | Verdict |
|---|---|---|
| 6a Home — selling | drafts + listings hidden; Scan / type / bell gate on press | ✅ correct |
| 6b Home — buying | wants + matches hidden (in a CHILD component, so a guest never fires the authed query) | ✅ correct |
| 6c Browse | none — open to all | ✅ correct by design |
| 6d Matches | whole-screen fork, `MatchesGuest` | ✅ correct |
| 6e Messages | whole-screen fork, `MessagesGuest` | ✅ correct |
| 6f Account | inline — "Browsing as a guest" | ✅ correct |
| `/v2/chat` | none — open to all, **including sending** | ✅ deliberate |
| 7b–7e Review | none until publish (`requireAuth('publish')` on 7e) | ✅ correct — a local draft must stay editable |
| **2a Listing detail** | **none** | ⚠️ see below |
| **2b Place a bid** | **none** | ⚠️ see below |

## Three things to decide

**1 · ~~The banner is the same for both~~ — RESOLVED 2026-09-16.**

Implemented as recommended: `PromoBanner` is now wrapped in `isGuest` on both
6a and 6b, so an account sees its own drafts/wants first and a guest still gets
the pitch. Verified on device in both states; pinned by `v2Inventory.test.ts`.
The reasoning below is kept because it is why, not what.

On 6a it reads *"For sellers — Turn idle plant into capital / See what sells"*.
For a guest that is exactly right: acquisition copy, selling the idea. For an
account with 24 drafts and 20 listings it is a pitch to someone who already
bought — and it sits ABOVE their own work, pushing it down the screen.

6b has the same shape: *"Skip the valuation — we price it for you"* explains the
product to someone already using it.

Options for the signed-in slot: drop it and let drafts lead; replace it with
their own state ("2 listings in review" — we already hold that data); or keep it
but move it BELOW their content. **Recommendation: drop it.** Nothing on that
screen should outrank a seller's own drafts.

**2 · A guest's Home is very thin.**

Hero, assistant row, banner — then nothing, because both data sections are
hidden. That is the dead-space case the `v2-screen` skill warns about, and it is
the state a brand-new install actually lands in. The guest Home may deserve MORE
design attention than the signed-in one, not less: it is the first screen a new
person ever sees, and right now it is mostly empty below the fold.

**3 · 2a and 2b have no guest handling at all.**

Viewing a lot should be open — that part is right. But:

- **2a's "Save this lot"** is local `useState` only. It persists nothing, for
  ANYONE. A guest taps the heart, it fills, and the intent is lost; a signed-in
  user gets exactly the same nothing. It is decorative in both states, which is
  worse than it being gated.
- **2b is a full bid form a guest can walk into.** Nothing writes today, so no
  harm yet — but bidding is unambiguously account-based, and when the write
  lands the gate has to exist. Better to decide now whether a guest is asked at
  the lot (before the form) or at the bid (after filling it in). Asking after
  someone has typed a number is the pattern that annoys people.

## What is NOT a gap

`browse` and `chat` having no guest branch is correct and deliberate — both are
open surfaces, and the assistant is open even for sending. The review steps
having no gate until publish is also right: the draft lives on the device, so
editing it must not require an account.
