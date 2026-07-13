// ProductThumb — a rounded product image with a graceful placeholder, used by
// want cards, match cards, and the conversation listing-context card (redesign
// mockup: `.thumb`). When `uri` is present it renders the cached `AppImage`;
// otherwise it falls back to a tinted gradient tile with a muted product glyph,
// exactly like the mockup's gradient placeholders.
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Package, PackageSearch } from 'lucide-react-native';
import { AppImage } from '@/components/ui';
import { lab, radius } from '@/constants/theme';

// Placeholder gradient + glyph tint — mockup-specific, no matching tokens
// (the foundation has no "product placeholder" surface).
const PLACEHOLDER_FROM = '#DDE7E0';
const PLACEHOLDER_TO = '#C7D6CC';
const GLYPH = lab.inkChipSub; // #7C8A82 — muted, matches the mockup glyph

export type ProductThumbProps = {
  uri?: string | null;
  /** Square edge in px (default 60 — the mockup's large thumb). */
  size?: number;
  /** Corner radius (default `radius.md` = 12). */
  radius?: number;
  /** Glyph flavour for the fallback: generic box vs. machine/search. */
  kind?: 'default' | 'machine';
};

export function ProductThumb({ uri, size = 60, radius: r = radius.md, kind = 'default' }: ProductThumbProps) {
  const box = { width: size, height: size, borderRadius: r };

  if (uri) {
    return <AppImage source={{ uri }} style={[box, styles.image]} />;
  }

  const glyphSize = Math.round(size * 0.4);
  const Glyph = kind === 'machine' ? PackageSearch : Package;

  return (
    <LinearGradient
      colors={[PLACEHOLDER_FROM, PLACEHOLDER_TO]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[box, styles.fallback]}
    >
      <Glyph size={glyphSize} color={GLYPH} strokeWidth={1.7} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: lab.pillBg, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
