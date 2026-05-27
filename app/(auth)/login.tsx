import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { loginSchema, type LoginInput } from '@/features/auth/schema';
import { useLogin } from '@/features/auth/useLogin';
import { LoginError } from '@/services/auth/login';
import { toast } from 'sonner-native';
import { useAuth } from '@/stores/authStore';
import { getBranding } from '@/theme/branding';

export default function LoginScreen() {
  const { t } = useTranslation();
  const branding = getBranding();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mut = useLogin();
  const setPending = useAuth((s) => s.setPending);

  const onSubmit = (values: LoginInput) =>
    mut.mutate(values, {
      onSuccess: () => router.replace('/(tabs)'),
      onError: (err) => {
        if (err instanceof LoginError) {
          if (err.code === 'EMAIL_NOT_VERIFIED') {
            toast.error(err.message);
            return;
          }
          if (err.code === 'ACCOUNT_PENDING') {
            setPending(true);
            return router.replace('/(auth)/pending');
          }
          if (err.code === 'BUYER_NOT_ALLOWED') {
            toast.error(err.message);
            return;
          }
          if (err.code === 'INVALID_CREDENTIALS') {
            setError('email', { message: ' ' });
            setError('password', { message: err.message });
            toast.error(err.message);
            return;
          }
          if (err.code === 'VALIDATION') {
            setError('email', { message: err.message });
            toast.error(err.message);
            return;
          }
          toast.error(err.message);
          return;
        }
        toast.error(t('mobile.auth.loginFailedBody'));
      },
    });

  return (
    <Screen padded={false} keyboardAware edges={[]} contentContainerStyle={{ paddingBottom: 0 }}>
      {/* Gradient hero */}
      <LinearGradient colors={['#14452f', '#236b48']} className="pb-[48px] rounded-b-[32px]">
        <SafeAreaView edges={['top']}>
          <View className="px-lg pt-md items-center">
            <View className="mb-lg self-center rounded-xl border border-white/20 bg-white px-lg py-sm shadow-sm">
              <Image
                source={branding.logo}
                style={{ width: branding.logoWidth, height: branding.logoHeight }}
                contentFit="contain"
                transition={200}
                accessibilityLabel={branding.logoLabel}
              />
            </View>
            <Text variant="hero" tone="inverse" className="text-center font-bold">
              {t('mobile.auth.welcomeBack')}
            </Text>
            <Text variant="body" tone="inverse" className="mt-xs text-center opacity-80">
              {t('mobile.auth.signInSubtitle')}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Form card */}
      <Card variant="flat" className="mt-[-28px] mx-lg px-lg py-xl gap-xl">
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('mobile.auth.email')}
              error={errors.email?.message}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder={t('mobile.auth.emailPlaceholderCompany')}
              leftIcon={
                <Mail
                  size={18}
                  color={errors.email ? '#DC2626' : '#9CA3AF'}
                />
              }
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('mobile.auth.password')}
              error={errors.password?.message}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
              placeholder="••••••••"
              leftIcon={
                <Lock
                  size={18}
                  color={errors.password ? '#DC2626' : '#9CA3AF'}
                />
              }
              rightIcon={
                showPassword ? (
                  <EyeOff size={18} color="#9CA3AF" />
                ) : (
                  <Eye size={18} color="#9CA3AF" />
                )
              }
              onPressRightIcon={() => setShowPassword((v) => !v)}
            />
          )}
        />

        <Button
          label={t('mobile.auth.signIn')}
          onPress={handleSubmit(onSubmit)}
          loading={mut.isPending}
          size="lg"
          fullWidth
          className="mt-md"
        />

        <Pressable
          onPress={() =>
            toast(t('mobile.auth.forgotPasswordBody'))
          }
          className="self-center py-sm active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.auth.forgotPassword')}
        >
          <Text variant="body" tone="brand" className="font-semi">
            {t('mobile.auth.forgotPassword')}
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
