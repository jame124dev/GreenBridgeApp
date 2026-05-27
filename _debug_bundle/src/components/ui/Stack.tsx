import { View, type StyleProp, type ViewStyle } from 'react-native';

import { cx } from '@/lib/cx';
import { spacing, type SpacingToken } from '@/theme';

type Align = 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
type Justify =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

type StackProps = {
  gap?: SpacingToken;
  align?: Align;
  justify?: Justify;
  /** Add `flex: 1` to the container. */
  flex?: boolean;
  /** Allow children to wrap to a new line. */
  wrap?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// `Stack` = vertical column with gap + alignment shorthands.
// `HStack` = horizontal row, defaults to `align="center"` (the common case).
//
// Both wrap a single View — no extra DOM nodes, no measurement cost. The point
// is to remove repetition of:
//
//   flexDirection / alignItems / justifyContent / gap
//
// from hundreds of inline StyleSheet entries.

export function Stack({ gap, align, justify, flex, wrap, children, style }: StackProps) {
  return (
    <View
      style={cx<ViewStyle>(
        { flexDirection: 'column' },
        flex && { flex: 1 },
        gap != null && { gap: spacing[gap] },
        align ? { alignItems: align } : undefined,
        justify ? { justifyContent: justify } : undefined,
        wrap ? { flexWrap: 'wrap' } : undefined,
        style,
      )}
    >
      {children}
    </View>
  );
}

export function HStack({
  gap,
  align = 'center',
  justify,
  flex,
  wrap,
  children,
  style,
}: StackProps) {
  return (
    <View
      style={cx<ViewStyle>(
        { flexDirection: 'row' },
        flex && { flex: 1 },
        gap != null && { gap: spacing[gap] },
        { alignItems: align },
        justify ? { justifyContent: justify } : undefined,
        wrap ? { flexWrap: 'wrap' } : undefined,
        style,
      )}
    >
      {children}
    </View>
  );
}
