/**
 * Footer action button for the detail/grouped footers.
 *
 * Now a thin adapter over the kit's `PrimaryAction`. The API is unchanged —
 * `label`, `onPress`, `primary`, `disabled`, `loading`, `icon`, `flex` — so
 * every call site keeps working; only the drawing moved.
 *
 * ── WHAT THE PORT FIXES ───────────────────────────────────────────────────
 *
 * • The disabled fill was a hardcoded `#d4d8df` that does not exist in either
 *   palette, so in dark mode the button became a light-grey slab. `PrimaryAction`
 *   derives its disabled state from the scheme.
 * • The secondary variant was `border-brand-border-strong` on `brand-surface`.
 *   `FORM_INPUT_RULES.md` §7 wants 3:1 on a control boundary, and a hairline
 *   border is the case the kit measured and rejected — `PrimaryAction`'s
 *   `tinted` carries a ground change instead, which separates by dE 7.3 in
 *   light and 15.0 in dark.
 * • `min-h-12` is 48dp; `PrimaryAction` uses the kit's control height, which
 *   clears 44/48 on both platforms.
 *
 * ⚠️ `flex` STAYS ON A STATIC INLINE STYLE, never on a functional one. The
 * original carries this note and it still applies: on this RN/Hermes +
 * NativeWind build a `({ pressed }) => …` style silently DROPS layout props,
 * which once collapsed a footer button to bare text.
 */
import { ArrowRight } from 'lucide-react-native';
import type { MaterialIcons } from '@expo/vector-icons';

import { PrimaryAction } from '@/features/v2/ui';
import { icon as iconSize, useV2Colors } from '@/theme/v2';

interface Props {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Kept as the `MaterialIcons` glyph name the call sites already pass, but
   * only `arrow-forward` is drawn — it is the sole value in use, and mapping a
   * whole icon set would import one to render at most one glyph. Anything else
   * renders no icon rather than a wrong one.
   */
  icon?: keyof typeof MaterialIcons.glyphMap;
  flex: number;
}

export function FooterButton({
  label,
  onPress,
  primary,
  disabled,
  loading,
  icon,
  flex,
}: Props) {
  const c = useV2Colors();
  const isDisabled = disabled || loading;

  return (
    <PrimaryAction
      label={label}
      onPress={onPress}
      disabled={isDisabled}
      loading={loading}
      variant={primary ? 'filled' : 'tinted'}
      icon={
        icon === 'arrow-forward' ? (
          <ArrowRight
            color={primary ? c.onAccent : c.accentInk}
            size={iconSize.xl}
            strokeWidth={2}
          />
        ) : undefined
      }
      style={{ flex }}
    />
  );
}
