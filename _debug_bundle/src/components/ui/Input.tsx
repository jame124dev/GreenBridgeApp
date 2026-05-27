import { forwardRef, useState } from 'react';
import {
  Platform,
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Press handler for rightIcon (e.g. eye toggle, clear button). */
  onPressRightIcon?: () => void;
  invalid?: boolean;
  readOnly?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onPressRightIcon,
    invalid = false,
    readOnly = false,
    editable,
    containerStyle,
    style,
    placeholderTextColor,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const isEditable = !readOnly && editable !== false;
  const isInvalid = invalid || !!error;

  const borderClass = isInvalid
    ? 'border-danger bg-danger/5'
    : focused
      ? 'border-primary-500 bg-surface'
      : 'border-border bg-neutral-50';

  const leftPaddingClass = leftIcon ? 'pl-11' : 'px-xl';
  const rightPaddingClass = rightIcon ? 'pr-11' : 'px-xl';

  return (
    <View className="gap-xs w-full" style={containerStyle}>
      {label ? (
        <Text variant="bodySm" tone={isInvalid ? 'danger' : 'secondary'} className="font-medium">
          {label}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center rounded-xl border h-14 bg-white relative ${borderClass}`}
      >
        {leftIcon ? (
          <View className="absolute left-[12px] z-[1]">
            {leftIcon}
          </View>
        ) : null}
        <TextInput
          ref={ref}
          editable={isEditable}
          placeholderTextColor={placeholderTextColor ?? '#9CA3AF'}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={`flex-1 text-neutral-900 font-sans ${leftPaddingClass} ${rightPaddingClass} h-full py-0`}
          style={[
            { fontSize: 16 },
            Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null,
            style,
          ]}
          {...rest}
        />
        {rightIcon ? (
          onPressRightIcon ? (
            <Pressable
              onPress={onPressRightIcon}
              hitSlop={12}
              className="absolute right-[12px] z-[1]"
            >
              {rightIcon}
            </Pressable>
          ) : (
            <View className="absolute right-[12px] z-[1]">{rightIcon}</View>
          )
        ) : null}
      </View>
      {(error || hint) ? (
        <Text variant="caption" tone={error ? 'danger' : 'tertiary'}>
          {error || hint}
        </Text>
      ) : null}
    </View>
  );
});
