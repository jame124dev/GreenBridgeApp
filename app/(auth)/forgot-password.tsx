/**
 * Native 3-step forgot-password wizard (email → 6-digit code → new password),
 * on the "Wash Hero" frame, 2026-09-23.
 *
 * Presentational only: all flow logic lives in `useForgotPassword`. This maps
 * error CODES → localized copy and renders the step, which is why the hook can
 * stay i18n-free and unit-tested. None of that changed.
 *
 * ── WHY THIS ONE WAS CONVERTED TOO (TWICE NOW) ─────────────────────────────
 *
 * It is ONE TAP from sign-in. When `login.tsx` moved to v2 tokens and this was
 * still on the old kit, pressing "Forgot password?" went from the green wash
 * sheet to a white page with a monospace label — seen on device, and the kind
 * of seam `UX_DESIGN_RULES.md` exists to prevent. The same argument applies to
 * the wash-hero rebuild: sign-in now opens with a wash panel and a curved
 * sheet, so a recovery flow with a bare header would be the identical seam one
 * tap later. A converted entry point whose first exit is unconverted is not a
 * converted flow.
 *
 * ── THE TWO THINGS THAT ARE NOT LIKE ITS SIBLINGS ──────────────────────────
 *
 * 1. **No segmented control.** Password reset is not a third face of "sign in
 *    or create an account" — it is a flow you are already inside. `AuthShell`
 *    takes `segmented={false}`, and the labelled way back to sign-in lives in
 *    the footer where it can survive an error line growing the body.
 *
 * 2. **The code step has a COUNTDOWN, and it stays prominent.** It is the only
 *    screen in the app where the user is racing something, and burying the
 *    remaining time in a caption is how someone types a correct code into an
 *    expired session and is told it is wrong. It sits directly under the
 *    cells, and turns `danger` at zero rather than only changing its words.
 */
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View, type TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react-native';
import { toast } from 'sonner-native';

import {
  Field,
  GlyphButton,
  OtpField,
  PrimaryAction,
  QuietAction,
  RevealToggle,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { AuthShell } from '@/features/v2/auth/AuthShell';
import { AuthStepRail } from '@/features/v2/auth/AuthStepRail';
import { useForgotPassword } from '@/features/auth/useForgotPassword';
import {
  newPasswordSchema, resetEmailSchema,
  type NewPasswordInput, type ResetEmailInput,
} from '@/features/auth/schema';
import type { ResetErrorCode } from '@/services/auth/passwordReset';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';

const STEP_ORDER = ['email', 'otp', 'password'] as const;

function mm(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Privacy: show a***@domain, not the full address, in the "code sent to" hint. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  const first = user.slice(0, 1);
  return `${first}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const c = useV2Colors();
  const fp = useForgotPassword();

  // Map a hook error CODE → localized copy (keeps the hook i18n-free/testable).
  const errText = (code: ResetErrorCode | null): string | null => {
    if (!code) return null;
    if (code === 'NO_ACCOUNT') return t('mobile.auth.reset.noAccount');
    if (code === 'INVALID_OTP') return t('mobile.auth.reset.invalidCode');
    if (code === 'NETWORK') return t('mobile.auth.reset.networkError');
    return t('mobile.auth.reset.unknownError');
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

  const stepIndex = STEP_ORDER.indexOf(fp.step as (typeof STEP_ORDER)[number]);

  /**
   * The chevron sits in the wash between the brand bar and the title. Unlike
   * sign-up's first step, EVERY step of this flow has one: there is no segment
   * here to act as the way out, and step one is reached by a tap that is easy
   * to make by accident.
   */
  const leading = (
    <View style={styles.headerRow}>
      <GlyphButton
        accessibilityLabel={t('mobile.auth.register.backToSignIn')}
        onPress={goBack}
      >
        <ChevronLeft size={icon.hero} color={c.ink} strokeWidth={1.75} />
      </GlyphButton>
    </View>
  );

  const rail = stepIndex >= 0 ? <AuthStepRail index={stepIndex} total={STEP_ORDER.length} /> : null;

  if (fp.step === 'otp') {
    return <OtpStep fp={fp} errText={errText} leading={leading} rail={rail} />;
  }
  if (fp.step === 'password') {
    return <PasswordStep fp={fp} errText={errText} leading={leading} rail={rail} />;
  }
  return <EmailStep fp={fp} errText={errText} leading={leading} rail={rail} />;
}

type StepProps = {
  fp: ReturnType<typeof useForgotPassword>;
  errText: (c: ResetErrorCode | null) => string | null;
  leading: React.ReactNode;
  rail: React.ReactNode;
};

function EmailStep({ fp, errText, leading, rail }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<ResetEmailInput>({
    resolver: zodResolver(resetEmailSchema),
    defaultValues: { email: '' },
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    const ok = await fp.submitEmail(email);
    if (ok) toast(t('mobile.auth.reset.codeSent'));
  });
  const serverErr = errText(fp.error);

  return (
    <AuthShell
      mode="signin"
      segmented={false}
      leading={leading}
      title={t('mobile.auth.reset.emailTitle')}
      subtitle={t('mobile.auth.reset.emailSubtitle')}
      testID="v2-auth-reset-email"
      footer={
        /*
          ⚠️ THE WAY BACK TO SIGN-IN IS A LABELLED CONTROL, NOT JUST THE CHEVRON.

          This step had exactly one exit: a 30pt back arrow in the corner. Someone
          who tapped "Forgot password?" by mistake, or who remembers the password
          while looking at this screen, had nothing that said "sign in" anywhere
          on it. The later steps of this same flow offer a labelled way out and
          this one did not.

          In the footer, not the body, for the reason register's had to move
          there: an error line grows the body and pushes a trailing control below
          the fold, which is exactly when the escape hatch is wanted.
        */
        <PrimaryAction
          label={t('mobile.auth.reset.sendCode')}
          onPress={onSubmit}
          loading={fp.isPending}
          testID="v2-auth-reset-send"
        />
      }
      footerQuiet={
        <QuietAction
          label={t('mobile.auth.register.backToSignIn')}
          onPress={() => router.replace('/(auth)/login')}
          tone="accent"
          variant="captionMedium"
          testID="v2-auth-reset-signin"
        />
      }
    >
      {rail}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value, onBlur } }) => (
          <Field
            label={t('mobile.auth.reset.emailLabel')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            invalid={Boolean(errors.email)}
            help={errors.email?.message ? t(errors.email.message) : undefined}
            testID="v2-auth-reset-email-input"
          />
        )}
      />

      {serverErr ? (
        <View style={styles.note}>
          <SectionNote tone="danger" variant="body">
            {serverErr}
          </SectionNote>
        </View>
      ) : null}
    </AuthShell>
  );
}

function OtpStep({ fp, errText, leading, rail }: StepProps) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const serverErr = errText(fp.error);
  const expired = fp.secondsLeft === 0;

  /**
   * A rejected code clears the field, so the next attempt starts clean.
   *
   * Done in the HANDLER, from `submitOtp`'s result — not in an effect watching
   * `error`. The effect version was a `setState` inside an effect (cascading
   * renders; eslint `react-hooks/set-state-in-effect`) and it only fired when
   * the error CHANGED, so entering the same wrong code twice left the six
   * digits sitting there.
   */
  const verify = (value: string) => {
    void fp.submitOtp(value).then((ok) => {
      if (!ok) setOtp('');
    });
  };

  return (
    <AuthShell
      mode="signin"
      segmented={false}
      leading={leading}
      title={t('mobile.auth.reset.otpTitle')}
      subtitle={t('mobile.auth.reset.otpSubtitle', { email: maskEmail(fp.email) })}
      testID="v2-auth-reset-otp"
      footer={
        <PrimaryAction
          label={t('mobile.auth.reset.verify')}
          onPress={() => verify(otp)}
          loading={fp.isPending}
          testID="v2-auth-reset-verify"
        />
      }
    >
      {rail}

      <View style={styles.otp}>
        <OtpField
          value={otp}
          onChange={setOtp}
          onComplete={verify}
          invalid={fp.error === 'INVALID_OTP'}
        />
      </View>

      {/*
        The countdown, and it is `h3` rather than a caption — see the header.
        `danger` at zero: the copy below already changes, but a sentence that
        changes wording is a much weaker signal than a number that changes
        colour, and this is the moment the user needs to stop typing and ask
        for a new code.
      */}
      <Text
        variant="h3"
        color={expired ? 'danger' : 'inkMuted'}
        style={styles.centered}
      >
        {mm(fp.secondsLeft)}
      </Text>
      <Text variant="caption" color="inkSubtle" style={styles.centered}>
        {expired
          ? t('mobile.auth.reset.codeExpired')
          : t('mobile.auth.reset.useRecentCode')}
      </Text>

      {serverErr ? (
        <View style={styles.note}>
          <SectionNote tone="danger" variant="body">
            {serverErr}
          </SectionNote>
        </View>
      ) : null}

      <QuietAction
        label={
          fp.resendCooldown > 0
            ? t('mobile.auth.reset.resendIn', { seconds: fp.resendCooldown })
            : t('mobile.auth.reset.resend')
        }
        onPress={() =>
          fp.resend().then((ok) => {
            if (ok) toast(t('mobile.auth.reset.newCodeSent'));
          })
        }
        disabled={fp.resendCooldown > 0}
        tone="accent"
        style={styles.recovery}
        testID="v2-auth-reset-resend"
      />
    </AuthShell>
  );
}

function PasswordStep({ fp, errText, leading, rail }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const confirmRef = useRef<TextInput>(null);
  /** One toggle for both boxes — see the note on `RevealToggle`. */
  const [reveal, setReveal] = useState(false);
  const revealLabels = {
    show: t('mobile.auth.showPasswordA11y'),
    hide: t('mobile.auth.hidePasswordA11y'),
  };
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
    <AuthShell
      mode="signin"
      segmented={false}
      leading={leading}
      title={t('mobile.auth.reset.passwordTitle')}
      testID="v2-auth-reset-password"
      footer={
        <PrimaryAction
          label={t('mobile.auth.reset.resetPassword')}
          onPress={onSubmit}
          loading={fp.isPending}
          testID="v2-auth-reset-submit"
        />
      }
    >
      {rail}

      <View style={styles.fields}>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, value, onBlur } }) => (
            <Field
              label={t('mobile.auth.reset.newPassword')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              trailing={
                <RevealToggle
                  on={reveal}
                  onToggle={() => setReveal((v) => !v)}
                  labels={revealLabels}
                />
              }
              invalid={Boolean(errors.newPassword)}
              help={errors.newPassword?.message ? t(errors.newPassword.message) : undefined}
              testID="v2-auth-reset-new"
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value, onBlur } }) => (
            <Field
              label={t('mobile.auth.reset.confirmPassword')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              ref={confirmRef}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              trailing={
                <RevealToggle
                  on={reveal}
                  onToggle={() => setReveal((v) => !v)}
                  labels={revealLabels}
                />
              }
              invalid={Boolean(errors.confirmPassword)}
              help={
                errors.confirmPassword?.message
                  ? t(errors.confirmPassword.message)
                  : undefined
              }
              testID="v2-auth-reset-confirm"
            />
          )}
        />
      </View>

      {serverErr ? (
        <View style={styles.note}>
          <SectionNote tone="danger" variant="body">
            {serverErr}
          </SectionNote>
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  /** Cancels `SectionNote`'s own gutter — the sheet already has one. */
  note: { marginHorizontal: -GUTTER, marginTop: space['3xl'] },
  fields: { gap: space['5xl'] },
  otp: { marginBottom: space['5xl'] },
  centered: { textAlign: 'center' },
  recovery: { marginTop: space['5xl'] },
});
