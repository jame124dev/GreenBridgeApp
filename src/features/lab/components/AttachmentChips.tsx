// AttachmentChips — the staged-attachment row for the (lab) AI composer(s)
// (Home + Chat). Renders one chip per `useComposer` attachment: a thumbnail for
// images, a file glyph + filename for documents, each with an × to unstage.
// Shared so Home and Chat show identical chips. Renders nothing when empty.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { FileText, X } from 'lucide-react-native';

import { useComposer } from '@/features/lab/stores/composerStore';
import { brand, fonts, fontSize, lab, radius } from '@/constants/theme';
import { usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AttachmentChips({ style }: { style?: object }) {
  const attachments = useComposer((s) => s.attachments);
  const removeAttachment = useComposer((s) => s.removeAttachment);

  if (attachments.length === 0) return null;

  return (
    <View style={[styles.row, style]}>
      {attachments.map((a) => (
        <View key={a.uri} style={styles.chip}>
          {a.isImage ? (
            <Image source={{ uri: a.uri }} style={styles.thumb} />
          ) : (
            <View style={styles.docIcon}>
              <FileText size={16} strokeWidth={1.8} color={lab.utilIcon} />
            </View>
          )}
          <Text style={styles.name} numberOfLines={1}>
            {a.name}
          </Text>
          <RemoveButton
            name={a.name}
            onPress={() => {
              haptics.tap();
              removeAttachment(a.uri);
            }}
          />
        </View>
      ))}
    </View>
  );
}

// Destructive × control. Uses the shared 0.97 press-scale so it gives the same
// tactile feedback as the other Pressables in this unit (TabBarItem / chips /
// send button); hitSlop keeps the effective target ≥44pt over the 28px box.
function RemoveButton({ name, onPress }: { name: string; onPress: () => void }) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${name}`}
      style={[styles.removeBtn, style]}
    >
      <X size={14} strokeWidth={2.2} color={lab.inkSub} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
    paddingLeft: 6,
    paddingRight: 4,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lab.hairline,
    backgroundColor: brand.surface,
  },
  thumb: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: lab.utilBg,
  },
  docIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lab.utilBg,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.md, // 12 — was ad-hoc 12.5
    color: lab.ink,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
