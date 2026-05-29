import { ActivityIndicator, Pressable, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { brand } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  flex: number;
}

/**
 * Footer action button — filled (primary) or outline; optional trailing icon.
 *
 * S6.2.b2.i — `flex` prop value is dynamic per call site so kept inline; the
 * disabled-primary background `#aecebe` + text `#304c41` are off-brand override
 * values used to dim the legacy filled button without dropping to gray — kept
 * inline rather than polluting the brand-* token set with one-off shades.
 */
export function FooterButton({
  label,
  onPress,
  primary,
  disabled,
  loading,
  icon,
  flex,
}: Props) {
  const isDisabled = disabled || loading;
  const primaryBg = primary
    ? isDisabled
      ? '#aecebe'
      : brand.primary
    : undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-1.5 py-2.5 rounded-xs min-h-12 ${
        primary ? '' : 'border border-brand-border-strong bg-brand-surface'
      }`}
      style={{ flex, ...(primary ? { backgroundColor: primaryBg } : null) }}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={brand.primaryForeground} size="small" />
      ) : (
        <>
          <Text
            className="font-label text-xl"
            style={{
              color: primary
                ? isDisabled
                  ? '#304c41'
                  : brand.primaryForeground
                : brand.foreground,
            }}
          >
            {label}
          </Text>
          {icon ? (
            <MaterialIcons
              name={icon}
              size={18}
              color={isDisabled ? '#304c41' : brand.primaryForeground}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
