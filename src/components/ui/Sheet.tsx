import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '@/constants/theme';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  snapTo?: string;
  children: React.ReactNode;
};

export function Sheet({ visible, onClose, title, snapTo = '60%', children }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const windowHeight = Dimensions.get('window').height;
  const snapPoints = useMemo(
    () => [snapTo.endsWith('%') ? Math.round(windowHeight * (parseFloat(snapTo) / 100)) : Number(snapTo)],
    [snapTo, windowHeight],
  );

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      animateOnMount={false}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      enablePanDownToClose
      handleIndicatorStyle={{
        backgroundColor: colors.light.borderStrong,
        width: 36,
        height: 4,
        borderRadius: 2,
      }}
      backgroundStyle={{
        backgroundColor: colors.light.surface,
        borderTopLeftRadius: radius['2xl'],
        borderTopRightRadius: radius['2xl'],
      }}
    >
      <View style={{ flex: 1 }}>
        {title ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <Text variant="subtitle" tone="primary" className="font-bold">
              {title}
            </Text>
          </View>
        ) : null}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </BottomSheetModal>
  );
}

type SheetOptionProps = {
  label: string;
  description?: string;
  active?: boolean;
  rightAdornment?: React.ReactNode;
  indent?: boolean;
  onPress: () => void;
};

Sheet.Option = function SheetOption({
  label,
  description,
  active = false,
  rightAdornment,
  indent = false,
  onPress,
}: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingLeft: indent ? spacing['2xl'] : spacing.sm,
        marginBottom: 2,
        borderRadius: radius.md,
        gap: spacing.sm,
        backgroundColor: active
          ? colors.primary[50]
          : pressed
            ? colors.light.surfaceAlt
            : 'transparent',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text
          variant="body"
          tone={active ? 'brand' : 'primary'}
          className={active ? 'font-semi' : 'font-sans'}
          numberOfLines={1}
        >
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {rightAdornment ?? (
        active ? <Check size={18} color={colors.primary[500]} strokeWidth={2.5} /> : null
      )}
    </Pressable>
  );
};
