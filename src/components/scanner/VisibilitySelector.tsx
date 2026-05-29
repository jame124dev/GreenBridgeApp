import { Alert, Pressable, Text, View } from 'react-native';

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

// S6.2.a — StyleSheet block converted to NativeWind classes. Token rationale:
//  - Brand primary `#14452f` → `bg-brand-primary` (tailwind class from
//    me_plan W6 extension) for the active card + border.
//  - Inverse text via `tone="inverse"` is not available on RN Text here
//    (this file uses raw RN Text, not the `<Text>` primitive), so a literal
//    `text-white` className stays — equivalent contract.
//  - Active-state hint text uses `text-white/85` (Tailwind opacity-fraction
//    syntax) which mirrors the prior `rgba(255,255,255,0.85)` rgba.
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
      <Text className="font-semi text-bodySm text-neutral-900 mt-md mb-sm">
        Listing visibility
      </Text>
      <View className="gap-sm">
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => select(opt.key)}
              className={`px-md py-md rounded-xl border bg-white ${
                active ? 'bg-brand-primary border-brand-primary' : 'border-border'
              }`}
            >
              <Text
                className={`font-semi text-body ${
                  active ? 'text-white' : 'text-neutral-900'
                }`}
              >
                {opt.label}
              </Text>
              <Text
                className={`font-sans text-caption mt-xs ${
                  active ? 'text-white/85' : 'text-neutral-500'
                }`}
              >
                {opt.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
