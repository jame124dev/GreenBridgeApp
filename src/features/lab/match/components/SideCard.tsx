// SideCard — one WTS (FOR SALE) or WTB (WANTED) column of the match detail
// side-by-side pair (spec 06-match-detail §2.3). Purely presentational; the two
// cards differ only in `accent` color + copy. `flex:1` + `align-items:stretch`
// on the parent row keep both cards equal height on any device.
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/constants/theme';

// Screen-local hexes with no exact foundation token (spec §3 `M` const).
const M = {
  cardBorder: '#E7EDE8',
  title: '#10201A',
  sub: '#8A988F',
} as const;

export type SideCardProps = {
  eyebrow: string; // e.g. "FOR SALE · WTS"
  accent: string; // eyebrow color (greenMedium for WTS, buyBlue for WTB)
  title: string;
  sub: string;
  price: string;
};

export function SideCard({ eyebrow, accent, title, sub, price }: SideCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
        {eyebrow}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {sub}
      </Text>
      <Text
        style={styles.price}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {price}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: M.cardBorder,
    borderRadius: 18,
    padding: 14,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5, // .05em × 10
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.headingBold, // Hanken 800
    fontSize: 15,
    lineHeight: 17, // 1.15 × 15 ≈ 17
    color: M.title,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: M.sub,
    marginTop: 5,
  },
  price: {
    fontFamily: fonts.headingBold, // Hanken 800
    fontSize: 18,
    color: M.title,
    marginTop: 9,
  },
});
