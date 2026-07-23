// StreamingChatList — EXPERIMENTAL alternative to chat.tsx's hand-built
// pin-to-top ScrollView, behind EXPO_PUBLIC_STREAMING_LIST (default OFF).
//
// Renders the SAME rows as the ScrollView path — committed `ChatMessage`s + the
// single self-subscribing live `StreamingMessage` — but through
// react-native-streaming-message-list (Legend List). The library owns the
// ChatGPT/Claude scroll: the last USER message is wrapped in <AnchorItem> (pins
// near the top), the streaming assistant turn in <StreamingItem> (tracks its
// growing height), and `isStreaming` tells it a turn is live.
//
// The live turn isn't in `chat.viewMessages` (it lives in threadStore until it
// settles), so we append a sentinel LIVE row and render our existing
// <StreamingMessage> for it. The sentinel is kept for the WHOLE non-idle window
// (streaming + the transient done/error settle frame), not just `streaming`, so
// the finished bubble never blanks for a frame before the committed row lands
// (the D3 seamless handoff — reviewer HIGH-1). Once idle, the last committed
// assistant row inherits <StreamingItem> so the library keeps tracking its
// height as cards/actions fade in (reviewer MED-4).
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  AnchorItem,
  StreamingItem,
  StreamingMessageList,
  StreamingMessageListProvider,
  useStreamingMessageList,
} from 'react-native-streaming-message-list';
import { ChevronDown } from 'lucide-react-native';

import i18n from '@/i18n';
import { radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useThread } from '@/features/lab/stores/threadStore';
import type { useChatController } from './controllers/useChatController';
import { ChatMessage } from './ChatMessage';
import { StreamingMessage } from './StreamingMessage';
import { useColor } from './theme';

type Chat = ReturnType<typeof useChatController>;
type ViewMessage = Chat['viewMessages'][number];

const LIVE_ID = '__live__';
type Row = ViewMessage | { id: typeof LIVE_ID; role: 'assistant'; __live: true };

type ListRef = { scrollToEnd: (opts?: { animated?: boolean }) => void };

// Stable references (reviewer LOW-6): the list re-renders per streaming token,
// so a fresh keyExtractor/config each frame rebuilds the underlying list
// element. Hoisting the two that have no per-render deps keeps it cheap.
const keyExtractor = (item: Row) => item.id;
const LIST_CONFIG = { debounceMs: 150, placeholderStableDelayMs: 200, isAtEndThreshold: 12 };

export function StreamingChatList({ chat }: { chat: Chat }) {
  const listRef = useRef<ListRef | null>(null);
  const { apiMode } = chat;

  // Same store the live bubble subscribes to. `turnActive` flips on status
  // transitions only (idle↔streaming↔done↔idle), not per token.
  const turnActive = useThread((s) => s.turn.status !== 'idle');

  // Committed rows + a sentinel LIVE row through the whole non-idle window.
  const data = useMemo<Row[]>(() => {
    const base = chat.viewMessages as Row[];
    return turnActive ? [...base, { id: LIVE_ID, role: 'assistant', __live: true }] : base;
  }, [chat.viewMessages, turnActive]);

  // The user message to pin to the top — the last one in the committed list.
  const lastUserId = useMemo(() => {
    for (let i = chat.viewMessages.length - 1; i >= 0; i--) {
      if (chat.viewMessages[i].role === 'user') return chat.viewMessages[i].id;
    }
    return null;
  }, [chat.viewMessages]);

  // Once the turn is idle (no sentinel), the last committed assistant row takes
  // over <StreamingItem> so height tracking never has a gap.
  const tailAssistantId = useMemo(() => {
    if (turnActive) return null;
    const last = chat.viewMessages[chat.viewMessages.length - 1];
    return last && last.role === 'assistant' ? last.id : null;
  }, [chat.viewMessages, turnActive]);

  const renderItem = ({ item }: { item: Row }) => {
    // Live assistant turn → the library's height-tracking wrapper.
    if ('__live' in item) {
      return (
        <StreamingItem>
          <View style={styles.row}>
            <StreamingMessage
              mode={apiMode}
              onSend={chat.onCardSend}
              onUploadPress={chat.handleUploadPress}
              onEditDraft={chat.onEditDraft}
              {...chat.batchCtx}
            />
          </View>
        </StreamingItem>
      );
    }
    const msg = item as ViewMessage;
    const row = (
      <View style={styles.row}>
        <ChatMessage
          msg={msg}
          mode={apiMode}
          onSend={chat.onCardSend}
          onRetry={chat.onRetry}
          onUploadPress={chat.handleUploadPress}
          onEditDraft={chat.onEditDraft}
          handoff={msg.id === chat.justSettledId}
          {...chat.batchCtx}
        />
      </View>
    );
    // Pin the latest user message near the top; the settled tail assistant keeps
    // <StreamingItem>; everything else renders plainly. (Padding lives INSIDE
    // the wrapper so the library measures it — reviewer LOW-8.)
    if (msg.id === lastUserId) return <AnchorItem>{row}</AnchorItem>;
    if (msg.id === tailAssistantId) return <StreamingItem>{row}</StreamingItem>;
    return row;
  };

  return (
    <StreamingMessageListProvider>
      <View style={styles.flex}>
        <StreamingMessageList
          ref={listRef as never}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem as never}
          isStreaming={chat.liveActive}
          contentContainerStyle={styles.content}
          config={LIST_CONFIG}
        />
        <ScrollDownPill onJump={() => listRef.current?.scrollToEnd({ animated: true })} />
      </View>
    </StreamingMessageListProvider>
  );
}

/** Scroll-to-bottom pill — shown only when the library reports we're scrolled up
 *  AND the content overflows. Sits just above the composer: this component's
 *  container is a flex sibling whose bottom edge IS the composer top, so a small
 *  fixed offset is correct (reviewer MED-5). */
function ScrollDownPill({ onJump }: { onJump: () => void }) {
  const { isAtEnd, contentFillsViewport } = useStreamingMessageList();
  const inkColor = useColor('input.text');
  const surface = useColor('surface.raised');
  const border = useColor('input.border');
  if (isAtEnd || !contentFillsViewport) return null;
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.pillWrap} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          haptics.tap();
          onJump();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('mobile.labChat.scrollToBottom')}
        style={[styles.pill, { backgroundColor: surface, borderColor: border }]}
      >
        <ChevronDown size={20} color={inkColor} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  row: { paddingBottom: spacing.md },
  pillWrap: { position: 'absolute', right: 18, bottom: spacing.md },
  pill: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
