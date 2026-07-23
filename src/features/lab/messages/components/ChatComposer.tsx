// ChatComposer — the message input row for a conversation thread: a growing
// multiline TextInput + a deep-forest send button (disabled until there's text).
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react-native';

import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export function ChatComposer({
  placeholder,
  disabled = false,
  offline = false,
  onSend,
}: {
  placeholder?: string;
  disabled?: boolean;
  /** Socket is disconnected: keep the input editable (let them draft) but tint
   *  the send button muted so it reads "can't deliver yet". */
  offline?: boolean;
  /** Return `false` to signal the message was NOT sent (e.g. offline) so the
   *  composer keeps the typed text for a retry instead of clearing it. */
  onSend: (text: string) => boolean | void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    haptics.impact();
    const result = onSend(text);
    if (result !== false) setText('');
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder ?? t('mobile.labMessages.composerDefault')}
        placeholderTextColor={lab.inkFaint}
        multiline
        editable={!disabled}
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
        accessibilityLabel={t('mobile.labMessages.sendMessage')}
      >
        <ArrowUp size={20} color="#fff" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingTop: 10,
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
