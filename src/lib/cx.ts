import type { StyleProp } from 'react-native';

// Tiny helper for conditional style-array composition. RN's style prop already
// accepts arrays with falsy entries (it filters them at render time) — this
// just makes the intent explicit and keeps callsites tidy:
//
//   style={cx(styles.base, disabled && styles.disabled, active && styles.active)}
//
// Equivalent to `clsx` but for RN StyleSheet objects instead of class strings.

type StyleEntry<T> = StyleProp<T> | false | null | undefined;

export function cx<T>(...entries: StyleEntry<T>[]): StyleProp<T> {
  return entries.filter(Boolean) as StyleProp<T>;
}
