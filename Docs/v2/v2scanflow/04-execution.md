# 04 — Execution: waves, file ownership, agent contracts

How the seven phases are actually run, given three constraints measured on 2026-09-23:

- **The phases are a chain.** 2, 3, 4 and 5 all assume Phase 1 has moved detection into the server
  draft. Only Phase 0 fans out cleanly.
- **Six files are contested** across phases (counted from the phase docs):
  `app/scan/processing-v2.tsx` ×3 · `app/v2/scan/items.tsx` ×2 · `usePublishDraft.ts` ×2 ·
  `scanv2Keys.test.ts` ×2 · `v2Inventory.test.ts` ×2 · `app/scan/detection.tsx` ×2.
- **105 uncommitted files on `feat/v2-ui`.** No baseline to diff or revert against.

## Waves

| Wave | Runs | Parallel? | Needs a clean tree? |
|---|---|---|---|
| **W0** | Phase 0 — verification + decisions | **Yes, 4 agents** | No — read-only |
| **W1** | Phase 1 — one spine | **No, one agent** | **Yes** |
| **W2** | Phase 2 (client) ‖ Phase 2 (backend MIME) ‖ Phase 3 | Partly — see ownership | Yes |
| **W3** | Phase 4 — item editor | **No, one agent** | Yes |
| **W4** | Phase 5 — valuation + submit ‖ its i18n | Partly | Yes |
| **W5** | Phase 6 — removal + guards | **No, one agent** | Yes |

Side jobs that can run against **any** wave because they touch nothing else: the item-editor design
+ KIT GAP list (before W3), and the locale authoring for `valuation`/`submit` (before W4, keys only).

## File ownership

One owner per file per wave. If a job needs a file it does not own, it stops and reports — it does
not edit around the owner.

> ⚠️ **This matrix governs CONCURRENT edits only — it is not a licence to leave a defect.**
> **A phase owns every file its own change breaks, whatever the table says.** If a change gives an
> existing field, route or key a second meaning, grep every reader in the same turn and fix them
> all. Deferring one to a later wave ships a known breakage, and usually breaks the phase's own
> acceptance test.
> Phase 1 hit exactly this: it made `thumbnail_object` mean two things, moved `items.tsx` onto the
> new `draftItemThumbUri`, and left `valuation.tsx` + `submit.tsx` piping a `file://` URI into
> `gcsUrlForAnalyze` — a broken tile on every freshly-scanned row — because the table assigns those
> two files to P5 in W4. No W4 agent was running. Fixed in review; logged in `MISTAKES.md`
> (2026-09-23). **Every agent brief carries this line:** *"if your change makes an existing call
> site wrong, fix that call site or stop — do not hand it forward."*

| File | W1 | W2 | W3 | W4 | W5 |
|---|---|---|---|---|---|
| `app/scan/processing-v2.tsx` | **P1** | P2-client *(error copy only, after P1 lands)* | — | — | **P6** |
| `app/v2/scan/items.tsx` | **P1** | **P3** | — | — | P6 |
| `app/v2/scan/detected.tsx` | **P1** (delete) | — | — | — | — |
| `src/features/scanner/applySmartDetection.ts` | — | **P2-client** | — | — | — |
| `src/stores/scanDraftStore.ts` | P1 *(read)* | **P2-client** | — | — | — |
| `usePublishDraft.ts` | — | **P2-client** *(gate only)* | — | **P5** *(publish set)* | — |
| `app/v2/scan/valuation.tsx` / `submit.tsx` | P1 *(route only)* | — | — | **P5** | P6 |
| `app/v2/scan/review/*` | — | — | **P4** (delete) | — | — |
| new `app/v2/scan/item.tsx` | — | — | **P4** | — | — |
| `src/lib/routes.ts` | **P1** | — | P4 | — | **P6** |
| `src/i18n/locales/*.json` | — | P3 *(grid keys)* | P4 *(editor keys)* | **P5** *(val/submit)* | — |
| `scanv2Keys.test.ts` | — | P3 | P4 | **P5** | P6 |
| `v2Inventory.test.ts` | **P1** | — | P4 | — | **P6** |
| backend `services/officeDocs.js` | — | **P2-backend** | — | — | — |

`src/i18n/locales/*.json` is the sharpest trap: six files, several phases, and **`json.dumps` on a
locale file is forbidden** (it drops duplicate keys and rewrites CRLF). Each phase adds its own
block with `Edit` calls, one file at a time, and runs `scanv2Keys.test.ts` before handing back.

## Baseline protocol (required from W1 on)

1. Before W1, the 105 dirty files get a decision from the owner: commit, or branch. Agents **must
   not** commit on anyone's behalf — `feat/v2-ui` already carries other sessions' work.
2. Each wave job records `git rev-parse HEAD` and `git status --porcelain | wc -l` at start **and**
   end, in its report. A job that finds the count changed under it stops and says so.
3. No job runs `git checkout .`, `reset --hard`, `stash`, or `clean`. Ever. (CLAUDE.md.)

## The contract every agent gets

Non-negotiable, because each of these has cost this workspace real time:

1. **Look before you drive.** Open the file/page before writing the script or the edit. Never reuse
   a selector, key path, or line number across environments or builds without re-reading.
2. **Two failures and stop.** After a second failed attempt at the same thing, stop and report —
   do not write probe #3.
3. **Suspect your instrument before the product.** No "X is broken" without reproducing it by a
   second, independent method.
4. **Never write source with heredoc / `echo` / `sed -i` / scripted replacement.** `Edit`/`Write`
   only, one file at a time.
5. **Resolve i18n keys by PATH, not by name.** `node -e "require('./locales/en.json').mobile.scanv2.x?.y"`,
   never `grep -c '"y"'`.
6. **A screenshot is not a press.** A control is verified when it has been pressed and the resulting
   state change observed. N controls ⇒ N presses.
7. **Do not edit the kit** (`src/features/v2/ui/*`). Report a KIT GAP with the code instead.
8. **Every number you report comes from a command shown in the same turn.**
9. **Log to `MISTAKES.md` the moment something surprises you** — same turn, not at the end.
10. **If you die mid-edit, the tree is broken.** State in your report every file you changed, so the
    orchestrator can `git diff` them. (A subagent's interrupted rename left the camera crashing on
    2026-09-22.)

## Report format

Every job ends with:

```
FILES CHANGED   <list, or "none — read-only">
HEAD / DIRTY    <sha> / <n>  →  <sha> / <n>
CLAIMS          <claim> | <file:line or command> | VERIFIED / WRONG / UNVERIFIED
BLOCKED ON      <what, or "nothing">
NEXT            <the one thing the next job needs to know>
```
