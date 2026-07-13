// One thread message row for the (lab) chat surface (05-mobile-ux §2.2).
// - user  → right, filled accent bubble
// - bot   → left, surface bubble; thinking dots pre-first-token; Markdown-lite
//           prose; response cards under the bubble; "Sources" strip on done
// - err   → left, danger-tint bubble + inline Retry
// Completed rows POP in; the streaming bot bubble does NOT POP per token (it
// fades once then grows — the screen renders it via a separate live component).
import React, { memo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { AlertTriangle, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage } from '@/components/ui';
import { brand, buyBlue, elevation, fonts, greenDarkest, greenMedium, radius, spacing } from '@/constants/theme';
import { usePop } from '@/animations/recipes';
import { GhostButton, renderCard } from './cards';
import { toolLabel } from './cardKit';
import { ThinkingDots } from './ThinkingDots';
import type { AiMsg } from './types';

/* ── Markdown-lite → RN <Text> ─────────────────────────────────────────────
 * The assistant emits only bold, bullet/numbered lists and links. A tiny
 * line-based parser covers all of it without a heavy dependency (05 §2.2). */

// Tokenize bold / image / link so the assistant's markdown doesn't leak raw
// syntax. Order matters: image `![alt](url)` before link `[text](url)` (the
// former starts with `!`), before `**bold**`.
const MD_TOKEN_RE = /(!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|\*\*[^*]+\*\*)/g;
const MD_LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;

function InlineText({ text, style }: { text: string; style?: object }) {
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
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line.trim() === '') return <View key={i} style={styles.gap} />;
        // Drop a line that carries an image (e.g. "- Image: ![alt](gcs-url)") —
        // the listing draft card already shows the photo, so the raw markdown +
        // long URL would just be a wide, ugly noise line here.
        if (/!\[[^\]]*\]\([^)]*\)/.test(line)) return null;
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

/** Draft cards whose prose the assistant pads with a redundant "**Label:**
 *  value" field dump (already shown in the card itself). */
const DRAFT_CARD_TYPES = new Set(['listing_draft', 'wtb_draft']);
function messageHasDraftCard(cards?: { type: string }[]): boolean {
  return !!cards?.some((c) => DRAFT_CARD_TYPES.has(c.type));
}

const FIELD_BULLET_RE = /^\s*[-*]\s+\*\*[^*]+:\*\*/; // "- **Label:** value"
/** Collapse the redundant field-dump when a draft card accompanies the prose:
 *  drop the "**Label:** value" bullets and the dangling "…here are the details:"
 *  lead-in, leaving just the opening + closing sentence (e.g. "Your draft is
 *  ready. Please add a location to publish."). The card already shows the
 *  fields. Only invoked when a draft card is present — ordinary prose (and the
 *  live streaming bubble) is never touched. */
export function stripDraftFieldDump(text: string): string {
  return text
    .split('\n')
    .filter((l) => !FIELD_BULLET_RE.test(l))
    .join('\n')
    .replace(/\s*here(?:'s| are)?(?: the)?(?: updated)? details:\s*/i, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function SourcesStrip({ tools }: { tools: string[] }) {
  const { t } = useTranslation();
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

export type ChatMessageProps = {
  msg: AiMsg;
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
  /** True while this bot bubble is the live streaming one (skip POP). */
  live?: boolean;
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
  live,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const popEntering = usePop();
  const accent = mode === 'seller' ? greenDarkest : buyBlue;

  const hasCards = !!msg.cards && msg.cards.length > 0;
  const isThinking = msg.role === 'bot' && !msg.text && !hasCards;

  // User bubble — right, filled. Renders sent attachments (image thumbnails /
  // doc chips) above the text so the sender sees what they sent.
  if (msg.role === 'user') {
    const atts = msg.attachments ?? [];
    const images = atts.filter((a) => a.isImage);
    const docs = atts.filter((a) => !a.isImage);
    const hasText = msg.text.length > 0;
    return (
      <Animated.View entering={reduced ? FadeIn.duration(200) : popEntering} style={styles.rowRight}>
        <View style={[styles.bubble, styles.userBubble, { backgroundColor: accent }]}>
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
          {hasText ? <Text style={styles.userText}>{msg.text}</Text> : null}
        </View>
      </Animated.View>
    );
  }

  // Error bubble — left, danger tint + Retry.
  if (msg.role === 'err') {
    return (
      <Animated.View entering={reduced ? FadeIn.duration(200) : popEntering} style={styles.rowLeft}>
        <View style={[styles.bubble, styles.errBubble]}>
          <View style={styles.errRow}>
            <AlertTriangle size={16} color={brand.destructiveStrong} />
            <Text style={styles.errText}>{msg.text}</Text>
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

  // Bot bubble — left. The live streaming bubble fades once (no POP per token).
  const entering = live ? FadeIn.duration(200) : reduced ? FadeIn.duration(200) : popEntering;
  // When this turn carries a draft card, collapse the redundant field-dump prose
  // (the card shows those fields). Committed messages only — the live bubble
  // streams full text, then commits to this clean version.
  const botText = messageHasDraftCard(msg.cards) ? stripDraftFieldDump(msg.text) : msg.text;
  return (
    <Animated.View entering={entering} style={styles.rowLeft}>
      <View style={styles.botWrap}>
        {(botText || isThinking) && (
          <View style={[styles.bubble, styles.botBubble]}>
            {isThinking ? <ThinkingDots /> : <MarkdownLite text={botText} />}
          </View>
        )}

        {hasCards ? (
          <View style={styles.cards}>
            {msg.cards!.map((c, i) => (
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
            ))}
          </View>
        ) : null}

        {msg.tools && msg.tools.length > 0 ? <SourcesStrip tools={msg.tools} /> : null}
      </View>
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

const styles = StyleSheet.create({
  rowRight: { alignItems: 'flex-end', width: '100%' },
  rowLeft: { alignItems: 'flex-start', width: '100%' },
  bubble: {
    maxWidth: '88%',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: { borderBottomRightRadius: radius.sm },
  userText: { fontFamily: fonts.regular, fontSize: 14, color: '#fff', lineHeight: 20 },
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
  // Full-width so cards (width:'100%') get the whole thread column; the text
  // bubble caps itself at 92% and hugs its content via alignSelf. (Was
  // maxWidth:'92%' here, which collapsed the column — and any wrap-friendly card
  // like the listing draft — to ~half width.)
  botWrap: { width: '100%' },
  botBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: brand.surface,
    borderWidth: 1,
    // Firmer border + soft lift so the prose bubble reads as one tactile
    // column with the elevated cards beneath it.
    borderColor: brand.border,
    borderBottomLeftRadius: radius.sm,
    ...elevation.sm,
  },
  errBubble: {
    backgroundColor: brand.destructiveBg,
    borderBottomLeftRadius: radius.sm,
  },
  errRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  errText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: brand.destructiveStrong, lineHeight: 20 },
  // 21 line-height calms multi-line paragraphs; the bullet baselines to match.
  botText: { fontFamily: fonts.regular, fontSize: 14, color: brand.foreground, lineHeight: 21 },
  bold: { fontFamily: fonts.bold },
  link: { fontFamily: fonts.semibold, color: greenDarkest, textDecorationLine: 'underline' },
  gap: { height: 8 },
  li: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  bullet: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: brand.textMuted, minWidth: 16 },
  cards: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 8 },
  // Unified eyebrow voice (letterSpacing 1.2); stays muted so the strip is
  // secondary to the cards above it.
  sourcesLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: brand.mutedForeground },
  // Bordered pill with a leading provenance dot — a quiet "where this came from"
  // marker; padding/border only, no size bump, to stay visually secondary.
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    backgroundColor: brand.surfaceMuted,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceDot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: greenMedium },
  sourceChipText: { fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 13, letterSpacing: 0.2, color: brand.mutedForeground },
});
