// Matches-feed card (spec 05 §2c / §3 `MatchCard`). A plain `View` (not the
// barrel `Card`, which is rounded-2xl=24) for the exact 20px radius + a
// green-tinted soft shadow (NOT the grey `elevation.md`). Composes:
// status chip + timestamp · FOR SALE column · % ring · WANTED column · a
// bespoke 44px CTA Pressable (outside `Button`'s size table). Card body is
// NOT tappable — only the inline "View match" CTA navigates (spec §4).
// Namespaced `Matches*` so parallel builders don't collide.
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { buyBlue, fonts, greenDarkest, greenMedium, radius } from '@/constants/theme';
import { usePop, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { MatchesStatusTag } from './MatchesStatusTag';
import { MatchesRing } from './MatchesRing';
import type { MatchVM } from '../data/matchesView';

// File-local neutrals the foundation does not name (spec §3).
const NEUTRALS = {
  title: '#10201A',
  cardSub: '#6B7A72', // ~4.6:1 on #fff (was #8A988F ~3.1:1 — failed AA at 11.5px)
  timestamp: '#6B7A72', // ~4.6:1 on #fff (was #9AA89F ~2.3:1 — failed AA)
  border: '#E7EDE8',
} as const;

// Green-tinted soft shadow (spec §2c) — NOT `elevation.md` (that reads grey).
const cardShadow = {
  shadowColor: greenDarkest, // #0E3B2E
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 3,
} as const;

export function MatchesCard({
  match,
  index,
  onPress,
}: {
  match: MatchVM;
  index: number;
  onPress: (id: string) => void;
}) {
  // Bespoke 44px CTA press-scale (0.97, matches Button). Local so it lives on
  // the CTA only — the card body is intentionally not pressable.
  const { style: ctaStyle, onPressIn: handleIn, onPressOut: handleOut } = usePressScale();
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={usePop(index * 80)}
      style={[
        {
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: NEUTRALS.border,
          borderRadius: radius.xl, // 20
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: 14,
        },
        cardShadow,
      ]}
    >
      {/* Row 1 — status header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <MatchesStatusTag variant={match.variant} />
        <Text
          style={{ fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 14, color: NEUTRALS.timestamp }}
        >
          {match.time}
        </Text>
      </View>

      {/* Row 2 — the pairing */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Left column — FOR SALE */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
              color: greenMedium,
              marginBottom: 4,
            }}
          >
            {t('mobile.labMatch.forSale')}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonts.headingBold, fontSize: 14, lineHeight: 18, color: NEUTRALS.title }}
          >
            {match.sell}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: NEUTRALS.cardSub, marginTop: 4 }}
          >
            {match.sellSub}
          </Text>
        </View>

        {/* Center — % match ring */}
        <MatchesRing pct={match.pct} index={index} fillColor={match.ringFill} trackColor={match.ringTrack} />

        {/* Right column — WANTED (right-aligned) */}
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
              color: buyBlue,
              marginBottom: 4,
              textAlign: 'right',
            }}
          >
            {t('mobile.labMatch.wanted')}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonts.headingBold, fontSize: 14, lineHeight: 18, color: NEUTRALS.title, textAlign: 'right' }}
          >
            {match.want}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.regular,
              fontSize: 11.5,
              lineHeight: 15,
              color: NEUTRALS.cardSub,
              marginTop: 4,
              textAlign: 'right',
            }}
          >
            {match.wantSub}
          </Text>
        </View>
      </View>

      {/* Row 3 — bespoke 44px CTA (spec §2c/§3: outside Button's size table) */}
      <Animated.View style={ctaStyle}>
        <Pressable
          onPressIn={handleIn}
          onPressOut={handleOut}
          onPress={() => {
            haptics.tap(); // card/CTA tap = tap() per foundation haptic map
            onPress(match.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labMatch.viewMatch')}
          style={{
            height: 44,
            borderRadius: radius.md, // 12 — snapped off the off-grid 13
            backgroundColor: greenDarkest,
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: '#fff' }}>{t('mobile.labMatch.viewMatch')}</Text>
          <ArrowRight size={15} color="#fff" strokeWidth={2.2} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
