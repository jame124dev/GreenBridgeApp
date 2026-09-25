/**
 * The step rail shared by the two auth wizards — sign-up (2 steps) and
 * password reset (3).
 *
 * Both had their own copy, and they had already drifted: register drew the
 * rail in the HEADER with `on="wash"` while reset drew it in the header too
 * but labelled it differently, and the wash-hero rebuild moves it into the
 * sheet, where the ground is `base`. One component so the next change lands
 * on both.
 *
 * The count is in WORDS as well as in the bar. `ProgressLine`'s own header
 * says the number "lives in the heading above" — and it did not, on either
 * wizard: it was passed as an `accessibilityLabel` and nowhere else, so a
 * sighted user got a bar with no scale and no idea how many steps were left.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProgressLine, Text } from '@/features/v2/ui';
import { space } from '@/theme/v2';

export function AuthStepRail({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation();
  const label = t('mobile.auth.register.stepOf', { current: index + 1, total });

  return (
    <View style={styles.rail}>
      <Text variant="eyebrow" color="accentInk">
        {label}
      </Text>
      <ProgressLine value={index + 1} total={total} label={label} animated />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: space.md, marginBottom: space['5xl'] },
});
