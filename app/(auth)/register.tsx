/**
 * Native 3-step registration (email + password → 6-digit code → your details).
 *
 * ⚠️ NATIVE ON PURPOSE — DO NOT REPLACE WITH A WEB HAND-OFF.
 * The login screen used to link out to `greenbidz.com/contact-us/` to "request
 * an account". App Review rejected build 14 under **Guideline 3.1.1** because
 * that page is a business sign-up funnel reached from inside the app. Signup
 * itself was never the problem — linking OUT to it was. This screen opens
 * nothing external.
 *
 * Deliberately a BUYER marketplace account with an optional company field.
 * Requiring company details would turn this back into business/organization
 * registration, which is exactly what was rejected.
 *
 * Presentational only: the flow lives in useRegistration, so the recovery paths
 * are unit-tested without rendering. Styling mirrors forgot-password.tsx, which
 * is the same 3-step shape, so the two flows feel identical.
 */
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { useRegistration } from '@/features/auth/useRegistration';
import {
  registerCodeSchema,
  registerCredentialsSchema,
  registerProfileSchema,
  type RegisterCredentialsInput,
  type RegisterProfileInput,
} from '@/features/auth/schema';

const FOREST = '#14452f';
const ECO_TEAL = '#00B289';
const TEXT_PRIMARY = '#1A1C1F';
const TEXT_SECONDARY = '#43474F';
const HAIRLINE = '#E1E5EC';

const STEP_ORDER = ['credentials', 'code', 'profile'] as const;

/** Privacy: show a***@domain in the "code sent to" hint, never the full address. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reg = useRegistration();
  const { step } = reg.state;

  // Hardware back: step within the flow, exit to login from the first step.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'credentials' || step === 'done') {
        router.back();
        return true;
      }
      reg.back();
      return true;
    });
    return () => sub.remove();
  }, [step, reg]);

  // Tell the user WHY they were sent back — a silent jump to step 1 reads as a
  // bug. The server's pending-signup record is in-memory with a 10-min expiry.
  useEffect(() => {
    if (reg.state.restarted) toast.error(t('mobile.auth.register.sessionLost'));
  }, [reg.state.restarted, t]);

  const goBack = () => {
    if (step === 'credentials' || step === 'done') router.back();
    else reg.back();
  };

  const stepIndex = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" style={styles.backBtn}>
        <ChevronLeft size={24} color={TEXT_PRIMARY} />
      </Pressable>

      {/* "Where am I?" — the progress rail is the answer, and it is the only
          chrome on the screen so the single CTA below stays dominant. */}
      {stepIndex >= 0 ? (
        <View style={styles.rail} accessibilityRole="progressbar"
          accessibilityLabel={t('mobile.auth.register.stepOf', {
            defaultValue: `Step ${stepIndex + 1} of 3`,
            current: stepIndex + 1,
            total: STEP_ORDER.length,
          })}
        >
          {STEP_ORDER.map((s, i) => (
            <View key={s} style={[styles.railSeg, i <= stepIndex && styles.railSegOn]} />
          ))}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'credentials' && <CredentialsStep reg={reg} />}
        {step === 'code' && <CodeStep reg={reg} />}
        {step === 'profile' && <ProfileStep reg={reg} />}
        {step === 'done' && <DoneStep reg={reg} />}
      </ScrollView>
    </View>
  );
}

type StepProps = { reg: ReturnType<typeof useRegistration> };

function CredentialsStep({ reg }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<RegisterCredentialsInput>({
    resolver: zodResolver(registerCredentialsSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const ok = await reg.submitCredentials(email.trim(), password);
    if (ok) toast(t('mobile.auth.register.codeSent'));
  });

  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.register.credentialsTitle')}</RNText>
      <RNText style={styles.subtitle}>{t('mobile.auth.register.credentialsSubtitle')}</RNText>

      <RNText style={styles.label}>{t('mobile.auth.register.emailLabel')}</RNText>
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
      {errors.email?.message ? <RNText style={styles.err}>{t(errors.email.message)}</RNText> : null}

      <RNText style={styles.label}>{t('mobile.auth.register.passwordLabel')}</RNText>
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
        )}
      />
      {errors.password?.message ? <RNText style={styles.err}>{t(errors.password.message)}</RNText> : null}

      <RNText style={styles.label}>{t('mobile.auth.register.confirmPasswordLabel')}</RNText>
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
        )}
      />
      {errors.confirmPassword?.message ? (
        <RNText style={styles.err}>{t(errors.confirmPassword.message)}</RNText>
      ) : null}

      {reg.state.error ? <RNText style={styles.err}>{reg.state.error}</RNText> : null}

      <Button
        label={t('mobile.auth.register.sendCode')}
        onPress={onSubmit}
        loading={reg.state.busy}
        fullWidth
      />

      {/* An "email already registered" dead end is the most likely failure on
          this step, so the recovery sits right under the CTA. */}
      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.linkRow} hitSlop={8}>
        <RNText style={styles.link}>{t('mobile.auth.register.haveAccount')}</RNText>
      </Pressable>
    </View>
  );
}

function CodeStep({ reg }: StepProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  // A rejected code clears the field so the next attempt starts clean.
  useEffect(() => {
    if (reg.state.error) setCode('');
  }, [reg.state.error]);

  const submit = (value: string) => {
    const parsed = registerCodeSchema.safeParse({ code: value });
    if (!parsed.success) {
      toast.error(t('mobile.auth.register.codeInvalid'));
      return;
    }
    void reg.submitCode(parsed.data.code);
  };

  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.register.codeTitle')}</RNText>
      <RNText style={styles.subtitle}>
        {t('mobile.auth.register.codeSubtitle', { email: maskEmail(reg.state.email) })}
      </RNText>

      <OtpInput value={code} onChange={setCode} onComplete={submit} />

      {reg.state.error ? <RNText style={styles.err}>{reg.state.error}</RNText> : null}

      <Button
        label={t('mobile.auth.register.verify')}
        onPress={() => submit(code)}
        loading={reg.state.busy}
        fullWidth
      />

      <Pressable
        onPress={() => reg.resend().then((ok) => { if (ok) toast(t('mobile.auth.register.newCodeSent')); })}
        style={styles.linkRow}
        hitSlop={8}
      >
        <RNText style={styles.link}>{t('mobile.auth.register.resend')}</RNText>
      </Pressable>
    </View>
  );
}

function ProfileStep({ reg }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<RegisterProfileInput>({
    resolver: zodResolver(registerProfileSchema),
    defaultValues: { firstName: '', lastName: '', phone: '', company: '', country: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await reg.submitProfile(values);
  });

  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.register.profileTitle')}</RNText>
      <RNText style={styles.subtitle}>{t('mobile.auth.register.profileSubtitle')}</RNText>

      <RNText style={styles.label}>{t('mobile.auth.register.firstNameLabel')}</RNText>
      <Controller
        control={control}
        name="firstName"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} autoComplete="given-name" />
        )}
      />
      {errors.firstName?.message ? <RNText style={styles.err}>{t(errors.firstName.message)}</RNText> : null}

      <RNText style={styles.label}>{t('mobile.auth.register.lastNameLabel')}</RNText>
      <Controller
        control={control}
        name="lastName"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} autoComplete="family-name" />
        )}
      />
      {errors.lastName?.message ? <RNText style={styles.err}>{t(errors.lastName.message)}</RNText> : null}

      <RNText style={styles.label}>{t('mobile.auth.register.phoneLabel')}</RNText>
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        )}
      />

      {/* ⚠️ Company is OPTIONAL and labelled as such. Making it required would
          turn this into business/organization registration — the Guideline
          3.1.1 finding on build 14. */}
      <RNText style={styles.label}>{t('mobile.auth.register.companyLabel')}</RNText>
      <Controller
        control={control}
        name="company"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} autoComplete="organization" />
        )}
      />

      <RNText style={styles.label}>{t('mobile.auth.register.countryLabel')}</RNText>
      <Controller
        control={control}
        name="country"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} autoComplete="country" />
        )}
      />

      {reg.state.error ? <RNText style={styles.err}>{reg.state.error}</RNText> : null}

      <Button
        label={t('mobile.auth.register.createAccount')}
        onPress={onSubmit}
        loading={reg.state.busy}
        fullWidth
      />
    </View>
  );
}

/**
 * "What happens after this?" — the account is created but PENDING admin
 * approval, so we say so plainly instead of dropping the user at a login screen
 * that would reject them.
 */
function DoneStep({ reg }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.body, { alignItems: 'center', marginTop: 40 }]}>
      <CheckCircle2 size={56} color={ECO_TEAL} />
      <RNText style={[styles.title, { textAlign: 'center', marginTop: 12 }]}>
        {t('mobile.auth.register.doneTitle')}
      </RNText>
      <RNText style={[styles.subtitle, { textAlign: 'center' }]}>
        {t('mobile.auth.register.doneSubtitle')}
      </RNText>
      <Button
        label={t('mobile.auth.register.backToSignIn')}
        onPress={() => router.replace({ pathname: '/(auth)/login', params: { email: reg.state.email } })}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 24 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rail: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 4 },
  railSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: HAIRLINE },
  railSegOn: { backgroundColor: FOREST },
  scroll: { paddingBottom: 40 },
  body: { marginTop: 16, gap: 12 },
  title: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 26, color: TEXT_PRIMARY },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY, marginBottom: 8 },
  label: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, letterSpacing: 0.6, color: TEXT_SECONDARY, textTransform: 'uppercase', marginTop: 4 },
  input: {
    minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: HAIRLINE,
    paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 15, color: TEXT_PRIMARY, backgroundColor: '#ffffff',
  },
  err: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#b42318' },
  linkRow: { marginTop: 14, alignItems: 'center' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: FOREST },
});
