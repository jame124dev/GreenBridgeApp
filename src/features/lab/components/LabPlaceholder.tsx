// Minimal click-through placeholder for (lab) screens — Run B builders replace
// each screen's body. Renders the screen name + a working nav button to the
// next step so the whole flow (home → processing → … → deal) is navigable now.
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Text, Button } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { greenDarkest, lab } from '@/constants/theme';

export type NextAction = { label: string; onPress: () => void };

export function LabPlaceholder({
  name,
  hint,
  actions,
  edges,
}: {
  name: string;
  hint?: string;
  actions?: NextAction[];
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const { t } = useTranslation();
  return (
    // lab palette so interim / unbuilt states read as the same app as the
    // shipped (lab) screens (lab.bg canvas, lab.ink title, lab.inkMeta kicker).
    <Screen scroll={false} edges={edges ?? ['top', 'bottom']} style={styles.screen}>
      <View style={styles.wrap}>
        <Text variant="caption" style={[styles.kicker, { color: lab.inkMeta }]}>
          {t('mobile.labCommon.placeholderKicker')}
        </Text>
        {/* variant="title" (24px) not hero (32px) — never clips a long screen
            name on ≤375pt devices (foundation small-screen rule). */}
        <Text variant="title" style={[styles.title, { color: lab.ink }]}>
          {name}
        </Text>
        {hint ? (
          <Text variant="body" style={[styles.hint, { color: lab.inkSub }]}>
            {hint}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {(actions ?? []).map((a) => (
            <Button
              key={a.label}
              label={a.label}
              variant="primary"
              fullWidth
              haptic={false}
              onPress={() => {
                haptics.tap();
                a.onPress();
              }}
              style={{ backgroundColor: greenDarkest }}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: lab.bg },
  wrap: { flex: 1, justifyContent: 'center', gap: 8 },
  kicker: { letterSpacing: 1.5 },
  title: { marginBottom: 4 },
  hint: { marginBottom: 20 },
  actions: { gap: 12, marginTop: 12 },
});
