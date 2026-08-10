import { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Globe, Leaf, Lock, Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { languageBadge } from '@/i18n';

import { Button, Card, Input, LanguageSheet, Screen, Text } from '@/components/ui';
import { loginSchema, type LoginInput } from '@/features/auth/schema';
import { useLogin } from '@/features/auth/useLogin';
import { IS_CUSTOMER } from '@/lib/flags';
import { LoginError, type ApprovalStateExtra } from '@/services/auth/login';
import { toast } from 'sonner-native';
import { useAuth } from '@/stores/authStore';
import { getBranding } from '@/theme/branding';

// ⚠️ This screen deliberately opens NO external pages.
//
// It used to hold a `CONTACT_URL` (`greenbidz.com/contact-us/`) plus an
// `openInAppBrowser` helper behind a "Request an account" link. That link is
// what App Review rejected build 14 for under **Guideline 3.1.1** — see the
// long note at the JSX site below. Both the constant and the helper are gone so
// there is no route back to a B2B sign-up funnel from the login screen; the
// `expo-web-browser` import went with them.
//
// Forgot-password is native (`/(auth)/forgot-password`) and never needed a
// browser hand-off, so nothing else on this screen regressed.
//
// History worth keeping: the ORIGINAL link was `seller.greenbidz.com/contact`,
// which rendered "404 — Oops! Page not found" and earned a Guideline 2.1(a)
// rejection. It is a single-page app, so the SERVER returns HTTP 200 and the
// 404 is drawn client-side — a status-code check "passes" on a dead page.
// Verify links by RENDERING them, never by curl'ing the status.

// Post-auth landing route, forked at build time by EXPO_PUBLIC_USER_TYPE: the
// customer (lab) app or the seller tabs. Mirrors `HOME_ROUTE` in app/_layout.tsx
// so a `router.replace` here leaves the (auth) group at the right destination —
// otherwise a customer would land on the seller tabs (the AuthGuard can no
// longer correct it once we're outside the auth group).
const HOME_ROUTE = IS_CUSTOMER ? '/(lab)/(tabs)/home' : '/(tabs)';

// Stitch palette (GreenBidz Seller Login Redesign — project 8600847790717829846):
// authority navy for primary actions, eco-teal as the card accent + footer badge.
// Kept inline for this screen; promote to design tokens when other screens adopt
// the navy/teal direction (brand-identity reconciliation tracked in me_plan inbox).
const ECO_TEAL = '#00B289';
const TEAL_SURFACE = '#E6F7F1';
const TEXT_PRIMARY = '#1A1C1F';
const TEXT_SECONDARY = '#43474F';
const MONO_FONT = 'JetBrainsMono_400Regular';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const branding = getBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const langLabel = languageBadge(i18n.language);

  const params = useLocalSearchParams<{ email?: string }>();
  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: typeof params.email === 'string' ? params.email : '', password: '' },
  });
  const mut = useLogin();
  const setPending = useAuth((s) => s.setPending);
  const setApproval = useAuth((s) => s.setApproval);

  const onSubmit = (values: LoginInput) =>
    mut.mutate(values, {
      onSuccess: () => router.replace(HOME_ROUTE),
      onError: (err) => {
        if (err instanceof LoginError) {
          if (err.code === 'EMAIL_NOT_VERIFIED') {
            toast.error(err.message);
            return;
          }
          if (err.code === 'ACCOUNT_PENDING') {
            setPending(true);
            setApproval((err.extra as ApprovalStateExtra | undefined)?.approval ?? null);
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
    <Screen keyboardAware contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}>
      {/* Top row: language switcher right-aligned. Login screen previously
          had no language entry — international sellers landing here couldn't
          switch the app's locale until after sign-in. Mirrors the chip in
          the Home tab header. */}
      <View className="flex-row justify-end mb-md">
        <Pressable
          onPress={() => setLangSheetOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Language, ${langLabel}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#F3F4F6',
            borderColor: '#E5E7EB',
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Globe size={14} color={TEXT_SECONDARY} />
          <RNText
            style={{
              fontFamily: MONO_FONT,
              fontSize: 12,
              lineHeight: 16,
              letterSpacing: 0.6,
              color: TEXT_SECONDARY,
              fontWeight: '600',
            }}
          >
            {langLabel}
          </RNText>
        </Pressable>
      </View>

      {/* Logo chip */}
      <View className="items-center">
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E5E7EB',
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 16,
            shadowColor: '#14452f',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          <Image
            source={branding.logo}
            style={{ width: branding.logoWidth, height: branding.logoHeight }}
            contentFit="contain"
            transition={200}
            accessibilityLabel={branding.logoLabel}
          />
        </View>
      </View>

      {/* Headline + subtitle */}
      <View className="items-center mt-md">
        <Text
          variant="hero"
          className="font-bold text-center"
          style={{ color: TEXT_PRIMARY }}
        >
          {t('mobile.auth.welcomeBack')}
        </Text>
        <RNText
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            lineHeight: 22,
            color: TEXT_SECONDARY,
            maxWidth: 280,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          {t('mobile.auth.welcomeSubtitle', {
            defaultValue: 'Sign in to buy and sell used lab & industrial equipment.',
          })}
        </RNText>
      </View>

      {/* Login card with teal stripe */}
      <View className="mt-xl">
        <View
          style={{
            height: 4,
            backgroundColor: ECO_TEAL,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            marginHorizontal: 4,
          }}
        />
        <Card
          variant="flat"
          className="px-lg py-xl gap-lg"
          style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        >
          {/* EMAIL */}
          <View className="gap-xs">
            <Text
              style={{
                fontFamily: MONO_FONT,
                fontSize: 12,
                lineHeight: 16,
                letterSpacing: 0.6,
                color: TEXT_SECONDARY,
                textTransform: 'uppercase',
              }}
            >
              {t('mobile.auth.emailLabelCaps', { defaultValue: 'Email address' })}
            </Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  error={errors.email?.message}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder={t('mobile.auth.emailPlaceholderCompany')}
                  leftIcon={
                    <Mail size={18} color={errors.email ? '#DC2626' : '#9CA3AF'} />
                  }
                />
              )}
            />
          </View>

          {/* PASSWORD with inline FORGOT */}
          <View className="gap-xs">
            <View className="flex-row items-center justify-between">
              <Text
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 12,
                  lineHeight: 16,
                  letterSpacing: 0.6,
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                }}
              >
                {t('mobile.auth.password')}
              </Text>
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.auth.forgotPassword')}
              >
                <Text
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: 12,
                    lineHeight: 16,
                    letterSpacing: 0.6,
                    color: ECO_TEAL,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('mobile.auth.forgotShort', { defaultValue: 'Forgot?' })}
                </Text>
              </Pressable>
            </View>
            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
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
                    <Lock size={18} color={errors.password ? '#DC2626' : '#9CA3AF'} />
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
          </View>

          {/* Sign In — uses the themed Button primitive's forest primary (the
              shipping brand), matching the rest of the app instead of the old
              seller navy. */}
          <Button
            label={t('mobile.auth.signIn')}
            onPress={handleSubmit(onSubmit)}
            loading={mut.isPending}
            size="md"
            fullWidth
            style={{ marginTop: 4 }}
          />
        </Card>
      </View>

      {/* Sustainability pill + tagline */}
      <View className="items-center mt-xl">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: TEAL_SURFACE,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            gap: 6,
          }}
        >
          <Leaf size={14} color={ECO_TEAL} strokeWidth={2.5} />
          <Text
            style={{
              fontFamily: MONO_FONT,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 0.8,
              color: ECO_TEAL,
              textTransform: 'uppercase',
            }}
          >
            {t('mobile.auth.sustainabilityFirst', {
              defaultValue: 'Sustainability first',
            })}
          </Text>
        </View>
        <Text
          variant="bodySm"
          className="text-center mt-sm"
          style={{ color: TEXT_SECONDARY, maxWidth: 280 }}
        >
          {t('mobile.auth.tagline', {
            defaultValue:
              'Empowering the circular economy through responsible industrial trade.',
          })}
        </Text>
      </View>

      {/* ⚠️ THIS MUST STAY A NATIVE ROUTE. DO NOT point it at a web page.
          This was originally a link opening greenbidz.com/contact-us/ in the
          in-app browser, and App Review REJECTED build 14 under
          **Guideline 3.1.1**:

            "The app includes an account registration feature for businesses and
             organizations, which is considered access to external mechanisms for
             purchases or subscriptions to be used in the app.
             Next Steps: Remove the account registration features for business
             and organizations."

          That contact page carries a Company field and a chat widget offering
          "auction services" / "list my equipment" / "free valuation", so Apple
          reads any in-app route to it as a B2B sign-up funnel for services sold
          outside the App Store.

          Registration itself was never the objection — linking OUT to it was.
          `/(auth)/register` is a fully native, free BUYER signup that opens
          nothing external, which is what every marketplace app ships.
          `src/__tests__/externalLinks.test.ts` fails the build if this screen
          ever performs outbound navigation again. */}
      <View className="items-center mt-2xl flex-row justify-center" style={{ gap: 4 }}>
        <RNText
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: TEXT_SECONDARY,
          }}
        >
          {t('mobile.auth.noAccount', { defaultValue: "Don't have an account?" })}
        </RNText>
        <Pressable
          onPress={() => router.push('/(auth)/register')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.auth.createAccount', { defaultValue: 'Create account' })}
        >
          <RNText
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 18,
              color: ECO_TEAL,
              fontWeight: '600',
            }}
          >
            {t('mobile.auth.createAccount', { defaultValue: 'Create account' })}
          </RNText>
        </Pressable>
      </View>

      <LanguageSheet visible={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
    </Screen>
  );
}
