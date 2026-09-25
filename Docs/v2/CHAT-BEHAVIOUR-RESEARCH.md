# v2 assistant — keyboard and thread behaviour vs ChatGPT / Gemini

> **Who this is for:** whoever decides what changes in the v2 assistant, and
> whoever implements it. Researched and measured 2026-09-21.

Three kinds of claim appear below and they are marked differently:

- **Measured** — pressed on the handset (RMX2151, 1080×2400) today, screenshot on file.
- **Code** — read in this repo, cited `file:line`.
- **Source** — a published page **I opened**. See the note below.

> ⚠️ **On the sources.** The first version of this doc cited eleven pages and I
> had opened two of them; the rest were summarised by the search tool. On
> re-reading, one load-bearing claim turned out to be attributed to two articles
> that do not make it, and it has been withdrawn (§ "Scroll during streaming").
> Every source still cited below has now been opened, except one that returns
> 403 and is marked as unreadable. A search summary is a lead, not a citation.

---

## 1 · What our assistant does today

Measured on device, guest, v2 assistant opened from Home's "Ask the assistant" row.

| behaviour | ours | verdict |
|---|---|---|
| Keyboard when the screen opens | stays **down** | ⚠️ see §3.1 |
| Composer position | pinned above the keyboard | ✅ |
| Tab bar while typing | collapses, returns on dismiss | ✅ |
| Keyboard after sending | **stays open** | ✅ matches every messaging app |
| Swipe down on the thread | dismisses the keyboard (`keyboardDismissMode="on-drag"`, [chat.tsx:618](../../app/v2/chat.tsx#L618)) | ✅ |
| Empty state | title, one line of explanation, three tappable openers, Selling/Buying tabs | ✅ |
| Openers while the keyboard is up | **all three stay visible** | ✅ and load-bearing — see §3.1 |
| Leave the screen and come back | **the whole thread is gone** | ❌ §3.2 |
| Scroll-to-bottom control | **none** | ❌ §3.3 |
| Your own message pinned while the answer streams | **no** | ❌ §3.3 |
| Follow-the-stream band | fixed 80px, no drag guard ([chat.tsx:217](../../app/v2/chat.tsx#L217)) | ❌ §3.3 |

---

## 2 · What the others do

### Gemini (Android) — opens the keyboard **for** you

Google added auto-opening the keyboard on app launch in Google app beta 16.4.36.
The stated reason is bluntly practical: *"keyboard entry is a big reason people
open the app"* — it saves a tap ([9to5Google](https://9to5google.com/2025/02/06/gemini-app-keyboard-android/)).

Google is also reworking the input itself: the sheet-style prompt bar becomes a
**floating pill** that **expands when the keyboard opens**. Mic and Gemini Live
stay visible; the model switcher and the tools (images, video, Deep Research,
Canvas) move behind a `+`. The reported trade-off is a smaller touch target
([Android Police](https://www.androidpolice.com/google-gemini-updated-ui-android-input-box/),
[WebProNews](https://www.webpronews.com/google-revamps-gemini-ai-android-app-with-dynamic-floating-input-bar/)).

### ChatGPT — blank field, and it assumes you know what to do

The empty state is a blank input plus suggestion chips; it does not onboard you.
That works *because the use case is intuitive*
([925 Studios](https://www.925studios.co/blog/chatgpt-interface-design-breakdown)).
That caveat matters for us — see §3.1.

### The wider convention — do **not** autofocus in a thread

Across chat products the repeated fix is the opposite of Gemini's: stop focusing
the composer on touch devices, because the keyboard covers the messages the
person came to read. Deliberate acts — tapping the composer, replying, editing —
still raise it (Odoo [#194122](https://github.com/odoo/odoo/pull/194122),
[#194274](https://github.com/odoo/odoo/pull/194274)).

**These two are not in conflict.** They are about different screens:

> Autofocus belongs on an **entry** surface that opens blank. It does not belong
> on a **reading** surface that opens onto history.

### Scroll during streaming — the settled pattern

⚠️ **This section was rewritten 2026-09-21 after actually opening the sources.**
The first version was assembled from search-result summaries, and two of its
three claims did not survive contact with the articles. What follows is only
what the pages say, each read.

- **A jump-to-latest control is the convention.** Documented with ChatGPT,
  Discord, Slack and Teams as examples. Placement guidance, verbatim: *"placed
  above the composer with enough tap target"* on mobile, and the named
  anti-pattern is *"covering the composer with the jump control"*. It also says
  the control should show *"New messages"* or a count **rather than only a
  chevron** ([AI UX Playground](https://aiuxplayground.com/pattern/scroll-bottom/)).
- **Anchoring a new turn to the top of the viewport is a real ask**, phrased as
  *"when a user submits a prompt, scroll so that the new turn (or start of the
  incoming assistant reply) aligns with the top of the visible viewport"*
  ([Andy963/ads #281](https://github.com/Andy963/ads/issues/281)). Note it
  anchors the **assistant's reply**, not the user's message; ours pins the user
  message, which is what `CHATBOT_RULES` §6 asks for.
- ⚠️ **"An 80px threshold is too sensitive, use 150–200px" is NOT sourced.** It
  was in the first draft of this doc with two citations. Neither says it:
  jhakim.com does not discuss thresholds at all — its approach is padding the
  last message to ~50vh so it lands in a comfortable reading position, and it
  recommends **neither** a pin **nor** a scroll-to-bottom button. The Medium
  article returns 403 and cannot be checked. The claim came from a search
  summary. **It is withdrawn.** Our 120/80 values come from the shipped lab
  chat, which is a better provenance anyway.

---

## 3 · The gaps, worst first

### 3.2 · Leaving the screen destroys the conversation — and this exact bug was client-reported on web

**Measured.** Sent *"Help me price a used centrifuge"*, got a real reply, went to
Home, came back: empty state, thread gone. It is deliberate —
[`useChatController.ts`](../../src/features/lab/chat/controllers/useChatController.ts)
seeds "once per mount … re-entry starts fresh, in-memory, no resume."

Both comparators persist. More to the point, **so do we, on web, because a
client complained**: on 101lab.co, clicking a product card opened a new tab and
"lost" the conversation. The fix shipped as `resumePolicy.shouldResumeOnOpen`
with an explicit rule — **busy-first → identity-gated → 24-hour recency → else
fresh** — plus a deliberate New-chat control (memory `project_ai_chat_follow`).

Mobile v2 still behaves the way the client called a bug. And it bites harder
here: a seller who taps a lot, or answers a message, loses their pricing
conversation with no way back.

**Do not re-derive the policy.** Port
`nextjs-port/src/shared/components/ai/resumePolicy.ts` — **verified present,
134 lines, with its own test file beside it**. It exports `shouldResumeOnOpen`,
`RESUME_MAX_AGE_MS` (24h) and `CONV_USER_KEY`. The 24h-plus-identity rule is the
part that is easy to get subtly wrong, and it is already written.

⚠️ It reads `localStorage` directly (`:42`, `:125`). On mobile that has to become
MMKV — swap the two accessors, keep the decision logic untouched.

⚠️ One thing to keep: v2 already has a New-chat control
([chat.tsx:763](../../app/v2/chat.tsx#L763)) that resets the thread *and* mints a
new server conversation. Resume is only safe alongside an explicit way to start
over — that control is it.

### 3.3 · v2's scroll behaviour is a regression against our own shipped chat — ✅ FIXED 2026-09-21

The old `app/(lab)/chat.tsx` already implements the pattern the research
describes, and implements it well. v2 has a simpler version that dropped four
things:

| | shipped lab chat | v2 |
|---|---|---|
| User's message pinned to top while the answer grows | yes (`pinActiveRef`) | **no** |
| Scroll-to-bottom pill, above the measured composer | yes, [chat.tsx:450](<../../app/(lab)/chat.tsx#L450>) | **no** |
| Follow band widened during a live turn | 120 streaming / 80 idle | fixed 80 |
| Don't yank the view while the finger is down | `draggingRef` guard | **no guard** |

The pin is not a nicety — **`CHATBOT_RULES.md` §6 requires it**: *"Pin the user's
latest message to the top; stream the reply below it … so their message + any
attached image never scroll off on send."* v2 does not comply.

And 80px is the number the research names as too sensitive. The shipped chat
already widens to 120 during a turn; that reasoning is in a comment there.

**Borrow, don't rewrite.** These four behaviours took several rounds to get
right in the lab chat (its comments record the jump and dead-gap bugs). Copy
them across and adapt to v2 tokens.

#### Could the external implementation be used instead? No — checked.

Before keeping our own, the obvious candidate was the library AI Elements'
`Conversation` is built on: **`use-stick-to-bottom`** (stackblitz-labs). It does
exactly this job — sticks to the bottom, survives content *shrinking*, and uses
velocity-based spring scrolling.

It is **React DOM only**. It detects resize through `ResizeObserver`, a browser
API that does not exist in React Native, and nothing in its documentation
mentions RN. So it cannot be vendored, and the ecosystem's best version of this
component is unavailable to us. That is the reason we have our own, and it is
worth writing down so nobody re-opens the question.

What we *can* reuse is our own proven copy — which is what happened.

#### Done — ported, deduplicated, and proven on device 2026-09-21

All four are in `app/v2/chat.tsx`, borrowed from the shipped chat rather than
re-derived. The pill uses the kit's `IconAction tone="quiet"` — the same circle
as Send without a second green disc competing with it — so no new component.

⚠️ **The first pass copied the logic, which left the repo holding it twice.**
Corrected the same day: the arithmetic is now
[`features/lab/chat/threadScroll.ts`](../../src/features/lab/chat/threadScroll.ts)
— four pure functions (`distanceToEnd`, `isAtBottom`, `shouldFollow`,
`bottomTarget`, `pinTarget`) with **18 tests**, which neither copy had ever had,
because reaching the logic used to mean rendering a chat screen. Both
`app/v2/chat.tsx` and the shipped `app/(lab)/chat.tsx` now call it; the screens
keep only the wiring.

The gap above a pinned row stayed a parameter rather than a constant: lab passes
`spacing.md` (12), v2 passes `space['3xl']` (16). Two different scales, and
baking either in would have silently shifted one screen's layout.

Both chats were re-driven on the handset afterwards — the shipped one has no
test covering scroll at all, so the device was the only check available.

Verified on the handset with a two-turn conversation, not in a test:

1. Send → the question pins to the **top**, "Working on it…" below it.
2. The answer streams in **below** the pinned question; it does not yank.
3. Scroll up → the pill **appears**.
4. Tap it → jumps to the **end of the answer**, stopping above the spacer's
   blank tail, and hides itself.

⚠️ **Known, accepted: the pill overlaps the thread.** Photographed sitting over
the right-hand end of a user bubble. The shipped chat has the identical geometry
(`position:absolute, right:18`), and floating over content is what ChatGPT does
too — the pill is transient and tapping it is the way out. Flagged rather than
fixed because every alternative is worse: centring it covers mid-sentence
assistant text instead, and reserving a lane makes the composer jump each time
the pill appears. Revisit only with a scrim behind it.

Reading the pattern write-up afterwards supported the decision rather than the
worry: the named anti-pattern is *"covering the composer with the jump
control"*, and the placement guidance is *"above the composer with enough tap
target"* — which is where ours sits, measured off the live composer height
rather than a guessed constant.

⚠️ **One documented recommendation we do NOT follow, deliberately.** The same
source says the control should read *"New messages"* or a count rather than only
a chevron. Its examples are Discord, Slack and Teams — multi-party rooms where
a count is meaningful. A one-to-one assistant thread has no unread count to
show, and ChatGPT uses a bare chevron for the same reason. Recorded as a choice,
not an oversight.

⚠️ **Corrected during the work:** the elevation was first passed to
`IconAction`, which sets `overflow: 'hidden'` for its material fill. Android
would still draw `elevation`, iOS would clip the shadow away — it would have
looked right on the test handset and wrong on a phone nobody checked. The
shadow is on the wrapper now.

### 3.1 · The keyboard could open on arrival — and here the usual objection doesn't apply

Ours stays down. Gemini's changed to open. The standard objection is "the
keyboard hides what you came to read" — but **measured: with the keyboard up,
all three "TRY ASKING" openers are still on screen**, because they sit directly
under the tab row rather than at the foot of the list.

So the trade-off that makes autofocus wrong in a threaded app is absent on this
screen. Our assistant opens **blank**, which is precisely Gemini's entry-surface
case.

The one real counter-argument is ChatGPT's caveat: a blank field works *because
the use case is intuitive*. Ours is not — "what can a marketplace assistant do
for me?" is a genuine question, and the three openers are the answer. Autofocus
does not remove them, but it does put a keyboard between the user and a calm
first read.

**Recommendation: autofocus, but only when the person arrived by pressing "Ask
the assistant."** That press is a statement of intent to type. Arriving via a
tab, a deep link, or a back-navigation should leave the keyboard down. If that
is more plumbing than it is worth, leaving it as it is today is defensible —
this is the weakest of the three gaps.

---

## 4 · What I would do, in order

| | change | why | size | state |
|---|---|---|---|---|
| 1 | Port `resumePolicy` — resume a recent thread on re-entry | a client already called this a bug on web | **L**, see below | 🟡 open |
| 2 | Bring across the pin + scroll pill + 120/80 band + drag guard | CHATBOT_RULES §6 non-compliance, and the code already exists | M | ✅ done |
| 3 | Autofocus when arriving from the Home row only | one tap, matches Gemini, costs nothing visible | S | 🟡 open |

**#2 went first, and #1 is bigger than this doc first said.** Resume needs
somewhere to resume *from*, and v2 has nowhere:
[`conversationStore.ts:6-10`](../../src/features/lab/stores/conversationStore.ts#L6-L10)
keeps messages in memory on purpose and calls durable persistence "a Phase-2
item (roadmap PR-7)". So porting `resumePolicy` is step two — the store has to
learn to persist first, and that is a decision about what we keep on a device
and for how long, not a port. #2 was contained to one v2 screen and closed a
written rule violation, so it went first.

Not recommended: Gemini's floating-pill composer. It is unreleased, its own
coverage flags the smaller touch target as a problem, and our composer is not
the thing that is wrong.

---

## Sources

**Opened and read**, and each one supports the claim it is attached to:

| source | what it gave this doc |
|---|---|
| [Gemini auto-opens your keyboard — 9to5Google](https://9to5google.com/2025/02/06/gemini-app-keyboard-android/) | the auto-focus change, the stated reason, beta 16.4.36 |
| [Gemini's new input box — Android Police](https://www.androidpolice.com/google-gemini-updated-ui-android-input-box/) | the floating pill, expand-on-keyboard, tools behind `+` |
| [ChatGPT design breakdown — 925 Studios](https://www.925studios.co/blog/chatgpt-interface-design-breakdown) | *"assumes competence rather than explaining itself"*, and why it works |
| [Scroll to Bottom — AI UX Playground](https://aiuxplayground.com/pattern/scroll-bottom/) | placement above the composer, the covering-the-composer anti-pattern, label-not-just-a-chevron |
| [Conversation — AI Elements](https://elements.ai-sdk.dev/components/conversation) | *"includes a scroll button that appears when not at the bottom"* |
| [Andy963/ads #281](https://github.com/Andy963/ads/issues/281) | anchoring a new turn to the top of the viewport |
| [odoo/odoo #194122](https://github.com/odoo/odoo/pull/194122) | don't autofocus on mobile — the keyboard takes half the screen |
| [jhakim.com — scroll behaviour for AI chat](https://jhakim.com/blog/handling-scroll-behavior-for-ai-chat-apps) | ⚠️ read and found NOT to support what it was first cited for; its actual approach is ~50vh padding on the last message, with no pin and no jump button |

**Cited in the first draft and now dropped**, because I never opened them and
nothing in this doc needs them: Mobbin's empty-state glossary, WebProNews'
Gemini piece (duplicates Android Police), and odoo/odoo #194274 (the
forward-port of #194122, which is read above).

**Could not be read:** [the Medium scroll article](https://medium.com/@disgcfrguy/the-scroll-problem-nobody-talks-about-when-building-ai-chat-interface-987c223cafc0) returns HTTP 403. No claim here rests on it.

In-repo: `CHATBOT_RULES.md` §6 · [`Docs/ChatUXImprove/06-input-and-buttons.md`](../ChatUXImprove/06-input-and-buttons.md) · memory `project_ai_chat_follow`
