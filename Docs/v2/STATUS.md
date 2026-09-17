# v2 status

**Observed on device 2026-09-16** (OPPO, density 423dp, signed in as a real
seller). Everything in the table is something that was seen or pressed, not
inferred — the route list itself is asserted by
[`v2Inventory.test.ts`](../../src/__tests__/v2Inventory.test.ts).

## The one thing to know first

**v2 still ships to nobody, but it now has a door — and the door is shut.**

The app launches into the OLD UI (`app/index.tsx` redirects to
`/(lab)/(tabs)/home`, untouched). There is exactly ONE way in: a row at the
bottom of the old Account screen, gated on `V2_UI_ENABLED`
(`EXPO_PUBLIC_V2_UI=1`, opt-in, **default OFF and unset everywhere including
`.env`**). With the flag unset the app is byte-for-byte what it was.

Both facts are asserted by the inventory test — the exact door, and that it
stays behind the flag — so a second door, or an ungated one, fails and this
paragraph has to change with it.

⚠️ **Not yet verified on the phone.** adb wedged repeatedly (hanging on
`get-state` and `screencap`, surviving a server restart), so nobody has watched
the Account screen with the flag off. The flag guarantees it in code and the
test asserts it; that is not the same as having looked.

That reframes the table: the screens work. What stands between them and a user
is one flag, not fifteen screens of work.

## Leaks back into the old UI — halved, and now pinned

Raised by the user while using the app: *"routing is wrong, at some point it
goes into the previous version."* True, and worse than the `TODO(v2-nav)` label
it had been filed under — the old shell has a different tab bar, so the chrome
changed mid-flow with no way back.

Two of the exits turned out to be pointless:

- Home's banner and 6b's "browse the open lots" both pushed
  `(lab)/(tabs)/browse`, which renders the **same** `MarketplaceWebView` at the
  **same** path as `/v2/browse`. The TODO said "repoint once 6c lands"; 6c had
  landed.
- All four review steps sent their empty state to `routes.scanHome` with
  `router.replace` — `/(lab)/(tabs)/home`, the OLD home, with v2 dropped from
  the back stack. There was no `routes.v2Home` constant, which is why four
  screens independently reached for the shipped one. There is now.

Ten files exited to the old UI; eight do. The remaining set is fixed by
`v2Inventory.test.ts` ("v2 exits into the old UI"), so a new leak fails rather
than accumulating, and one guard asserts specifically that nothing in v2 ever
sends anyone to the old home again. Both were proven to go red before being
trusted. The eight that remain have no v2 destination yet: the bell, the
want-composer sheet, the shipped processing screen, drafts, and account
deletion.

**Verified on device 2026-09-16.** Both browse exits were pressed on the phone
and the tab bar afterwards reads `Home | Browse | Matches | MESSAGES | Account`
— v2's own bar. Before the fix it read `Chat`, which is the old shell's, and
that single word is the quickest way to tell which app you are standing in.

⚠️ The third fix — the review steps' empty state going to `/v2` instead of the
old home — is **guarded by the test but not pressed**, because reaching that
state needs an empty scan draft and clearing the device's draft store to force
it was not worth the risk to someone's in-progress work.

## Per screen

*Built* = renders · *vs canvas* = its drawing's text diffed against the live
screen · *Pressed* = ⚑ means EVERY control was tapped and its effect observed ·
*Real data* = a real account's content, not a fixture · *L+D* = seen in both
colour schemes.

| Screen | Built | vs canvas | Pressed | Real data | L+D |
|---|:--:|:--:|:--:|:--:|:--:|
| **6a** Home — selling | ✅ | ✅ | ⚑ all 11 | ✅ drafts + listings | ✅ |
| **6b** Home — buying | ✅ | ✅ | ⚑ all 8 | ✅ wants + matches | ✅ |
| **6c** Browse | ✅ WebView | n/a | ⚑ all 4 | ✅ 3,668 lots | ⛔ web-side |
| **6d** Matches | ✅ | ✅ | ⚑ all 6 | ✅ 12 wants / 20 matches | ✅ |
| **6e** Messages | ✅ | ✅ | ⚑ all 4 | ✅ 190 threads | ✅ |
| **6f** Account | ✅ | ✅ | ⚑ all 6 | ✅ 3-of-4, 20+, 24+ | ✅ |
| **7a** Analyzing | ✅ | ⚠️ copy only | ✅ empty state | ❌ unreachable | ✅ empty only |
| **7b** Review · photos | ✅ | ✅ | ⚑ all 5 | ✅ resumed draft | ✅ |
| **7c** Review · details | ✅ | ✅ | ⚑ all 9 | ✅ resumed draft | ✅ |
| **7d** Review · pricing | ✅ | ✅ | ⚑ all 9 | ✅ real bands | ✅ |
| **7e** Review · location | ✅ | ✅ | ⚑ all 10 | ✅ resumed draft | ✅ |
| **2a** Listing detail | ✅ | ✅ | ⚑ all 7 | ⚠️ fixture | ✅ |
| **2b** Place a bid | ✅ | ✅ | ⚑ all 5 | ⚠️ fixture | ✅ |
| **3a** Talk to assistant | ⛔ module fails | ✅ | ❌ unreachable | ⚠️ fixture | ✅ dark by design |
| **3b** Scan an item | ✅ | ✅ | ⚑ all 5 | ✅ real capture | n/a viewfinder |
| Assistant `/v2/chat` | ✅ | not drawn | ⚑ all 12 | ✅ live controller | ✅ |
| SignInSheet | ✅ | not drawn | ✅ all 3 | n/a | ✅ |

**14 surfaces carry ⚑, 101 controls pressed** (summed from the column above,
not from memory — an earlier draft of this line said 97 and did not match its
own table). The bar is every control, not one: it was raised after the sign-in
sheet was marked "verified on glass" with all three of its buttons dead, and
raising it found 13 more controls that did nothing.

## The two that are not done, and why

**7a Analyzing — blocked on a decision, not on work.** Its empty state renders
and its copy matches the canvas, but the running state needs a
`recognition-jobs` job and nothing in v2 can start one. See
[DECISIONS.md](DECISIONS.md) item 2.

**3a Talk to the assistant — one line, located.** Removing `<Waveform />` makes
the entire screen render. The fault is its bar animation, and it was
characterised on device by varying only the repeat:

| animation | route opens? |
|---|:--:|
| none | ✅ |
| one-shot `withTiming` | ✅ |
| `withRepeat(…, 4, true)` | ✅ |
| `withRepeat(…, 100000, true)` | ❌ |
| `withRepeat(…, -1, true)` × 11 bars (shipped) | ❌ |
| `withRepeat(…, -1, true)` × 1 shared driver | ❌ |
| `-1` deferred via `InteractionManager` | ❌ |

Nothing is logged in Metro or logcat either way, which is why it read as a
missing route for two days. **Three fixes were tried and all three failed**, so
the file is restored exactly as found rather than left holding a guess.

⚠️ **This diagnosis is under revision (2026-09-16).** A review raised a point I
cannot answer: *a `useEffect` cannot unregister a route*. If the phone is really
rendering `+not-found`, the router decided the URL did not match BEFORE
`voice.tsx` was evaluated, and no runtime animation can cause that. Two facts
now sit against the table above:

- The router's own dev sitemap (`greenbridge://_sitemap`) **lists `voice.tsx`**
  among the v2 routes, so the route IS registered.
- Every row of that table was produced by editing the file with the app
  running, i.e. through a Fast Refresh re-evaluation. A module-scope failure —
  the `GUTTER` TDZ lead below — bites on RE-evaluation, not on first load. The
  repeat count may be a correlate of test procedure rather than a cause.

The outstanding experiment is a COLD start (force-stop, fresh bundle) against
the unmodified file. Until that runs, treat "the animation is the fault" as
unconfirmed.

**PARKED 2026-09-16, deliberately.** Two days went into this screen and the most
likely outcome now is that the table measures the test procedure rather than the
bug. 3a is a static mock — its own header says the mic, camera, speaker, "Use
this" and quick replies are all inert — sitting behind a door that does not
exist. Even a correct diagnosis buys nothing until v2 has an entry point and
someone decides to wire the voice turn.

Whoever picks it up: start with the cold start, and read the three hypotheses in
`todo/T2_VOICE_WAVEFORM.md` before re-running anything in the table above.

⚠️ This does **not** generalise to "endless animations break screens".
`(lab)/chat` gates its one on streaming and 7a's live in components its empty
state never mounts — but `app/(auth)/pending.tsx` starts **four**
unconditionally on mount and is a shipped screen I could not reach to test. It
stands as an unruled-out counterexample.

## Health

- **142 suites / 1,397 tests green**, `tsc` clean, eslint clean (2026-09-16).
- **Nothing is committed.** All of it sits uncommitted on
  `feat/app-store-account-deletion`, which is not a v2 branch. Landing it on its
  own branch is [DECISIONS.md](DECISIONS.md) item 4.
