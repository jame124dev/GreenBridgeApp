// ChatComposer — the message input row for a conversation thread: a growing
// multiline TextInput + a deep-forest send button (inert until there's text).
// Proportions (44dp input/button, radius.xl, 1.5 border, 14dp gutter) are the AI
// chat composer's, so the two conversation surfaces feel like one app.
//
// The draft text lives HERE, not in the screen, so a re-render of the thread
// can't disturb what the user is typing. The screen still needs to seed it —
// conversation starters PREFILL the composer instead of firing a message the user
// never got to read back — so that one capability is exposed imperatively via
// `ChatComposerRef.prefill`, which sets the text AND takes focus. That is the
// whole public surface; there is no other way in, and no second send control.
//
// This view owns NO keyboard/safe-area padding: the screen wraps it in an
// animated container carrying max(keyboardHeight, safeArea.bottom), so adding
// anything here would double-count the inset (the old bug: a dead gap between
// the composer and the raised keyboard).
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react-native';

import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export interface ChatComposerRef {
  /** Seed the draft and focus the input (conversation starters). */
  prefill: (text: string) => void;
  focus: () => void;
}

export interface ChatComposerProps {
  placeholder?: string;
  disabled?: boolean;
  /** Socket is disconnected: keep the input editable (let them draft) but tint
   *  the send button muted so it reads "can't deliver yet". */
  offline?: boolean;
  /** Return `false` to signal the message was NOT sent (e.g. offline) so the
   *  composer keeps the typed text for a retry instead of clearing it. */
  onSend: (text: string) => boolean | void;
}

export const ChatComposer = forwardRef<ChatComposerRef, ChatComposerProps>(function ChatComposer(
  { placeholder, disabled = false, offline = false, onSend },
  ref,
) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const canSend = text.trim().length > 0 && !disabled;

  useImperativeHandle(ref, () => ({
    prefill: (next: string) => {
      setText(next);
      // Focus on the next frame so the caret lands after the seeded text rather
      // than racing the state commit.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    focus: () => inputRef.current?.focus(),
  }));

  const submit = () => {
    if (!canSend) return;
    haptics.impact();
    const result = onSend(text);
    if (result !== false) setText('');
  };

  return (
    <View style={styles.row}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder ?? t('mobile.labMessages.composerDefault')}
        placeholderTextColor={lab.inkFaint}
        multiline
        editable={!disabled}
        testID="deal-composer-input"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        style={[
          styles.send,
          offline && styles.sendOffline,
          { opacity: canSend ? (offline ? 0.6 : 1) : 0.45 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        accessibilityLabel={t('mobile.labMessages.sendMessage')}
        testID="deal-composer-send"
      >
        <ArrowUp size={20} color="#fff" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingTop: 10,
    // Constant — never keyboard-dependent (the screen owns that inset).
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lab.hairline,
    backgroundColor: brand.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: lab.hairline,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: lab.ink,
    backgroundColor: brand.surface,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOffline: {
    backgroundColor: lab.inkMeta,
  },
});
