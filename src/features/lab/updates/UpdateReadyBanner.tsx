// UpdateReadyBanner — "a fix is ready, restart to apply".
//
// Mounted once at the (lab) stack level so it floats above every screen. It is
// the visible half of the fix described in useAppUpdate.ts: without it, a
// downloaded update sits idle until the user happens to fully kill the app, with
// nothing on screen to say so.
//
// Design follows NotificationToast (floating card, squircle medallion, soft
// branded lift) so it reads as part of the same system. Per UX_DESIGN_RULES it
// has exactly ONE primary action ("Restart now"), is non-blocking (dismissible,
// and the update still applies on the next launch either way), and states the
// consequence rather than a bare "Update available".
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useAppUpdate } from './useAppUpdate';

export function UpdateReadyBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pending, restarting, restart } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!pending || dismissed) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}
    >
      <View style={styles.card}>
        <View style={styles.medallion}>
          <RefreshCw size={18} color={brand.primary} strokeWidth={2.2} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{t('mobile.labUpdate.readyTitle')}</Text>
          <Text style={styles.message}>{t('mobile.labUpdate.readyBody')}</Text>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            restart();
          }}
          disabled={restarting}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labUpdate.restart')}
          style={[styles.cta, restarting && styles.ctaBusy]}
        >
          <Text style={styles.ctaText}>
            {restarting ? t('mobile.labUpdate.restarting') : t('mobile.labUpdate.restart')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setDismissed(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labUpdate.later')}
        >
          <X size={16} color={lab.inkMeta} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 90,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: lab.utilBorder,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    boxShadow: '0 12px 32px rgba(14, 59, 46, 0.18)',
  },
  medallion: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: brand.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.headingBold, fontSize: 14, lineHeight: 19, color: lab.ink },
  message: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: lab.inkSub, marginTop: 1 },
  cta: {
    backgroundColor: brand.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.sm - 1,
    paddingHorizontal: spacing.md,
    flexShrink: 0,
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { fontFamily: fonts.headingBold, fontSize: 12.5, lineHeight: 16, color: '#FFFFFF' },
});
