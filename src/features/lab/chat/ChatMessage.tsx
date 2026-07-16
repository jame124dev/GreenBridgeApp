// One thread message row for the (lab) chat surface (05-mobile-ux §2.2).
// - user  → right, filled accent bubble
// - bot   → left, surface bubble; thinking dots pre-first-token; Markdown-lite
//           prose; response cards under the bubble; "Sources" strip on done
// - err   → left, danger-tint bubble + inline Retry
// Completed rows POP in; the streaming bot bubble does NOT POP per token (it
// fades once then grows — the screen renders it via a separate live component).
import React, { memo } from 'react';
import { Linking, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { AlertTriangle, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage } from '@/components/ui';
import { fonts, radius, spacing } from '@/constants/theme';
import { usePop } from '@/animations/recipes';
import { CHAT_UI_V2 } from '@/lib/flags';
import { createThemedStyles, useColor } from './theme';
import { GhostButton, renderCard } from './cards';
import { toolLabel } from './cardKit';
import { WorkingIndicator } from './WorkingIndicator';
import { MessageActions } from './MessageActions';
import { isErrorMessage, messageText, type Message } from './types/message';
import { CodeBlock } from './CodeBlock';
import { messageHasDraftCard, resolveBotText } from './streamSanitizer';

/* ── Markdown-lite → RN <Text> ─────────────────────────────────────────────
 * The assistant emits only bold, bullet/numbered lists, links, code blocks,
 * inline code, block quotes, and headings. A tiny line/block parser covers all
 * of it without a heavy dependency (05 §2.2). */

// Tokenize bold / image / link / inline code so the assistant's markdown doesn't leak raw
// syntax. Order matters.
const MD_TOKEN_RE = /(!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|\*\*[^*]+\*\*|`[^`]+`)/g;
const MD_LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;

function InlineText({ text, style }: { text: string; style?: object }) {
  const styles = useChatMessageStyles();
  const parts = text.split(MD_TOKEN_RE).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        // Image markdown → drop entirely (the draft card renders the photo; the
        // raw `![alt](long-gcs-url)` is pure noise in the prose bubble).
        if (p.startsWith('![')) return null;
        // Link markdown → tappable label, never the raw `[text](url)`/long URL.
        const link = MD_LINK_RE.exec(p);
        if (link) {
          const url = link[2];
          return (
            <Text
              key={i}
              style={styles.link}
              onPress={() => {
                Linking.openURL(url).catch(() => undefined);
              }}
            >
              {link[1] || url}
            </Text>
          );
        }
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <Text key={i} style={styles.bold}>
              {p.slice(2, -2)}
            </Text>
          );
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <Text key={i} style={styles.inlineCode}>
              {p.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

export type Block =
  | { type: 'prose'; text: string }
  | { type: 'code'; code: string; language: string };

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeLines: string[] = [];
  let language = '';
  let proseLines: string[] = [];

  const flushProse = () => {
    if (proseLines.length > 0) {
      blocks.push({ type: 'prose', text: proseLines.join('\n') });
      proseLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^```(\w*)/);
    if (match) {
      if (inCode) {
        blocks.push({ type: 'code', code: codeLines.join('\n'), language });
        codeLines = [];
        language = '';
        inCode = false;
      } else {
        flushProse();
        language = match[1] || '';
        inCode = true;
      }
    } else if (inCode) {
      codeLines.push(line);
    } else {
      proseLines.push(line);
    }
  }

  if (inCode) {
    blocks.push({ type: 'code', code: codeLines.join('\n'), language });
  } else {
    flushProse();
  }

  return blocks;
}

function MarkdownLiteProse({ text }: { text: string }) {
  const styles = useChatMessageStyles();
  const lines = text.split('\n');
  return (
    <View style={{ width: '100%' }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line.trim() === '') return <View key={i} style={styles.gap} />;
        // Drop a line that carries an image (e.g. "- Image: ![alt](gcs-url)") —
        // the listing draft card already shows the photo, so the raw markdown +
        // long URL would just be a wide, ugly noise line here.
        if (/!\[[^\]]*\]\([^)]*\)/.test(line)) return null;

        // Headings: #, ##, ###
        const heading = line.match(/^\s*(#{1,3})\s+(.*)$/);
        if (heading) {
          return <InlineText key={i} text={heading[2]} style={styles.heading} />;
        }

        // Blockquotes: >
        const quote = line.match(/^\s*>\s+(.*)$/);
        if (quote) {
          return (
            <View key={i} style={styles.quoteContainer}>
              <View style={styles.quoteBorder} />
              <InlineText text={quote[1]} style={styles.quoteText} />
            </View>
          );
        }

        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} style={styles.li}>
              <Text style={styles.bullet}>•</Text>
              <InlineText text={bullet[1]} style={styles.botText} />
            </View>
          );
        }
        if (numbered) {
          return (
            <View key={i} style={styles.li}>
              <Text style={styles.bullet}>{numbered[1]}.</Text>
              <InlineText text={numbered[2]} style={styles.botText} />
            </View>
          );
        }
        return <InlineText key={i} text={line} style={styles.botText} />;
      })}
    </View>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <View style={{ width: '100%' }}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return <CodeBlock key={idx} code={block.code} language={block.language} />;
        }
        return <MarkdownLiteProse key={idx} text={block.text} />;
      })}
    </View>
  );
}

// The card-aware text strips live in the pure `streamSanitizer` module now
// (PR: clean streaming frames) so the streaming path can converge on the exact
// committed render. Re-exported so existing importers keep working unchanged.
export {
  stripDraftFieldDump,
  stripCardFieldDump,
  messageHasDraftCard,
  messageHasInfoCard,
} from './streamSanitizer';

function SourcesStrip({ tools }: { tools: string[] }) {
  const { t } = useTranslation();
  const styles = useChatMessageStyles();
  const unique = [...new Set(tools)];
  if (unique.length === 0) return null;
  return (
    <View style={styles.sources}>
      <Text style={styles.sourcesLabel}>{t('mobile.labCards.sources')}</Text>
      {unique.map((t) => (
        <View key={t} style={styles.sourceChip}>
          <View style={styles.sourceDot} />
          <Text style={styles.sourceChipText}>{toolLabel(t)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Card-action handlers threaded to `renderCard` — shared by the committed
 *  (ChatMessage) and streaming (StreamingMessage) drivers via AssistantMessage. */
export type CardActionHandlers = {
  onSend: (text: string) => void;
  onUploadPress?: () => void;
  onEditDraft?: (data: unknown) => void;
  onJumpProduct?: (index: number) => void;
  onAdvanceProduct?: (dir: 'prev' | 'next', currentIndex: number, total: number) => void;
  onCombineProducts?: () => void;
  onSplitProducts?: () => void;
  onPublishBatch?: () => void;
  batchBusy?: boolean;
};

/**
 * The SHARED assistant-message presentation (A4 §2.1 / §12.7). BOTH the committed
 * path (ChatMessage) and the live streaming path (StreamingMessage) render THIS
 * subtree — a single source of visual truth, so the two can never drift. Callers
 * own the row wrapper + entering animation and supply already-resolved `text`
 * (committed: full/field-dump-collapsed; streaming: the revealed substring).
 * Thinking dots show pre-first-token (no text, no cards). Cards are each wrapped
 * in a CardBoundary so a bad payload never crashes the thread (05-mobile-ux §4).
 */
export function AssistantMessage({
  text,
  cards,
  sources,
  mode,
  committed,
  streaming,
  phase,
  onSend,
  onUploadPress,
  onEditDraft,
  onJumpProduct,
  onAdvanceProduct,
  onCombineProducts,
  onSplitProducts,
  onPublishBatch,
  batchBusy,
}: CardActionHandlers & {
  text: string;
  cards?: { type: string; data: unknown }[];
  sources?: string[];
  mode: 'buyer' | 'seller';
  /** R4: this is a SETTLED message (not the live streaming leaf) → show the
   *  copy/share/feedback action row (behind CHAT_UI_V2). The streaming driver
   *  omits it, so actions only appear once the answer is final. */
  committed?: boolean;
  /** True only for the live streaming leaf; keeps the text bubble slot present
   *  pre-first-token so an early data-card can never render above the text. */
  streaming?: boolean;
  /** Optional live pipeline phase (turn.phase) — surfaced by the WorkingIndicator
   *  as a phase-aware "AI is working" label pre-first-token. Additive: absent on
   *  committed messages (which are never thinking), so behavior-neutral there. */
  phase?: string;
}) {
  const styles = useChatMessageStyles();
  const hasCards = !!cards && cards.length > 0;
  const isThinking = !text && (streaming || !hasCards);
  // A DRAFT card (WTB / listing) is an artifact the assistant "presents" — while
  // streaming, hold it until the intro text has begun so it slides in BELOW the
  // prose instead of popping in first and getting a text bubble pushed in above
  // it. Result/info cards still stream in immediately (they ARE the answer).
  // Committed messages always show their cards.
  const isDraftCard = messageHasDraftCard(cards);
  const showCards = hasCards && (!streaming || !isDraftCard || !!text);
  const cardsInner = hasCards
    ? cards!.map((c, i) => (
        <CardBoundary key={`${c.type}-${i}`}>
          {renderCard(c.type, c.data, {
            mode,
            onSend,
            onUploadPress,
            onEditDraft,
            onJumpProduct,
            onAdvanceProduct,
            onCombineProducts,
            onSplitProducts,
            onPublishBatch,
            batchBusy,
          })}
        </CardBoundary>
      ))
    : null;
  return (
    <View style={styles.botWrap}>
      {(text || isThinking) && (
        <View style={[styles.bubble, styles.botBubble]}>
          {isThinking ? <WorkingIndicator phase={phase} mode={mode} /> : <MarkdownLite text={text} />}
        </View>
      )}

      {committed && CHAT_UI_V2 && !!text ? <MessageActions text={text} /> : null}

      {/* Streaming: cards fade/slide in (smooth entrance, no pop). Committed: plain
          View — the row already animates, and this keeps snapshots byte-identical. */}
      {showCards ? (
        streaming ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.cards}>
            {cardsInner}
          </Animated.View>
        ) : (
          <View style={styles.cards}>{cardsInner}</View>
        )
      ) : null}

      {sources && sources.length > 0 ? <SourcesStrip tools={sources} /> : null}
    </View>
  );
}

export type ChatMessageProps = {
  msg: Message;
  mode: 'buyer' | 'seller';
  /** Send a follow-up turn (card actions + retry). */
  onSend: (text: string) => void;
  /** Retry the errored turn's original message. */
  onRetry: (text: string) => void;
  /** Open the native picker action sheet from the entry-options card. */
  onUploadPress?: () => void;
  /** Open the native edit sheet for a listing_draft card (threaded to cards). */
  onEditDraft?: (data: unknown) => void;
  /* Multi-product batch callbacks (additive; queue/group_choice/batch_result).
   * Passed only behind DETECT_STREAM_ENABLED; undefined → cards render read-only. */
  onJumpProduct?: (index: number) => void;
  onAdvanceProduct?: (dir: 'prev' | 'next', currentIndex: number, total: number) => void;
  onCombineProducts?: () => void;
  onSplitProducts?: () => void;
  onPublishBatch?: () => void;
  batchBusy?: boolean;
  /** This committed row is replacing the pixel-identical streaming bubble on
   *  screen (the settle handoff) — mount with NO entering animation so the swap
   *  frame is invisible (no POP/fade on text the user is already reading). */
  handoff?: boolean;
};

function ChatMessageImpl({
  msg,
  mode,
  onSend,
  onRetry,
  onUploadPress,
  onEditDraft,
  onJumpProduct,
  onAdvanceProduct,
  onCombineProducts,
  onSplitProducts,
  onPublishBatch,
  batchBusy,
  handoff,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const popEntering = usePop();
  const styles = useChatMessageStyles();
  const sellAccent = useColor('mode.sell');
  const buyAccent = useColor('mode.buy');
  const accent = mode === 'seller' ? sellAccent : buyAccent;
  const dangerStrong = useColor('status.dangerStrong');

  const text = messageText(msg);
  const isErr = isErrorMessage(msg);

  // User bubble — right, filled. Renders sent attachments (image thumbnails /
  // doc chips) above the text so the sender sees what they sent.
  if (msg.role === 'user') {
    const atts = msg.attachments ?? [];
    const images = atts.filter((a) => a.isImage);
    const docs = atts.filter((a) => !a.isImage);
    const hasText = text.length > 0;
    return (
      <Animated.View entering={reduced ? FadeIn.duration(200) : popEntering} style={styles.rowRight}>
        <View style={[styles.bubble, styles.userBubble, !CHAT_UI_V2 && { backgroundColor: accent }]}>
          {images.length > 0 ? (
            <View style={[styles.sentImgRow, (hasText || docs.length > 0) && styles.sentAttGap]}>
              {images.map((a) => (
                <AppImage key={a.uri} source={{ uri: a.uri }} style={styles.sentImg} />
              ))}
            </View>
          ) : null}
          {docs.map((a, i) => (
            <View
              key={a.uri}
              style={[styles.sentDoc, (hasText || i < docs.length - 1) && styles.sentAttGap]}
            >
              <FileText size={15} strokeWidth={1.8} color="#fff" />
              <Text style={styles.sentDocName} numberOfLines={1}>
                {a.name}
              </Text>
            </View>
          ))}
          {hasText ? <Text style={styles.userText}>{text}</Text> : null}
        </View>
      </Animated.View>
    );
  }

  // Error bubble — left, danger tint + Retry.
  if (isErr) {
    return (
      <Animated.View entering={reduced ? FadeIn.duration(200) : popEntering} style={styles.rowLeft}>
        <View style={[styles.bubble, styles.errBubble]}>
          <View style={styles.errRow}>
            <AlertTriangle size={16} color={dangerStrong} />
            <Text style={styles.errText}>{text}</Text>
          </View>
          {msg.retry ? (
            <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <GhostButton label={t('mobile.labCards.retry')} small onPress={() => onRetry(msg.retry!)} />
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  }

  // Bot bubble — left. A settle handoff mounts PLAIN (entering undefined): the
  // row is replacing the streaming bubble's identical pixels in the same frame,
  // so any entrance animation would read as a visible jump (D3).
  const entering = handoff ? undefined : reduced ? FadeIn.duration(200) : popEntering;
  // When this turn carries a card that already shows the structured fields,
  // collapse the redundant field-dump prose (draft cards → their field list;
  // result/info cards like product_list → the bold "**Name** / **Condition:**"
  // bullets). The streaming leaf resolves through the SAME function (via
  // streamSafeText) so the settle swap is byte-identical.
  const botText = resolveBotText(text, msg.cards);
  return (
    <Animated.View entering={entering} style={styles.rowLeft}>
      <AssistantMessage
        text={botText}
        cards={msg.cards}
        sources={msg.sources}
        mode={mode}
        committed
        onSend={onSend}
        onUploadPress={onUploadPress}
        onEditDraft={onEditDraft}
        onJumpProduct={onJumpProduct}
        onAdvanceProduct={onAdvanceProduct}
        onCombineProducts={onCombineProducts}
        onSplitProducts={onSplitProducts}
        onPublishBatch={onPublishBatch}
        batchBusy={batchBusy}
      />
    </Animated.View>
  );
}

/** Per-card error boundary — a bad payload renders nothing, never crashes the
 *  thread (05-mobile-ux §4 "never crash the thread on a bad frame"). */
class CardBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export const ChatMessage = memo(ChatMessageImpl);

// Colors/elevation from the theme (D2); layout/spacing/radius/fonts stay as
// direct `@/constants/theme` imports (theme-independent). Built via the reusable
// createThemedStyles builder so the style-prop shape — and PR-0 snapshots — are
// unchanged.
const useChatMessageStyles = createThemedStyles((t) => ({
  rowRight: { alignItems: 'flex-end', width: '100%' },
  rowLeft: { alignItems: 'flex-start', width: '100%' },
  bubble: {
    maxWidth: '88%',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: CHAT_UI_V2 ? t.color['surface.alt'] : undefined,
    borderRadius: CHAT_UI_V2 ? radius.full : radius.lg,
    borderBottomRightRadius: CHAT_UI_V2 ? radius.full : radius.sm,
    paddingHorizontal: CHAT_UI_V2 ? 20 : 14,
    paddingVertical: CHAT_UI_V2 ? 14 : 10,
    maxWidth: CHAT_UI_V2 ? '72%' : '88%',
  },
  userText: {
    fontFamily: fonts.regular,
    fontSize: CHAT_UI_V2 ? 17 : 14,
    color: CHAT_UI_V2 ? t.color['text.primary'] : '#fff',
    lineHeight: CHAT_UI_V2 ? 26 : 20,
    letterSpacing: CHAT_UI_V2 ? -0.2 : 0,
  },
  // Sent attachments inside the user bubble (on the accent fill).
  sentImgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sentImg: {
    width: 168,
    height: 168,
    maxWidth: '100%',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sentDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sentDocName: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  sentAttGap: { marginBottom: 8 },
  botWrap: { width: '100%' },
  botBubble: {
    alignSelf: 'flex-start',
    maxWidth: CHAT_UI_V2 ? '84%' : '92%',
    backgroundColor: CHAT_UI_V2 ? 'transparent' : t.color['surface.raised'],
    borderWidth: CHAT_UI_V2 ? 0 : 1,
    borderColor: CHAT_UI_V2 ? 'transparent' : t.color['border.subtle'],
    borderBottomLeftRadius: CHAT_UI_V2 ? 0 : radius.sm,
    paddingHorizontal: CHAT_UI_V2 ? 0 : 14,
    paddingVertical: CHAT_UI_V2 ? 0 : 10,
    ...t.elevation('flat'),
  },
  errBubble: {
    backgroundColor: t.color['status.dangerSurface'],
    borderBottomLeftRadius: radius.sm,
  },
  errRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  errText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: t.color['status.dangerStrong'], lineHeight: 20 },
  botText: {
    fontFamily: fonts.regular,
    fontSize: CHAT_UI_V2 ? 17 : 14,
    color: t.color['text.primary'],
    lineHeight: CHAT_UI_V2 ? 32 : 21,
    letterSpacing: CHAT_UI_V2 ? -0.2 : 0,
  },
  bold: { fontFamily: fonts.bold },
  link: { fontFamily: fonts.semibold, color: t.color['accent'], textDecorationLine: 'underline' },
  inlineCode: {
    fontFamily: fonts.mono,
    fontSize: CHAT_UI_V2 ? 14 : 12,
    color: t.color['accent'],
    backgroundColor: CHAT_UI_V2 ? t.color['surface.alt'] : 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  heading: {
    fontFamily: fonts.semibold,
    fontSize: CHAT_UI_V2 ? 22 : 16,
    lineHeight: CHAT_UI_V2 ? 30 : 22,
    letterSpacing: CHAT_UI_V2 ? -0.3 : 0,
    color: t.color['text.primary'],
    marginTop: CHAT_UI_V2 ? spacing.md : spacing.xs,
    marginBottom: spacing.xs,
  },
  quoteContainer: {
    flexDirection: 'row',
    paddingLeft: 12,
    marginVertical: 6,
    position: 'relative',
  },
  quoteBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: t.color['accent'],
    borderRadius: 1.5,
  },
  quoteText: {
    fontFamily: fonts.regular,
    fontSize: CHAT_UI_V2 ? 17 : 14,
    lineHeight: CHAT_UI_V2 ? 28 : 20,
    color: t.color['text.secondary'],
  },
  gap: { height: CHAT_UI_V2 ? 24 : 8 },
  li: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  bullet: {
    fontFamily: fonts.semibold,
    fontSize: CHAT_UI_V2 ? 17 : 14,
    lineHeight: CHAT_UI_V2 ? 32 : 21,
    color: t.color['text.secondary'],
    minWidth: 16,
  },
  cards: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 8 },
  sourcesLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: t.color['text.muted'] },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    backgroundColor: t.color['surface.alt'],
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceDot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: t.color['status.success'] },
  sourceChipText: { fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 13, letterSpacing: 0.2, color: t.color['text.muted'] },
}));

