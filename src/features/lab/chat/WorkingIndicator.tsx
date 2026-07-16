// Phase-aware "AI is working" indicator — the successor to the bare ThinkingDots
// in the assistant bubble's pre-first-token slot (fixes the "weak loading state"
// review flag). Layout: the EXISTING <ThinkingDots/> verbatim on the left (keeps
// the animation vocabulary + reduced-motion + its own untouched snapshot) plus a
// labeled state on the right that SURFACES the live pipeline phase when the
// stream carries one, else a tasteful mode-aware default ("Searching the
// marketplace…" for buyer text-search, which emits no stage frames; "Working…"
// for seller). Additive + behavior-neutral when `phase` is absent.
//
// Coexists with the just-shipped Stop button: this lives INSIDE the bubble ("what
// the AI is doing"); the composer independently shows the morphed Stop square +
// pulse ring ("cancel it"). Different surfaces, never a competing spinner.
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { fonts, spacing } from '@/constants/theme';
import { createThemedStyles } from './theme';
import { ThinkingDots } from './ThinkingDots';

// Detect/scanner pipeline phases → localized copy. NOTE: the emitted phases are
// detect/scanner-oriented; the buyer "Searching…/Ranking results…" copy rests on
// the default-buyer branch + the extracting_products mapping, NOT on guaranteed
// search-phase frames. Unknown/absent phase → the mode-aware default below.
const PHASE_KEY: Record<string, string> = {
  validating: 'mobile.labChat.working.checking',
  preparing_documents: 'mobile.labChat.working.reading',
  preparing_pdfs: 'mobile.labChat.working.reading',
  ai_running: 'mobile.labChat.working.thinking',
  extracting_products: 'mobile.labChat.working.ranking',
};

export function WorkingIndicator({ phase, mode }: { phase?: string; mode: 'buyer' | 'seller' }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const key =
    (phase && PHASE_KEY[phase]) ||
    (mode === 'buyer' ? 'mobile.labChat.working.searching' : 'mobile.labChat.working.default');
  const label = t(key);
  return (
    <View style={styles.row}>
      {/* Reused verbatim — same dots, same freeze-under-reduced-motion. */}
      <ThinkingDots />
      {/* Fixed-minHeight row above means a phase label swap never reflows the
          bubble (no scroll jerk). Key on `phase` so each phase cross-fades in;
          reduced motion → instant text swap (dots already freeze). */}
      {reduced ? (
        <Text style={styles.label}>{label}</Text>
      ) : (
        <Animated.Text key={phase ?? '_default'} entering={FadeIn.duration(200)} style={styles.label}>
          {label}
        </Animated.Text>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  // Fixed minHeight so a label swap never changes the bubble's height.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 20 },
  label: {
    fontFamily: fonts.labelMedium,
    fontSize: 12.5,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: t.color['text.secondary'],
  },
}));
