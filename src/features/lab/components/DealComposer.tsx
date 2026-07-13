// (lab) Deal Room composer — pill TextInput + 46×46 round send button. Spec 07
// §2d + §5. Bespoke (NOT `Input`, NOT `Button`): send is 46×46, a non-standard
// height below Button's sm(48px), so it is a hand-rolled Pressable with the
// foundation 0.97 press scale. Controlled — the screen owns `value`/`onSend`.
// The screen's onSend() owns the MEDIUM haptic so it fires exactly once/send;
// this component does NOT touch haptics.
import { TextInput, View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react-native';
import { fonts, greenMedium } from '@/constants/theme';
import { usePressScale } from '@/animations/recipes';
import { DEAL_COLORS } from '@/features/lab/data/demo';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DealComposerProps {
  value: string;
  onChangeText: (t: string) => void;
  /** Screen's send() — fires haptics.impact() itself. */
  onSend: () => void;
  /** Screen scrolls the thread to the bottom on focus. */
  onFocus?: () => void;
  placeholder: string;
}

export function DealComposer({ value, onChangeText, onSend, onFocus, placeholder }: DealComposerProps) {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0;
  const { style: aStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={DEAL_COLORS.placeholder}
        multiline={false}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={() => {
          if (canSend) onSend();
        }}
      />
      <AnimatedPressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => {
          if (canSend) onSend();
        }}
        disabled={!canSend}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labDeal.sendMessage')}
        style={[aStyle, styles.send, { opacity: canSend ? 1 : 0.5 }]}
      >
        <Send size={20} color="#fff" strokeWidth={2} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DEAL_COLORS.inputBorder,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: DEAL_COLORS.inputInk,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: greenMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
