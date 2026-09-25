/**
 * The app bar for `app/scan/detail.tsx` — the single-product editor.
 *
 * Ported to the v2 kit so the three scan screens share one bar: `detection`,
 * `grouped-review` and `grouped-edit` all draw a 44pt `GlyphButton`, a centred
 * eyebrow and a `Hairline`. This one had its own shape — a left-aligned
 * `text-5xl` title beside a 22pt `MaterialIcons` arrow with `p-xs` padding, so
 * the only control in the bar was a ~30pt target, under the 44pt minimum
 * `FORM_INPUT_RULES.md` §7 asks of every tappable control.
 *
 * The title moves out of the bar for the same reason it did on
 * `grouped-review`: at `text-5xl` a translated title wraps inside a fixed bar
 * and pushes the form down before a single field is visible.
 */
import { View, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { GlyphButton, Hairline, Text } from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';
import { safeBack } from '@/lib/safeBack';

export function DetailAppBar() {
  const { t } = useTranslation();
  const c = useV2Colors();

  return (
    <>
      <View style={styles.bar}>
        <GlyphButton
          onPress={() => safeBack()}
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
        >
          {/* `lucide`'s ChevronLeft, not `MaterialIcons` arrow-back — the other
              three scan screens use it, and mixing two icon sets inside one
              flow is visible at the stroke weight. */}
          <ChevronLeft color={c.ink} size={icon.lg} strokeWidth={1.8} />
        </GlyphButton>
        <View style={styles.centre}>
          <Text variant="eyebrow" color="inkMuted">
            {t('mobile.detail.title')}
          </Text>
        </View>
        {/* Mirrors the button's 44pt width so the eyebrow is optically centred. */}
        <View style={styles.spacer} />
      </View>
      <Hairline />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  centre: { flex: 1, alignItems: 'center' },
  spacer: { width: 44 },
});
