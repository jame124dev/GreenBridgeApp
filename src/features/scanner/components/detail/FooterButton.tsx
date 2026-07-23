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
 * Unified with grouped-review's submit CTA (the newer "Stitch Review Inventory"
 * design) so the submit button reads the same across the single-item detail and
 * multi-item review flows: radius `md`, forest fill, and — when disabled — a
 * CLEARLY VISIBLE flat neutral (`#d4d8df` + muted text) that stays readable,
 * rather than the old green-tinted `#aecebe`/`#304c41` hack.
 *
 * S6.2.b2.i — `flex` is dynamic per call site so it stays on the (static) inline
 * style; only `backgroundColor` joins it, so no layout prop is at risk of being
 * dropped by the RN/Hermes + NativeWind functional-style interop bug.
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
      ? '#d4d8df'
      : brand.primary
    : undefined;
  const primaryFg = isDisabled ? brand.mutedForeground : brand.primaryForeground;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-1.5 py-2.5 rounded-md min-h-12 active:opacity-90 ${
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
              color: primary ? primaryFg : brand.foreground,
            }}
          >
            {label}
          </Text>
          {icon ? (
            <MaterialIcons
              name={icon}
              size={18}
              color={isDisabled ? brand.mutedForeground : brand.primaryForeground}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
