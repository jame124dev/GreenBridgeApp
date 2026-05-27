# Design-token sync — Stitch "Industrial Marketplace System"

**Goal:** bring the app's design tokens in line with the Stitch project **`projects/15822776848387463557`** ("Enhanced Design Studio", design system "Industrial Marketplace System") — Deep Forest Green primary, Sage secondary, Industrial Amber tertiary, Hanken Grotesk / Inter / IBM Plex Sans type, soft industrial shapes.

**Status:** ✅ Done in code — pending dev-client rebuild (new font assets) + on-device visual check.

**Approach:** the codebase already routes everything through `src/theme/` tokens, so the sync changes **token definitions** (values cascade automatically) rather than editing every screen. A few hardcoded literals and heading/label font applications were also updated by hand.

---

## What changed

### Colors — [colors.ts](../src/theme/colors.ts)
Token **keys unchanged**; values remapped to the Stitch palette so all consumers cascade.

| Token | Before | After | Source |
|---|---|---|---|
| `primary` | `#0a4a2f` | `#14452f` | Stitch overridePrimary / primary-container |
| `primaryDark` / `brandDeep` | `#053823` / `#003824` | `#002e1c` | Stitch primary |
| `primaryLight` | `#1d6647` | `#236b48` | lighter forest (gradients) |
| `primaryDim` | `#15803d` | `#1f7a4d` | legible green on light |
| `primarySurface` | `#f0fdf4` | `#e6f2eb` | soft green tint |
| `primaryBorder` / `primaryAccent` | `#bbf7d0` / `#86efac` | `#bfe3cd` / `#9fd2b4` | Stitch primary-fixed / inverse-primary |
| `background` | `#f7f9fb` | `#f8f9ff` | Stitch background |
| `foreground` | `#13171f` | `#121c28` | Stitch on-surface |
| `surfaceMuted` | `#f8fafc` | `#eef4ff` | Stitch surface-container-low |
| `border` / `borderStrong` | `#e1e5ec` / `#e2e8f0` | `#dfe5ec` / `#c0c9c1` | Stitch outline-variant |
| **new** `secondary*` | — | `#769486` / `#c7e7d7` | Stitch sage secondary |
| **new** `tertiary*` | — | `#f4b400` / `#fdbc13` / `#ffdea3` | Stitch industrial amber |

`secondary*` / `tertiary*` are **added, not yet consumed** — available for highlights/progress UI. The semantic `warning*` tokens were left as-is (amber `tertiary` is a brand accent, not the warning state).

Also updated: [gradients.ts](../src/theme/gradients.ts) (`#14452f → #236b48`), [shadows.ts](../src/theme/shadows.ts) web box-shadow rgba to the new green, and **41 hardcoded brand/ink literals** swapped across 6 files (`#0a4a2f→#14452f`, `#1d6647→#236b48`, `#13171f→#121c28`): [index.tsx](../app/(tabs)/index.tsx), [listing/[id].tsx](../app/listing/[id].tsx), [camera.tsx](../app/scan/camera.tsx), [detail.tsx](../app/scan/detail.tsx), [VisibilitySelector.tsx](../src/components/scanner/VisibilitySelector.tsx), [LanguageSheet.tsx](../src/components/ui/LanguageSheet.tsx).

### Fonts — [typography.ts](../src/theme/typography.ts) + [app/_layout.tsx](../app/_layout.tsx)
Three families per Stitch. Installed `@expo-google-fonts/hanken-grotesk` + `@expo-google-fonts/ibm-plex-sans`; loaded in `_layout.tsx`.

| Token | Family | Use |
|---|---|---|
| `regular` / `semibold` / `bold` | Inter (unchanged) | body |
| `heading` / `headingSemibold` | **Hanken Grotesk** 700 / 600 | headlines |
| `label` / `labelMedium` | **IBM Plex Sans** 600 / 500 | label-caps / metadata |

**Applied so far:** `fonts.heading` on the major screen/card/sheet titles (history, profile, detail, grouped-review, listing-method, processing, reorder, success, [Card.tsx](../src/components/ui/Card.tsx), [Sheet.tsx](../src/components/ui/Sheet.tsx)); `fonts.label` on [SectionLabel.tsx](../src/components/ui/SectionLabel.tsx) (label + AI badge) and the listing sectionTitle.

⚠️ **Not exhaustive:** there's no shared `Heading`/`Text` primitive, so headline coverage is title-by-title. Inline `<Text>` headings elsewhere still use Inter `fonts.bold`. **Follow-up:** introduce a `Heading` primitive (`fonts.heading`) and migrate screens to it for complete coverage.

### Shape — [radius.ts](../src/theme/radius.ts)
Large end compressed toward Stitch's soft-industrial language (cards ~8px): `lg 10→8`, `xl 12→10`, `2xl 14→12`, `3xl 16→12`, `4xl 20→16`. Small end (`xs 4`, `sm 6`, `md 8`) unchanged.

### Spacing — intentionally unchanged
Stitch documents an 8px baseline. Our scale is already a compatible 4px grid. Remapping our token **values** to Stitch's named steps (`md 8→24`, `lg 10→40`, …) would inflate every margin/pad and break layouts, so spacing was **left as-is**. Stitch's 8px baseline is satisfied by the existing tokens.

---

## Verification
- `npx tsc --noEmit` — clean.
- `eslint` (theme + touched files) — clean.

---

## Item Review screen — full layout rebuild

Token sync alone didn't reproduce the Stitch **"Item Review Redesign"** screen (`projects/15822776848387463557/screens/7d055af0…`) — it's a different composition. [detail.tsx](../app/scan/detail.tsx) was rebuilt to match it (mobile single-column).

**Installed:** `@expo/vector-icons` (MaterialIcons — the practical RN stand-in for the design's Material Symbols).

| Stitch element | Rebuilt as |
|---|---|
| Top app bar + step progress | `arrow-back` + "Item · Review" (Hanken) + live progress bar driven by `required.doneCount/total` |
| Hero gallery + thumbnail strip | 16:9 hero (counter + Rearrange overlay) → tap opens `PhotoZoomViewer`; horizontal thumb strip w/ active outline + dashed **ADD MORE** tile (image-picker → `updatePhotos`) |
| Glass cards | white card + outline-variant border + `radius.lg` grouping: Basic Info · Category+Condition · Price+Qty · Documents · Visibility · Location |
| Category | full-width **rows** w/ `chevron-right`/`check-circle`, selected = 2px primary border + tint |
| Condition | **pills** (`radius.full`), selected = filled primary + `check` icon |
| Price + Quantity | side-by-side in one card; qty = single bordered stepper (`remove`/`add`) |
| Visibility | icon-card grid (`public`/`visibility-off`/`hub`), NETWORK keeps the web-only alert |
| Location | inputs with leading `location-on` / `public` icons |
| Checklist | **amber card** (`tertiarySurface`) + LIVE dot + 7 rows w/ `check-circle`/`error` icons + **"+40% visibility" promo** + **Seller Tips** card |
| Footer | sticky **Preview · Submit→**; disabled Submit = sage `#aecebe` (Stitch secondary-fixed-dim) |

**Driven by real state:** the app-bar progress and the checklist both read `getRequiredStatus` (7 required rows), so "5 OF 7" is live, not mocked. Grouped mode keeps its Add-another / Review-group / Save-&-return CTAs in the same footer.

**Deviations / follow-ups:**
- **Glass blur** — Stitch uses `backdrop-filter: blur`. RN has no cheap equivalent without `expo-blur`; used solid white cards over the light bg (visually ~identical). Add BlurView later if desired.
- **Primary fill** — Stitch fills buttons with `#002e1c` (its `primary`) and uses `#14452f` as container/tint. We fill with `#14452f` (our app-wide brand) for cross-screen consistency. Switch to `primaryDark` here if exact parity matters.
- **Preview** button shows a "coming soon" alert — no preview screen exists yet.
- **`VisibilitySelector`** component is now unused (inlined) — safe to delete.
- New i18n keys used with `defaultValue` fallbacks (`mobile.detail.preview`, `previewSoon`); add to locale files when seeding.

**Verification:** `tsc --noEmit` clean; `eslint` clean (pre-existing `watch()` warning only).

**Post-rebuild review fixes (2 passes):**
1. Category list was a `<View maxHeight:240>` → **clipped, unscrollable** with many lab categories (couldn't select hidden ones). Restored a nested `ScrollView`.
2. `KeyboardAwareScrollView` had no `flex:1` → as a middle flex sibling between app bar and sticky footer it wouldn't bound correctly / footer wouldn't pin. Added `flex:1`.
3. `SafeAreaView` was top-only → footer could sit under the home indicator. Added the `bottom` edge.
4. `MaterialIcons.font` now preloaded in `_layout` `useFonts` so icons don't flash empty/tofu on first paint.

---

## Remaining before merge
1. ⚠️ **Rebuild the dev client** — two new font packages add native font assets; restart Metro with `--clear`.
2. **On-device visual check** — primary green everywhere, headlines in Hanken Grotesk, labels in IBM Plex Sans, card corners tighter.
3. **Follow-ups (optional):** `Heading` primitive for full headline coverage; consume `secondary`/`tertiary` tokens where the design calls for sage/amber; per-component 4px radius on inputs/buttons/chips if we want to match Stitch's "standard element" radius exactly; retint remaining neutral literals (`#e1e5ec`, etc.) to the new `border` token.
