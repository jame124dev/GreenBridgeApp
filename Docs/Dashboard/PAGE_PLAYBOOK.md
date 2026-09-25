# PAGE_PLAYBOOK.md — how to build one dashboard page

**Say this and nothing else:**

> Build `<page>` following `Docs/Dashboard/PAGE_PLAYBOOK.md`.

That is the whole instruction. Everything below is what happens next, so it
does not have to be explained again. Derived from building
`/v2/dashboard/bids` on 2026-09-23 across about a dozen rounds of correction —
each step below exists because skipping it cost time that day.

**The page list and their order:** `src/features/v2/dashboard/nav.ts`
(`DASHBOARD_GROUPS`). Buyer, all six built 2026-09-24 — My bids ✅ phase 2,
Watchlist ✅ phase 2, Inspections ✅ (wired, unverified on real rows — test
buyer has none), Orders & requests, Order detail & tracking (no in-app entry
point yet — see its route file), Buying home. Seller (not started): Bids on
my listings, Offers received, Orders, Shipments — same flow, follow this doc.

---

## The rule the whole playbook serves

> Clone the template repo into `ui_git_repo/`, copy its files into our
> codebase, then adjust them there. **Do not build it yourself.**

Set by the user and repeated four times on 2026-09-23 before it stuck. It is a
decision, not a proposal — **do not re-litigate it per page.** If a particular
copy looks like a bad idea, do it anyway and say why afterwards with the result
in hand. Once, the objection was "our kit already has tabs"; the copied tab bar
turned out to be better than ours. A comparison beats a prediction.

Hand-rolling is allowed **only** when the search genuinely finds nothing, and
then the file must say so in its header.

---

## Step 0 — read these four, in this order

| File | What you need from it |
|---|---|
| `Docs/Dashboard/<side>/<page>/phase-1-ui.md` | what this page is, what to take from the web |
| `Docs/Dashboard/README.md` § 1 | why only ~24% of a web page copies (the other 76% is `<div>`/`className`) |
| `ui_git_repo/README.md` | the clone rules, the licence rule, the expo-router ban |
| `.claude/skills/v2-screen/SKILL.md` | tokens, primitives, the five traps, both halves of "done" |

⚠️ **Plan docs are not evidence.** The phase md files were written in one pass
and three citations in them were already wrong. Before implementing any claim,
check it and output `Claim | file:line | VERIFIED / WRONG / UNVERIFIED`.

---

## Step 1 — take the contract from the web, not the markup

The web app is next door at `../nextjs-port` — it is checked out, do not clone it.

⚠️ **There are THREE copies of each RTK slice.** `src/rtk/slices/`,
`src/scanflow/rtk/slices/` and `src/services/api/slices/` all define
`BuyerBidItem` at line 34 and differ only in details. **The live one is
`src/services/api/slices/`** — confirmed by what the page imports
(`nextjs-port/src/shared/pages/buyer/MyBids.tsx:25-26`). Cite the full path,
never the bare filename.

Copy **verbatim** into `src/features/v2/<page>/types.ts`:

- the response interface (`BuyerBidItem` — `services/api/slices/buyerApiSlice.ts:34`)
- the endpoint and its query params (`…:315`)
- status → label maps and step tables, read off the page component
  (`shared/pages/buyer/MyBids.tsx`)
- formatters: currency, dates, lot numbers

Copy **nothing** of the JSX. It is `<div>`, `className=` and shadcn
`<Table>`/`<Dialog>`/`<Select>`; React Native has none of those.

---

## Step 2 — find a React Native repo for the LAYOUT and clone it

Not the web app — a real Expo app whose interaction already exists.

```bash
cd ui_git_repo
git clone --depth 1 <url> <short-name>
```

Already cloned, check before adding a fourth:

| Directory | Source | Licence | Good for |
|---|---|---|---|
| `obytes-template/` | obytes/react-native-template-obytes | MIT | list screens, cards, the route↔screen split |
| `collapsible-tabs/` | PedroBern/react-native-collapsible-tab-view | MIT | tab bars, sliding indicators, sticky headers |
| `drawer-expo-router/` | syednomishah/Drawer-Navigation-Expo-Router | ⚠️ **none** | read-only reference, copy nothing |

Before cloning anything new:

1. **Licence first, not after copying.** MIT/Apache-2.0/ISC → vendor it and keep
   a header naming the source. **No licence file = all rights reserved** → read
   it, take the approach, write our own, and say so in the file.
2. **Check the stack.** Expo + **expo-router** + React Query. A React Navigation
   or Apollo template costs more to convert than to write.
3. ⚠️ **Check for framework bans before installing its dependencies.**
   expo-router 56 forbids direct `@react-navigation/*` imports and Metro
   enforces it at bundle time — one such import took the whole app down with
   "Failed to compile" on every route, not just the screen that did it.
   `grep -rn "no longer compatible" node_modules/expo/node_modules/@expo/cli`
   finds the rule in seconds. When the framework ships a wrapper
   (`expo-router/drawer`), **the wrapper is the API**.

---

## Step 3 — `cp` the files, then adjust. In that order.

```bash
cp ui_git_repo/<repo>/src/<their-file>.tsx src/features/v2/<page>/<our-name>.tsx
```

Then edit **in place**. Do not read theirs and retype it — that is building,
and the diff is the value: it shows what we changed and what we inherited.

Kebab-case the copied filenames (`bid-card.tsx`), so a copied file is visibly
not a kit file (`BidCard.tsx`).

**Every copied file opens with this header.** Non-negotiable — it is the
licence compliance *and* the record of what was adjusted:

```tsx
/**
 * COPIED from <repo name> and adjusted in place.
 *
 *   source: ui_git_repo/<repo>/<path>
 *   repo:   <url>
 *   licence: MIT — Copyright (c) <year> <holder>
 *
 * Their shape, kept: <what survived and why it was worth taking>
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | ... | ... | ... |
 */
```

### The adjustments that are always needed

| Theirs | Ours | Enforced by |
|---|---|---|
| `className="..."` (NativeWind) | `StyleSheet.create` + tokens | `v2Adherence` |
| `#2196f3`, `rgba(0,0,0,1)` | `c.accent` from `useV2Colors()` | `v2Adherence` |
| `fontSize: 14` | `<Text variant>` or `type.bodySemi` | `v2Adherence` |
| `style={({pressed}) => …}` | `usePressFeedback()` | `v2Adherence` + trap 1 |
| `borderRadius: 12`, `padding: 16` | `radius.md`, `space.lg` | `v2Adherence` |
| RN `Pressable` | RNGH `Pressable` | taps die inside a pager otherwise |
| `height: 48` | `MIN_TOUCH` | convention |
| keyExtractor by index | by a stable id | a filtered list recycles rows |
| their empty state | our `EmptyState` | it must carry the action that FILLS it |

Any `backgroundColor: c.*` needs `MaterialFill` or a `// flat: <reason>` comment
within 8 lines above, or `v2MaterialCoverage` fails.

### Two that bit on the second page

**A copied `<Link href={...}>` will not compile.** Expo-router's `Href` is a
union over every route in the app, and it is now large enough that tsc gives up
distributing it through a conditional:
`TS2590: Expression produces a union type that is too complex to represent`.
Annotating `Href | null` only moves the error into the JSX. Use
`router.push(routes.x(id))` in an `onPress` — no generic, no union — and keep
`accessibilityRole="link"` for the semantics `<Link>` was giving you.

**Where the ramp goes on a card with a photo.** `MaterialFill` is absolutely
filled, so putting it on a card whose top half is an image runs a gradient over
the photograph. Paint and ramp the *text block* instead, and leave the image
area alone (`Row.tsx:248` says the same thing: "A photograph is not a surface").

### Do not touch `src/features/v2/ui/`

The kit is reconciled in one hand. If the copy needs something the kit lacks,
keep it in the page's own folder and note it as a **KIT GAP** in
`Docs/V2_CHECKLIST.md`. Three screens once independently rebuilt the brand bar;
that is the drift this rule prevents.

---

## Step 4 — fixtures, then the route

`src/features/v2/<page>/__fixtures__/<page>.ts` — **one row per status**, plus
the nasty cases: the longest real title (AI titles here run past 90
characters), a missing image, an empty field. A screen designed around
plausible data breaks on real data.

⚠️ **At least one fixture image must actually LOAD, and an invented URL does
not.** The watchlist fixture used seven plausible-looking URLs
(`https://images.greenbidz.com/lots/5091-1.jpg`) that resolve to nothing, so
every tile rendered the "No photo" placeholder and the working-image path was
never exercised on the device at all. A fixture that fails uniformly proves
only the fallback. Use a `data:` URI — it always loads, needs no network and
cannot rot — and keep one deliberately dead URL so `onError` stays covered.

Route file `app/v2/dashboard/<page>.tsx` is a thin wrapper:

```tsx
<Screen
  header={<DashboardBar title="<Page name>" />}
  scroll={false}          // the list scrolls, not the Screen
  tabBar={false}
  contentStyle={styles.fill}   // flex: 1, or a FlashList collapses
  testID="v2-<page>"
>
  <PageScreen />
</Screen>
```

Then register it, or the page is unreachable:

1. `src/features/v2/dashboard/nav.ts` — give the row an `href`, drop its `note: 'Soon'`
2. `src/lib/routes.ts` — add the typed route
3. `src/__tests__/v2Inventory.test.ts` — it enumerates routes and will fail otherwise

### Header rule, learned the hard way

**The page name goes in `DashboardBar title`. Nothing else above the list.**
The first bids page had `DashboardBar` + a 27pt display title + a subtitle +
tabs: ~500px of chrome before the first row, and two cards visible. Deleting
the title and subtitle took it to ~330px and three and a half cards. A subtitle
that explains a screen called "My bids" to someone who just tapped "My bids" is
noise. There is no header component worth copying in any of the three repos —
this is a deletion, not a port.

---

## Step 5 — gates

```bash
npx tsc --noEmit
npx jest src/__tests__/v2Adherence.test.ts src/__tests__/v2Contrast.test.ts \
         src/__tests__/v2MaterialCoverage.test.ts src/__tests__/v2Inventory.test.ts
npx jest        # no NEW failures
```

Other sessions work in this repo concurrently. **Before claiming a red gate,
check whether the failing file is yours** — on 2026-09-23 `v2MaterialCoverage`
was red on `app/v2/scan/item.tsx`, which belonged to someone else.

⚠️ **The same applies to a broken bundler, and there the temptation is worse.**
An HTTP 500 from Metro blocks *your* device pass, so the urge is to fix
whatever it names. Check the file's mtime first: on 2026-09-23 the watchlist
page was blocked by a `SyntaxError` in `app/v2/scan/items.tsx` whose mtime was
**17 seconds old** — another session was mid-edit. Editing it would have
clobbered live work to unblock a screenshot. Poll for recovery, say the device
pass is blocked, and do not mark the page done.

---

## Step 6 — verify. Web for the layout, device for the controls.

### 6z. Use WEB first — it is far faster, and it cannot press your controls

```bash
npx expo start --web --port 8083     # web is a supported dev surface: app.config.ts:157
```

Then drive `http://localhost:8083/v2/dashboard/<page>` with Chrome DevTools MCP.
No install, no bundle wait, no route-tree restart — an edit is on screen in
seconds, where the device costs 2–3 minutes per change.

Dump the text rather than hunting selectors; it checks every fixture edge case
at once:

```js
() => document.body.innerText
```

⚠️ **What web CANNOT do: press a v2 control.** Anything built with
`usePressFeedback` — Tabs, Row, cards, tiles — is
`Animated.createAnimatedComponent(RNGH Pressable)`, and that is **inert in the
browser**. A plain RNGH `<Pressable>` works, which is what makes the failure
confusing. Home's Selling/Buying tab is dead on web too, so this is not your
screen. Full write-up in `Docs/v2/TRAPS.md` § "The WEB surface cannot press
most v2 controls".

So: **layout, content, fixtures, empty states, both schemes and the drawer on
web; every control press on the device.** Do not report a browser click that
did nothing as a defect.

### Then the device. This is where "done" is decided.

Green gates prove nothing. Every defect found that day was invisible to all of
them: a blank grey image box, a title printed twice, a dead hamburger, a row
navigating to the wrong screen.

### 6a. Find the Metro port — never assume it

```bash
for p in 8081 8082; do echo "=== :$p ==="; curl -s --max-time 4 "http://127.0.0.1:$p/json/list" | head -c 200; echo; done
```

The right port names `com.greenbidz.bridge (realme RMX2151)`. The wrong one
returns `[]`. **Both have been Metro for this same app at once**, and a probe
aimed at the unattached one returns a fresh, green, entirely irrelevant answer.

### 6b. Prove the bundle is fresh BEFORE testing

```bash
code=$(curl -s -o /tmp/b.js -w "%{http_code}" \
  "http://127.0.0.1:<port>/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false")
echo "HTTP $code"
grep -c '<a string you just added>' /tmp/b.js    # must be > 0
grep -c '<a string that was already there>' /tmp/b.js   # the control
```

A broken Metro serves the LAST GOOD bundle with no redbox and no error — it
looks exactly like your code not working. The control string matters because a
failed download also greps to `0`. Fix with `npx expo start --clear`.

### 6c. Open the page and press every control

```bash
adb shell am start -a android.intent.action.VIEW -d "greenbridge://v2/dashboard/<page>"
adb shell dumpsys window | grep mCurrentFocus     # must name com.greenbidz.bridge
adb exec-out screencap -p > Docs/AuthScreenImg/<page>-1.png
```

On Windows/MSYS prefix adb with `MSYS_NO_PATHCONV=1`.

Rules, each one paid for:

- **ONE `adb input` per command.** Batching four taps once backgrounded the app
  and the remaining taps landed on the launcher, opening a screen-share app on
  the user's personal phone.
- **Derive every coordinate from a screenshot taken AFTER the last state
  change, in the same turn as the tap.** A remembered coordinate is a stale
  measurement. Multiply by the displayed→original scale factor.
- **Long-press the magenta `SYS → LIGHT` pill to hide it first.** It floats over
  the bottom-left of every v2 screen, has sat on top of three real controls, and
  `uiautomator` cannot see occlusion — the tap just never arrives.
- **A screenshot proves appearance, not function.** N controls means N presses.
- **For a filter or sort, the acceptance test is "the results changed"**, never
  "the control changed". A typed query param the server ignores looks perfect
  and returns a byte-identical list.
- Read the view tree for text assertions:
  ```bash
  adb shell uiautomator dump /sdcard/d1.xml      # unique filename each time; do NOT redirect stderr
  adb shell cat /sdcard/d1.xml | tr '>' '\n' | grep -o 'text="[^"]*"' | grep -v 'text=""'
  ```
  Reusing one filename silently re-reads the previous dump when the command fails.
- **Both colour schemes.** This design carries its structure in hairlines and
  washes, which are exactly what stop working when the ground changes.

### 6d. Then look at the screenshot properly

Not "does it render" — these are the questions that found real defects:

- Is anything printed **twice**? (A missing product title fell back to
  `Batch #1029` and the meta line below repeated it verbatim.)
- Is any image area **blank**? (A dead URL renders an empty box, silently. Every
  `<Image>` needs `onError` → the same placeholder a missing image gets.)
- **On a rounded card with an image, sample the corner — do not look at it.**
  `overflow: 'hidden'` + `borderRadius` on the parent is enough on iOS and not
  on Android: the clip does not apply to a child `<Image>`, so the photo gets
  square top corners inside a rounded card. It is a ~16px detail the eye cannot
  call at phone scale. Give the image its own `borderTopLeftRadius` /
  `borderTopRightRadius`, then verify: along the corner diagonal the pixels
  must stay background for about `0.293 × radius` (in device px —
  `radius_dp × 1080/423` here), and the middle of the top edge must still be
  image, or the crop shrank instead of rounding.
- Does anything **navigate to the wrong place**? A row with no valid destination
  gets **no** `onPress` — a wrong destination is worse than none.
- Is the copy saying the same thing twice in two sizes?
- Does it read as one screen with the other eleven?

---

## Step 7 — write it down, in these three places

1. **`Docs/V2_CHECKLIST.md`** — append a section for the page: the copy table
   (part → source repo → our file → what was adjusted), the device pass with
   row counts per control, the defects found, what is still open.
2. **`Docs/Dashboard/<side>/<page>/phase-1-ui.md`** — tick it, and correct
   anything the build proved wrong.
3. **`../MISTAKES.md`** — the moment a mistake appears, not at the end.

Then reply in the repo template (`GreenBridgeApp/CLAUDE.md`): `Done:` / `Next:`
/ `Need:`, one line each, under 80 words, one bold thing at most.

---

## Phase 2 — the API. **Not blocked. Do it in the same session.**

⚠️ This section used to say phase 2 needed a dev/staging test login and called
it "the single blocker for every page". **That was never true, and it cost
three screens three sessions.** These endpoints take the buyer in the PATH and
do not check who is asking — they return 200 with real rows and no credentials
(the route class in `Docs/v2/SECURITY-WISHLIST.md`). Curl before you claim;
`../../../MISTAKES.md`, 2026-09-24.

What you actually need is **which buyer** — `src/features/v2/dashboard/useBuyerId.ts`
already answers it: the signed-in `profile.id`, or `DEV_BUYER_ID` under
`__DEV__` only. Never relax that guard; on these routes it is what stops a
release build reading a stranger's data.

**Verify against `testapi.greenbidz.com` (dev), from a CORS-allowed origin.**
The allowlist is `101recycle-greenbidz-backend/app.js:184`, and it is
spelling-sensitive: `http://localhost:8000` is listed, `http://localhost:8002`
is not, `http://127.0.0.1:8002` is. Point the harness at the dev API without
touching `.env` — the process var wins over dotenv:

```bash
GREENBIDZ_API_URL="https://testapi.greenbidz.com/api/v1" \
  npx expo start --web --port 8000 --clear
```

`--clear` matters: the API URL is baked into the bundle's manifest, so a cached
transform serves the old one and the page keeps calling the old host.

**Do not go hunting for a buyer id that has data.** Incrementing ids against an
unauthenticated endpoint is the abuse the security note describes. If the only
id you may use has no rows, say the screen is unverified and ask for one.

The swap itself is small because step 1 already took the contract:

- delete the fixture import, add `useQuery` against the endpoint in `types.ts`
- mobile sends site identity as the **`x-platform` header**
  (`src/api/greenbidzClient.ts:10`), where the web sends `?type=`. Not the same
  mechanism — do not copy the web's query string.
- move filtering to the server: filtering a page is not filtering a list
- ⚠️ **curl the endpoint twice, with and without the filter, and diff the
  result** before wiring a control to it. A param the server ignores typechecks
  perfectly and ships a dead control.
- check the landing's `staleTime` against the mutation's invalidation, and
  search for the *behaviour* (an `invalidate*` helper), not just the literal
  `invalidateQueries`.

---

## The worked example — `/v2/dashboard/bids`

Every file is on disk; read them rather than trusting this table.

| Part | Copied from | Our file |
|---|---|---|
| list | `obytes-template/src/features/feed/feed-screen.tsx` | `src/features/v2/bids/bids-screen.tsx` |
| card | `obytes-template/src/features/feed/components/post-card.tsx` | `src/features/v2/bids/bid-card.tsx` |
| tab bar | `collapsible-tabs/src/MaterialTabBar/{TabBar,TabItem,Indicator}.tsx` | `src/features/v2/bids/material-tab-bar.tsx` |
| contract | `nextjs-port/src/services/api/slices/buyerApiSlice.ts` + `shared/pages/buyer/MyBids.tsx` | `src/features/v2/bids/types.ts` |
| fixtures | — | `src/features/v2/bids/__fixtures__/bids.ts` |
| route | — | `app/v2/dashboard/bids.tsx` |
| header | **nothing — deleted** | see step 4 |

Full write-up, including the device pass and the two defects:
`Docs/V2_CHECKLIST.md` § `/v2/dashboard/bids`.
