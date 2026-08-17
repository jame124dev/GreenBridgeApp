// AppVersionLine — the quiet "which build am I actually running" line at the
// foot of the Account screen.
//
// Support-critical, not decorative: when a published OTA fix appears not to have
// arrived, this is the only way to tell whether the phone is on the bundle baked
// into the binary ("built-in") or on an update, and which one. Without it the
// only diagnosis available is asking the user to force-quit and guess.
//
// Deliberately understated — muted, centred, no card — so it reads as a footer
// rather than a setting.
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { fonts, lab, spacing } from '@/constants/theme';
import { getRunningBundle, useAppUpdate } from './useAppUpdate';

export function AppVersionLine() {
  const { t } = useTranslation();
  const { downloading } = useAppUpdate();
  const bundle = getRunningBundle();

  // expo-updates reports an unconfigured channel (and an unknown runtime
  // version) as an EMPTY STRING, not null — which is how the footer came to read
  // "GreenBidz 1.0.2 · · built-in". Blank segments are dropped before joining, so
  // no combination of missing facts can produce a doubled or trailing separator.
  // They are dropped rather than back-filled: an invented channel would send
  // support chasing the wrong build.
  const line = [
    bundle.version ? t('mobile.labUpdate.version', { version: bundle.version }) : null,
    bundle.channel,
    bundle.embedded ? t('mobile.labUpdate.builtIn') : bundle.updateId,
  ]
    .map((segment) => segment?.trim())
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>{line}</Text>
      {downloading ? <Text style={styles.note}>{t('mobile.labUpdate.downloading')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: 2 },
  line: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: lab.inkFaint },
  note: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: lab.inkMeta },
});
