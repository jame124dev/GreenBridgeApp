import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';

import type { BatchVisibility } from '@/types/batch';

type Props = {
  value: BatchVisibility;
  onChange: (v: BatchVisibility) => void;
};

const OPTIONS: { key: BatchVisibility; label: string; hint: string }[] = [
  { key: 'PUBLIC', label: 'Public', hint: 'Visible on the marketplace' },
  { key: 'PRIVATE', label: 'Private', hint: 'Only you can see this batch' },
  { key: 'NETWORK', label: 'Network', hint: 'Selected buyers only' },
];

export function VisibilitySelector({ value, onChange }: Props) {
  const select = (key: BatchVisibility) => {
    if (key === 'NETWORK') {
      Alert.alert(
        'Network visibility',
        'Assigning network buyers is available on the 101 Lab web dashboard for now. Choose Public or Private, or set Network on web after submit.',
        [{ text: 'OK' }],
      );
      return;
    }
    onChange(key);
  };

  return (
    <View>
      <Text style={styles.label}>Listing visibility</Text>
      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.card, value === opt.key && styles.cardActive]}
            onPress={() => select(opt.key)}
          >
            <Text style={[styles.cardTitle, value === opt.key && styles.cardTitleActive]}>
              {opt.label}
            </Text>
            <Text style={[styles.cardHint, value === opt.key && styles.cardHintActive]}>
              {opt.hint}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#13171f', marginTop: 12, marginBottom: 8 },
  options: { gap: 8 },
  card: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    backgroundColor: '#fff',
  },
  cardActive: { backgroundColor: '#0a4a2f', borderColor: '#0a4a2f' },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#13171f' },
  cardTitleActive: { color: '#fff' },
  cardHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6b7280', marginTop: 4 },
  cardHintActive: { color: 'rgba(255,255,255,0.85)' },
});
