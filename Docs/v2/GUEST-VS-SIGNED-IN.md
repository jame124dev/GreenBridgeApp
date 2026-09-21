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
| ~~2a Listing detail~~ | — | 🗑️ screen DELETED 2026-09-17 |
| ~~2b Place a bid~~ | — | 🗑️ screen DELETED 2026-09-17 |

**Re-verified on device 2026-09-21** (RMX2151), signed OUT — which is the state
a fresh install lands in, and the one Guideline 5.1.1(v) is about. Pressed, not
inferred:

- **6a "Scan it"** → the sign-in sheet, *"Sign in to list equipment"*, with
  Create account / I already have an account / **Keep browsing**. The way out is
  present and labelled, which is the half the 2026-08-24 rejection was about.
- **6f Account** → *"Browsing as a guest — Sign in to sell, save and message"*,
  then a plain explanation that "your listings, drafts, offers and messages live
  behind an account. Browsing and search stay open either way." Rows stay
  visible and gate on press rather than disappearing.
- **6d Matches** and **6e Messages** → their guest forks render.

The two ⚠️ rows above are gone rather than fixed: `lot.tsx` and `bid.tsx` were
DELETED on 2026-09-17. Both rendered `MOCK_LOT`, nothing navigated to either,
and bidding already works for a buyer inside the Browse WebView — so the
open question they carried ("should a guest be able to reach a bid form?")
stopped existing rather than being answered.

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

**3 · ~~2a and 2b have no guest handling at all~~ — MOOT 2026-09-17.**

Both screens were deleted, so the question dissolved rather than being answered.
Kept because the reasoning still applies to whatever replaces them.

- **2a's "Save this lot"** was local `useState` only. It persisted nothing, for
  ANYONE — a guest tapped the heart, it filled, the intent was lost, and a
  signed-in user got exactly the same nothing. Decorative in both states, which
  is worse than being gated. **If a save/watch affordance returns, it must write
  or not exist.**
- **2b was a full bid form a guest could walk into.** Nothing wrote, so no harm
  landed — but bidding is unambiguously account-based. **When a bid surface
  returns, decide the gate's position first:** ask at the lot (before the form)
  or at the bid (after a number has been typed). Asking after someone has typed
  a number is the pattern that annoys people.

Bidding today happens for a buyer inside the Browse WebView, which carries the
web's own auth — so mobile has no ungated bid path at present.

## What is NOT a gap

`browse` and `chat` having no guest branch is correct and deliberate — both are
open surfaces, and the assistant is open even for sending. The review steps
having no gate until publish is also right: the draft lives on the device, so
editing it must not require an account.
