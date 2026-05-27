import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from './Text';
import { colors, motion } from '@/constants/theme';

type Props = {
  value: string;
  placeholder?: boolean;
  onPress: () => void;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SelectButton({ value, placeholder, onPress, disabled, leftIcon }: Props) {
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const borderClass = focused ? 'border-primary-500 bg-surface' : 'border-border bg-neutral-50';

  return (
    <AnimatedPressable
      onPressIn={() => {
        if (disabled) return;
        setFocused(true);
        scale.value = withTiming(0.98, { duration: motion.tap });
      }}
      onPressOut={() => {
        setFocused(false);
        scale.value = withTiming(1, { duration: motion.tap });
      }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={animStyle}
      className={`flex-row items-center h-14 px-xl rounded-xl border gap-sm ${borderClass} ${disabled ? 'opacity-50' : ''}`}
    >
      {leftIcon ? <View>{leftIcon}</View> : null}
      <Text
        variant="body"
        tone={placeholder ? 'tertiary' : 'primary'}
        className="flex-1"
        numberOfLines={1}
      >
        {value}
      </Text>
      <ChevronDown color={colors.neutral[400]} size={16} />
    </AnimatedPressable>
  );
}
