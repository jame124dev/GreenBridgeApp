/**
 * Native 2-step registration (email + password + name → 6-digit code → in).
 *
 * ⚠️ NATIVE ON PURPOSE — DO NOT REPLACE WITH A WEB HAND-OFF.
 * The login screen used to link out to `greenbidz.com/contact-us/` to "request
 * an account". App Review rejected build 14 under **Guideline 3.1.1** because
 * that page is a business sign-up funnel reached from inside the app. Signup
 * itself was never the problem — linking OUT to it was. The Terms and Privacy
 * notices below are the ONLY external links on this screen (legal notices, not
 * a purchase or registration mechanism) and `externalLinks.test.ts` enforces it.
 *
 * Deliberately THREE FIELDS for a plain BUYER marketplace account. Company, tax
 * id and business type are NOT collected here — asking for them is what turns
 * signup into "account registration for businesses and organizations", the
 * Guideline 3.1.1 finding. They belong to the seller-upgrade application, which
 * is only reached by someone who tries to list something.
 *
 * Presentational only: the flow lives in useRegistration, so the recovery paths
 * are unit-tested without rendering. Styling mirrors forgot-password.tsx so the
 * two flows feel identical.
 */
import { useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
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
import { useLogin } from '@/features/auth/useLogin';
import {
  registerCodeSchema,
  registerCredentialsSchema,
  type RegisterCredentialsInput,
} from '@/features/auth/schema';
import { spacing } from '@/constants/theme';
import { LoginError } from '@/services/auth/login';

const FOREST = '#14452f';
const ECO_TEAL = '#00B289';
const TEXT_PRIMARY = '#1A1C1F';
const TEXT_SECONDARY = '#43474F';
const HAIRLINE = '#E1E5EC';

// Post-auth landing route — mirrors HOME_ROUTE in login.tsx / _layout.tsx so a
// brand-new account lands in the right app for this bundle.
const HOME_ROUTE = '/(lab)/(tabs)/home';

const STEP_ORDER = ['credentials', 'code'] as const;

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
            defaultValue: `Step ${stepIndex + 1} of ${STEP_ORDER.length}`,
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
        // The root is a bare View that insets only the top, so this scroll owns
        // the bottom inset. At a flat 40 (< the 48dp Android 3-button nav bar)
        // the trailing "Already have an account? / Sign in" row and the Terms /
        // Privacy links were half-buried, with taps landing on the system
        // buttons — the last controls of the screen must stay reachable.
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'credentials' && <CredentialsStep reg={reg} />}
        {step === 'code' && <CodeStep reg={reg} />}
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
    defaultValues: { email: '', name: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password, name }) => {
    const ok = await reg.submitCredentials(email.trim(), password, name.trim());
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

      {/* One free-text name, split into first/last for the API. Without it the
          server falls back to the email prefix, which shows up as e.g. "abhay"
          in a seller's chat thread. */}
      <RNText style={styles.label}>
        {t('mobile.auth.register.nameLabel', { defaultValue: 'Your name' })}
      </RNText>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('mobile.auth.register.namePlaceholder', { defaultValue: 'Ada Lovelace' })}
            placeholderTextColor="#9aa1ad"
            autoCapitalize="words"
            autoComplete="name"
          />
        )}
      />
      {errors.name?.message ? (
        <RNText style={styles.err}>
          {t(errors.name.message, { defaultValue: 'Please enter your name' })}
        </RNText>
      ) : null}

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

      {/* The ONLY external links permitted on an auth screen — legal notices, not a
          registration or purchase mechanism (see Global Constraint 1). */}
      <RNText style={styles.legal}>
        {t('mobile.auth.register.legalPrefix', { defaultValue: 'By continuing you agree to our' })}{' '}
        <RNText style={styles.legalLink} onPress={() => Linking.openURL('https://101lab.co/terms-of-service')}>
          {t('mobile.auth.register.terms', { defaultValue: 'Terms of Service' })}
        </RNText>
        {' '}{t('mobile.auth.register.legalAnd', { defaultValue: 'and' })}{' '}
        <RNText style={styles.legalLink} onPress={() => Linking.openURL('https://101lab.co/privacy-policy')}>
          {t('mobile.auth.register.privacy', { defaultValue: 'Privacy Policy' })}
        </RNText>
      </RNText>

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

/**
 * "What happens after this?" — the account works immediately as a BUYER, so the
 * only thing left to do is go and use it.
 *
 * ⚠️ The signup endpoints do NOT return a session: `POST /user/complete-signup`
 * creates the row and returns `{ user_id, email, name }`, nothing else. So this
 * button signs in with the credentials just entered rather than pretending a
 * session exists — without that, replacing to HOME_ROUTE with a null profile is
 * bounced straight back to /(auth)/login by the AuthGuard. The account is
 * `pw_user_status = "pending"`, so `login()` answers ACCOUNT_PENDING; since Task
 * 1 that is a working buyer session, not a failure.
 */
function DoneStep({ reg }: StepProps) {
  const { t } = useTranslation();
  const mut = useLogin();

  const enter = () =>
    mut.mutate(
      { email: reg.state.email, password: reg.state.password },
      {
        onSuccess: () => router.replace(HOME_ROUTE),
        onError: (err) => {
          // Pending is the EXPECTED outcome for a fresh signup and is a usable
          // buyer session (login() has already persisted profile + tokens).
          if (err instanceof LoginError && err.code === 'ACCOUNT_PENDING') {
            return router.replace(HOME_ROUTE);
          }
          // Anything else (e.g. the app was backgrounded long enough for the
          // password to be dropped from memory) — recover at sign-in rather
          // than stranding the user on a success screen.
          toast.error(err instanceof Error ? err.message : t('mobile.auth.loginFailedBody'));
          router.replace({ pathname: '/(auth)/login', params: { email: reg.state.email } });
        },
      },
    );

  return (
    <View style={[styles.body, { alignItems: 'center', marginTop: 40 }]}>
      <CheckCircle2 size={56} color={ECO_TEAL} />
      <RNText style={[styles.title, { textAlign: 'center', marginTop: 12 }]}>
        {t('mobile.auth.register.doneTitle')}
      </RNText>
      <RNText style={[styles.subtitle, { textAlign: 'center' }]}>
        {t('mobile.auth.register.doneSubtitleBuyer', {
          defaultValue:
            'Your account is ready. Browse equipment, ask our AI assistant anything, and message sellers. To list your own equipment, apply to sell from the Sell tab.',
        })}
      </RNText>
      <Button
        label={t('mobile.auth.register.startBrowsing', { defaultValue: 'Start browsing' })}
        onPress={enter}
        loading={mut.isPending}
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
  legal: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, textAlign: 'center', marginTop: 12 },
  legalLink: { color: FOREST, fontWeight: '600' },
  linkRow: { marginTop: 14, alignItems: 'center' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: FOREST },
});
