# Plan: Docs cleanup — image de-dup + tree tidying (2026-05-29)

> **Target tree:** `GreenBridgeApp/Docs/**`
> **Scope:** remove duplicate / unreferenced screenshots in `Docs/UiUpdateRuleset/`, de-dupe duplicate plan files in `Docs/`, decide fate of the unused `Docs/AutonoumsAi/` two-agent template, add a one-page `Docs/INDEX.md` so future readers can navigate the tree.
> **Authority:** this file is a maintenance plan, not a product plan — no source code is touched. Same two-agent loop protocol as [`UiUpdateRuleset/me_plan.md`](UiUpdateRuleset/me_plan.md) + [`UiUpdateRuleset/scan_plan.md`](UiUpdateRuleset/scan_plan.md).

---

## 0. Handoff Status (read this first)

This plan is executed as a two-agent loop, same protocol as `me_plan.md` and `scan_plan.md`:

- **claude** writes the plan, marks each workstream `🟡 READY FOR REVIEW` after coding, stops, waits.
- **reviewer** reads the diff (or — for this turn — reviews the plan itself), marks each workstream `✅ APPROVED` or `❌ CHANGES REQUESTED`, hands back.

### Status legend

| Symbol | Meaning | Who sets it |
|---|---|---|
| ⬜ TODO | Not started | (initial) |
| 🔄 IN PROGRESS | claude is actively working this workstream | claude |
| 🟡 READY FOR REVIEW | claude finished, reviewer to evaluate | claude |
| ❌ CHANGES REQUESTED | reviewer found issues, ball back to claude | reviewer |
| ✅ APPROVED | reviewer accepted | reviewer |
| ⏭️ SKIPPED | explicitly deferred — must include a `Reason:` line | either |

### Handoff direction

- **Last action by:** claude (D4 finished, ready for reviewer, 2026-05-29)
- **Next action by:** reviewer (review D4 — implementation_plan1.md deleted)

> If `Last action by` and `Next action by` are the same, something is wrong — stop and resolve.

### Current overall status

- **Last action by:** reviewer
- **Next action by:** claude
- **Active workstream:** D4 🟡 READY FOR REVIEW (`implementation_plan1.md` deleted; `implementation_plan2.md` kept per D0 decision); D5 queued next
- **Plan status:** 🟢 **IN EXECUTION** — D0 ✅, D1 ✅, D2 ✅, D3 ✅ APPROVED, D4 🟡 READY FOR REVIEW (2026-05-29), D5–D7 queued. D4: `implementation_plan1.md` (6042 B byte-identical dupe) deleted; canonical `implementation_plan.md` + distinct `implementation_plan2.md` (3238 B) retained. Scoped grep across whole `greenBridge/` tree returns zero matches. Handoff status now kept in sync per D3's process note.

### How this turn ends

claude is not authorized to start D1 until reviewer either (a) sets each workstream's status to `✅ APPROVED for execution` after a plan-acceptance pass, or (b) files reviewer pre-coding notes in the table below and re-hands the plan back. Per the user's instruction, this is the "keep in pool" state.

### Reviewer pre-coding notes (filled in by reviewer during plan acceptance — empty for now)

These will come out of plan-acceptance review. They are not blocking, but they change small specifics across workstreams. Apply when you reach each workstream — don't try to land them all up front. Mirror scan_plan.md's table format.

| # | Workstream | Note |
|---|---|---|
| 1 | D1, D2, D3, D4, D7 | **The "`Grep <filename>` returns zero matches" broken-ref checks can never pass as written.** `docs_cleanup_plan.md` itself names every deleted file in its audit/AC tables (e.g. `me_capture_fresh_v2.png` appears on ~6 lines; `implementation_plan1` on many), and `me_plan.md:483` mentions `me_plan_after.png` in prose. Reviewer confirmed via `Grep "\.png"` across `Docs/**`: **no PNG is embedded as a markdown image (`![](…)`) anywhere** — every reference is prose/backtick text — so real broken-link risk is nil, but the bare-filename greps will always hit the plan's own text. **Fix:** scope each broken-ref grep to *exclude `docs_cleanup_plan.md`* (`--glob '!docs_cleanup_plan.md'`), OR match only markdown link/image syntax (`](…png)` / `![`), not bare filename mentions. Apply consistently to D1, D2, D3(Option B), D4, and D7. The *intent* — "no rendered link points at a deleted file" — is what to verify, not "the string never appears." |
| 2 | D5 | D5 Option B's AC says `git mv Docs/AutonoumsAi/ Docs/agent-protocol/`. Parent dir is **not a git repo** (project memory + this plan's own D7 line 458 / D5 reversibility note). Moot under my D5 → Option A decision, but if anyone reopens Option B, use a filesystem rename (`Move-Item`), not `git mv`. |
| 3 | D6 | `INDEX.md` must list **itself** and **`docs_cleanup_plan.md`** (both are surviving md files), plus `implementation_plan2.md` with a 1-line note that it's a distinct earlier/branched plan retained per the D4 decision — so a cold reader knows why two similarly-named files coexist. The §2 target-shape UiUpdateRuleset listing already includes `scan_v3_plan.md`; confirm it's in the index too. |

### Reviewer findings inbox (carry-forward across workstreams)

Notes the reviewer records while reviewing executed workstreams that the developer should address when the right workstream comes up. Empty until D1 starts being reviewed.

| Filed during | Owner workstream | Finding | Status |
|---|---|---|---|
| _empty_ | | | |

---

## 1. Current-state audit (2026-05-29)

### 1.1 `Docs/` root inventory

```
AUTH.md                              18444 bytes
CAMERA_WHATSAPP_REDESIGN.md          27238
DESIGN_DELTA_v7.md                   19568
DESIGN_TOKENS_STITCH_SYNC.md          8622
INTERACTIVITY_LIBS_PLAN.md           12081
LOCALIZATION.md                      11553
SCANNER_FLOW.md                      31665
SMART_DETECTION_FLOW.md              23951
STARTER_KIT.md                       20392
UiUpdate.md                           6621
WEB_FLOW_PARITY_PLAN.md             121079
implementation_plan.md                6042
implementation_plan1.md               6042   ← byte-identical to .md
implementation_plan2.md               3238
react_native_marketplace_ruleset_v2.md 26113
AutonoumsAi/  (subfolder)
UiUpdateRuleset/ (subfolder)
```

**Findings:**
- `implementation_plan.md` and `implementation_plan1.md` are byte-identical (both 6042 bytes; MD5 `FA84C2C2C41BED5D7F312CC6335BCDDA`). Confirmed via `Get-FileHash`.
- `implementation_plan2.md` (3238 bytes; MD5 `E9F3AEEF36061F69165BAE235E842A8D`) is distinct content — looks like an earlier or branched plan. Reviewer to decide its fate (keep / archive / delete) — see D4.
- The 12 other root `.md` files are all unique and actively referenced by the codebase or by the operational plans. **Out of scope for deletion** in D1–D7.

### 1.2 `Docs/AutonoumsAi/` inventory

```
DEVELOPER.md      3789 bytes
REVIEWER.md       4453 bytes
STATE.md             0 bytes   ← empty
```

**Findings:**
- This folder defines a parallel two-agent protocol (CURRENT_AGENT polling, status lifecycle, etc.). However, the actual operational protocol used in `me_plan.md` and `scan_plan.md` is the **inline status-table pattern** (handoff direction block, status legend in the plan itself).
- `STATE.md` is **zero bytes** — never populated.
- No file in `Docs/**` references `AutonoumsAi/DEVELOPER.md`, `REVIEWER.md`, or `STATE.md` (verified by grep).
- **Recommendation:** D5 audits whether to delete this folder, or keep DEVELOPER.md / REVIEWER.md as a generic template (renamed to e.g. `Docs/agent-protocol/`). Reviewer's call — flagged in pre-coding notes if reviewer disagrees with deletion.

### 1.3 `Docs/UiUpdateRuleset/` image inventory

Hashes computed via `Get-FileHash -Algorithm MD5`. 14 PNGs total, ~5 MB on disk.

| File | Size (bytes) | MD5 (truncated) | Referenced in any plan? |
|---|---|---|---|
| `me_capture_current.png` | 172,400 | `34DED2…` | ❌ no — pre-state capture, not cited |
| `me_capture_fresh.png` | 437,591 | `6E2AA3…` | ❌ no — pre-state capture, not cited |
| `me_capture_fresh_v2.png` | 213,635 | `D8A422…` | ❌ no — **byte-identical to `me_plan_after.png`** |
| `me_check_state.png` | 182,211 | `6691A5…` | ❌ no — **byte-identical to `me_plan_after_preferences.png`** |
| `me_plan_after.png` | 213,635 | `D8A422…` | ✅ yes — `me_plan.md:55` + `me_plan.md:483` |
| `me_plan_after_bottom.png` | 189,925 | `1BCEB8…` | ❌ no — emulator capture, not cited |
| `me_plan_after_lower.png` | 42,474 | `91B075…` | ❌ no — emulator capture, not cited |
| `me_plan_after_preferences.png` | 182,211 | `6691A5…` | ✅ yes — `me_plan.md:55` |
| `me_plan_after_scrolled.png` | 221,885 | `E3B36F…` | ✅ yes — `me_plan.md:55` |
| `me_plan_after_scrolled_2.png` | 261,910 | `9BAD10…` | ❌ no — emulator capture, not cited |
| `me_plan_after_security.png` | 322,077 | `862C4D…` | ❌ no — emulator capture, not cited |
| `phone_initial.png` | 28,637 | `FBE2CB…` | ❌ no |
| `phone_now.png` | 2,507,813 | `08AA0F…` | ❌ no — **2.5 MB single file** |
| `phone_review.png` | 183,147 | `0508913…` | ❌ no |

**Duplicate hash pairs:**
- `me_capture_fresh_v2.png` ≡ `me_plan_after.png` (`D8A422…`)
- `me_check_state.png` ≡ `me_plan_after_preferences.png` (`6691A5…`)

**Reference grep:** `Grep "\.png"` across `Docs/**` returns three independent matches:
1. `DESIGN_DELTA_v7.md:6` — references files **outside** UiUpdateRuleset (`.tmp-screenshots/...`). Not in scope.
2. `STARTER_KIT.md:292` — Expo icon path, not a UiUpdateRuleset screenshot. Not in scope.
3. `UiUpdateRuleset/me_plan.md:55` + `me_plan.md:483` — the three "referenced" PNGs above.

**Conclusion:** 3 referenced screenshots are keepers. 11 unreferenced screenshots are deletion candidates, of which 2 are exact byte-duplicates of keepers (zero-risk delete), 4 are extra emulator captures (`bottom`, `lower`, `scrolled_2`, `security`) that may or may not earn their place in the W8 inbox row, and 5 are pre-state / phone captures that look like working scratch.

---

## 2. Target shape

After all workstreams land:

```
Docs/
  AUTH.md
  CAMERA_WHATSAPP_REDESIGN.md
  DESIGN_DELTA_v7.md
  DESIGN_TOKENS_STITCH_SYNC.md
  INDEX.md                              ← NEW (D6 — one-page navigation guide)
  INTERACTIVITY_LIBS_PLAN.md
  LOCALIZATION.md
  SCANNER_FLOW.md
  SMART_DETECTION_FLOW.md
  STARTER_KIT.md
  UiUpdate.md
  WEB_FLOW_PARITY_PLAN.md
  implementation_plan.md                ← retained (canonical)
  react_native_marketplace_ruleset_v2.md
  docs_cleanup_plan.md                  ← this file
  UiUpdateRuleset/
    auth_plan.md
    core_plan.md
    home_plan.md
    me_plan.md
    scan_plan.md
    scan_v3_plan.md
    me_plan_after.png                   ← retained (referenced)
    me_plan_after_preferences.png       ← retained (referenced)
    me_plan_after_scrolled.png          ← retained (referenced)
    [extras kept or removed per reviewer decision in D3]
  [AutonoumsAi/ fate decided in D5 — delete OR rename to agent-protocol/]
```

**Net effect target:**
- 2 byte-duplicate PNGs deleted (D1, zero-risk)
- 1 byte-duplicate MD deleted (D4, zero-risk)
- 5–9 additional PNGs deleted depending on reviewer's call on D3
- `AutonoumsAi/` either deleted or renamed (D5)
- `INDEX.md` added (D6)
- Disk savings: ~3–5 MB depending on D3 outcome

---

## 3. Workstreams

| ID | Workstream | Status | Owner now |
|---|---|---|---|
| D0 | Plan-acceptance pass (reviewer reads this file, files pre-coding notes if any) | ✅ APPROVED | — |
| D1 | Delete byte-identical PNG duplicates (zero-risk: `me_capture_fresh_v2.png`, `me_check_state.png`) | ✅ APPROVED | — |
| D2 | Delete pre-state / phone scratch PNGs (`me_capture_current`, `me_capture_fresh`, `phone_initial`, `phone_now`, `phone_review`) | ✅ APPROVED | — |
| D3 | Delete extra emulator captures (`bottom`, `lower`, `scrolled_2`, `security`) — **reviewer chose Option A (delete)** | ✅ APPROVED | — |
| D4 | Delete `implementation_plan1.md` (byte-identical dupe); **reviewer chose: keep `implementation_plan2.md`** | 🟡 READY FOR REVIEW | reviewer |
| D5 | `AutonoumsAi/` audit — **reviewer chose Option A (delete the folder)** | ⬜ READY TO EXECUTE | claude |
| D6 | Add `Docs/INDEX.md` — one-page nav guide listing every md with a 1-sentence purpose | ⬜ READY TO EXECUTE | claude |
| D7 | Verification gate: grep for any straggling `.png` references; confirm no broken links in any md file | ⬜ READY TO EXECUTE | claude (after D1–D6) |

> Dependencies:
> - All execution workstreams (D1–D7) blocked on D0 (reviewer plan-acceptance).
> - D7 runs last.
> - D1 must run before D7 (D7 grep depends on the file set after deletions).

---

## D0 — Plan-acceptance pass

**Goal:** reviewer reads this plan, files pre-coding notes (if any) in the table at top, then either:
- (a) marks each of D1–D7 as `✅ APPROVED for execution` (sets `Next action by: claude`), OR
- (b) marks the plan `❌ CHANGES REQUESTED` and lists what needs to change.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Next action by:** claude

### Acceptance criteria (for the reviewer)

- [x] Audit table in §1.3 spot-checked against `Get-FileHash` output — confirm the two duplicate-hash pairs — *verified: `me_capture_fresh_v2.png` ≡ `me_plan_after.png` (`D8A4224F7327372194B49656A113ABA5`); `me_check_state.png` ≡ `me_plan_after_preferences.png` (`6691A5175180581A8FB3B779C60351C1`). All 14 PNG hashes + sizes match the §1.3 table exactly.*
- [x] §1.1 dupe of `implementation_plan.md` vs `implementation_plan1.md` spot-checked (`Get-FileHash` both files) — *both `FA84C2C2C41BED5D7F312CC6335BCDDA`, 6042 B. `implementation_plan2.md` distinct (`E9F3AEEF36061F69165BAE235E842A8D`, 3238 B).*
- [x] §1.2 finding that `STATE.md` is zero bytes spot-checked — *confirmed 0 bytes via `Get-ChildItem`.*
- [x] D3's "either cite or delete" framing is acceptable — **reviewer decision: Option A (delete).** The 4 extras (`bottom`/`lower`/`scrolled_2`/`security`, ~816 KB total) add marginal evidence over the 3 already-cited captures; not worth keeping unreferenced material.
- [x] D5's "delete or rename" framing is acceptable — **reviewer decision: Option A (delete the folder).** Verified `AutonoumsAi` is referenced nowhere outside this plan; the inline status-table protocol is the one actually used by me_plan/scan_plan. Unused parallel protocol → delete.
- [x] If reviewer wants a different target shape in §2 — *no reshaping requested; the flat `Docs/` + `UiUpdateRuleset/` layout is fine. INDEX.md (D6) covers navigability.*
- [x] No risk of accidentally deleting referenced material — *confirmed: the 3 keepers, 12+ root md files, and 6 UiUpdateRuleset plan files are all out of D1–D5 scope. Additionally confirmed no PNG is embedded as a markdown image anywhere in `Docs/**`, so deletions cannot break a rendered link.*

### Reviewer hand-back

If approved: set `Last action by: reviewer` + `Next action by: claude` at top of plan, flip every D-workstream status from `⬜ TODO` to `⬜ READY TO EXECUTE`, add a one-line approval note here.

If changes requested: file pre-coding notes in the table at top of plan, leave statuses `⬜ TODO`, set `Next action by: claude` so claude can revise.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (reviewer, 2026-05-29) | **APPROVED for execution.** Independently re-ran `Get-FileHash -Algorithm MD5` on all 14 UiUpdateRuleset PNGs + the 3 `implementation_plan*.md` files, and `Get-ChildItem` on `AutonoumsAi/` — every size and hash in §1.1/§1.3 is accurate, both duplicate-hash pairs confirmed, `STATE.md` is 0 bytes. `Grep` confirms `AutonoumsAi` and `implementation_plan1` are referenced nowhere outside this plan, and that **no PNG is embedded as a markdown image (`![](…)`)** anywhere in `Docs/**` — all references are prose/backtick text. Decisions: D3→A (delete), D5→A (delete), D4→keep plan2. Three pre-coding notes filed at top — note #1 (grep re-scoping) is the one that matters for execution: the bare-filename broken-ref greps in D1/D2/D4/D7 will hit this plan's own audit tables and never return zero, so re-scope them to exclude `docs_cleanup_plan.md` or match link/image syntax only. Not blocking approval since it's a verification-method fix, not a plan-substance problem. | Closed |

---

## D1 — Delete byte-identical PNG duplicates (zero-risk)

**Goal:** delete the 2 PNG files in `Docs/UiUpdateRuleset/` that are confirmed byte-identical (same MD5) to a referenced keeper. Zero visual content lost.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer (D1 review 2026-05-29)
- **Next action by:** claude (proceed to D2)
- **Reviewer note (applied):** pre-coding note #1 honored — broken-ref grep scoped via `--glob '!docs_cleanup_plan.md'` so the plan's own audit-table mentions don't false-positive.

### Acceptance criteria

- [x] Delete `Docs/UiUpdateRuleset/me_capture_fresh_v2.png` (MD5 `D8A422…`, dup of `me_plan_after.png`) — *deleted; `Glob` confirms file gone.*
- [x] Delete `Docs/UiUpdateRuleset/me_check_state.png` (MD5 `6691A5…`, dup of `me_plan_after_preferences.png`) — *deleted; `Glob` confirms file gone.*
- [x] Re-run `Get-FileHash -Algorithm MD5` against the remaining keepers — confirm `me_plan_after.png` and `me_plan_after_preferences.png` still on disk with their original hashes — *verified: `me_plan_after.png` = `D8A4224F7327372194B49656A113ABA5` ✓; `me_plan_after_preferences.png` = `6691A5175180581A8FB3B779C60351C1` ✓. Exact match to §1.3 audit table.*
- [x] `Grep "me_capture_fresh_v2\|me_check_state"` across all of `Docs/**` returns zero matches (no broken refs) — *scoped per pre-coding note #1: `Grep` with `--glob '!docs_cleanup_plan.md'` returns "No matches found". The plan file itself still names both for traceability; that's expected.*

### Files expected to change

- delete `Docs/UiUpdateRuleset/me_capture_fresh_v2.png` ✅
- delete `Docs/UiUpdateRuleset/me_check_state.png` ✅
- _no md file edits — these aren't referenced anywhere outside this plan_

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (claude self-note, 2026-05-29) | Pre-coding note #1 applied: used `Grep` with `--glob '!docs_cleanup_plan.md'` rather than the bare-filename grep the original AC suggested. Real broken-ref risk for these two files is `Docs/UiUpdateRuleset/me_plan.md` (the only file outside this plan that references PNG names in prose); the scoped grep confirms it doesn't mention `me_capture_fresh_v2` or `me_check_state`. | Closed by reviewer round 2. |
| 2 (reviewer, 2026-05-29) | **APPROVED.** Independently re-verified against ground truth (didn't trust the dev's notes): UiUpdateRuleset PNG count is now 12 (was 14) and the two gone are exactly `me_capture_fresh_v2.png` + `me_check_state.png`; both keepers present with original hashes (`me_plan_after.png` `D8A4224F…`, `me_plan_after_preferences.png` `6691A5…`); my own `Grep "me_capture_fresh_v2\|me_check_state"` over `Docs/**` with `--glob '!docs_cleanup_plan.md'` returns zero matches. Dev's pre-coding-note-#1 scoping is exactly right — the scoped grep is the correct broken-ref check, not the bare-filename one. All 4 ACs satisfied. (Note: a poll race had me briefly see the deletions before the dev flipped the status to READY FOR REVIEW — confirmed it was just timing, not an out-of-band edit.) D1 done; ball to claude for D2. | Closed |

---

## D2 — Delete pre-state / phone scratch PNGs

**Goal:** delete 5 PNGs that look like scratch captures (pre-W1 hero state, ad-hoc phone shots) and aren't cited in any plan.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer (D2 review 2026-05-29)
- **Next action by:** claude (proceed to D3)
- **Reviewer note (applied):** none of the 5 preserved (no pre-coding note overrode D2). Pre-coding note #1 honored on the final grep via `--glob '!docs_cleanup_plan.md'`.

### Acceptance criteria

- [x] Delete `Docs/UiUpdateRuleset/me_capture_current.png` (172 KB) — *deleted; `Glob` confirms 7 remaining PNGs and file is absent.*
- [x] Delete `Docs/UiUpdateRuleset/me_capture_fresh.png` (438 KB) — *deleted; `Glob` confirms.*
- [x] Delete `Docs/UiUpdateRuleset/phone_initial.png` (29 KB) — *deleted; `Glob` confirms.*
- [x] Delete `Docs/UiUpdateRuleset/phone_now.png` (2.5 **MB** — the heaviest single file in Docs) — *deleted; `Glob` confirms.*
- [x] Delete `Docs/UiUpdateRuleset/phone_review.png` (183 KB) — *deleted; `Glob` confirms.*
- [x] `Grep "me_capture_current\|me_capture_fresh\|phone_initial\|phone_now\|phone_review"` across all of `Docs/**` returns zero matches — *scoped per pre-coding note #1 with `--glob '!docs_cleanup_plan.md'`: "No matches found". This plan's own audit references for these 5 names remain as the only mentions in `Docs/**`, which is the expected outcome.*

### Files expected to change

- delete the 5 PNGs above ✅
- _no md file edits — none of these are referenced outside this plan_

### Risk note

These look like working scratch the developer kept around. **If reviewer wants any of them preserved**, file a pre-coding note in D0 specifying which ones — D2 will be revised before running.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (claude self-note, 2026-05-29) | Pre-coding note #1 applied (`--glob '!docs_cleanup_plan.md'`). ~3.2 MB reclaimed — largest single contributor was `phone_now.png` (2.5 MB). UiUpdateRuleset/ now holds 7 PNGs (3 keepers + 4 D3 targets). | Closed by reviewer round 2. |
| 2 (reviewer, 2026-05-29) | **APPROVED.** Independently verified against ground truth: total Docs file count 37→32; UiUpdateRuleset PNG count 12→7; `Test-Path` on all 5 D2 targets (`me_capture_current`, `me_capture_fresh`, `phone_initial`, `phone_now`, `phone_review`) returns False — all gone; the 7 survivors are exactly the 3 keepers + the 4 D3 targets, no keeper collateral. My own `Grep` for the 5 names over `Docs/**` with `--glob '!docs_cleanup_plan.md'` returns zero matches (note #1 correctly applied). All 6 ACs satisfied. Irreversibility (not a git repo) acknowledged at D0; these were uncited scratch, so the call stands. D2 done; ball to claude for D3 (delete the 4 emulator captures, Option A). | Closed |

---

## D3 — Decision on extra emulator captures

**Goal:** the 4 "extra" emulator captures (`me_plan_after_bottom`, `_lower`, `_scrolled_2`, `_security`) cover sections of the Me screen that the existing W8 inbox row only partially attributes. Two options:

- **Option A (delete):** they're redundant with the 3 already-cited ones. Just remove and save ~810 KB.
- **Option B (cite):** edit `me_plan.md` W8 inbox row (line 55) to add the 4 file names + what they show, then keep on disk.

Reviewer's call in D0. Default if reviewer doesn't specify: **Option A (delete)** — they're below the bar of evidence value for keeping unreferenced material.

### Status

- **Status:** ✅ APPROVED (Option A — delete)
- **Last action by:** reviewer (D3 review 2026-05-29)
- **Next action by:** claude (proceed to D4)
- **Reviewer note:** execute the "Option A (delete)" AC block only; ignore the Option B (cite) block. Apply pre-coding note #1 to the grep. **Protocol note:** the 4 deletions landed on disk but the developer never updated D3's plan section (boxes unticked, status never flipped to 🟡); reviewer approved on verified ground truth — see review log.

### Acceptance criteria (Option A — default)

- [x] Delete `Docs/UiUpdateRuleset/me_plan_after_bottom.png` — *gone; `Test-Path` False*
- [x] Delete `Docs/UiUpdateRuleset/me_plan_after_lower.png` — *gone; `Test-Path` False*
- [x] Delete `Docs/UiUpdateRuleset/me_plan_after_scrolled_2.png` — *gone; `Test-Path` False*
- [x] Delete `Docs/UiUpdateRuleset/me_plan_after_security.png` — *gone; `Test-Path` False*
- [x] `Grep` confirms no references — *scoped per pre-coding note #1 (`--glob '!docs_cleanup_plan.md'`): "No matches found". UiUpdateRuleset now holds exactly the 3 keepers.*

### Acceptance criteria (Option B — if reviewer overrides)

- [ ] Files stay on disk
- [ ] `me_plan.md:55` W8 inbox row extended with explicit citations for each
- [ ] tsc/eslint untouched (md-only edit)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (reviewer, 2026-05-29) | **APPROVED (Option A).** Verified against ground truth: total Docs file count 32→28; UiUpdateRuleset PNG count 7→3; `Test-Path` on all 4 D3 targets (`me_plan_after_bottom/_lower/_scrolled_2/_security`) returns False — all gone; the 3 survivors are exactly the keepers with original hashes (`D8A4224F…`, `6691A5…`, `E3B36F…`), no keeper collateral. My own `Grep` for the 4 names over `Docs/**` with `--glob '!docs_cleanup_plan.md'` returns zero matches (note #1 applied). All 5 Option-A ACs satisfied; Option B correctly skipped. **Protocol deviation (non-blocking):** unlike D1/D2, the developer performed the deletions on disk but never updated D3's plan section — boxes stayed unticked, status never flipped to 🟡 READY FOR REVIEW, handoff stayed on claude across 2+ poll cycles. Reviewer detected via the file-count drop and approved on verified ground truth. **Developer: please flip status to 🟡 READY FOR REVIEW when a workstream's disk work is done, so the handoff stays in sync — for D4/D5/D6 follow the D1/D2 pattern.** ~810 KB reclaimed. D3 done; ball to claude for D4. | Closed |

---

## D4 — Delete `implementation_plan1.md` (byte-identical dupe)

**Goal:** `implementation_plan.md` and `implementation_plan1.md` are byte-identical (MD5 `FA84C2…`, 6042 bytes each). Keep the canonical one. Reviewer decides whether `implementation_plan2.md` (distinct, 3238 bytes) should stay, be renamed, or be archived under a `v0/` subfolder.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude (D4 finished 2026-05-29)
- **Next action by:** reviewer
- **Reviewer note (applied):** deleted only `implementation_plan1.md`. Kept `implementation_plan2.md` per D0 decision (D6 will index it with the "distinct earlier/branched plan" hook). Pre-coding note #1 honored: `Grep` scoped via `--glob '!docs_cleanup_plan.md'` against the whole `greenBridge/` tree.

### Acceptance criteria

- [x] Delete `Docs/implementation_plan1.md` — *deleted; `Glob` shows only `implementation_plan.md` and `implementation_plan2.md` remain.*
- [x] `Grep "implementation_plan1"` across the whole repo (not just Docs) returns zero matches — *scoped per pre-coding note #1 with `--glob '!docs_cleanup_plan.md'`: "No matches found" across `C:\Users\Pc\Desktop\greenBridge\**`. The plan file itself still names it for traceability; that's expected.*
- [x] For `implementation_plan2.md`: reviewer specifies one of (keep / rename / delete / archive). Default if not specified: **keep** — it's distinct content and small (3 KB). — *reviewer decision: keep. File untouched.*

### Files expected to change

- delete `Docs/implementation_plan1.md` ✅
- ~~(conditional on reviewer) rename or delete `Docs/implementation_plan2.md`~~ — N/A (reviewer chose keep).

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (claude self-note, 2026-05-29) | Pre-coding note #1 applied (`--glob '!docs_cleanup_plan.md'`) for the cross-repo grep. Reviewer's "keep `implementation_plan2.md`" decision honored — only the byte-identical `implementation_plan1.md` removed. D6 acceptance criteria already require the index to call out `implementation_plan2.md` as a distinct earlier/branched plan, so the cold-reader confusion risk is covered downstream. | Open for reviewer |

---

## D5 — `AutonoumsAi/` audit

**Goal:** the `Docs/AutonoumsAi/` folder defines a two-agent protocol (CURRENT_AGENT polling, status lifecycle) but isn't actually used by `me_plan.md` or `scan_plan.md` (those use the inline status-table pattern). `STATE.md` is 0 bytes. Two options:

- **Option A (delete):** the inline pattern won — this template adds confusion. Recommended.
- **Option B (rename + populate):** keep as a reusable generic template at `Docs/agent-protocol/`. Populate `STATE.md` with example content showing how it's meant to be used.

Default if reviewer doesn't specify: **Option A (delete)** — unused parallel protocols rot. The me_plan/scan_plan pattern is the documented one in practice.

### Status

- **Status:** ⬜ READY TO EXECUTE — **reviewer chose Option A (delete the folder)** (2026-05-29)
- **Last action by:** reviewer (D0 approval)
- **Next action by:** claude
- **Reviewer note:** execute Option A only — delete `DEVELOPER.md`, `REVIEWER.md`, `STATE.md`, and the empty `AutonoumsAi/` folder. Ignore Option B (and its `git mv` — see pre-coding note #2; not a git repo). Apply pre-coding note #1 to the `AutonoumsAi` grep.

### Acceptance criteria (Option A — default)

- [ ] Delete `Docs/AutonoumsAi/DEVELOPER.md`
- [ ] Delete `Docs/AutonoumsAi/REVIEWER.md`
- [ ] Delete `Docs/AutonoumsAi/STATE.md`
- [ ] Delete the now-empty `Docs/AutonoumsAi/` folder
- [ ] `Grep "AutonoumsAi"` across the whole repo returns zero matches

### Acceptance criteria (Option B — if reviewer overrides)

- [ ] `git mv Docs/AutonoumsAi/ Docs/agent-protocol/` (or rename via filesystem)
- [ ] Populate `STATE.md` with example fields (CURRENT_AGENT, STATUS, ACTIVE_WORKSTREAM, etc.) and a 1-line note at top: "Template only — actual operational plans use the inline status table pattern, see me_plan.md."
- [ ] Cross-reference the new path from `INDEX.md` (built in D6)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## D6 — Add `Docs/INDEX.md`

**Goal:** one-page navigation guide. For each md in `Docs/` (after D1–D5 dust settles), one line: `- [Title](path.md) — one-sentence purpose`. This is the missing piece that makes the tree readable cold.

### Status

- **Status:** ⬜ READY TO EXECUTE (D0 approved 2026-05-29)
- **Last action by:** reviewer (D0 approval)
- **Next action by:** claude
- **Reviewer note:** apply pre-coding note #3 — `INDEX.md` must list itself, `docs_cleanup_plan.md`, `scan_v3_plan.md`, and `implementation_plan2.md` (the last with a "distinct earlier/branched plan, kept per D4" hook).

### Acceptance criteria

- [ ] New file `Docs/INDEX.md` exists
- [ ] Each surviving md in `Docs/` and `Docs/UiUpdateRuleset/` listed exactly once
- [ ] Each entry has a 1-line purpose hook (under ~120 chars), e.g.:
  - `- [STARTER_KIT.md](STARTER_KIT.md) — RN stack baseline (Zustand + React Query + MMKV); read before adding deps.`
  - `- [UiUpdateRuleset/me_plan.md](UiUpdateRuleset/me_plan.md) — Settings/Profile redesign (W1–W8, complete).`
- [ ] No file under `Docs/**` (md or otherwise) is missing from the index
- [ ] No entry points to a file that doesn't exist (i.e. nothing referencing the files D1/D2/D3/D4/D5 deleted)

### Files expected to change

- new `Docs/INDEX.md`

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## D7 — Verification gate

**Goal:** prove nothing got broken. Mirror me_plan.md W8 + scan_plan.md S8.

### Status

- **Status:** ⬜ READY TO EXECUTE after D1–D6 (D0 approved 2026-05-29)
- **Last action by:** reviewer (D0 approval)
- **Next action by:** claude (runs last)
- **Reviewer note:** apply pre-coding note #1 to BOTH grep ACs here — scope out `docs_cleanup_plan.md` (its audit tables name every deleted file) or match only markdown link/image syntax. Reviewer pre-confirmed no PNG is embedded as `![](…)` in `Docs/**`, so the real check is "no rendered `](…)` link points at a deleted file," not "the filename string is absent."

### Acceptance criteria

- [ ] `Grep "\.png"` across `Docs/**` returns only paths that exist on disk (no broken image refs)
- [ ] `Grep "\.md"` across `Docs/**` returns only paths that exist on disk (no broken internal links — `INDEX.md` is the highest-risk file here since it's net new)
- [ ] `Get-ChildItem Docs/ -Recurse -File` count is consistent with the §2 target shape
- [ ] No source-tree changes (run a quick `git status` on `GreenBridgeApp/` excluding `Docs/` if this is the active git directory; otherwise note "n/a" — the project memory says `Is a git repository: false` for the parent dir)
- [ ] `npx tsc --noEmit` from `GreenBridgeApp/` still exits 0 (sanity — should be unaffected by md-only edits, but easy to verify and matches the discipline of me_plan W8 / scan_plan S8)

### Files expected to change

None — this is a verification gate.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## Reviewer instructions

When picking up D0 (plan-acceptance pass):
1. Read this whole file.
2. Run the audit spot-checks listed in D0's acceptance criteria — at minimum the two `Get-FileHash` confirmations (PNG pair + implementation_plan pair) and the 0-byte STATE.md check.
3. For D3 and D5, the plan says "default to Option A (delete)" — if you disagree, file a pre-coding note at top of plan saying so. Don't reject the plan over a default choice — defaults are explicit so the loop doesn't stall.
4. If everything passes: at top of plan, set `Last action by: reviewer`, `Next action by: claude`. Add a one-line approval to D0's review log. Optionally flip every other workstream's status from `⬜ TODO` to `⬜ READY TO EXECUTE` (or leave them `⬜ TODO` and let claude pick D1 first per its own dependency order).
5. If issues: file pre-coding notes, leave statuses `⬜ TODO`, set `Next action by: claude` so claude can revise the plan before running anything.

When picking up D1–D6 reviews:
1. Read only the workstream's "Files expected to change" plus the affected `Get-ChildItem` snapshot.
2. Tick acceptance-criteria boxes against ground truth — don't tick boxes you didn't verify.
3. Approve or request changes per the standard protocol.

---

## claude instructions (for future turns)

1. Read this file first. If `Next action by:` says `reviewer`, **stop**. The reviewer hasn't acted yet.
2. If `Next action by:` says `claude`:
   - If the top-level state is post-D0-approval: find the first workstream in dependency order with status `⬜ TODO` or `⬜ READY TO EXECUTE` and start it.
   - If there are pre-coding notes filed: revise the plan to incorporate them before running any D-workstream.
3. Flip the workstream's status to `🔄 IN PROGRESS`, update `Last action by: claude`.
4. Do the work. Tick acceptance-criteria boxes as you verify them.
5. When done, flip to `🟡 READY FOR REVIEW`, update `Next action by: reviewer`, **stop**.
6. Never tick a checkbox you didn't actually verify. Never delete a file outside the workstream's "Files expected to change" list.
7. **For deletions:** the user has authorized deletion of files identified in this plan. But if a `Grep` check during execution reveals an unexpected reference to a file slated for deletion, **stop** and file a finding in the reviewer inbox rather than deleting anyway. Reversibility note: per the project memory, this directory is not a git repo, so deletions are not recoverable from git — treat each delete with care.
