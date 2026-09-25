/**
 * Native 2-step registration (email + password + name → 6-digit code → in),
 * on the "Wash Hero" frame, 2026-09-23.
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
 * Presentational only: the flow lives in `useRegistration`, so the recovery
 * paths are unit-tested without rendering. None of that changed here.
 *
 * ── WHAT THE WASH-HERO PASS CHANGED ────────────────────────────────────────
 *
 * • **The frame is `AuthShell`**, shared with sign in: wash panel, curved
 *   sheet, and the Sign in / Create account segment.
 *
 * • **"Already have an account? Sign in" is gone.** That is the segment's job
 *   now, and it sits above the fields rather than below four of them.
 *
 * • **The chrome follows the step.** The segment is visible while you are
 *   filling the form and HIDDEN on the code step — you are mid-flow there,
 *   and offering "Sign in" beside a code we just emailed invites you to
 *   abandon an account that already half-exists. The outcome step drops the
 *   title block entirely, so the confirmation has the screen to itself.
 *   Chrome belonging to a state must not render outside that state.
 *
 * • **The back chevron is on the code step, where it was missing.** Step one
 *   does not have one: the segment is the way out, and hardware back still
 *   leaves the group.
 */
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
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
import { useRegistration } from '@/features/auth/useRegistration';
import { homeRoute, postAuthLanding } from '@/features/v2/routing/postAuthLanding';
import { useLogin } from '@/features/auth/useLogin';
import {
  registerCodeSchema,
  registerCredentialsSchema,
  type RegisterCredentialsInput,
} from '@/features/auth/schema';
import { LoginError } from '@/services/auth/login';
import { GUTTER, icon, radius, space, useV2Colors } from '@/theme/v2';

const STEP_ORDER = ['credentials', 'code'] as const;

/** Privacy: show a***@domain in the "code sent to" hint, never the full address. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
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

  if (step === 'code') return <CodeStep reg={reg} />;
  if (step === 'done') return <DoneStep reg={reg} />;
  return <CredentialsStep reg={reg} />;
}

type StepProps = { reg: ReturnType<typeof useRegistration> };

/** The rail, inside the sheet above the fields. Shared with the reset wizard. */
function StepRail({ index }: { index: number }) {
  return <AuthStepRail index={index} total={STEP_ORDER.length} />;
}

function CredentialsStep({ reg }: StepProps) {
  const { t } = useTranslation();
  // Prefilled when the switch came from sign in with an address already typed.
  const params = useLocalSearchParams<{ email?: string }>();
  const { control, handleSubmit, formState: { errors } } = useForm<RegisterCredentialsInput>({
    resolver: zodResolver(registerCredentialsSchema),
    defaultValues: {
      email: typeof params.email === 'string' ? params.email : '',
      name: '',
      password: '',
      confirmPassword: '',
    },
  });
  const email = useWatch({ control, name: 'email' });

  /**
   * The focus chain. Four fields with no `returnKeyType` is four dead ends:
   * the keyboard's action key closes the keyboard, and the person taps the next
   * box, four times, on the screen where we are asking them to sign up.
   */
  const nameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  /**
   * One toggle for BOTH password fields.
   *
   * Two independent eyes would let someone reveal one and not the other, which
   * is the one configuration where "do these match?" cannot be answered by
   * looking — and checking that is the entire purpose of a confirm field.
   */
  const [reveal, setReveal] = useState(false);

  const onSubmit = handleSubmit(async ({ email: address, password, name }) => {
    const ok = await reg.submitCredentials(address.trim(), password, name.trim());
    if (ok) toast(t('mobile.auth.register.codeSent'));
  });

  const revealToggle = (
    <RevealToggle
      on={reveal}
      onToggle={() => setReveal((v) => !v)}
      labels={{ show: t('mobile.auth.showPasswordA11y'), hide: t('mobile.auth.hidePasswordA11y') }}
    />
  );

  const footer = (
    <PrimaryAction
      label={t('mobile.auth.register.sendCode')}
      onPress={onSubmit}
      loading={reg.state.busy}
      testID="v2-auth-register-submit"
    />
  );

  // Hidden while the keyboard is up — see `AuthShell`'s `footerQuiet`. This is
  // the four-field form, so the ~126px that row costs is the difference
  // between the first field keeping its label and losing it.
  const footerQuiet = (
    <QuietAction
      label={t('mobile.auth.doLater', { defaultValue: 'Do later' })}
      onPress={() => router.replace(homeRoute())}
      tone="accent"
      variant="captionMedium"
      testID="v2-auth-register-skip"
    />
  );

  return (
    <AuthShell
      mode="signup"
      eyebrow={t('mobile.auth.sustainabilityFirst')}
      title={t('mobile.auth.register.credentialsTitle')}
      subtitle={t('mobile.auth.register.credentialsSubtitle')}
      email={email}
      footer={footer}
      footerQuiet={footerQuiet}
      testID="v2-auth-register"
    >
      <StepRail index={0} />

      <View style={styles.fields}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value, onBlur } }) => (
            <Field
              label={t('mobile.auth.register.emailLabel')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              /* `you@example.com`, not `you@company.com`. Cosmetic on its own,
                 but this screen is one of the two App Review screenshotted
                 under Guideline 3.1.1 ("account registration for businesses
                 and organizations"), and a work-email placeholder is one of
                 the cues that reads a personal signup as a business one. */
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
              invalid={Boolean(errors.email)}
              help={errors.email?.message ? t(errors.email.message) : undefined}
              testID="v2-auth-register-email"
            />
          )}
        />

        {/* One free-text name, split into first/last for the API. Without it
            the server falls back to the email prefix, which shows up as e.g.
            "abhay" in a seller's chat thread. */}
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value, onBlur } }) => (
            <Field
              label={t('mobile.auth.register.nameLabel', { defaultValue: 'Your name' })}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('mobile.auth.register.namePlaceholder', {
                defaultValue: 'Ada Lovelace',
              })}
              ref={nameRef}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              invalid={Boolean(errors.name)}
              help={
                errors.name?.message
                  ? t(errors.name.message, { defaultValue: 'Please enter your name' })
                  : undefined
              }
              testID="v2-auth-register-name"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value, onBlur } }) => (
            <Field
              label={t('mobile.auth.register.passwordLabel')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              ref={passwordRef}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete="new-password"
              // Without this iOS never offers Strong Password on a signup form.
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              invalid={Boolean(errors.password)}
              // ⚠️ THE RULE IS SHOWN BEFORE IT IS BROKEN. The 8-character
              // minimum (`schema.ts`) used to appear only after a failed
              // submit, so the first a person heard of it was being told off.
              help={
                errors.password?.message
                  ? t(errors.password.message)
                  : t('mobile.auth.register.passwordTooShort')
              }
              trailing={revealToggle}
              testID="v2-auth-register-password"
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value, onBlur } }) => (
            <Field
              label={t('mobile.auth.register.confirmPasswordLabel')}
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
              trailing={revealToggle}
              invalid={Boolean(errors.confirmPassword)}
              help={
                errors.confirmPassword?.message
                  ? t(errors.confirmPassword.message)
                  : undefined
              }
              testID="v2-auth-register-confirm"
            />
          )}
        />
      </View>

      {/* A flow-level failure (the server refused the whole submission) is not
          any one field's, so it stays a note of its own. `styles.note` cancels
          `SectionNote`'s own gutter: it carries one because list screens drop
          it straight into an unpadded scroll, and the sheet already has one —
          the two stacked would put the note at a third horizontal position,
          which `spacing-and-layout.md` R4 forbids. */}
      {reg.state.error ? (
        <View style={styles.note}>
          <SectionNote tone="danger" variant="body">
            {reg.state.error}
          </SectionNote>
        </View>
      ) : null}

      {/* The ONLY external links permitted on an auth screen — legal notices,
          not a registration or purchase mechanism. */}
      <Text variant="caption" color="inkSubtle" style={styles.legal}>
        {t('mobile.auth.register.legalPrefix', {
          defaultValue: 'By continuing you agree to our',
        })}{' '}
        <Text
          variant="captionMedium"
          color="accentInk"
          onPress={() => Linking.openURL('https://101lab.co/terms-of-service')}
        >
          {t('mobile.auth.register.terms', { defaultValue: 'Terms of Service' })}
        </Text>
        {' '}
        {t('mobile.auth.register.legalAnd', { defaultValue: 'and' })}{' '}
        <Text
          variant="captionMedium"
          color="accentInk"
          onPress={() => Linking.openURL('https://101lab.co/privacy-policy')}
        >
          {t('mobile.auth.register.privacy', { defaultValue: 'Privacy Policy' })}
        </Text>
      </Text>
    </AuthShell>
  );
}

function CodeStep({ reg }: StepProps) {
  const { t } = useTranslation();
  const c = useV2Colors();
  const [code, setCode] = useState('');

  /**
   * A rejected code clears the field, so the next attempt starts clean.
   *
   * From `submitCode`'s result, in the handler — not from an effect watching
   * `error`. The effect version was a `setState` inside an effect (cascading
   * renders; eslint `react-hooks/set-state-in-effect`), and because it fired on
   * the error CHANGING, the same wrong code entered twice left the digits in
   * place.
   */
  const submit = (value: string) => {
    const parsed = registerCodeSchema.safeParse({ code: value });
    if (!parsed.success) {
      toast.error(t('mobile.auth.register.codeInvalid'));
      return;
    }
    void reg.submitCode(parsed.data.code).then((ok) => {
      if (!ok) setCode('');
    });
  };

  const footer = (
    <PrimaryAction
      label={t('mobile.auth.register.verify')}
      onPress={() => submit(code)}
      loading={reg.state.busy}
      testID="v2-auth-register-verify"
    />
  );

  return (
    <AuthShell
      mode="signup"
      segmented={false}
      title={t('mobile.auth.register.codeTitle')}
      subtitle={t('mobile.auth.register.codeSubtitle', { email: maskEmail(reg.state.email) })}
      leading={
        <View style={styles.backRow}>
          <GlyphButton
            accessibilityLabel={t('mobile.auth.register.backToSignIn')}
            onPress={() => reg.back()}
          >
            <ChevronLeft size={icon.hero} color={c.ink} strokeWidth={1.75} />
          </GlyphButton>
        </View>
      }
      footer={footer}
      testID="v2-auth-register-code"
    >
      <StepRail index={1} />

      <View style={styles.otp}>
        <OtpField
          value={code}
          onChange={setCode}
          onComplete={submit}
          invalid={Boolean(reg.state.error)}
        />
      </View>

      {reg.state.error ? (
        <View style={styles.note}>
          <SectionNote tone="danger" variant="body">
            {reg.state.error}
          </SectionNote>
        </View>
      ) : null}

      {/*
        Rate-limited, like the reset flow's identical-looking link. Signup had
        no cooldown at all, so this was tap-spammable while the screen it is a
        twin of was not. The label carries the remaining seconds — a disabled
        control with unchanged copy reads as broken.
      */}
      <QuietAction
        label={
          reg.resendCooldown > 0
            ? t('mobile.auth.reset.resendIn', { seconds: reg.resendCooldown })
            : t('mobile.auth.register.resend')
        }
        onPress={() =>
          reg.resend().then((ok) => {
            if (ok) toast(t('mobile.auth.register.newCodeSent'));
          })
        }
        disabled={reg.resendCooldown > 0}
        tone="accent"
        style={styles.recovery}
        testID="v2-auth-register-resend"
      />
    </AuthShell>
  );
}

/**
 * "What happens after this?" — the account works immediately as a BUYER, so the
 * only thing left to do is go and use it.
 *
 * ⚠️ The signup endpoints do NOT return a session: `POST /user/complete-signup`
 * creates the row and returns `{ user_id, email, name }`, nothing else. So this
 * button signs in with the credentials just entered rather than pretending a
 * session exists — without that, replacing to the home route with a null
 * profile is bounced straight back to /(auth)/login by the AuthGuard. The
 * account is `pw_user_status = "pending"`, so `login()` answers ACCOUNT_PENDING;
 * since Task 1 that is a working buyer session, not a failure.
 */
function DoneStep({ reg }: StepProps) {
  const { t } = useTranslation();
  const c = useV2Colors();
  const mut = useLogin();

  const enter = () =>
    mut.mutate(
      { email: reg.state.email, password: reg.state.password },
      {
        // The v2 sheet's "Create account" lands here, so the signup half needs
        // the same gatekeeper as login. See `postAuthLanding`.
        onSuccess: () => router.replace(postAuthLanding()),
        onError: (err) => {
          // Pending is the EXPECTED outcome for a fresh signup and is a usable
          // buyer session (login() has already persisted profile + tokens).
          if (err instanceof LoginError && err.code === 'ACCOUNT_PENDING') {
            return router.replace(postAuthLanding());
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
    <AuthShell
      mode="signup"
      segmented={false}
      footer={
        <PrimaryAction
          label={t('mobile.auth.register.startBrowsing', { defaultValue: 'Start browsing' })}
          onPress={enter}
          loading={mut.isPending}
          testID="v2-auth-register-enter"
        />
      }
      testID="v2-auth-register-done"
    >
      <View style={styles.done}>
        <View style={[styles.doneMark, { backgroundColor: c.accentWash }]}>
          <CheckCircle2 size={icon.hero} color={c.accent} strokeWidth={1.75} />
        </View>
        <Text variant="display" style={styles.centered}>
          {t('mobile.auth.register.doneTitle')}
        </Text>
        <Text variant="lead" color="inkMuted" style={styles.centered}>
          {/* ⛔ The trailing sentence used to read "To list your own equipment,
              apply to sell from the Sell tab." — deleted 2026-08-20. It was an
              in-app call to action into the business-registration form that App
              Review told us to remove under Guideline 3.1.1, and 3.1.3's
              preamble forbids steering to an off-app commercial path. See the
              note at the top of `app/(lab)/sell/apply.tsx` before writing
              anything like it again. What is left describes what this account
              CAN do. */}
          {t('mobile.auth.register.doneSubtitleBuyer', {
            defaultValue:
              'Your account is ready. Browse equipment, ask our AI assistant anything, and message sellers.',
          })}
        </Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  /** One step between fields; the eyebrow label supplies the rest. */
  fields: { gap: space['5xl'] },
  otp: { marginTop: space['3xl'] },
  legal: { textAlign: 'center', marginTop: space['6xl'] },
  recovery: { marginTop: space['5xl'] },
  /** Cancels `SectionNote`'s own gutter — see the call site. */
  note: { marginHorizontal: -GUTTER, marginTop: space['3xl'] },
  done: { alignItems: 'center', gap: space['3xl'], marginTop: space['8xl'] },
  doneMark: {
    width: space['8xl'] * 2,
    height: space['8xl'] * 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
});
