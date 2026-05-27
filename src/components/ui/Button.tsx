import {
  ActivityIndicator,
  Pressable,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { motion } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:     'bg-primary-500 active:bg-primary-600',
  secondary:   'bg-neutral-100 active:bg-neutral-200',
  ghost:       'bg-transparent active:bg-neutral-100',
  destructive: 'bg-danger active:opacity-90',
  danger:      'bg-danger active:opacity-90',
};

const variantText: Record<ButtonVariant, 'inverse' | 'primary' | 'brand'> = {
  primary:     'inverse',
  secondary:   'primary',
  ghost:       'brand',
  destructive: 'inverse',
  danger:      'inverse',
};

// Height in px → enforces 48dp min touch target
const sizeClasses: Record<ButtonSize, { container: string; text: 'bodySm' | 'body' | 'bodyMd' }> = {
  sm: { container: 'h-12 px-lg',  text: 'bodySm' },  // 48
  md: { container: 'h-14 px-xl',  text: 'bodyMd' },  // 56
  lg: { container: 'h-16 px-2xl', text: 'bodyMd' },  // 64
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  haptic = true,
  style,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sz = sizeClasses[size];
  const isDisabled = disabled || loading;

  const handlePress = (e: GestureResponderEvent) => {
    if (isDisabled) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  const handlePressIn = () => {
    if (!isDisabled) {
      // eslint-disable-next-line react-hooks/immutability
      scale.value = withTiming(0.97, { duration: motion.tap });
    }
  };

  const handlePressOut = () => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(1, { duration: motion.tap });
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      style={[animatedStyle, style]}
      className={`
        ${sz.container} ${variantClasses[variant]}
        rounded-2xl flex-row items-center justify-center
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
      `}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'destructive' || variant === 'danger' ? '#fff' : '#10B981'} />
      ) : (
        <View className="flex-row items-center gap-sm">
          {leftIcon ? <View className="mr-xs">{leftIcon}</View> : null}
          <Text variant={sz.text} tone={variantText[variant]} className="font-semi text-center">{label}</Text>
          {rightIcon ? <View className="ml-xs">{rightIcon}</View> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}
