// SparkleIcon — the composer's bespoke two-star glyph (react-native-svg), tinted
// by the active mode accent (spec 01-home-tell-ai §2d). NOT lucide `Sparkles` —
// the prototype mark is a custom two-star shape; the second star renders at
// opacity 0.6. Recolors with sell/buy mode.
import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color: string };

// Two 4-point stars (diamond/sparkle). A big lead star + a smaller trailing one.
export function SparkleIcon({ size = 20, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lead star — 4-point sparkle centered top-left */}
      <Path
        d="M9.5 2.5c.3 2.6 1.4 3.7 4 4-2.6.3-3.7 1.4-4 4-.3-2.6-1.4-3.7-4-4 2.6-.3 3.7-1.4 4-4Z"
        fill={color}
      />
      {/* Trailing smaller star — bottom-right, dimmed */}
      <Path
        d="M17.5 12.5c.2 1.9 1 2.7 2.9 2.9-1.9.2-2.7 1-2.9 2.9-.2-1.9-1-2.7-2.9-2.9 1.9-.2 2.7-1 2.9-2.9Z"
        fill={color}
        opacity={0.6}
      />
    </Svg>
  );
}
