import React, { useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { fonts, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { createThemedStyles, useColor } from './theme';

export type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const { t } = useTranslation();
  const styles = useCodeBlockStyles();
  const iconColor = useColor('icon.util');
  const accentColor = useColor('accent');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const onCopy = async () => {
    haptics.tap();
    try {
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(code);
      setCopied(true);
      toast(t('mobile.labChat.actions.copied'));
    } catch {
      // safe fallback
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.langText}>{language.toLowerCase()}</Text>
        <Pressable
          onPress={onCopy}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labChat.actions.copy')}
          style={styles.copyBtn}
        >
          {copied ? (
            <Check size={14} color={accentColor} strokeWidth={2.2} />
          ) : (
            <Copy size={14} color={iconColor} strokeWidth={1.9} />
          )}
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

const useCodeBlockStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    backgroundColor: t.color['surface.raised'],
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: t.color['surface.alt'],
    borderBottomWidth: 1,
    borderBottomColor: t.color['border.subtle'],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  langText: {
    fontFamily: fonts.labelMedium,
    fontSize: 11,
    letterSpacing: 1.0,
    color: t.color['text.muted'],
    textTransform: 'uppercase',
  },
  copyBtn: {
    padding: 4,
    borderRadius: 4,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    padding: 12,
  },
  codeText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: t.color['text.primary'],
  },
}));
