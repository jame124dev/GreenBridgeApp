import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { brand } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

/**
 * Progressive disclosure for the review screen's OPTIONAL fields.
 *
 * WHY. The review screen measured 7,483px on a Galaxy S20 FE — ten stacked
 * cards, with weight / dimensions / CO₂ / serial / documents each given exactly
 * the same visual weight as price and location. The owner's words were "too much
 * text, not a nicer well structured screen… not simple for user to get idea".
 * Nothing here is required to publish, so nothing here needs to be on screen
 * before the seller asks for it. Collapsed, this section is one row instead of
 * roughly a third of the scroll.
 *
 * This is the approved design's "boost this listing" row (Stitch screen 6),
 * which specified three collapsible sections with one open at a time.
 *
 * Collapsed by default and NOT persisted, deliberately: reopening the screen
 * should show the short version, because the short version is the point. If a
 * field in here is filled, say so on the row — a seller must never have to open
 * a section to discover they already answered something inside it.
 *
 * ⚠️ `style` is a StyleSheet ARRAY, never a `({ pressed }) => …` callback.
 * NativeWind's interop takes over the inline `style` prop and merges it with
 * `{ ...declaration }`; spreading a FUNCTION yields `{}`, so a function-form
 * style is silently discarded at runtime — fill, padding and minHeight all
 * vanish — and jest cannot see it, because the interop is not registered when
 * NODE_ENV === 'test'. That bug shipped past 1,218 green tests once already.
 */
export function OptionalDetailsSection({
  filledCount,
  children,
}: {
  /** How many fields inside already have a value — surfaced on the collapsed row. */
  filledCount: number;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.tap();
          setOpen((v) => !v);
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('mobile.detail.optionalSection.label', {
          defaultValue: 'More details, optional',
        })}
        style={[styles.row, pressed && styles.rowPressed]}
      >
        <MaterialIcons
          name="tune"
          size={18}
          color={brand.textMuted}
          style={styles.leadingIcon}
        />
        <View style={styles.textColumn}>
          <Text style={styles.title} numberOfLines={1}>
            {t('mobile.detail.optionalSection.title', { defaultValue: 'More details' })}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {filledCount > 0
              ? t('mobile.detail.optionalSection.someFilled', {
                  defaultValue: 'Optional · {{count}} filled in',
                  count: filledCount,
                })
              : t('mobile.detail.optionalSection.hint', {
                  defaultValue: 'Optional · weight, size, CO₂, documents',
                })}
          </Text>
        </View>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={22}
          color={brand.textMuted}
        />
      </Pressable>
      {open ? children : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.borderStrong,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: { backgroundColor: brand.primarySurface },
  leadingIcon: { marginTop: 1 },
  textColumn: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: brand.foreground,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: brand.textMuted,
    marginTop: 2,
  },
});

