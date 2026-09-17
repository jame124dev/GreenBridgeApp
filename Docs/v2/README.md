# v2 docs

Eight files. Each has one owner and one job. If something does not fit in one of
them, it probably belongs in a test instead — see below.

| file | answers | changes |
|---|---|---|
| [STATUS.md](STATUS.md) | where each screen actually is | often |
| [DECISIONS.md](DECISIONS.md) | what is waiting on a human | when one is answered |
| [DECISION-LOG.md](DECISION-LOG.md) | what was already settled, and why | when something is decided |
| [SHIP-BLOCKERS.md](SHIP-BLOCKERS.md) | what must not reach App Review | rarely |
| [ARCHITECTURE.md](ARCHITECTURE.md) | how v2 is put together | when code moves |
| [GUEST-VS-SIGNED-IN.md](GUEST-VS-SIGNED-IN.md) | what each person should see, per screen | when a screen's states change |
| [SECURITY-WISHLIST.md](SECURITY-WISHLIST.md) | a live unauthenticated API this UI must not call | when it is fixed |
| [WEB-PARITY.md](WEB-PARITY.md) | scan-flow features the web has and mobile does not | when one is ported |
| [TRAPS.md](TRAPS.md) | what wastes a day if you do not know it | when one bites |

## The rule that makes this different from the last attempt

**Anything a grep can establish is asserted in
[`src/__tests__/v2Inventory.test.ts`](../../src/__tests__/v2Inventory.test.ts),
not written here.**

That test enumerates the v2 route list, the controls that explain themselves
instead of working, whether any entry point into v2 exists, and which screens
wire the language sheet. Change the code and it fails, naming the doc line it
backs. Prose cannot do that, and the evidence that it cannot is local: the file
these replace reached ~1,900 lines and several of its claims were stale within
hours of being written — a screen marked verified that could not be opened, a
"no real data" on a screen holding 3,668 live lots.

`Docs/` also already contains `docs_cleanup_plan.md`, a tidy-up stalled
mid-execution since 2026-05-29. That is the honest prior on reorganising
documentation by hand, and the reason the load-bearing half of this one is a
test.

So: if you are about to write a fact here that a grep could check, put it in the
test and link to it. What belongs in these files is what a grep cannot know —
decisions awaiting a person, what was observed on a device and when, and why
something is the way it is.

## What these replace

`Docs/V2_CHECKLIST.md` — kept as an ARCHIVE with a banner pointing here, not
deleted. Code comments across `app/v2/` reference it by name, and the reasoning
behind most v2 decisions is in it. It is no longer where current state lives,
and nothing should be added to it.

**Not touched:** `docs_cleanup_plan.md`. It is mid-flight in someone else's
review loop, and stepping into it is how a third cleanup stalls.
