# v2 scan flow — rebuild plan

**What this is.** The plan to make the mobile scan flow do what the web's `/valuation` does, step for
step, with a mobile-native item editor and a working spreadsheet lane. Docs only; nothing here has
been built.

**Where the evidence came from.** Three walks taken on 2026-09-23, screenshots in the sibling folders:

| Folder | What | Result |
|---|---|---|
| [`../v2scan`](../v2scan/) | Mobile, Realme 7, one PDF | Reached Published (BATCH 5096), but via the old per-item wizard, never touching Valuation or Review |
| [`../v2scanweb`](../v2scanweb/) `01–05` | Web `/valuation`, same PDF | Single-item collapse → Review and submit |
| [`../v2scanweb`](../v2scanweb/) `xlsx-*` | Web `/valuation`, an 8.7 MB spreadsheet | **10 items** → Detected grid → bulk edit → Valuation → Review and submit |

And the code: `GreenBridgeApp/` for mobile, `nextjs-port/src/valuation/` for the web reference.

**How to read it.**

| File | Answers |
|---|---|
| [`00-current-structure.md`](00-current-structure.md) | What exists on mobile today — every screen, how they route, which data each reads |
| [`01-problems.md`](01-problems.md) | What is wrong, numbered, each with `file:line` |
| [`02-target-structure.md`](02-target-structure.md) | What it should be — screens kept, removed, new; the one route graph; one data model |
| [`03-web-reference.md`](03-web-reference.md) | What the web does at each step, with file pointers — the thing being copied |
| [`phases/`](phases/) | The build order. One folder per phase; each README is self-contained: scope, files, acceptance, exit criteria |

**Two decisions already made (by the owner, 2026-09-23):**

1. **The per-item editor is rebuilt for mobile.** The current four-screen wizard (Photos · Details ·
   Pricing · Location) goes. Its replacement is one mobile-native item sheet, designed to the UX rules
   — not the web's drawer copied, not the four screens kept.
2. **The spreadsheet lane is ported from the web as-is.** The web already reads a 10-row xlsx into 10
   items with per-row photos; mobile copies that mechanism rather than inventing one.

**Rule for anyone executing a phase.** Every `file:line` in these docs was read on 2026-09-23. Before
acting on one, open it — the tree is dirty and moving. Anything marked `<VERIFY>` was **not** read
by the author and must be checked before it is treated as true.
