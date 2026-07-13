// OrbitLogo — the 101LAB orbit/atom brand mark (react-native-svg). Rendered
// inside the header logo tile (spec 01-home-tell-ai §2a). Center dot + 4 cross
// lines + 4 outer node dots, all mint (`greenLight` #34D08C). Reused across the
// (lab) flow so it lives in the shared lab components folder.
import Svg, { Circle, Line } from 'react-native-svg';
import { greenLight } from '@/constants/theme';

type Props = { size?: number };

export function OrbitLogo({ size = 19 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 4 cross-lines from center to the outer nodes */}
      <Line x1="12" y1="12" x2="12" y2="3" stroke={greenLight} strokeWidth={1.5} />
      <Line x1="12" y1="12" x2="12" y2="21" stroke={greenLight} strokeWidth={1.5} />
      <Line x1="12" y1="12" x2="3" y2="12" stroke={greenLight} strokeWidth={1.5} />
      <Line x1="12" y1="12" x2="21" y2="12" stroke={greenLight} strokeWidth={1.5} />
      {/* 4 outer node dots (top / bottom / left / right) */}
      <Circle cx="12" cy="3" r="1.7" fill={greenLight} />
      <Circle cx="12" cy="21" r="1.7" fill={greenLight} />
      <Circle cx="3" cy="12" r="1.7" fill={greenLight} />
      <Circle cx="21" cy="12" r="1.7" fill={greenLight} />
      {/* center dot */}
      <Circle cx="12" cy="12" r="2.4" fill={greenLight} />
    </Svg>
  );
}
