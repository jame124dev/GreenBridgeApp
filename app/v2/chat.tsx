/**
 * 6e — Chat (the assistant).
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [G] GREENBIDZ                            EN   bell•    │
 *   │  Assistant                                  (new chat)  │
 *   │  Describe what you are selling and it drafts…           │
 *   └─────────────────────────────────────────────────────────┘
 *      Selling   Buying                                          tabs + rule
 *      ────────────────────────────────────────────────────────
 *      TRY ASKING                                                empty state
 *      I have a used CNC machine to sell
 *      ────────────────────────────────────────────────────────
 *      Help me price my lab equipment
 *
 *                              …conversation…
 *
 *      ────────────────────────────────────────────────────────
 *      [ 📷 📎  Describe what you are selling        ]   ( ↑ )   composer
 *
 * ⚠️ WHAT THE DRAWING ACTUALLY SHOWS
 *
 * `docs/v2-design/screens/6e.html` is labelled "Chat" but it draws the
 * buyer↔seller MESSAGES INBOX — "Messages / Two threads are waiting on you",
 * All 12 / Unread 2 / Buying / Selling tabs, thread rows with a last-message
 * line and a 7pt unread dot, "5 empty threads hidden · show all". That is the
 * shipped Deals/Messages surface (`src/features/lab/messages/`), not the AI
 * assistant. This screen is the ASSISTANT, as briefed. Everything structural
 * has therefore been taken from the drawing (header sheet, display title +
 * supporting line, a ruled tab strip below the sheet, rows under a tracked
 * eyebrow) and everything content-shaped had to be designed here. The inbox
 * still needs a home; see the build report.
 *
 * DATA — read real, write later.
 *
 * The stream, the turn reducer and the committed history are NOT reimplemented:
 * `useChatController` is mounted exactly as `app/(lab)/chat.tsx` mounts it, and
 * the live turn is read straight off `threadStore` by the one leaf that needs
 * token-level updates (`LiveAnswer`), mirroring `StreamingMessage`. Only the
 * presentation is new.
 *
 * ⚠️ THIS BLOCK SAID "Nothing here writes" UNTIL 2026-09-22, AND IT WAS WRONG.
 * Send and Retry were wired on 2026-09-17 and the header was never updated, so
 * the file asserted the opposite of its own code for five days. A truth audit
 * caught it. What is actually true:
 *
 *  • `initialQuery` is hardcoded `''` — still load-bearing. Passing a `?q=`
 *    through would make the controller OPEN A TURN on mount, a real POST.
 *  • Send and Retry are LIVE: both go through `chat.send`, which streams.
 *  • Saving a want from a `wtb_draft` card is LIVE, and gated by
 *    `requireAuth('want', …)` — see `WantDraftCard`.
 *  • Stop, attachment staging and "New chat" are local only.
 *
 * Two artifacts of sharing state with the shipped surfaces, both by design and
 * neither worth forking a store over:
 *  • `composerStore.attachments` is app-wide (Home stages, chat consumes), so a
 *    photo staged here is still staged if the person walks into the old chat and
 *    sends. The chips make it visible and each one can be removed.
 *  • The controller's mount-time seed reads `lastSentAttachments` — the crumb
 *    that carries a Home → chat handoff. If the person sent a photo in the OLD
 *    chat earlier in the same app session, this screen opens with that user
 *    bubble and no answer under it. "New chat" clears it. Fixing it properly
 *    means the controller consuming its own crumb, which is a change to the
 *    shipped flow, not to this screen.
 *
 * ── Five things worth knowing before editing ─────────────────────────────
 *
 * 1. THE CHAT THEME PROVIDER IS NEVER MOUNTED. `ChatMessage`, `StreamingMessage`,
 *    `cards.tsx` and `WorkingIndicator` all read `src/features/lab/chat/theme`,
 *    so rendering any of them here would put old-UI tokens inside a v2 screen.
 *    This file imports only the HEADLESS pieces — the controller, the two hooks,
 *    the pure `streamSanitizer`, the message types — none of which touch that
 *    theme. So there is no provider to fight and no `darkTheme.ts` decision to
 *    take here.
 *
 * 2. `Screen` is given `scroll={false}` + `contentStyle={styles.fill}`: the
 *    thread owns its own ScrollView. The bottom reserve is `useTabBarReserve()`,
 *    applied to the KEYBOARD-AVOIDING wrapper rather than to the list, because
 *    the composer — not the last message — is what has to clear the tab bar.
 *
 * 3. Keyboard: ONE animated `paddingBottom = max(keyboardInset, tabBarReserve)`
 *    on a flex column holding the list and the composer. `useKeyboardInset`
 *    cross-clamps three native channels so a missed IME callback cannot strand
 *    the composer (glitch-audit G1/G2). The composer is a flex SIBLING of the
 *    list, never an overlay, so the last message can never sit under it.
 *
 * 4. Prose is rendered with `lead`/`leadMedium` — 15pt, the scale's own
 *    long-form token ("15/400 — long-form paragraph").
 *
 *    It used to be `body`/`bodyMedium` (13pt), and the reason was real: RN
 *    applies a nested span's `lineHeight` per fragment on Android, so a **bold**
 *    run in a different line box shifts the baseline of its line. `body` and
 *    `bodyMedium` were the only pair sharing a box, so the longest prose in the
 *    app dropped two sizes to get one. `leadMedium` (added 2026-09-21, same
 *    23pt box as `lead`) removes the constraint rather than working around it.
 *
 *    ⚠️ If you add another weight for prose, give it `leading(size.lg, 1.5)` or
 *    the baselines will drift again.
 *
 * 5. Guest mode: the assistant is open to everyone, INCLUDING SENDING.
 *
 *    ⛔ DO NOT PUT `requireAuth` ON SEND. `signInPromptStore.ts` states the rule
 *    verbatim from the 2026-08-24 rejection: "Registration can only be required
 *    for account-based features." Talking to the assistant is not account-based,
 *    and the shipped `app/(lab)/chat.tsx` does not gate it either. Build
 *    1.0.3(21) was rejected under 5.1.1(v) for exactly this shape of gate.
 *
 *    An earlier revision of this screen gated Send. It was wrong and was removed.
 *    `requireAuth` belongs on account-based actions only — messaging a seller,
 *    saving a want, publishing a listing.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import {
  ArrowUp,
  ChevronDown,
  Plus,
  Square,
  SquarePen,
  X,
} from 'lucide-react-native';

import {
  GUTTER,
  SECTION_GAP,
  control,
  icon,
  radius,
  shadow,
  space,
  type as typeScale,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';
import {
  BrandBar,
  Hairline,
  IconAction,
  MaterialFill,
  Row,
  RowThumb,
  Screen,
  SectionHeader,
  SectionNote,
  Shimmer,
  StagedChip,
  Tabs,
  Text,
  useTabBarReserve,
  type TabItem,
} from '@/features/v2/ui';
import { AttachSheet, type AttachSheetRef, type AttachSource } from '@/features/v2/chat/AttachSheet';
import { LanguageSheet } from '@/components/ui';
import { languageBadge } from '@/i18n';
import { useV2Copy } from '@/i18n/v2Auto';
import { router } from 'expo-router';

import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { requireAuth } from '@/features/auth/requireAuth';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { useChatController } from '@/features/lab/chat/controllers/useChatController';
import { useKeyboardInset } from '@/features/lab/chat/hooks/useKeyboardInset';
import { useStreamReveal } from '@/features/lab/chat/hooks/useStreamReveal';
import { resolveBotText, streamSafeText } from '@/features/lab/chat/streamSanitizer';
import { bottomTarget, isAtBottom, pinTarget, shouldFollow } from '@/features/lab/chat/threadScroll';
import {
  isErrorMessage,
  messageText,
  type Attachment,
  type Message,
} from '@/features/lab/chat/types/message';
import { useAttachmentPicker } from '@/features/lab/hooks/useAttachmentPicker';
import {
  useComposer,
  type ComposerAttachment,
  type ComposerMode,
} from '@/features/lab/stores/composerStore';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useThread } from '@/features/lab/stores/threadStore';
import { ChatCards } from '@/features/v2/chat/ChatCards';
import { drawnCards } from '@/features/v2/chat/drawnCards';
// `types/card`, not `types` — see the note in `ChatCards.tsx`.
import type { Card } from '@/features/lab/chat/types/card';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── Constants ───────────────────────────────────────────────────────────── */

const MODE_TABS: readonly TabItem<ComposerMode>[] = [
  { value: 'sell', label: 'Selling' },
  { value: 'buy', label: 'Buying' },
];

/** The one line under the display title. Says what the assistant does, per mode. */
const HEADER_SUB: Record<ComposerMode, string> = {
  sell: 'Describe what you are selling, or add a photo of the nameplate, and it drafts the listing.',
  buy: 'Say what you need and it searches the marketplace for you.',
};

/**
 * ⚠️ These must not repeat `HEADER_SUB`, which is on screen at the same time.
 *
 * `sell` used to read "Describe what you are selling" — the first six words of
 * its own header sentence, verbatim, one above the other. The `v2-screen`
 * skill names this exact failure ("Does any sentence repeat the one above
 * it?"), and it cost the screen a line of attention to say nothing new. The
 * header keeps the longer sentence because it carries the part the placeholder
 * cannot — that a photo works too, and what comes out the other end.
 *
 * `buy` never had the problem: its header opens "Say what you need".
 */
const PLACEHOLDER: Record<ComposerMode, string> = {
  sell: 'What are you selling?',
  buy: 'Describe what you are looking for',
};

/** Openers, straight from the shipped chat's starter prompts. */
const STARTERS: Record<ComposerMode, readonly string[]> = {
  sell: [
    'I have a used CNC machine to sell',
    'Help me price my lab equipment',
    'List several items from photos',
  ],
  buy: ['Find an HPLC system', 'I need a used centrifuge', "Show me what's available"],
};

/**
 * The wait, explained. `stage` frames carry `phase` (NOT `stage`) — the detect
 * pipeline's taxonomy — and the buyer text-search path emits none at all, so the
 * per-mode default below is what is normally on screen. Never a bare spinner.
 */
const PHASE_LINE: Record<string, string> = {
  validating: 'Checking what you sent…',
  preparing_documents: 'Reading your documents…',
  preparing_pdfs: 'Reading your documents…',
  ai_running: 'Thinking it through…',
  extracting_products: 'Pulling out the details…',
};
const WORKING_DEFAULT: Record<'buyer' | 'seller', string> = {
  buyer: 'Searching the marketplace…',
  seller: 'Working on it…',
};

/**
 * The gap above a pinned message, and above the landing point of the jump
 * control. v2's own token — the lab chat passes its `spacing.md` (12) to the
 * same helpers, which is why `threadScroll` takes it as an argument instead of
 * baking one scale's number in.
 */
const PIN_GAP = space['3xl'];
/** The composer stops growing here and scrolls internally. ~4 lines of body. */
const INPUT_MAX_HEIGHT = control.input * 2;
/** The measure of the header's supporting line, matching 6d's. */
const HEADER_SUB_MEASURE = 250;

/* ── Markdown-lite, in v2 tokens ─────────────────────────────────────────── */

/**
 * Inline syntax, in MATCH ORDER — the order is load-bearing.
 *
 * `!\[alt](url)` must come FIRST. It shares its tail with a link, so with the
 * link alternative first the `!` fell outside the match and rendered as a stray
 * exclamation mark before the alt text — observed as `!Nameplate`. The image is
 * then dropped entirely (see `InlineProse`): v2 has no inline-image treatment,
 * and the assistant's own uploads already render as thumbnails in the user's
 * bubble.
 *
 * `***both***` before `**bold**` before `*italic*`, for the same reason: a
 * shorter alternative matching first leaves stray asterisks behind.
 *
 * ⚠️ UNDERSCORE EMPHASIS IS DELIBERATELY ABSENT. `__x__` and `_x_` were here
 * and had to go: this product's content is model numbers, and underscores live
 * inside them. Run, not reasoned about:
 *
 *     "PART_NO_4 is the spare"   ->  PART | _NO_ | 4 is the spare  ->  "PARTNO4"
 *     "Model AVANTI_J26S_XPI"    ->  ... -> "AVANTIJ26SXPI"
 *
 * A part number silently losing characters is worse than an underscore showing
 * through, and CommonMark forbids intra-word `_` emphasis for exactly this
 * reason. `*` and `**` have no such problem and are what these models emit
 * anyway. If underscore emphasis is ever needed, it must carry word-boundary
 * assertions — do not simply add the alternative back.
 */
const MD_TOKEN_RE =
  /(!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
const MD_IMAGE_RE = /^!\[[^\]]*\]\([^)]*\)$/;
const MD_LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;
const FENCE_RE = /^\s*```/;
/** Captures the indent so a nested bullet can be indented rather than flattened. */
const BULLET_RE = /^(\s*)[-*]\s+/;
/** `1. ` / `12) ` — the numeral is kept and shown. */
const ORDERED_RE = /^(\s*)(\d{1,2})[.)]\s+/;
const HEADING_RE = /^\s*#{1,6}\s+/;
/**
 * `> quoted` — but NOT a comparison.
 *
 * ⚠️ This was `/^\s*>\s?/`, which ate the operator off any line opening with a
 * comparison — and this product is about specifications, so those lines are
 * common. Run, not reasoned about:
 *
 *     "> 5 tonnes capacity"  ->  rendered "5 tonnes capacity"
 *     ">= 500 kg"            ->  rendered "= 500 kg"
 *
 * The first turns "over five tonnes" into "five tonnes". That is a defect that
 * changes a NUMBER'S MEANING, not its styling, in an answer a seller may price
 * against.
 *
 * `(?!=)` rejects `>=`; `(?!\s*[\d.])` rejects a digit after optional space, so
 * `> 5`, `>0.5` and `> .5` all stay prose. A real blockquote — `> Note: …` —
 * still matches.
 */
const QUOTE_RE = /^\s*>(?!=)(?!\s*[\d.])\s?/;
/**
 * A thematic break: `---`, `***`, `___`, three or more of ONE character.
 *
 * Written as an explicit alternation rather than a `([-*_])` + backreference,
 * which is the natural way to say it: a backslash-digit escape does not survive
 * every editing route intact. It was written into this file once as a literal
 * 0x01 byte, which `tsc` accepted happily and which then matched nothing — a
 * rule that silently stopped being a rule. The alternation cannot be mangled
 * into something that still compiles.
 */
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
/** A table row or its `|---|---|` separator. */
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER_RE = /^\s*\|[\s:|-]+\|\s*$/;

/** One line of prose with its inline spans resolved. */
function InlineProse({ text }: { text: string }) {
  const parts = text.split(MD_TOKEN_RE).filter(Boolean);
  return (
    /*
     * `selectable`: the answer is the thing the seller came for — a drafted
     * description, a spec list, a price range — and without this the only way
     * to get it out of the app is a screenshot. RN defaults Text to
     * non-selectable, so long-press did nothing at all.
     *
     * A per-message copy action is the fuller answer (the shipped chat has one
     * in `MessageActions.tsx`); this is the one-prop half that removes the dead
     * end today.
     */
    <Text variant="lead" selectable style={styles.proseLine}>
      {parts.map((p, i) => {
        // An IMAGE is dropped, not described. The assistant emits
        // `![alt](gcs-url)` for photos it has been sent, and those already
        // render as thumbnails in the user's own bubble — the alt text alone
        // ("Nameplate") adds nothing. Matched before links, or the `!` escapes
        // the token and renders as a stray character.
        if (MD_IMAGE_RE.test(p)) return null;

        const link = MD_LINK_RE.exec(p);
        // A link renders as its label, never as raw `[text](https://…)`. It is
        // not tappable here: the v2 in-app browser target is not decided, and a
        // link that silently does nothing is worse than plain text.
        if (link) {
          return (
            <Text key={i} variant="leadMedium" color="accentInk">
              {link[1] || link[2]}
            </Text>
          );
        }
        // `***both***` first — `**` would match its head and leave an asterisk.
        if (p.startsWith('***') && p.endsWith('***')) {
          return (
            <Text key={i} variant="leadMedium">
              {p.slice(3, -3)}
            </Text>
          );
        }
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <Text key={i} variant="leadMedium">
              {p.slice(2, -2)}
            </Text>
          );
        }
        /*
         * Italic has no token of its own: the scale carries no italic face
         * (Poppins 400/500/600 is the whole set), and RN's synthetic oblique is
         * a sheared regular that reads as a rendering fault. So emphasis is
         * carried by WEIGHT, the same as bold — the alternative was leaking the
         * asterisks, which is what it did before.
         */
        if (p.startsWith('*') && p.endsWith('*')) {
          return (
            <Text key={i} variant="leadMedium">
              {p.slice(1, -1)}
            </Text>
          );
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <Text key={i} variant="leadMedium" color="inkMuted">
              {p.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i} variant="lead">{p}</Text>;
      })}
    </Text>
  );
}

/**
 * A table row, as a label/value pair rather than a grid.
 *
 * A real table does not fit 423dp — three columns of spec text truncate to
 * uselessness — and the assistant emits them for exactly the content this
 * product is about (spec sheets). So each row becomes "Label — value", stacked,
 * which is the same shape `Row`'s title/subtitle uses elsewhere in the kit.
 *
 * The `|---|---|` divider and the header row are dropped: the header's labels
 * repeat on every row in this treatment.
 */
function TableRow({ line }: { line: string }) {
  const cells = line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length === 0) return null;
  const [label, ...rest] = cells;
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletText}>
        <Text variant="lead" selectable style={styles.proseLine}>
          <Text variant="leadMedium">{label}</Text>
          {rest.length ? <Text variant="lead">{`  ${rest.join(' · ')}`}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

/**
 * The renderable lines of an answer, with fenced code removed.
 *
 * ⚠️ AN UNTERMINATED FENCE MUST NOT EAT THE ANSWER. The loop toggles `inFence`
 * and drops what is inside. If the model opens a fence and never closes it — or
 * the reader presses Stop mid-fence — every remaining line used to vanish, with
 * no marker: a total, silent loss triggered by a button the user can press.
 * So the held lines are kept and returned as plain prose if the fence never
 * closed.
 */
function visibleLines(text: string): string[] {
  const out: string[] = [];
  let held: string[] = [];
  let inFence = false;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (FENCE_RE.test(line)) {
      if (inFence) held = []; // a closed fence: its contents really are dropped
      inFence = !inFence;
      continue;
    }
    if (inFence) held.push(line);
    else out.push(line);
  }
  // Fence never closed — give the text back rather than swallowing it.
  return inFence ? [...out, ...held] : out;
}

/** Images anywhere in a line, for stripping. `MD_IMAGE_RE` is anchored. */
const MD_IMAGE_G = /!\[[^\]]*\]\([^)]*\)/g;

/**
 * What of `text` will actually reach the screen.
 *
 * `Prose` deliberately drops two things — fenced code and images — so a reply
 * made only of those is non-empty as a string and empty as a rendering. Callers
 * deciding "is there anything here" must ask this, not `text.trim()`.
 */
function renderableText(text: string): string {
  return visibleLines(text)
    .map((l) => l.replace(MD_IMAGE_G, ''))
    .join('')
    .trim();
}

/**
 * An assistant answer, line by line.
 *
 * Handles: blank line, heading, thematic rule, blockquote, table row, bullet
 * (nested by indent), numbered item, and paragraph. Fenced code is DROPPED —
 * v2 has no monospace face loaded (Poppins 400/500/600 is the whole set) and
 * inventing one here would be a trap; the assistant does not emit code in this
 * product. If that changes, a `CodeBlock` belongs in the kit, not in this file.
 *
 * Everything below was leaking as raw syntax before 2026-09-21 — `> quoted`
 * kept its marker, `---` printed as three hyphens, `1.` lost its list shape,
 * nested bullets flattened, and a `|Model|Price|` table printed its pipes.
 */
function Prose({ text }: { text: string }) {
  const c = useV2Colors();
  // Materialised once: the table branch needs to look AHEAD one line to spot a
  // header (the row above the `|---|` divider).
  const lines = visibleLines(text);
  return (
    <View style={styles.prose}>
      {lines.map((line, i) => {
        if (line.trim() === '') return <View key={i} style={styles.proseGap} />;

        // A thematic break is a RULE, not three hyphens. Checked before the
        // bullet rule, which would otherwise claim `---` as `- --`.
        if (RULE_RE.test(line)) {
          return (
            <View key={i} style={styles.proseRule}>
              <Hairline />
            </View>
          );
        }

        if (HEADING_RE.test(line)) {
          return (
            <Text key={i} variant="h3" style={styles.proseHeading}>
              {line.replace(HEADING_RE, '')}
            </Text>
          );
        }

        // The divider row of a table carries no content.
        if (TABLE_DIVIDER_RE.test(line)) return null;
        if (TABLE_ROW_RE.test(line)) {
          // ⚠️ AND THE HEADER ROW, which is the line directly ABOVE the
          // `|---|` divider. `TableRow` renders each row as "Label — value", so
          // the header's labels repeat on every row below it and the header
          // itself becomes a meaningless first entry ("Model — Price ·
          // Condition"). `TableRow`'s docstring already claimed this was
          // dropped; only the divider actually was.
          if (TABLE_DIVIDER_RE.test(lines[i + 1] ?? '')) return null;
          return <TableRow key={i} line={line} />;
        }

        // A line that is ONLY an image contributes nothing once the image is
        // dropped — render the paragraph gap rather than an empty line box.
        if (MD_IMAGE_RE.test(line.trim())) return <View key={i} style={styles.proseGap} />;

        // A quote gets a left rule and quieter ink — the marker itself never
        // reaches the reader.
        if (QUOTE_RE.test(line)) {
          return (
            // ⚠️ The bar's colour comes from the palette, not the stylesheet:
            // `borderLeftWidth` with no colour defaults to BLACK, which is
            // invisible on the dark ground and too hard on the light one.
            <View key={i} style={[styles.proseQuote, { borderLeftColor: c.hairlineStrong }]}>
              <InlineProse text={line.replace(QUOTE_RE, '')} />
            </View>
          );
        }

        const ordered = ORDERED_RE.exec(line);
        if (ordered) {
          return (
            <View key={i} style={[styles.bulletRow, indentFor(ordered[1])]}>
              <Text variant="bodyMedium" color="inkSubtle">
                {`${ordered[2]}.`}
              </Text>
              <View style={styles.bulletText}>
                <InlineProse text={line.replace(ORDERED_RE, '')} />
              </View>
            </View>
          );
        }

        const bullet = BULLET_RE.exec(line);
        if (bullet) {
          return (
            <View key={i} style={[styles.bulletRow, indentFor(bullet[1])]}>
              <Text variant="body" color="inkSubtle">
                {bullet[1].length >= 2 ? '◦' : '•'}
              </Text>
              <View style={styles.bulletText}>
                <InlineProse text={line.replace(BULLET_RE, '')} />
              </View>
            </View>
          );
        }

        return <InlineProse key={i} text={line} />;
      })}
    </View>
  );
}

/**
 * A nested list item's indent, from its leading whitespace.
 *
 * Capped at two levels: deeper nesting on a 423dp screen costs more in measure
 * than it returns in structure, and the assistant rarely goes past two.
 */
function indentFor(lead: string): { marginLeft: number } {
  const depth = Math.min(2, Math.floor(lead.replace(/\t/g, '  ').length / 2));
  return { marginLeft: depth * space['4xl'] };
}

/* ── KIT GAP — message bubbles ───────────────────────────────────────────── */

/**
 * KIT GAP. The kit has no conversation primitives; this is the first screen
 * that needs them. Reported with the code in the build report.
 *
 * The user speaks in a filled `accentWash` bubble on the right; the assistant
 * answers as plain prose on the page ground, left, full width. That asymmetry
 * is the design's own "space instead of boxes" rule applied to a thread — one
 * filled block for the short thing you said, no box at all around the long
 * thing you are reading.
 */
function UserBubble({ text, attachments }: { text: string; attachments?: readonly Attachment[] }) {
  const c = useV2Colors();
  const photos = (attachments ?? []).filter((a) => a.isImage);
  const files = (attachments ?? []).filter((a) => !a.isImage);
  return (
    <View style={styles.rowRight}>
      {/*
        Ramped, for the same reason the composer is. The kit's `Bubble` is still
        exempt as "PENDING: TintedRow (its analogue) ramps — decide together",
        but nothing renders `Bubble` anywhere in the app, so this is the only
        bubble a person actually sees and it does not have to wait on that
        decision. `TintedRow` — the same accent-washed rounded block — already
        ramps, and a thread where the assistant's answer sits on ramped chrome
        while the reader's own words sit on a flat swatch reads as unfinished.
      */}
      <View style={[styles.userBubble, { backgroundColor: c.accentWash }]}>
        <MaterialFill role="accentWash" ink="ink" radius={radius.lg} />
        {photos.length > 0 ? (
          <View style={styles.thumbRow}>
            {photos.map((a) => (
              <RowThumb key={a.uri} uri={a.uri} />
            ))}
          </View>
        ) : null}
        {files.map((a) => (
          <Text key={a.uri} variant="caption" color="inkMuted" numberOfLines={1}>
            {a.name}
          </Text>
        ))}
        {text ? <Text variant="body">{text}</Text> : null}
      </View>
    </View>
  );
}

/** The assistant's turn: prose, plus the retry affordance when it failed. */
function AssistantTurn({
  text,
  failed,
  cards,
  onRetry,
}: {
  text: string;
  failed?: boolean;
  cards?: Card[];
  onRetry?: () => void;
}) {
  /*
   * Nothing to read AND nothing to look at.
   *
   * ⚠️ This must test what WILL RENDER, not the raw string. It used to be
   * `!text.trim()`, which an image-only reply passes: `![Nameplate](https://…)`
   * is non-empty text, so `empty` was false, `Prose` ran, `InlineProse` dropped
   * the image, and the turn rendered as a blank gap — the exact failure the
   * empty branch below exists to prevent, arriving through the front door.
   */
  const empty = !failed && !renderableText(text) && !cards?.length;

  return (
    <View style={styles.rowLeft}>
      {empty ? (
        /*
         * ⚠️ AN EMPTY ANSWER MUST SAY SOMETHING.
         *
         * `Prose('')` renders one `proseGap` — 10pt of nothing — so a turn that
         * arrives with no text and no drawable card reads as the assistant
         * accepting the question and answering with silence. Indistinguishable
         * from a hang, and no retry is offered because the turn did not "fail".
         *
         * Reachable two ways: Stop pressed before the first token, and any
         * reply whose prose the sanitizer emptied. The shipped chat guards this
         * (`ChatMessage.tsx`, `if (!text && !hasCards && !streaming) return null`)
         * by rendering nothing; saying so is better than vanishing.
         */
        <SectionNote variant="body" actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry}>
          That one came back empty. Ask again in the box below — nothing you typed was lost.
        </SectionNote>
      ) : failed ? (
        // Say what happened, then what to do about it. With Retry deferred the
        // next step is the composer, so the copy points at it rather than
        // leaving a dead end.
        <SectionNote variant="body" tone="danger" actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry}>
          {`${text || 'That answer did not come through.'}${
            onRetry ? '' : ' Ask again in the box below — nothing you typed was lost.'
          }`}
        </SectionNote>
      ) : (
        <Prose text={text} />
      )}
      {/*
        A `data` frame carried a card — a result set, a draft, a queue.
        `ChatCards` renders the ones v2 draws and NAMES the ones it does not,
        reusing the shipped `toProductRow` so the two surfaces cannot word a
        result differently. It was a single line of prose saying a card existed,
        which meant a buyer searching the marketplace got told results existed
        and shown none.
      */}
      <ChatCards cards={cards} />
    </View>
  );
}

/** The pre-first-token wait, named. Explanatory copy, never a bare spinner. */
function WorkingLine({ phase, mode }: { phase?: string; mode: 'buyer' | 'seller' }) {
  const label = (phase && PHASE_LINE[phase]) || WORKING_DEFAULT[mode];
  return (
    <View style={styles.rowLeft} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Text variant="lead" color="inkSubtle" style={styles.working}>
        {label}
      </Text>
      {/*
        Two breathing bars standing in for the answer.
        `Shimmer`'s own rule is "use where something is KNOWN to be coming" —
        which is exactly this: the turn is open, the answer is on its way.
        Smart-detect on a photo is a long wait, and a motionless grey sentence
        for eight seconds reads as a hang no matter how good the wording is.

        NOT `ProgressLine`: that is determinate, and we do not know how far
        along the model is. Claiming a fraction we cannot measure would be the
        wrong kind of reassurance.

        Reduced motion is handled inside `Shimmer` — it renders the static
        block instead of breathing.
      */}
      <View style={styles.workingBars} accessibilityElementsHidden importantForAccessibility="no">
        <Shimmer style={styles.workingBarWide} />
        <Shimmer style={styles.workingBarShort} />
      </View>
    </View>
  );
}

/**
 * The live turn — the ONLY token-level subscriber, exactly as `StreamingMessage`
 * is in the shipped screen, so a burst of tokens re-renders this node and not
 * the committed list. `useStreamReveal` is reused verbatim; `streamSafeText` is
 * applied to the REVEALED substring (never upstream of the reveal hook, whose
 * shrink-reset would wipe the bubble when a strip shortens the text).
 */
function LiveAnswer({ mode }: { mode: 'buyer' | 'seller' }) {
  const turn = useThread((s) => s.turn);
  const streaming = turn.status === 'streaming';
  /**
   * WORD cadence, not per-character.
   *
   * The shipped chat passes `CHAT_UI_V2` here and that flag is commented out in
   * `.env`, so both chats have been revealing letter by letter. The hook's own
   * comment calls the word cadence "the Gemini-style cadence", and it reads
   * better for long prose: a word arriving whole is read as a word, where a word
   * assembling letter by letter pulls the eye down to the characters.
   *
   * v2 passes `true` outright rather than reading the flag. The flag exists to
   * keep the SHIPPED chat byte-for-byte identical to its Phase-1 behaviour; this
   * screen has no such contract.
   *
   * ⚠️ Safe for zh / ja / th: the hook picks characters per frame whenever the
   * unrevealed tail has no whitespace, so an unspaced script still streams
   * instead of appearing all at once. Pinned by two tests.
   */
  const revealed = useStreamReveal(turn.text, !streaming, true);
  // `drawnCards`: the sanitizer may only strip prose for a card v2 will
  // actually render. See its docstring — ten types were stripping to nothing.
  const safe = streamSafeText(revealed, drawnCards(turn.cards), !streaming && revealed === turn.text);

  if (turn.status === 'idle') return null;
  if (!safe) return <WorkingLine phase={turn.phase} mode={mode} />;
  // Cards only once the turn has settled: mid-stream the reducer can still be
  // appending to `cards`, and a half-built result list flickering under a
  // typing answer reads as a glitch.
  return <AssistantTurn text={safe} cards={streaming ? undefined : turn.cards} />;
}

/* ── KIT GAP — the composer ──────────────────────────────────────────────── */

/** A 20pt icon control inside the composer field. The kit's `IconAction` is a
 *  46pt circle — right for Send, far too big to sit inside a 52pt field. */
function GlyphButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  return (
    <AnimatedPressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT}
      style={animatedStyle}
    >
      {children}
    </AnimatedPressable>
  );
}

const HIT = { top: space.xl, bottom: space.xl, left: space.xl, right: space.xl };

/* ── The screen ──────────────────────────────────────────────────────────── */

function ChatScreen({ onNewChat }: { onNewChat: () => void }) {
  const c = useV2Colors();
  const { i18n } = useTranslation();
  const tr = useV2Copy();
  const { unreadCount } = useLabNotifications();
  const picker = useAttachmentPicker();
  const staged = useComposer((s) => s.attachments);

  const [langOpen, setLangOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const attachRef = useRef<AttachSheetRef>(null);
  const atBottomRef = useRef(true);

  // ── Pin-to-top, ported from the shipped chat ─────────────────────────────
  //
  // `CHATBOT_RULES.md` §6: "Pin the user's latest message to the top; stream
  // the reply below it … so their message + any attached image never scroll off
  // on send." v2 shipped without it and yanked to the bottom instead, which is
  // the exact user-reported behaviour that rule was written to stop.
  //
  // The model is `app/(lab)/chat.tsx`'s, borrowed rather than re-derived — its
  // comments record the jump bugs each piece exists to prevent:
  //
  //   viewportH        a viewport-tall trailing spacer, so a SHORT answer can
  //                    still push the user's message all the way to the top
  //   pinScrolledRef   pin each message exactly once; a later relayout (the
  //                    keyboard opening, an image decoding) must not re-yank
  //   pinActiveRef     while pinned, the stream does NOT auto-follow
  //   pinSpacerRef     distance-to-bottom measures REAL content, so the pill
  //                    does not appear over the spacer's empty tail
  //   draggingRef      never move the view while a finger is down
  const [viewportH, setViewportH] = useState(0);
  const [composerHeight, setComposerHeight] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const pinScrolledRef = useRef<string | null>(null);
  const pinActiveRef = useRef(false);
  const pinSpacerRef = useRef(0);
  const contentHeightRef = useRef(0);
  const draggingRef = useRef(false);
  const followScheduledRef = useRef(false);

  // `initialQuery: ''` is load-bearing — see the header comment. With it empty
  // the controller mounts inert: it seeds nothing, opens no turn, and fires no
  // request until `send` is called, which this screen never does.
  const chat = useChatController({ initialQuery: '' });
  const mode = chat.mode;

  const keyboardInset = useKeyboardInset();
  const reserve = useTabBarReserve();
  const avoidStyle = useAnimatedStyle(
    () => ({ paddingBottom: Math.max(keyboardInset.value, reserve) }),
    [reserve],
  );

  const hasThread = chat.viewMessages.length > 0 || chat.liveActive;
  const canSend = chat.input.trim().length > 0 || staged.length > 0;

  // The most-recent USER message — the one to pin. Changes on every send, which
  // is what re-arms the pin for the next turn.
  const latestUserId = useMemo(() => {
    const ms = chat.viewMessages;
    for (let i = ms.length - 1; i >= 0; i--) if (ms[i].role === 'user') return ms[i].id;
    return null;
  }, [chat.viewMessages]);

  useEffect(() => {
    pinActiveRef.current = latestUserId != null;
    /**
     * ⚠️ RESERVED ONLY WHILE THE TURN IS STILL GENERATING — not for the rest
     * of the thread.
     *
     * This used to be `latestUserId != null ? viewportH : 0`: a FULL SCREEN
     * of blank space reserved the moment any user message existed, forever,
     * because nothing ever released it once the pin had done its job.
     * Reported 2026-09-24: scrolling past a short answer showed a full dark
     * void with nothing in it — no content, no affordance — indistinguishable
     * from a broken screen.
     *
     * The reserve exists so the ONE `scrollTo(pinTarget(...))` call — fired
     * once, right as the row lays out, before the answer has streamed much
     * text yet — has somewhere to land; without it, RN clamps the scroll to
     * the (still short) content and the pin falls short of the top.
     * `shouldFollow`'s `pinActive` veto (`threadScroll.ts`) means the view is
     * never re-scrolled after that ONE call, so the pinned row's on-screen
     * position does not move as the answer grows below it — the reserve does
     * not need to keep pace with that growth, it only needs to exist long
     * enough for the first scroll to land. Once `chat.liveActive` goes false
     * there is no more growth to protect the pin against, so the reserve
     * collapses to 0. That does not resurrect the "message scrolls off top"
     * bug `CHATBOT_RULES.md` §6 was written against — that bug is a
     * DURING-generation defect, which this still fully covers.
     */
    pinSpacerRef.current = latestUserId != null && chat.liveActive ? viewportH : 0;
  }, [latestUserId, viewportH, chat.liveActive]);

  /**
   * ⚠️ LEAVING MID-STREAM MUST NOT STRAND THE SHARED TURN STORE.
   *
   * `useThread` is app-wide. Without this, sending and then tabbing away or
   * pressing back leaves `turn.status === 'streaming'` forever: on return the
   * screen remounts, `seed` replaces the committed messages, and `LiveAnswer`
   * paints an answer with NO question above it while the composer shows Stop
   * for a conversation the reader cannot see.
   *
   * `stop()`, not `abort()` — the shipped chat's comment is explicit that abort
   * "only kills the network and left turn.status stuck 'streaming'".
   *
   * The refs exist so the cleanup can read the CURRENT values without the
   * effect re-subscribing on every token (`chat` is a fresh object each render).
   */
  const stopRef = useRef(chat.stop);
  const liveRef = useRef(chat.liveActive);
  useEffect(() => {
    stopRef.current = chat.stop;
    liveRef.current = chat.liveActive;
  });
  useEffect(
    () => () => {
      if (liveRef.current) stopRef.current();
    },
    [],
  );

  // The arithmetic lives in `threadScroll.ts` and is tested there. This file
  // only wires it to refs and to the ScrollView — the four rules it encodes
  // (subtract the spacer, widen the band while live, a pin beats following,
  // never move under a finger) are documented at their definitions, not here,
  // so the two chat screens cannot drift in what they mean by them.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const atBottom = isAtBottom(
        {
          contentHeight: contentSize.height,
          spacerHeight: pinSpacerRef.current,
          scrollY: contentOffset.y,
          viewportHeight: layoutMeasurement.height,
        },
        chat.liveActive,
      );
      atBottomRef.current = atBottom;
      setShowScrollDown(!atBottom);
    },
    [chat.liveActive],
  );

  const onScrollBeginDrag = useCallback(() => {
    draggingRef.current = true;
  }, []);
  /**
   * ⚠️ BOTH endings have to clear it. `onMomentumScrollEnd` fires only when the
   * release had a flick behind it; a slow drag let go with no velocity produces
   * NO momentum phase, so with only that handler `draggingRef` stayed `true`
   * for the rest of the mount — a permanent veto in `shouldFollow`. The shipped
   * chat wires `onScrollEndDrag` too; the port left it out.
   */
  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      draggingRef.current = false;
      onScroll(e);
    },
    [onScroll],
  );
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      draggingRef.current = false;
      onScroll(e);
    },
    [onScroll],
  );

  // rAF coalesces a burst of token-driven size changes into ONE non-animated
  // scroll, so the thread glides instead of stacking overlapping animations.
  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
    const go = shouldFollow({
      atBottom: atBottomRef.current,
      dragging: draggingRef.current,
      pinActive: pinActiveRef.current,
      scheduled: followScheduledRef.current,
    });
    if (!go) return;
    followScheduledRef.current = true;
    requestAnimationFrame(() => {
      followScheduledRef.current = false;
      scrollRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  const onScrollDown = useCallback(() => {
    haptics.tap();
    atBottomRef.current = true;
    setShowScrollDown(false);
    const target = bottomTarget(
      {
        contentHeight: contentHeightRef.current,
        spacerHeight: pinSpacerRef.current,
        viewportHeight: viewportH,
      },
      PIN_GAP,
    );
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: target, animated: true }));
  }, [viewportH]);

  /**
   * The sheet chose a source; run the matching picker.
   *
   * All three already existed on `useAttachmentPicker` — `pickLibrary` simply
   * had no caller in v2 until the sheet gave it somewhere to live. Each stages
   * into `composerStore`, which the chips above the composer already render.
   */
  const onPickSource = useCallback(
    (source: AttachSource) => {
      if (source === 'camera') void picker.pickCamera();
      else if (source === 'library') void picker.pickLibrary();
      else void picker.pickDocument();
    },
    [picker],
  );

  const onModeChange = useCallback(
    (next: ComposerMode) => {
      if (next === mode) return;
      haptics.tap();
      // Local UI state shared with the shipped Home composer. Picks the copy,
      // the openers, and which endpoint the NEXT turn would use.
      useComposer.getState().setMode(next);
    },
    [mode],
  );

  // `setInput` is the controller's own `useState` setter — stable across
  // renders, unlike the `chat` object itself, which is rebuilt every render.
  const setInput = chat.setInput;
  const onStarter = useCallback(
    (prompt: string) => {
      haptics.tap();
      // Openers FILL the composer rather than sending: sending streams, and
      // writes are deferred. It is also the better behaviour — the person can
      // edit the question before it goes.
      setInput(prompt);
      inputRef.current?.focus();
    },
    [setInput],
  );

  const onSend = useCallback(() => {
    haptics.impact();
    // No auth gate — see note 5 in the file header. The assistant is open to
    // guests under App Review 5.1.1(v), and gating it here is what got a build
    // rejected once already.
    //
    // WIRED 2026-09-17. This was inert behind `TODO(v2-writes)` and fired only
    // a haptic, so the send button buzzed and did nothing — the worst shape a
    // control can have, because the buzz confirms the tap landed. It was also
    // the wrong call: the assistant is not an unbuilt feature, it WORKS in the
    // shipped UI, and this screen already mounts the very same
    // `useChatController` that `app/(lab)/chat.tsx` mounts. Nothing needed
    // building; the call had simply never been connected.
    //
    // `send` owns clearing the input and starting the turn (it calls
    // `setInput('')` then `labTurn.start`), so do not clear it here — doing so
    // would race the controller and drop the text it is about to send.
    // The pin effect scrolls the new message to the TOP, so the reader is by
    // definition looking at fresh content — the pill would be a lie.
    setShowScrollDown(false);

    /**
     * ⚠️ PUT THE KEYBOARD AWAY. This belongs WITH the pin, not beside it.
     *
     * The shipped chat has done this since it got the pin —
     * `app/(lab)/chat.tsx`, "Dismiss the keyboard on send (ChatGPT/Claude
     * style) so the answer isn't hidden behind it and the pinned message is
     * fully visible." When the pin was ported here on 2026-09-21 that half came
     * with it and this half did not, so v2 pinned the question to the top and
     * then left the keyboard covering the space the answer grows into. The two
     * are one behaviour; do not separate them again.
     *
     * Measured on this handset (1080×2400): keyboard UP, the thread gets about
     * 565px of the 2400 and the pinned question eats most of it, so the answer
     * streams into a slot barely taller than a paragraph. Keyboard DOWN, the
     * same area is about 1150px — roughly double.
     *
     * `Keyboard.dismiss()` rather than the shipped screen's
     * `inputRef.current?.blur()`: same effect when the composer holds focus,
     * but it also works when something else does.
     */
    Keyboard.dismiss();

    chat.send(chat.input);
  }, [chat]);

  const onBell = useCallback(() => {
    haptics.tap();
    // Was an EMPTY callback — signed in, the bell did nothing. `index.tsx`
    // already pointed at the shipped notifications screen; two bells in one app
    // should not disagree about whether notifications open.
    // TODO(v2-nav): repoint at a v2 notifications surface if one is drawn.
    requireAuth('notifications', () => router.push(routes.labNotifications));
  }, []);

  /**
   * ── THE BANNER GOES AWAY ONCE THERE IS A CONVERSATION ──
   *
   * The display title and the supporting line are ONBOARDING. "Describe what
   * you are selling, or add a photo of the nameplate, and it drafts the
   * listing" answers a question the person has already answered by sending
   * something — and it costs about a third of the screen, permanently, on the
   * one screen whose job is reading.
   *
   * The pin made it worse: the pin puts the question at the top of the THREAD,
   * and the thread's top was already a third of the way down. With the keyboard
   * up the whole reading area is ~565px — smaller than this header was.
   *
   * ChatGPT and Gemini both do this: a tall invitation when empty, a compact
   * bar once you are talking.
   *
   * ⚠️ A first attempt kept a small "Assistant" on its own row and saved only
   * ~135px, because the emptiness is not the title — it is `BrandBar`'s 30dp
   * bottom margin plus `Screen`'s 34dp padding, which sat around the small
   * title exactly as they sat around the big one. Dropping the row entirely and
   * flushing the bar is what actually reclaims it.
   *
   * What stays, and why:
   *   • `BrandBar` — app chrome, and the bell is a live control. It also
   *     carries the wordmark, so the screen is still identified.
   *   • the Selling/Buying tabs, directly below — they say which assistant this
   *     is far better than the word "Assistant" did.
   *   • the wash sheet — v2's signature shape; losing it would make chat look
   *     like a different app.
   */
  const newChat = (
    <IconAction
      tone="quiet"
      accessibilityLabel="New chat"
      accessibilityHint="Starts a fresh conversation. This one is not kept."
      onPress={onNewChat}
      icon={<SquarePen size={icon.xl} color={c.ink} strokeWidth={1.8} />}
      testID="v2-chat-new"
    />
  );

  const brandBar = (
    <BrandBar
      language={languageBadge(i18n.language)}
      unread={unreadCount}
      onNotifications={onBell}
      onLanguage={() => {
        haptics.tap();
        setLangOpen(true);
      }}
      // Both only in the collapsed state: `trailing` gives "New chat" a home
      // now the title row is gone, and `flush` drops the margin that only
      // existed to separate the bar from that row.
      trailing={hasThread ? newChat : undefined}
      flush={hasThread}
    />
  );

  const header = hasThread ? (
    brandBar
  ) : (
    <>
      {brandBar}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text variant="display">Assistant</Text>
          <Text variant="body" color="inkMuted" style={styles.titleSub}>
            {HEADER_SUB[mode]}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <Screen header={header} scroll={false} contentStyle={styles.fill} testID="v2-chat">
      <View style={styles.tabsWrap}>
        <Tabs items={MODE_TABS} value={mode} onChange={onModeChange} rule gutter />
      </View>

      <Animated.View style={[styles.fill, avoidStyle]}>
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          /**
           * TOP-ALIGNED, and ⚠️ do not "fix" the empty state with `flex-end`.
           *
           * The shipped chat hugs its composer when empty
           * (`app/(lab)/chat.tsx:352`, `justifyContent: latestUserId ?
           * 'flex-start' : 'flex-end'`) to kill the dead area under the
           * openers. That was tried here on 2026-09-21 and is WORSE, because
           * the two screens have different headers: the lab chat has a compact
           * title bar, v2 has the green sheet with a display title and a
           * three-line subtitle. Pushing the openers to the bottom does not
           * remove the gap, it moves it into the middle — header, void,
           * openers — which reads as two disconnected screens rather than one
           * waiting for input. Photographed both ways in dark before reverting.
           *
           * Blank space above the composer in an empty chat is normal and is
           * what ChatGPT shows too. The lesson is the general one: a proven
           * implementation still has to be checked in the layout it is moving
           * into.
           */
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
          testID="v2-chat-thread"
        >
          {/* A wrapper, not a fragment: the thread container spaces its children
              with `gap`, and the openers space themselves with hairlines. */}
          {!hasThread ? (
            <View>
              <SectionHeader title="Try asking" />
              {STARTERS[mode].map((prompt, i) => (
                <React.Fragment key={prompt}>
                  {i > 0 ? <Hairline /> : null}
                  <Row
                    title={prompt}
                    titleVariant="row"
                    titleLines={2}
                    /*
                      ⚠️ SEND WHAT THE ROW SHOWS, NOT THE SOURCE STRING.

                      `Row` translates its `title` on the way to the screen, so
                      this chip reads 我有一台二手 CNC 工具機要賣 — but
                      `prompt` is still the English literal, and passing it
                      straight through put English in the composer the moment a
                      Chinese chip was tapped. Observed on device 2026-10-01.
                      It also meant the assistant was asked in English by
                      someone using the app in Chinese, so it answered in
                      English.
                    */
                    onPress={() => onStarter(tr(prompt))}
                    // KIT GAP: `Row` takes no `accessibilityHint`, so "puts
                    // this in the message box" has to ride in the label.
                    accessibilityLabel={`${tr(prompt)}. Fills the message box.`}
                    testID={`v2-chat-starter-${i}`}
                  />
                </React.Fragment>
              ))}
            </View>
          ) : null}

          {chat.viewMessages.map((m) => (
            <View
              key={m.id}
              // Pin this row to the top, exactly once. `pinScrolledRef` is the
              // guard: without it a later relayout — the keyboard opening, an
              // image finishing decode — fires `onLayout` again and re-yanks a
              // thread the reader has since scrolled.
              onLayout={
                m.id === latestUserId
                  ? (e) => {
                      if (pinScrolledRef.current === m.id) return;
                      pinScrolledRef.current = m.id;
                      const y = e.nativeEvent.layout.y;
                      requestAnimationFrame(() =>
                        scrollRef.current?.scrollTo({
                          y: pinTarget(y, PIN_GAP),
                          animated: true,
                        }),
                      );
                    }
                  : undefined
              }
            >
              <MessageRow message={m} onRetry={chat.onRetry} />
            </View>
          ))}

          <LiveAnswer mode={chat.apiMode} />

          {/* Reserved ONLY while the turn is still generating — see the
              docblock on the effect above. Zero once it finishes, so a short
              answer does not leave a permanent void above the composer. */}
          <View style={{ height: latestUserId != null && chat.liveActive ? viewportH : 0 }} />
        </ScrollView>

        {/* Scroll-to-bottom — the standard affordance in every streaming chat.
            `IconAction tone="quiet"` is the kit's secondary circle: same
            geometry as Send, without a second green disc competing with it. */}
        {showScrollDown ? (
          <View
            style={[
              styles.scrollDown,
              // The elevation goes on THIS wrapper, not on `IconAction`. That
              // component sets `overflow: 'hidden'` for its material fill, which
              // clips a shadow away on iOS while Android's `elevation` still
              // draws — so passing it down would have looked right on this
              // handset and wrong on a phone nobody tested it on.
              shadow.raised,
              { bottom: (composerHeight || control.input) + space.xl },
            ]}
            pointerEvents="box-none"
          >
            <IconAction
              accessibilityLabel="Scroll to the latest message"
              tone="quiet"
              onPress={onScrollDown}
              icon={<ChevronDown size={icon.xl} color={c.ink} strokeWidth={2} />}
              testID="v2-chat-scroll-down"
            />
          </View>
        ) : null}

        <Hairline />

        <View
          style={styles.composer}
          // Measured, not guessed: the composer grows with multiline text and
          // with staged attachment chips, and the pill has to sit above it.
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
        >
          {staged.length > 0 ? (
            <View style={styles.stagedRow}>
              {staged.map((a) => (
                <StagedChip
                  key={a.uri}
                  label={a.name}
                  onRemove={() => {
                    haptics.tap();
                    useComposer.getState().removeAttachment(a.uri);
                  }}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.composerRow}>
            {/*
              The composer is a 52pt filled box on `surface` — structurally the
              same shape as the kit's `Field`, so it gets the same ramp. It was
              left `flat: PENDING` with a note to "decide with the kit's Field",
              and this is that decision: the kit's own argument applies verbatim
              here. On a thread showing the want card, the card's budget Field
              and this composer sit one above the other, one with depth and one
              without, "which is a difference the eye reads as a bug rather than
              as meaning".

              ⚠️ `overflow: 'hidden'` on `styles.field` is what clips the
              gradient to the radius — without it the ramp paints a square
              behind the rounded box.
            */}
            <View style={[styles.field, { backgroundColor: c.surface }]}>
              <MaterialFill role="surface" ink="ink" radius={radius.xl} />
              {/*
                ONE control, not two. A camera glyph and a paperclip side by
                side each took width from the field between them and made the
                person choose a source before they had chosen to attach
                anything. `AttachSheet` holds the choice — and adds the photo
                library, which `useAttachmentPicker` has always supported and
                v2 never offered.
              */}
              <GlyphButton
                label="Add a photo or file"
                onPress={() => {
                  haptics.tap();
                  attachRef.current?.present();
                }}
              >
                <Plus size={icon.xl} color={c.inkMuted} strokeWidth={2} />
              </GlyphButton>
              <TextInput
                ref={inputRef}
                value={chat.input}
                onChangeText={chat.setInput}
                /* Not a `Text` child, so the kit's translation interception
                   never sees it — see `useV2Copy`. The composer was the one
                   English string left on this screen. */
                placeholder={tr(PLACEHOLDER[mode])}
                placeholderTextColor={c.inkDisabled}
                multiline
                accessibilityLabel={tr(PLACEHOLDER[mode])}
                style={[styles.input, typeScale.body, { color: c.ink }]}
                testID="v2-chat-input"
              />
            </View>

            {/* One control, two jobs: Stop while a turn is live, Send otherwise. */}
            {chat.liveActive ? (
              <IconAction
                accessibilityLabel="Stop"
                onPress={() => {
                  haptics.tap();
                  // Not a write — it kills the in-flight stream and settles the
                  // turn locally.
                  chat.stop();
                }}
                icon={<Square size={icon.md} color={c.onAccent} strokeWidth={2.4} />}
                testID="v2-chat-stop"
              />
            ) : (
              <IconAction
                accessibilityLabel="Send"
                disabled={!canSend}
                onPress={onSend}
                icon={<ArrowUp size={icon['2xl']} color={c.onAccent} strokeWidth={2.2} />}
                testID="v2-chat-send"
              />
            )}
          </View>
        </View>
      </Animated.View>

      <AttachSheet ref={attachRef} onPick={onPickSource} />
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </Screen>
  );
}

/**
 * One committed message.
 *
 * `onRetry` is threaded in from the screen rather than pulled from a store: the
 * controller is mounted once, at the screen, and a second `useChatController`
 * in here would open its own conversation.
 */
function MessageRow({ message, onRetry }: { message: Message; onRetry: (text: string) => void }) {
  if (message.role === 'user') {
    return <UserBubble text={messageText(message)} attachments={message.attachments} />;
  }
  const failed = isErrorMessage(message);
  return (
    <AssistantTurn
      text={resolveBotText(messageText(message), drawnCards(message.cards))}
      failed={failed}
      cards={failed ? undefined : message.cards}
      // WIRED 2026-09-17, alongside send. A failed turn now offers "Try again"
      // and re-sends the original text. It was `undefined` while sending was
      // inert — correct then, because offering a retry that cannot retry is
      // worse than not offering one.
      onRetry={failed ? () => onRetry(message.retry ?? '') : undefined}
    />
  );
}

/**
 * "New chat" mints a fresh `conversation_id` and REMOUNTS the thread.
 *
 * The remount is not cosmetic: `useChatController` reads the conversation id
 * once, on mount, and keys the committed history by it. Resetting the session
 * without remounting would leave the controller pointing at the old id — a new
 * conversation on the server, the old one on screen.
 */
export default function V2Chat() {
  const [threadKey, setThreadKey] = useState(0);

  const onNewChat = useCallback(() => {
    haptics.tap();
    useThread.getState().reset();
    useSession.getState().reset();
    setThreadKey((k) => k + 1);
  }, []);

  return <ChatScreen key={threadKey} onNewChat={onNewChat} />;
}

const styles = StyleSheet.create({
  /** `Screen` measures its body with `width:100%` and no flex; the thread's
   *  ScrollView inside that collapses to zero height without this. */
  fill: { flex: 1 },

  // ── header sheet ──
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space['3xl'],
  },
  titleCol: { flex: 1, minWidth: 0 },
  titleSub: { marginTop: space.md, maxWidth: HEADER_SUB_MEASURE },

  // ── tabs ──
  tabsWrap: { paddingTop: space['5xl'] },

  // ── thread ──
  thread: {
    flexGrow: 1,
    paddingTop: space['6xl'],
    paddingBottom: SECTION_GAP,
    gap: space['5xl'],
  },
  /** The scroll-to-bottom pill floats over the thread, above the composer.
   *  `box-none` on the wrapper so the thread underneath stays scrollable. */
  scrollDown: { position: 'absolute', right: GUTTER, alignItems: 'flex-end' },

  rowLeft: { alignItems: 'flex-start', width: '100%' },
  rowRight: { alignItems: 'flex-end', width: '100%', paddingHorizontal: GUTTER },
  userBubble: {
    // Clips the ramp to the rounded corners — see `MaterialFill` at the bubble.
    overflow: 'hidden',
    maxWidth: '86%',
    borderRadius: radius.lg,
    paddingHorizontal: space['3xl'],
    paddingVertical: space.xl,
    gap: space.md,
  },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },

  // ── prose ──
  /**
   * `rowGap` separates consecutive LIST ITEMS, which previously sat at a flat
   * 20pt rhythm with nothing between them — the bullets ran together as one
   * block. 4pt is enough to group them without loosening paragraph rhythm.
   */
  prose: { width: '100%', paddingHorizontal: GUTTER, rowGap: space.xs },
  proseLine: { width: '100%' },
  /** A heading needs more air ABOVE it than below: the gap is what detaches it
   *  from the paragraph it follows and binds it to the one it introduces. */
  proseHeading: { marginTop: space['3xl'], marginBottom: space.sm },
  /**
   * A blank line in the answer.
   *
   * Was `space.lg` (10) — half a 20pt line — on the reasoning that paragraphs
   * breathe through leading. On a real multi-paragraph answer at phone width
   * that is the "wall of text" shape: NN/g's *Less Chat, More Answer* notes
   * that "the chat viewport is much smaller, so even a small paragraph can look
   * like a wall of text". Three-quarters of a line separates without drifting
   * into the airiness of a full blank row.
   */
  proseGap: { height: space['3xl'] },
  bulletRow: { flexDirection: 'row', gap: space.md },
  bulletText: { flex: 1, minWidth: 0 },
  /** A thematic break. The kit's `Hairline` is the rule; this is its air. */
  proseRule: { width: '100%', paddingVertical: space.xl },
  /**
   * A blockquote. The left bar is what replaces the `>` marker — the marker
   * itself used to reach the reader. `paddingLeft` clears the bar so the text
   * does not sit on it.
   */
  proseQuote: {
    width: '100%',
    borderLeftWidth: 2,
    paddingLeft: space['2xl'],
    marginVertical: space.sm,
  },
  working: { paddingHorizontal: GUTTER },
  /** The waiting placeholder: two prose-width bars under the phase line. */
  workingBars: { paddingHorizontal: GUTTER, paddingTop: space.xl, gap: space.lg, width: '100%' },
  workingBarWide: { height: 12, width: '86%' },
  workingBarShort: { height: 12, width: '54%' },

  // ── composer ──
  /**
   * ⚠️ `paddingBottom` is not optional here, and its absence was shipped.
   *
   * This had `paddingTop` only, so the composer's bottom edge WAS the
   * container's bottom edge. Measured on the handset: the send button's last
   * green pixel at y=2087 and the tab bar's divider at y=2089 — a two-pixel
   * gap, under 1dp. The button read as welded to the navigation bar.
   *
   * It is not the tab bar's fault and not `useTabBarReserve`'s: the bar is a
   * real flex sibling below this, so it correctly reserves nothing. A footer
   * that sits directly above it has to space itself.
   */
  composer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  field: {
    // Clips the ramp to the rounded corners, exactly as the kit's `Field` does.
    overflow: 'hidden',
    flex: 1,
    minWidth: 0,
    minHeight: control.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    paddingHorizontal: space['3xl'],
    borderRadius: radius.xl,
  },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: INPUT_MAX_HEIGHT,
    // Android gives a multiline TextInput its own, larger vertical padding.
    // Pin it so the field's 52pt minHeight is what centres a single line, while
    // leaving enough room that descenders are never clipped.
    paddingVertical: space.md,
  },
  stagedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
