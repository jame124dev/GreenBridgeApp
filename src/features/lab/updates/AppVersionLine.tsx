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

  const source = bundle.embedded ? t('mobile.labUpdate.builtIn') : bundle.updateId;

  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>
        {`GreenBidz ${bundle.version} · ${bundle.channel} · ${source}`}
      </Text>
      {downloading ? <Text style={styles.note}>{t('mobile.labUpdate.downloading')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: 2 },
  line: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: lab.inkFaint },
  note: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: lab.inkMeta },
});
