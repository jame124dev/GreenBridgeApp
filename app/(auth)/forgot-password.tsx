// Native 3-step forgot-password wizard (email → 6-digit code → new password),
// replacing the old web hand-off. Presentational: all flow logic lives in
// useForgotPassword; this maps error CODES → localized copy and renders the
// step. Styling mirrors the login screen (forest/eco-teal Stitch palette).
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { useForgotPassword } from '@/features/auth/useForgotPassword';
import {
  newPasswordSchema, resetEmailSchema,
  type NewPasswordInput, type ResetEmailInput,
} from '@/features/auth/schema';
import type { ResetErrorCode } from '@/services/auth/passwordReset';

const FOREST = '#14452f';
const TEXT_PRIMARY = '#1A1C1F';
const TEXT_SECONDARY = '#43474F';
const HAIRLINE = '#E1E5EC';

function mm(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Privacy: show a***@domain, not the full address, in the "code sent to" hint.
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  const first = user.slice(0, 1);
  return `${first}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const fp = useForgotPassword();

  // Map a hook error CODE → localized copy (keeps the hook i18n-free/testable).
  const errText = (code: ResetErrorCode | null): string | null => {
    if (!code) return null;
    if (code === 'NO_ACCOUNT') return t('mobile.auth.reset.noAccount');
    if (code === 'INVALID_OTP') return t('mobile.auth.reset.invalidCode');
    if (code === 'NETWORK') return t('mobile.auth.reset.networkError');
    return t('mobile.auth.reset.networkError');
  };

  // Hardware back: step within the flow; exit to login from the first step.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fp.step === 'email') { router.back(); return true; }
      fp.back();
      return true;
    });
    return () => sub.remove();
  }, [fp]);

  const goBack = () => {
    if (fp.step === 'email') router.back();
    else fp.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" style={styles.backBtn}>
        <ChevronLeft size={24} color={TEXT_PRIMARY} />
      </Pressable>

      {fp.step === 'email' && <EmailStep fp={fp} errText={errText} />}
      {fp.step === 'otp' && <OtpStep fp={fp} errText={errText} />}
      {fp.step === 'password' && <PasswordStep fp={fp} errText={errText} />}
    </View>
  );
}

type StepProps = {
  fp: ReturnType<typeof useForgotPassword>;
  errText: (c: ResetErrorCode | null) => string | null;
};

function EmailStep({ fp, errText }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<ResetEmailInput>({
    resolver: zodResolver(resetEmailSchema),
    defaultValues: { email: '' },
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    await fp.submitEmail(email);
    if (!fp.error) toast(t('mobile.auth.reset.codeSent'));
  });
  const serverErr = errText(fp.error);
  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.reset.emailTitle')}</RNText>
      <RNText style={styles.subtitle}>{t('mobile.auth.reset.emailSubtitle')}</RNText>
      <RNText style={styles.label}>{t('mobile.auth.reset.emailLabel')}</RNText>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="you@company.com"
            placeholderTextColor="#9aa1ad"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        )}
      />
      {errors.email ? <RNText style={styles.err}>{errors.email.message}</RNText> : null}
      {serverErr ? <RNText style={styles.err}>{serverErr}</RNText> : null}
      <Button label={t('mobile.auth.reset.sendCode')} onPress={onSubmit} loading={fp.isPending} fullWidth />
    </View>
  );
}

function OtpStep({ fp, errText }: StepProps) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const serverErr = errText(fp.error);
  // A wrong code clears the field (hook sets error, screen resets input).
  useEffect(() => {
    if (fp.error === 'INVALID_OTP') setOtp('');
  }, [fp.error]);
  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.reset.otpTitle')}</RNText>
      <RNText style={styles.subtitle}>{t('mobile.auth.reset.otpSubtitle', { email: maskEmail(fp.email) })}</RNText>
      <OtpInput value={otp} onChange={setOtp} onComplete={(v) => fp.submitOtp(v)} />
      <RNText style={styles.timer}>{mm(fp.secondsLeft)}</RNText>
      {serverErr ? <RNText style={styles.err}>{serverErr}</RNText> : null}
      <RNText style={styles.hint}>{t('mobile.auth.reset.useRecentCode')}</RNText>
      <Button label={t('mobile.auth.reset.verify')} onPress={() => fp.submitOtp(otp)} loading={fp.isPending} fullWidth />
      <Pressable
        disabled={fp.resendCooldown > 0}
        onPress={() => fp.resend().then(() => toast(t('mobile.auth.reset.newCodeSent')))}
        style={{ marginTop: 14, alignItems: 'center', opacity: fp.resendCooldown > 0 ? 0.5 : 1 }}
      >
        <RNText style={styles.resend}>
          {fp.resendCooldown > 0
            ? t('mobile.auth.reset.resendIn', { seconds: fp.resendCooldown })
            : t('mobile.auth.reset.resend')}
        </RNText>
      </Pressable>
    </View>
  );
}

function PasswordStep({ fp, errText }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const onSubmit = handleSubmit(async ({ newPassword }) => {
    try {
      await fp.submitNewPassword(newPassword);
      toast(t('mobile.auth.reset.resetSuccess'));
      router.replace({ pathname: '/(auth)/login', params: { email: fp.email } });
    } catch {
      /* hook already set the error + (for INVALID_OTP) bounced to the otp step */
    }
  });
  const serverErr = errText(fp.error);
  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.reset.passwordTitle')}</RNText>
      <RNText style={styles.label}>{t('mobile.auth.reset.newPassword')}</RNText>
      <Controller
        control={control}
        name="newPassword"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} secureTextEntry autoCapitalize="none" />
        )}
      />
      {errors.newPassword ? <RNText style={styles.err}>{errors.newPassword.message}</RNText> : null}
      <RNText style={styles.label}>{t('mobile.auth.reset.confirmPassword')}</RNText>
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} secureTextEntry autoCapitalize="none" />
        )}
      />
      {errors.confirmPassword ? <RNText style={styles.err}>{errors.confirmPassword.message}</RNText> : null}
      {serverErr ? <RNText style={styles.err}>{serverErr}</RNText> : null}
      <Button label={t('mobile.auth.reset.resetPassword')} onPress={onSubmit} loading={fp.isPending} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 24 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: 16, gap: 12 },
  title: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 26, color: TEXT_PRIMARY },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY, marginBottom: 8 },
  label: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, letterSpacing: 0.6, color: TEXT_SECONDARY, textTransform: 'uppercase', marginTop: 4 },
  input: {
    minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: HAIRLINE,
    paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 15, color: TEXT_PRIMARY, backgroundColor: '#ffffff',
  },
  err: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#b42318' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: TEXT_SECONDARY, textAlign: 'center' },
  timer: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' },
  resend: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: FOREST },
});
