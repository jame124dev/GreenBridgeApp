// Matches-feed status chip (spec 05 §3 `StatusTag`). Namespaced `Matches*` so
// parallel builders don't collide. A CLOSED variant union — only two states
// exist — so no arbitrary color pairs can leak in. `Badge` from the barrel is
// class-based and can't produce these exact bg/fg pairs, hence a bespoke chip.
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, greenMedium, warnAmber } from '@/constants/theme';
import type { MatchTag } from '../data/matchesView';

// `dot` = the 6px accent (stays the vivid brand hue); `text` = the label, darkened
// to clear WCAG AA on the pale pill bg (the accent hues themselves fail AA at 11px).
const TAG_VARIANTS: Record<MatchTag, { labelKey: string; dot: string; text: string; bg: string }> = {
  'new-match': { labelKey: 'statusNewMatch', dot: greenMedium /* #16A35A */, text: greenDarkest /* #0E3B2E, ~9:1 on #EAF6EE */, bg: '#EAF6EE' },
  'worth-a-look': { labelKey: 'statusWorthALook', dot: warnAmber /* #E8A21A */, text: brand.warningText /* #b45309, ~4.9:1 on #FBF1DD */, bg: '#FBF1DD' },
};

export function MatchesStatusTag({ variant }: { variant: MatchTag }) {
  const { t } = useTranslation();
  const v = TAG_VARIANTS[variant];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 99,
        backgroundColor: v.bg,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 99, marginRight: 6, backgroundColor: v.dot }}
      />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: v.text }}>
        {t(`mobile.labMatch.${v.labelKey}`)}
      </Text>
    </View>
  );
}
