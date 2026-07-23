// MessageActions — the R4 action row under a committed assistant answer (X5).
// Copy (clipboard), Share (native share sheet), and a 👍/👎 feedback toggle.
// Per A2 (row: feedback selection lives in LOCAL component state, never Zustand,
// never persisted), the thumbs are pure local state — no network, no store.
//
// Gated by the caller (AssistantMessage renders this only when committed +
// CHAT_UI_V2 + non-empty text), so the flag-off path is untouched. Streaming
// messages never render it (actions belong to a settled answer).
import { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';
import { Check, Copy, Share2, ThumbsDown, ThumbsUp } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { createThemedStyles, useColor } from './theme';

type Feedback = 'up' | 'down' | null;

export function MessageActions({ text }: { text: string }) {
  const { t } = useTranslation();
  const styles = useActionStyles();
  const iconColor = useColor('icon.util');
  const accentColor = useColor('accent');

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Reset the transient "copied" checkmark after a moment (cleaned up on unmount).
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const onCopy = async () => {
    haptics.tap();
    try {
      // Lazy-load so a dev client without the native module (pre-rebuild) still
      // boots — the module is only evaluated when Copy is actually tapped.
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      setCopied(true);
      toast(t('mobile.labChat.actions.copied'));
    } catch {
      // Native clipboard unavailable (needs a rebuild) — fail quietly.
    }
  };

  const onShare = () => {
    haptics.tap();
    void Share.share({ message: text });
  };

  const onFeedback = (v: 'up' | 'down') => {
    haptics.tap();
    setFeedback((cur) => (cur === v ? null : v)); // toggle off if re-tapped
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onCopy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labChat.actions.copy')}
        style={styles.btn}
      >
        {copied ? (
          <Check size={15} color={accentColor} strokeWidth={2.2} />
        ) : (
          <Copy size={15} color={iconColor} strokeWidth={1.9} />
        )}
      </Pressable>

      <Pressable
        onPress={onShare}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labChat.actions.share')}
        style={styles.btn}
      >
        <Share2 size={15} color={iconColor} strokeWidth={1.9} />
      </Pressable>

      <Pressable
        onPress={() => onFeedback('up')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: feedback === 'up' }}
        accessibilityLabel={t('mobile.labChat.actions.helpful')}
        style={styles.btn}
      >
        <ThumbsUp
          size={15}
          color={feedback === 'up' ? accentColor : iconColor}
          fill={feedback === 'up' ? accentColor : 'transparent'}
          strokeWidth={1.9}
        />
      </Pressable>

      <Pressable
        onPress={() => onFeedback('down')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: feedback === 'down' }}
        accessibilityLabel={t('mobile.labChat.actions.notHelpful')}
        style={styles.btn}
      >
        <ThumbsDown
          size={15}
          color={feedback === 'down' ? accentColor : iconColor}
          fill={feedback === 'down' ? accentColor : 'transparent'}
          strokeWidth={1.9}
        />
      </Pressable>
    </View>
  );
}

const useActionStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: 4, marginTop: 6, marginLeft: 2 },
  // ≥44pt touch target (icon stays 15px, centered) — was ~27px.
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
}));
