// (lab) Deal Room — inline react-native-svg marks ported 1:1 from the prototype
// (101LAB Mobile.dc.html lines 392 / 408 / 420). Lucide's BadgeCheck / Sparkles
// do NOT match the prototype's faceted seal / single 4-point sparkle paths, so
// these are hand-ported for pixel fidelity. Namespaced `deal*` so parallel
// builders don't collide. See spec 07 §3 + §5.
import Svg, { Path } from 'react-native-svg';
import { greenMedium } from '@/constants/theme';

/** 14×14 faceted verified seal — green fill, white check. HTML line 392. */
export function DealVerifiedSeal({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2l2.4 2.1 3.2-.3 1 3 2.7 1.7-1.2 3 1.2 3-2.7 1.7-1 3-3.2-.3L12 22l-2.4-2.1-3.2.3-1-3L2.7 13.5l1.2-3-1.2-3 2.7-1.7 1-3 3.2.3L12 2z"
        fill={greenMedium}
      />
      <Path
        d="M9.5 12.5l1.8 1.8 3.5-3.8"
        stroke="#fff"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * 4-point sparkle mark. Two viewBox-equivalent paths in the prototype:
 *   - confirm pill sparkle (13×13, HTML 408)
 *   - concierge chip sparkle (15×15, HTML 420)
 * Both are the same 4-point star shape; caller passes `size` + `color`.
 */
export function DealSparkle({ size = 13, color = greenMedium }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={color} />
    </Svg>
  );
}
