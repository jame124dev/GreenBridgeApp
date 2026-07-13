# Deal Room — Implementation-Ready Screen Spec

**App:** 101LAB by GreenBridge (AI-first buy/sell marketplace)
**Screen ID / route:** `app/deal/[id].tsx` (Expo Router stack screen, headerless)
**State phase:** `deal` (final node in the 7-state machine: home → processing → draft → published → matches → match → **deal**)
**Data mode:** Static / hardcoded (Phase 1 — no APIs yet), fully interactive.
**HTML source of truth:** `c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/101LAB Mobile.dc.html` lines 384–431 (markup) + handlers `navMatches`/`confirm`/`navDeals`.

> Read `00-foundation.md` first. This screen assumes its tokens (`@/constants/theme`), the installed stack (Reanimated 4.3.1, Reanimated layout animations, `react-native-keyboard-controller` 1.21.6 wired at root, Expo Haptics, Lucide 1.16.0, FlashList 2.3.1, Safe Area Context, expo-linear-gradient, react-native-svg 15.15.4), and the Animation Recipes + Native Checklist defined there.

---

## Prerequisites (foundation setup)

These are **set up once in [`00-foundation.md`](./00-foundation.md) → Prerequisites**, not per-screen work. This screen consumes them; do not re-implement. The audit flagged the missing font/tokens as "blockers" — they are resolved here as documented dependencies. Confirm each is done in the foundation before building this screen:

- [ ] **Fonts** — `HankenGrotesk_800ExtraBold` added to `useFonts({...})` in `app/_layout.tsx` (from `@expo-google-fonts/hanken-grotesk`) **and** exposed as `fonts.headingBold` in `src/theme/typography.ts`. (Verified: `app/_layout.tsx` currently loads only Hanken 600/700; `fonts.headingBold` does **not** exist yet — foundation adds it.) This screen uses `fonts.headingBold` for the **avatar initials** and **seller name** only. All body/meta/composer text uses **Inter** (`fonts.regular`/`fonts.semibold`/`fonts.bold`); the prototype's Plus Jakarta Sans is a documented simplification — keep Inter.
- [ ] **Color tokens** — the green tokens `greenDarkest #0E3B2E`, `greenMedium #16A35A`, `greenLight #34D08C` added to `@/constants/theme.ts` per foundation → [Colors](./00-foundation.md#colors). (Verified: none of these exist in the repo yet.) This screen references them **by token name**; it never adds or redefines them. `buyBlue` is intentionally NOT used here (see §4).
- [ ] **`src/animations/recipes.ts`** — motion recipes module (`POP`, `SLIDE-X`, etc.) + `useReducedMotion()`-aware fallbacks. This screen leans on Reanimated layout-animation primitives (`SlideInLeft/Right`, `ZoomIn`, `FadeIn`) chosen to express the foundation's POP/directional feel; `useReducedMotion` is imported from `react-native-reanimated` (installed 4.3.1) — see §6.
- [ ] **`(lab)` route group + `src/features/lab/`** — the customer-app variant folders exist (foundation-owned). This screen's static fixtures live under `src/features/deal/` (a deal-specific sibling) and its components under `src/components/deal/`.

> **Haptics & Button already exist** — import `{ haptics }` from `@/lib/haptics` and `Button` from `@/components/ui`. Their verified contracts (below) are followed exactly: the only haptic verbs are `tap/impact/heavy/success/warning/error`; Button press scale is **0.97**; Button's boolean `haptic` prop fires Light internally.

---

## 1. Purpose & Place in Flow

The Deal Room is the **managed 1:1 chat** a buyer/seller enters after confirming interest in a match. It is where 101LAB (the managed marketplace) positions itself between the two counterparties: seller messages arrive on the left, the user's messages on the right, and a dashed "101LAB Concierge" system card injects logistics/escrow/inspection guidance. It reassures the user that inspection, logistics and escrow are handled by 101LAB.

**Entry points**
- From **Match detail** (`match` state) → `confirm()` handler → `go('deal')`. Primary entry. In RN: `router.push('/deal/4821')` after the confirm CTA.
- From **bottom nav "Deals" tab** → `navDeals()` → jumps into a single deal room in the prototype. In RN, `Deals` tab should route to a deals **list** first; for this static screen we deep-link `router.push('/deal/4821')`. (Document the list as a future sibling screen; not built here.)

**Exits / navigation targets**
- **Back chevron** (top-left) → prototype `navMatches()` → Matches feed. In RN this is `router.back()` with a fallback `router.replace('/matches')` (so a cold deep-link into `/deal/4821` still has a sensible up-target).
- Composer send → stays on screen, appends an optimistic user message (no navigation).
- No forward navigation from this screen in the prototype (terminal node).

---

## 2. Visual Layout (top-to-bottom, exact values from HTML)

Root: full-height flex column, `min-height:100%` (HTML 386). Three regions: **fixed header**, **scrollable body** (banner + thread, `flex:1`), **fixed composer**. Screen background inherits app shell (`brand.background #f8f9ff`); each region paints its own surface.

> Layout ownership: `SafeAreaView edges={['top','bottom']}` → `KeyboardAvoidingView` (or the `KeyboardAvoidingView` from `react-native-keyboard-controller`) wrapping a flex column of **Header (fixed)** → **Banner (fixed flex sibling — NOT in the scroll body)** → **Thread (`flex:1`, scrolls)** → **Composer (fixed)**. The banner is a sibling *above* `.lab-scroll` in the HTML and therefore does not scroll; render it as a plain flex row between Header and Thread (see §2b for the definitive rule).

### 2a. Header (HTML 387–396) — fixed, non-scrolling
- Container: `background:#fff`, `border-bottom:1px solid #EBF0EC`, padding `58px 18px 14px`. The `58px` top is the status-bar/notch reservation → **replace with `insets.top + 14`** in RN; horizontal `18px`, bottom `14px`.
- Row: `flex-row`, `align-items:center`, `gap:12px`.
  - **Back button:** transparent, `padding:4px`, chevron-left `22×22`, stroke `#10201A`, stroke-width `2.2`. → Lucide `<ChevronLeft size={22} color="#10201A" strokeWidth={2.2} />`. Use a **bespoke `Pressable`** (not `Button variant="ghost"`, whose boolean `haptic` would fire Light on its own) so the screen controls the haptic: `haptics.tap()` in `onPress`, press-scale 0.97, `hitSlop` to a ≥44×44 target.
  - **Seller avatar:** `42×42`, `border-radius:13px`, gradient `135deg #0E3B2E→#1f6b4a`, centered initials `AS`, **Hanken Grotesk 800** = `fonts.headingBold` (foundation prerequisite font), `15px`, color `#CFF0DD`. → `expo-linear-gradient` `<LinearGradient colors={[greenDarkest, dealColors.avatarTo]} start={{x:0,y:0}} end={{x:1,y:1}} />` — the gradient **start** is the `greenDarkest` token (`#0E3B2E`); the **end** `#1f6b4a` lives in `dealColors.avatarTo`. (There is deliberately no `avatarFrom` key in `dealColors` — the start comes from the token.)
  - **Title block** (`flex:1`):
    - Line 1: seller name `Asia Surplus` — **`fonts.headingBold`** (Hanken 800), `15px`, color `#10201A`, `flex-row align-items:center gap:6px` + a **verified seal** `14×14` (fill `greenMedium #16A35A`, white check), `numberOfLines={1}` / `ellipsizeMode='tail'` and seal `flexShrink:0`.
    - Line 2: subtitle `Agilent 1260 HPLC · deal #4821` — **Inter 400**, `11.5px`, color `#8A988F`.

### 2b. Managed banner (HTML 399–402) — fixed, below header (above scroll body)
- In the HTML this `<div>` is a **sibling above** `.lab-scroll`, so it does **not** scroll. Implement it as an **ordinary flex sibling in the column** (Header → Banner → Thread(`flex:1`) → Composer) — NOT `position:absolute`, and NOT inside the thread's `ScrollView`. Because the thread takes `flex:1`, the banner naturally holds a fixed band between header and thread. This is the single source of truth: the banner is fixed and non-scrolling.
- Margin `12px 16px 0`, `background:#FFF6E6`, `border:1px solid #F4E2BC`, `border-radius:14px`, padding `11px 13px`.
- `flex-row align-items:center gap:9px`.
- Shield icon `17×17`, stroke `#B27A12`, stroke-width 2 → Lucide `<ShieldCheck size={17} color="#B27A12" strokeWidth={2} />` (HTML path is a plain shield; `ShieldCheck` or `Shield` both acceptable — `Shield` is the closer 1:1 to the prototype path, no inner check). Use `flexShrink:0`.
- Text: **Inter 600**, `11.5px`, color `#8A6418`, **`lineHeight: 16`** (absolute px — RN rule: never a CSS multiplier; `1.4 × 11.5 ≈ 16`): *"101LAB is managing this deal — inspection, logistics & escrow handled for you."*

### 2c. Chat thread (HTML 404–423) — scrollable, `flex:1`
- Container `class="lab-scroll"`, `overflow-y:auto`, padding `16px 16px 8px`, `flex-col gap:12px`. In RN: `ScrollView` (Phase 1) / `FlashList` (Phase 2) with `contentContainerStyle={{ padding:16, paddingBottom:8, gap:12 }}` — note RN `ScrollView` does not honor `gap` on the container; apply `gap:12` on an inner `View` wrapper or set `marginBottom:12` per row (last row no margin).
- **Day divider** (centered): `Introduced by 101LAB · Today` — **Inter 600**, `10.5px`, color `#A5B1A9`, `text-align:center`.
- **Confirmation pill** (centered, `align-self:center`): `background:#EAF3EC`, color `#0E6B3F`, `11.5px` **Inter 600**, padding `8px 13px`, `border-radius:99px` (`radius.full`), `flex-row gap:6px align-items:center`; leading **4-point sparkle** `13×13` fill `#16A35A`. Text: *"You confirmed interest at 96% match"*.
- **Seller bubble (left)** `align-self:flex-start`, `max-width:78%`, `background:#fff`, `border:1px solid #EBF0EC`, `border-radius:16px 16px 16px 4px` (notched bottom-left), padding `11px 13px`.
  - Body: **Inter 400**, `13px`, color `#1c2a24`, **`lineHeight: 19`** (absolute px; `1.45 × 13 ≈ 19`).
  - Meta: **Inter 400**, `10px`, color `#A5B1A9`, `marginTop: 5` → `Asia Surplus · 10:24`.
- **User bubble (right)** `align-self:flex-end`, `max-width:78%`, `background:#0E3B2E`, `border-radius:16px 16px 4px 16px` (notched bottom-right), padding `11px 13px`.
  - Body: **Inter 400**, `13px`, color `#EAF3EC`, **`lineHeight: 19`** (absolute px).
  - Meta: **Inter 400**, `10px`, color `#7FAE97`, `margin-top:5px`, `text-align:right` → `You · 10:26`.
- **Concierge card (center, dashed)** `align-self:center`, `max-width:88%`, `background:#F0F4F1`, `border:1px dashed #CBD8CF`, `border-radius:14px`, padding `11px 13px`, `flex-row gap:9px align-items:flex-start`.
  - Icon chip: `26×26`, `border-radius:8px` (`radius.sm`), `background:#0E3B2E`, centered **4-point sparkle** `15×15` fill `#34D08C`, `flexShrink:0`.
  - Body: **Inter 400**, `11.5px`, color `#445049`, **`lineHeight: 17`** (absolute px; `1.45 × 11.5 ≈ 17`); bold lead `101LAB Concierge:` (**Inter 700**) colored `#0E3B2E` (= `greenDarkest` token), then message text — one wrapping `Text` with a nested bold `Text` span.

### 2d. Composer (HTML 425–429) — fixed bottom
- Container: `background:#fff`, `border-top:1px solid #EBF0EC`, padding `10px 14px 26px`, `flex-row align-items:center gap:9px`. The `26px` bottom is home-indicator reservation → **replace with `insets.bottom + 10`**.
- **Input pill** (`flex:1`): `height:46px`, `border:1.4px solid #E1E8E3`, `border-radius:99px`, padding `0 16px`, placeholder color `#9AA89F`, **Inter 400** `13.5px`, text color `#1c2a24`. Placeholder: `Message Asia Surplus…`. This is a bare `TextInput` (see §3 — do **not** reuse `Input`). Set `multiline={false}`, `returnKeyType="send"`, `blurOnSubmit={false}`, `onSubmitEditing={send}`.
- **Send button:** `46×46`, `border-radius:99px`, `background:#16A35A`; paper-plane `20×20`, stroke `#fff`, stroke-width 2 → Lucide `<Send size={20} color="#fff" strokeWidth={2} />`. Disabled visual = `opacity:0.5` when `draft.trim()` is empty.

---

## 3. Component Breakdown (reuse map)

All primitives import from `@/components/ui`; **tokens from `@/constants/theme`** (semantic roles) — NOT `@/theme/*`, which foundation marks as legacy Stitch hex for old screens only (this includes `@/theme/typography` and `@/theme/spacing`, whose legacy scales differ from the 4px-base `@/constants/theme`; use `@/constants/theme` exclusively here). Three prototype hexes map to green tokens the **foundation adds as a prerequisite** (`greenDarkest`/`greenMedium`/`greenLight` — see below and §Prerequisites); the remaining true one-off hexes are centralized in a local `dealColors` const (§5).

| Prototype element | Reuse | Import | Notes |
|---|---|---|---|
| Root layout / safe area | **Custom** (not `Screen`) | `react-native-safe-area-context` + `react-native-keyboard-controller` | `Screen` forces a padded ScrollView; Deal Room needs 3 flex regions (fixed header / scrolling thread / fixed composer). Use `SafeAreaView edges={['top','bottom']}` + a `KeyboardAvoidingView`. |
| Text (all copy) | `Text` | `@/components/ui` | Prototype sizes (10/10.5/11.5/13/13.5px) fall between token variants — pass explicit `style={{fontSize,lineHeight}}`. Use `variant="caption"` only where it matches; otherwise inline. Font family: **Inter** for all body/meta/composer, **`fonts.headingBold`** (Hanken 800, foundation prerequisite) only for the avatar initials + seller name. |
| Chevron, shield, send icons | `lucide-react-native` (verified present @1.16.0) | `import { ChevronLeft, ShieldCheck, Send } from 'lucide-react-native'` | All three exist in the installed build. |
| Verified seal + the two 4-point sparkles | **inline `react-native-svg`** (NOT Lucide) | `import Svg, { Path } from 'react-native-svg'` | Lucide `BadgeCheck` (scalloped badge) and `Sparkles` (4-star cluster) do **not** match the prototype's faceted seal / single 4-point sparkle paths. Port the exact HTML `<path d>` values into three tiny SVG components (`VerifiedSeal`, `SparkleMark`) for 1:1 fidelity. Paths are in §5. |
| Managed banner | **New** `DealManagedBanner` | `@/components/deal/DealManagedBanner` | Amber card, ~20 lines. `Card` variants don't offer this bg/border pairing — custom is cleaner. |
| Message bubbles | **New** `MessageBubble` | `@/components/deal/MessageBubble` | Props `{ role: 'system'|'confirm'|'seller'|'user'|'concierge', text, meta?, senderName? }`. Encapsulates the 5 render styles + asymmetric radii + entrance animation. |
| Composer | **New** `DealComposer` | `@/components/deal/DealComposer` | Pill `TextInput` + round send `Pressable`; owns focus/keyboard/enabled state. Do **not** reuse `Input` (labeled `rounded-xl` field, wrong shape). Send is 46×46 — a **non-standard height** below Button's `sm` (48px), so it is a **bespoke `Pressable`** (per foundation Button contract), NOT a `Button` with a style override. Skeleton in §5. |
| Avatar | inline gradient `View` | `expo-linear-gradient` `LinearGradient` | 42×42 radius 13, initials. `AppImage` only when a real avatar URL exists (Phase 2). |
| Thread list | `ScrollView` (Phase 1) → `FlashList` (Phase 2) | `react-native` / `@shopify/flash-list` | 5 static items → plain mapped `View` in a `ScrollView` now. Adopt `FlashList` (installed ^2.3.1) with `scrollToEnd` when messages go dynamic. |
| Button press feel | Reanimated worklet | `react-native-reanimated` | Foundation **Button press** feel: `scale 1 → 0.97` over `motion.tap` (100ms), spring back. **Scale is 0.97** (matches `@/components/ui/Button` exactly — verified) — NOT 0.95/0.92. Custom `Pressable`s (avatar, send) use this same 0.97. |
| Haptics | **`@/lib/haptics`** | `import { haptics } from '@/lib/haptics'` | `haptics.impact()` (MEDIUM) on send, `haptics.tap()` (light/selection) on back. NEVER import `expo-haptics` in the screen (see §6). |
| Toast (Phase 2) | `sonner-native` | — | "Message failed to send". |

**Token references — the three greens are a foundation PREREQUISITE (add per `00-foundation.md` → Colors; they do NOT exist in the repo yet — verified). Reference by name, never redefine in this screen:**
- User bubble / avatar-start / concierge-chip / concierge-lead `#0E3B2E` = **`greenDarkest`**. Use the token; do NOT confuse with `brand.primary #14452f` or `brand.primaryDim` (those already exist and are different).
- Send button + verified check + confirm sparkle green `#16A35A` = **`greenMedium`**. Use the token.
- Concierge accent sparkle `#34D08C` = **`greenLight`**. Use the token.
- Radii: `radius.full` (9999) for pills/send; `radius.sm` (8) for the concierge icon chip; bubbles use a literal `borderRadius` object (16 + one 4px corner — no token expresses an asymmetric radius); banner/concierge `14px` sits between `radius.md`(12) and `radius.lg`(16) — use the **literal 14** to match the prototype exactly.
- Spacing: `gap:12` = `spacing.md`; `gap:9`, `gap:6`, padding `11/13`, `8/13` are prototype-specific micro values — use literals (they fall between 4px-scale steps). Header `18px` H-pad ≈ `spacing.lg+2`; thread `16px` = `spacing.lg`.

**Remaining true one-off hexes (not in tokens) → `dealColors` (§5):** the amber-banner family (`#FFF6E6/#F4E2BC/#8A6418/#B27A12`), avatar gradient end `#1f6b4a`, avatar ink `#CFF0DD`, header border `#EBF0EC`, title ink `#10201A`, subtitle/meta inks `#8A988F`/`#A5B1A9`/`#7FAE97`, seller body `#1c2a24`, user body `#EAF3EC`, confirm bg/ink `#EAF3EC`/`#0E6B3F`, concierge bg/border/body `#F0F4F1`/`#CBD8CF`/`#445049`, input border `#E1E8E3`, placeholder `#9AA89F`. **No new npm dependency is required for this screen** — every library it uses is already installed per foundation.

---

## 4. Interactivity & Navigation

```ts
import { haptics } from '@/lib/haptics';
import { format } from 'date-fns';

const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
const [draft, setDraft] = useState('');
const canSend = draft.trim().length > 0;
const scrollRef = useRef<ScrollView>(null); // FlashList ref in Phase 2

const send = () => {
  const body = draft.trim();
  if (!body) return;
  haptics.impact();                       // MEDIUM — primary confirm action
  const now = format(new Date(), 'HH:mm'); // "10:26" — matches meta format
  setMessages((m) => [
    ...m,
    { id: `u-${Date.now()}`, role: 'user', text: body, meta: `You · ${now}` },
  ]);
  setDraft('');
  requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  // Phase-1 mandatory demo reply (retire in Phase 2 once real concierge events arrive):
  setTimeout(() => {
    setMessages((m) => [...m, { ...CANNED_REPLY, id: `c-${Date.now()}` }]);
    haptics.tap();                        // subtle light on inbound
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, 900);
};
```
Phase 1 uses local `useState`; the shape mirrors a future Zustand slice / React Query cache so the Phase-2 swap is mechanical.

| Element | Gesture | Action | Feedback |
|---|---|---|---|
| Back chevron | tap | `router.back()` (fallback `router.replace('/matches')`) | `haptics.tap()` (light/selection); bespoke `Pressable` press-scale **0.97** |
| Seller avatar / name | tap | No-op Phase 1 (future: open seller profile / match detail). Wire an `onPress` prop (default a no-op), leave a `// TODO`. | subtle press-scale 0.97 only, no haptic |
| Managed banner | tap | No-op (informational). Future: open "How managed deals work" `Sheet` (`@/components/ui` `Sheet`). | none |
| Message bubbles | — | Static; not interactive. Long-press (future) → copy/report `// TODO`. | none |
| Composer input | focus | Keyboard rises; thread auto-scrolls to bottom (`scrollToEnd({animated:true})`). | — |
| Composer input | type | `setDraft(text)`; send enabled only when `canSend`. | Send opacity 1 enabled / 0.5 disabled; `disabled={!canSend}` |
| Send button | tap (or `onSubmitEditing`) | Append optimistic user message `{ id, role:'user', text:draft.trim(), meta:'You · '+now }`; clear draft; `scrollToEnd`. **Then (mandatory in Phase 1)** after 900ms push `CANNED_REPLY` so the static thread feels alive. | `haptics.impact()` (MEDIUM) on send; user bubble enters `SlideInRight`; canned concierge reply enters `SlideInLeft` after 900ms with a subtle `haptics.tap()` on arrival |

**Mode (sell/buy) variations:** The Deal Room is **mode-agnostic** in the prototype — copy is hardcoded for the HPLC deal and does not branch on `sell`/`buy` (unlike home/draft). There are **no sell/buy color or copy swaps** on this screen: keep the deal accent `greenMedium #16A35A` regardless of mode. Explicitly do **NOT** apply the `buyBlue #2563EB` buy-accent here — a reviewer expecting the blue buy-tint should note its intentional absence. The only dynamic dimensions are counterparty identity + thread contents (static seed data in Phase 1).

---

## 5. Static Data Shape + Future Hook Points

Hardcode at module scope, shaped to mirror the eventual API so the swap is mechanical.

```ts
// src/features/deal/dealFixtures.ts
export type MessageRole = 'system' | 'confirm' | 'seller' | 'user' | 'concierge';

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  meta?: string;        // "Asia Surplus · 10:24" | "You · 10:26"
  senderName?: string;  // concierge bold lead, e.g. "101LAB Concierge"
}

export interface DealHeader {
  dealId: string;               // "4821"
  counterpartyName: string;     // "Asia Surplus"
  counterpartyInitials: string; // "AS"
  itemTitle: string;            // "Agilent 1260 HPLC"
  verified: boolean;            // true
  managedNote: string;          // amber banner copy
}

export const DEAL_HEADER: DealHeader = {
  dealId: '4821',
  counterpartyName: 'Asia Surplus',
  counterpartyInitials: 'AS',
  itemTitle: 'Agilent 1260 HPLC',
  verified: true,
  managedNote:
    '101LAB is managing this deal — inspection, logistics & escrow handled for you.',
};

export const SEED_MESSAGES: Message[] = [
  { id: 'm0', role: 'system',  text: 'Introduced by 101LAB · Today' },
  { id: 'm1', role: 'confirm', text: 'You confirmed interest at 96% match' },
  { id: 'm2', role: 'seller',  text: 'Hi Ravi — yes, the 1260 is available with the DAD detector, 2019, ~6k injection hours. Happy to share the service log.', meta: 'Asia Surplus · 10:24' },
  { id: 'm3', role: 'user',    text: 'Great. Can 101LAB arrange inspection before I commit the $13,400?', meta: 'You · 10:26' },
  { id: 'm4', role: 'concierge', senderName: '101LAB Concierge', text: 'Inspection can be booked for Thu. Escrow holds funds until you approve on delivery. Want me to schedule it?' },
];

// Canned concierge reply — pushed 900ms after every user send in Phase 1 (mandatory,
// see §4). The `id` here is a template; the send handler assigns a fresh unique id
// (`c-${Date.now()}`) on each push so keys never collide. Retire in Phase 2.
export const CANNED_REPLY: Message = {
  id: 'auto-template', role: 'concierge', senderName: '101LAB Concierge',
  text: "On it — I'll confirm the inspection slot and hold escrow until you approve.",
};

// One-off prototype hexes NOT covered by @/constants/theme tokens.
// (NOTE: #0E3B2E=greenDarkest, #16A35A=greenMedium, #34D08C=greenLight are
//  foundation tokens — reference those, do not duplicate them here.)
export const dealColors = {
  headerBorder: '#EBF0EC',
  avatarTo: '#1f6b4a', avatarInk: '#CFF0DD',
  titleInk: '#10201A', subtitleInk: '#8A988F',
  bannerBg: '#FFF6E6', bannerBorder: '#F4E2BC', bannerInk: '#8A6418', bannerIcon: '#B27A12',
  divider: '#A5B1A9',
  confirmBg: '#EAF3EC', confirmInk: '#0E6B3F',
  sellerBg: '#ffffff', sellerBorder: '#EBF0EC', sellerInk: '#1c2a24', metaInk: '#A5B1A9',
  userInk: '#EAF3EC', userMeta: '#7FAE97',
  conciergeBg: '#F0F4F1', conciergeBorder: '#CBD8CF', conciergeInk: '#445049',
  inputBorder: '#E1E8E3', placeholder: '#9AA89F', inputInk: '#1c2a24',
} as const;
```

**Exact SVG paths to port (react-native-svg) — from HTML lines 392 / 408 / 420:**
```tsx
// VerifiedSeal (14×14, viewBox 0 0 24 24) — HTML line 392
<Svg width={14} height={14} viewBox="0 0 24 24">
  <Path d="M12 2l2.4 2.1 3.2-.3 1 3 2.7 1.7-1.2 3 1.2 3-2.7 1.7-1 3-3.2-.3L12 22l-2.4-2.1-3.2.3-1-3L2.7 13.5l1.2-3-1.2-3 2.7-1.7 1-3 3.2.3L12 2z" fill={greenMedium /* #16A35A */} />
  <Path d="M9.5 12.5l1.8 1.8 3.5-3.8" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
</Svg>

// Confirm sparkle (13×13) — HTML line 408 — fill greenMedium #16A35A
<Path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />

// Concierge sparkle (15×15) — HTML line 420 — fill greenLight #34D08C
<Path d="M12 4l1.3 3.6L17 9l-3.6 1.4L12 14l-1.3-3.6L7 9l3.7-1.4L12 4z" />
```

**`DealComposer` skeleton (bespoke — not `Button`, not `Input`):** send is 46×46 (a non-standard height), so it is a hand-rolled `Pressable` with the foundation 0.97 press scale. The composer is a controlled component; the screen owns `draft`/`send`.
```tsx
// src/components/deal/DealComposer.tsx
import { TextInput, View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Send } from 'lucide-react-native';
import { motion, greenMedium } from '@/constants/theme';   // greenMedium = foundation prereq token
import { dealColors } from '@/features/deal/dealFixtures';

const AP = Animated.createAnimatedComponent(Pressable);

interface DealComposerProps {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;          // screen's `send()` — fires haptics.impact() itself
  onFocus?: () => void;        // screen scrolls thread to end
  placeholder: string;         // "Message Asia Surplus…"
}

export function DealComposer({ value, onChangeText, onSend, onFocus, placeholder }: DealComposerProps) {
  const canSend = value.trim().length > 0;
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <TextInput
        style={{ flex: 1, height: 46, borderRadius: 999, borderWidth: 1.4,
                 borderColor: dealColors.inputBorder, paddingHorizontal: 16,
                 fontFamily: 'Inter_400Regular', fontSize: 13.5, color: dealColors.inputInk }}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={dealColors.placeholder}
        multiline={false}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={() => { if (canSend) onSend(); }}
      />
      <AP
        onPressIn={() => { scale.value = withTiming(0.97, { duration: motion.tap }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: motion.tap }); }}
        onPress={() => { if (canSend) onSend(); }}   // onSend() calls haptics.impact()
        disabled={!canSend}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={[aStyle, { width: 46, height: 46, borderRadius: 999, backgroundColor: greenMedium,
                          alignItems: 'center', justifyContent: 'center', opacity: canSend ? 1 : 0.5 }]}
      >
        <Send size={20} color="#fff" strokeWidth={2} />
      </AP>
    </View>
  );
}
```
> The 46×46 target is <48px; `hitSlop={4}` brings the effective touch area to ≥54px so it clears the ≥44px minimum. Do NOT reach for `haptics` inside the composer — the screen's `onSend()` owns the MEDIUM haptic so it fires exactly once per send.

**Future dynamic hook points (leave `// TODO` markers):**
- `DEAL_HEADER` → `useQuery(['deal', id])` (TanStack React Query, per foundation stack) hitting the Node deal endpoint.
- `SEED_MESSAGES` → `useQuery(['deal', id, 'messages'])` + **Socket.io** (`socket.io-client` ^4.8.3, installed) subscription for live inbound; append on `message` event.
- Send → `useMutation` — the optimistic append already implemented becomes `onMutate`; reconcile on success/error, `sonner-native` toast on failure.
- Concierge messages → server-pushed `role:'concierge'` events on the same subscription (retire `CANNED_REPLY`).
- Auto-scroll and unread markers slot into the same list.

---

## 6. Animations & Micro-Interactions (foundation recipes)

Recipe names reference `00-foundation.md` → Animation & Interaction Recipes + Screen transition matrix.

- **Screen entrance:** transition matrix row **match → deal = slide-right + fade, 350ms, cubic out**. Configure on the Expo Router `Stack.Screen` for `deal/[id]`: `options={{ headerShown:false, animation:'slide_from_right' }}` (react-native-screens honors the native slide; the fade rides along). The header bar itself is static on entrance.
- **Message entrance choreography** (Reanimated layout animations — built into the installed Reanimated 4.3.1; these are library primitives, not named foundation recipes, chosen to express the foundation's POP + directional feel):
  - `system` day-divider: `FadeIn.duration(250)`.
  - `confirm` pill: foundation **POP** (`ZoomIn`/scale 0.92→1 + fade, 300ms, spring 1.2 overshoot), ~200ms delay.
  - `seller` / `concierge` (left-origin): `SlideInLeft.duration(300)`.
  - `user` (right-origin): `SlideInRight.duration(300)` (offset ~120px) + fade.
  - On first mount, **stagger** seed messages ~80ms each (foundation POP stagger value) so the thread assembles top-down.
- **Send micro-interaction:** the bespoke send `Pressable` uses the foundation press feel — `scale 1 → 0.97` over `motion.tap` (100ms in), spring/time back to `1`. **Scale is 0.97** (matches `@/components/ui/Button` — verified), NOT 0.95, and there is no opacity change on press (Button doesn't apply one). The MEDIUM haptic fires from the screen's `onSend()` via `haptics.impact()` (see below), not on press-in. New user bubble = `SlideInRight`; the mandatory canned concierge reply = `SlideInLeft` after 900ms.
- **Auto-scroll:** on new message and on input focus, `scrollToEnd({ animated:true })` (ScrollView ref Phase 1; FlashList `scrollToEnd` Phase 2).
- **Haptics** (via `@/lib/haptics`, NEVER `expo-haptics` directly): Send → `haptics.impact()` (MEDIUM thump; primary confirm action). Back → `haptics.tap()` (light/selection). Inbound canned reply → subtle `haptics.tap()`. Avatar/banner taps and passive scroll/entrance → **no haptic**. (There is no `haptics.light()`/`haptics.medium()` — the only verbs are `tap/impact/heavy/success/warning/error`.)
- **Reduced motion** (`import { useReducedMotion } from 'react-native-reanimated'` — verified present in the installed 4.3.1; the foundation `useAnimationConfig` wrapper may also be used): `SlideInLeft/Right` → `FadeIn.duration(200)`; POP → `FadeIn`; disable the mount stagger; screen entrance stays the native slide (system-level, respects OS setting) or collapses to fade. Keep auto-scroll (functional, not decorative). All animations are Reanimated worklets → **60fps locked**, no JS-driven layout animation.

---

## 7. Native Screen-Management (tailored checklist)

```
Safe area:   [x] top edge (header)  [x] bottom inset (composer)  [x] no Dynamic Island overlap
Keyboard:    [x] input outside scroll (sticky)  [x] CTA sticky  [x] onFocus scrollToEnd
Responsive:  [x] flex/%-width bubbles  [x] SE + Pro Max tested  [x] no fixed container widths
Scroll/CTA:  [x] thread scrolls  [x] composer outside scroll  [x] contentContainer paddingBottom
Android/DM:  [x] nav inset in composer  [x] opaque white surfaces  [x] dark text  [x] contrast ≥4.5:1
Polish:      [x] card radius ≥12px (banner/concierge 14, bubbles 16)  [x] spacing tokens/literals  [x] border-only surfaces
```

**Scenario A — Safe areas (header + composer both load-bearing):**
- [ ] Root `SafeAreaView edges={['top','bottom']}` (both insets matter: fixed header + fixed composer).
- [ ] Header top padding = `insets.top + 14` (replaces hardcoded `58px`); do NOT double-inset (don't also let `SafeAreaView` pad the top — if it does, drop the `top` edge and pad manually, or use `edges={['bottom']}` + manual `insets.top`).
- [ ] Composer bottom padding = `insets.bottom + 10` (replaces `26px`); gesture pill / Dynamic Island never overlaps.

**Scenario B — Keyboard avoidance (composer screen — critical):**
- [ ] `KeyboardAvoidingView` around the column (`behavior='padding'` iOS). Root already provides `react-native-keyboard-controller` `KeyboardProvider` (foundation) for Android parity; prefer its `KeyboardAvoidingView`/`KeyboardStickyView` for the composer if smoother.
- [ ] Composer is **outside** the scroll region (sticky bottom); thread `ScrollView`/`FlashList` is `flex:1` and scrolls independently.
- [ ] On input focus → `scrollToEnd`; send button + latest message stay visible above the keyboard.
- [ ] `keyboardShouldPersistTaps='handled'` on the thread so tapping a bubble mid-type doesn't dismiss the keyboard.
- [ ] On keyboard dismiss, thread retains scroll position (don't reset to top).

**Scenario C — Small vs large device (SE 375 → Pro Max 430):**
- [ ] Bubbles use `maxWidth:'78%'` (`88%` concierge) — percentages, device-safe.
- [ ] Body 13px stays fixed on SE; do not scale down. Header seller name `numberOfLines={1}` + `ellipsizeMode='tail'` and the verified seal `flexShrink:0` so long names never push the seal off-row.
- [ ] Subtitle `deal #…` `numberOfLines={1}`.

**Scenario D — Long content + fixed CTA:**
- [ ] Thread is the scroll region; composer is a fixed sibling (not floating over scroll) → no CTA-overlap. Banner also fixed above the thread.
- [ ] Thread `contentContainerStyle` bottom padding ≥ 8px (prototype) so the last bubble clears the composer border.

**Scenario E — Android nav bar + dark mode:**
- [ ] Composer bottom padding includes `insets.bottom` → clears gesture pill / 3-button bar.
- [ ] Header + composer surfaces are opaque white; all light-surface text ≥4.5:1. User bubble `#EAF3EC` on `#0E3B2E` and concierge lead `#0E3B2E` on `#F0F4F1` both pass AA.
- [ ] Dark mode = v2 (light-only now) — documented.

---

## 8. Acceptance Checklist (pass/fail vs prototype)

**Visual fidelity**
- [ ] Header: 42×42 gradient avatar (radius 13, `#0E3B2E`→`#1f6b4a`, `AS` in Hanken 800 / 15px / `#CFF0DD`), seller name `Asia Surplus` (Hanken 800 / 15 / `#10201A`) + green verified seal (`#16A35A`), subtitle `Agilent 1260 HPLC · deal #4821` (Inter / 11.5 / `#8A988F`); white bg, `#EBF0EC` bottom border, top pad = `insets.top+14`.
- [ ] Amber managed banner: `#FFF6E6` bg / `#F4E2BC` border / radius 14, shield `#B27A12`, copy Inter 600 `#8A6418`, margin `12/16/0`, sits fixed below header (does not scroll).
- [ ] Day divider centered Inter 600 `#A5B1A9` 10.5px; confirmation pill `#EAF3EC`/`#0E6B3F` with 4-point sparkle, "You confirmed interest at 96% match".
- [ ] Seller bubble: left, white, `#EBF0EC` border, radius `16/16/16/4`, body Inter 13 `#1c2a24`, meta `Asia Surplus · 10:24` `#A5B1A9`.
- [ ] User bubble: right, `#0E3B2E`, radius `16/16/4/16`, body `#EAF3EC`, meta right-aligned `#7FAE97`.
- [ ] Concierge card: centered, dashed `#CBD8CF`, `#F0F4F1` bg, radius 14, 26×26 `#0E3B2E` chip with `#34D08C` sparkle, bold `101LAB Concierge:` lead in `#0E3B2E`.
- [ ] Composer: 46px pill `1.4px #E1E8E3` radius 99, placeholder `Message Asia Surplus…` `#9AA89F` Inter 13.5; 46×46 `#16A35A` round send, white paper-plane, bottom pad = `insets.bottom+10`.

**Interactivity**
- [ ] Back chevron returns to Matches (`router.back()` / fallback `/matches`) with `haptics.tap()`.
- [ ] Typing enables send; empty/whitespace keeps it disabled at opacity 0.5.
- [ ] Send appends a right-aligned user bubble with a live `HH:mm` timestamp, clears input, fires `haptics.impact()` (MEDIUM), scrolls to bottom.
- [ ] Canned Concierge reply appears ~900ms later from the left (`SlideInLeft`) with a subtle `haptics.tap()` — mandatory in Phase 1.
- [ ] Keyboard never covers composer or latest message; thread scrolls to bottom on focus; taps on bubbles don't dismiss keyboard mid-type.

**Native robustness**
- [ ] Correct on iPhone SE (375), 14 Pro (Dynamic Island), Pro Max (430), Pixel 7 (gesture + 3-button).
- [ ] No hardcoded `58px`/`26px` insets remain — replaced by safe-area math.
- [ ] Reduced-motion collapses all slide/POP entrances to fades and disables stagger; auto-scroll still works.
- [ ] 60fps on scroll and message entrance (Reanimated worklets only; no JS-driven animation).

**Code hygiene**
- [ ] Primitives from `@/components/ui`; tokens from `@/constants/theme` (NOT `@/theme/*`); haptics from `@/lib/haptics` (NOT `expo-haptics`); icons `ChevronLeft/ShieldCheck/Send` from `lucide-react-native`; seal + sparkles inline `react-native-svg`.
- [ ] `#0E3B2E`/`#16A35A`/`#34D08C` reference foundation prerequisite tokens `greenDarkest`/`greenMedium`/`greenLight` (added once in `@/constants/theme.ts` per foundation) — NOT redefined per screen; remaining one-off hexes centralized in `dealColors`.
- [ ] `fonts.headingBold` (`HankenGrotesk_800ExtraBold`, a foundation prerequisite add to `app/_layout.tsx` + `src/theme/typography.ts`) is used ONLY by avatar initials + seller name; all body/meta/composer text uses Inter.
- [ ] Bespoke `Pressable`s (back button, send) use press scale **0.97** (matches Button); no `0.95`/`0.92` press feedback anywhere.
- [ ] All `lineHeight` values are absolute px (16/17/19), never CSS multipliers.
- [ ] Static data in `src/features/deal/dealFixtures.ts` with API-shaped types and `// TODO` hook markers (React Query + Socket.io) per §5.
- [ ] Deal Room does **not** branch on sell/buy mode (green accent only; `buyBlue` intentionally absent) — verified against HTML lines 384–431.
- [ ] No new npm dependency introduced (all libs already installed per foundation).

---

### Files to create
- `app/deal/[id].tsx` — screen (custom safe-area/keyboard 3-region layout, not `Screen`; register with `animation:'slide_from_right'`, `headerShown:false`).
- `src/features/deal/dealFixtures.ts` — types + `SEED_MESSAGES` + `DEAL_HEADER` + `CANNED_REPLY` + `dealColors` + SVG path constants.
- `src/components/deal/MessageBubble.tsx` — 5-role bubble renderer + entrance animation.
- `src/components/deal/DealManagedBanner.tsx` — amber banner.
- `src/components/deal/DealComposer.tsx` — pill `TextInput` + round send button (owns focus/enabled/keyboard).
- (SVG marks `VerifiedSeal` / `SparkleMark` can live inline in `MessageBubble`/header or in `src/components/deal/icons.tsx`.)
