# How v2 is put together

Counts verified 2026-09-16. The route list is asserted by
[`v2Inventory.test.ts`](../../src/__tests__/v2Inventory.test.ts); everything
else here is shape, not inventory.

## Where things live

```
app/v2/                     16 routes (+ layouts)
  index.tsx                 6a/6b — ONE screen, two panes
  buying.tsx                redirect → /v2?mode=buying
  browse · matches · messages · account
  lot · bid                 2a/2b — render MOCK_LOT, nothing writes
  chat                      the assistant, text composer, live controller
  voice                     3a — static, and does not currently open
  scan/camera · scan/analyzing
  scan/review/{photos,details,pricing,location}   7b–7e

src/features/v2/
  ui/      29 components — the kit. Screens compose, never restyle.
  home/    SellingPane · BuyingPane · HomePager · PaneShell
  scan/    the review wizard's state
  auth/    SignInSheet
  mock/    lot.json · voice.json — the only fixtures in v2

src/theme/v2/
  palette.ts   light + dark roles
  scale.ts     space · radius · type · icon · control · GUTTER
  motion.ts    timing() · usePressFeedback
  material.ts  the ramp
  ThemeProvider.tsx
```

## Four ideas that explain most of the code

**Home is one screen, not two.** Selling and Buying are panes of a pager, so the
brand bar and the tab row must not move between them. `HomePager` wraps
`reanimated-tab-view`; its header lives above the pager, fixed, because an
identical logo sliding out while its twin slides in is the tell of a pager
pretending to be tabs.

**Everything visual comes from the kit.** The first pass had local copies of the
brand bar, tabs, banner and chips in each screen; they were reconciled into
`ui/` and the screens now compose. A screen that needs a new look reports a kit
gap rather than styling locally — `v2Adherence.test.ts` enforces that colours
come from `useV2Colors()` and not from direct palette imports.

**Depth is derived from the palette, not painted.** `material.ts` computes a
ramp per role; controls and cards ramp, grounds and anything that swipes stay
flat. `v2MaterialCoverage.test.ts` enumerates the population so a flat control
cannot hide — it found two within a second of being written, after the kit had
been hand-audited twice.

**Read real, write later.** Every screen reads live data through the shipped lab
hooks (`useListDrafts`, `useWants`, `useRecentSubmissions`, `useLabNotifications`,
the chat controller). The only fixtures are 2a/2b and 3a, because there is no
public listings endpoint — the same gap that keeps Browse on a WebView. Writes
are held; see [SHIP-BLOCKERS.md](SHIP-BLOCKERS.md).

## Things that will surprise you

**`/v2/buying` is a redirect, not a screen** — it resolves to `/v2?mode=buying`.
Home reads that param in a `useState` initialiser, so it seeds the pane on a
fresh mount but does **not** move it if Home is already mounted. Nothing in the
app navigates there (the tab bar targets `/v2` and lists `/v2/buying` only for
active-state matching), so this is deep-link-only.

**Both panes set the assistant's mode before navigating.** `/v2/chat` reads
buyer/seller from the shared `useComposer` store, not from a route param — so
without an explicit `setMode`, the assistant opens in whatever mode the last
screen left behind. That produced a buyer tapping *"Find an LC-20 under $12k"*
and landing on **"Sell with AI"**.

**3a nests its own `V2ThemeProvider` in dark.** A voice turn is a call — the tab
bar is gone and the screen is one conversation — so it resolves against the dark
palette whatever the app is set to. Nesting the provider was chosen over adding
non-flipping `voice*` roles, because a second set of near-identical roles is how
a design system starts to drift.

**Four enforcement tests, not one.** `v2Adherence` (colour access),
`v2Contrast` (ramps are correct), `v2MaterialCoverage` (nothing is flat by
accident), `v2Inventory` (the doc-backing facts). They overlap deliberately:
`v2Contrast` asserts that things which ramp ramp correctly, so a component with
no ramp at all is invisible to it — which is exactly how two shipped flat.
