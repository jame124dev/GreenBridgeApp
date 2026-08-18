import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

import type { RequiredRowKey } from '@/features/scanner/requiredStatus';

/** Breathing room above the card we jump to, in px. */
const SCROLL_MARGIN = 12;

export type RowScroller = {
  scrollRef: React.RefObject<KeyboardAwareScrollViewRef | null>;
  /** onLayout handler for the wrapper View around the card that owns `key`. */
  registerRow: (key: RequiredRowKey) => (e: LayoutChangeEvent) => void;
  scrollToRow: (key: RequiredRowKey) => void;
};

/**
 * Scroll-to-card plumbing for the detail editor: the footer's missing-field chips
 * (RequiredProgressStrip, M-8) and the invalid-submit alert (M-9) both need to
 * jump to the card that owns a required row.
 *
 * `KeyboardAwareScrollViewRef` extends RN's `ScrollView`
 * (react-native-keyboard-controller 1.21.6,
 * lib/typescript/components/KeyboardAwareScrollView/types.d.ts:25-27), so
 * `.scrollTo` is available on the ref. The offsets come from each card's own
 * onLayout `y`, which is relative to the scroll content — exactly what scrollTo
 * expects.
 */
export function useRowScroller(): RowScroller {
  const scrollRef = useRef<KeyboardAwareScrollViewRef | null>(null);
  const yByRow = useRef<Partial<Record<RequiredRowKey, number>>>({});

  const registerRow = useCallback(
    (key: RequiredRowKey) => (e: LayoutChangeEvent) => {
      yByRow.current[key] = e.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToRow = useCallback((key: RequiredRowKey) => {
    const y = yByRow.current[key];
    if (y == null) return; // never laid out (card not mounted) — do nothing
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN), animated: true });
  }, []);

  return { scrollRef, registerRow, scrollToRow };
}
