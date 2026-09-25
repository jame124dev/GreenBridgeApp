/**
 * Sign in — the "Wash Hero" layout, 2026-09-23.
 *
 * ⚠️ THIS SCREEN DELIBERATELY OPENS NO EXTERNAL PAGES.
 *
 * It used to hold a `CONTACT_URL` (`greenbidz.com/contact-us/`) plus an
 * `openInAppBrowser` helper behind a "Request an account" link. That link is
 * what App Review rejected build 14 for under **Guideline 3.1.1**. Both the
 * constant and the helper are gone so there is no route back to a B2B sign-up
 * funnel from the login screen, and `src/__tests__/externalLinks.test.ts` fails
 * the build if this file ever performs outbound navigation again.
 *
 * Forgot-password is native (`/(auth)/forgot-password`) and never needed a
 * browser hand-off.
 *
 * History worth keeping: the ORIGINAL link was `seller.greenbidz.com/contact`,
 * which rendered "404 — Oops! Page not found" and earned a Guideline 2.1(a)
 * rejection. It is a single-page app, so the SERVER returns HTTP 200 and the
 * 404 is drawn client-side — a status-code check "passes" on a dead page.
 * Verify links by RENDERING them, never by curl'ing the status.
 *
 * ── WHAT THE WASH-HERO PASS CHANGED, AND WHY ───────────────────────────────
 *
 * The frame is now `AuthShell` (wash panel + curved sheet + segmented
 * control), shared with sign-up. Three things went with it:
 *
 * • **The bordered card is gone.** It held the only two fields on an
 *   otherwise empty screen — a box drawn around the whole page. The sheet's
 *   curve against the wash is the structure now, which is this design's
 *   device everywhere else.
 *
 * • **"Don't have an account? Create account" is gone.** The segment above
 *   the fields is that route, and two controls doing one job at opposite ends
 *   of the screen is the duplicate-control item of `UX_DESIGN_RULES.md`.
 *
 * • **The CTA moved into `Screen`'s footer.** It was the last thing inside a
 *   scrolling body, so on a small phone with the keyboard up it sat under the
 *   keyboard while you typed the password above it. The footer is a flex
 *   sibling that measures itself and rides the keyboard.
 *
 * The brand line ("Sustainability first") is the hero's eyebrow — it was a
 * pill once, which is the shape of a CONTROL in this kit, and it does nothing
 * when pressed.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import {
  Field,
  PrimaryAction,
  QuietAction,
  RevealToggle,
} from '@/features/v2/ui';
import { AuthShell } from '@/features/v2/auth/AuthShell';
import { loginSchema, type LoginInput } from '@/features/auth/schema';
import { useLogin } from '@/features/auth/useLogin';
import { homeRoute, postAuthLanding } from '@/features/v2/routing/postAuthLanding';
import { LoginError, type ApprovalStateExtra } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';
import { space } from '@/theme/v2';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  // The keyboard's "next" key has to land somewhere. Without these the email
  // field's return key dismissed the keyboard and the person re-tapped.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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
  // Handed to the shell so switching to Create account carries the address
  // already typed here.
  const email = useWatch({ control, name: 'email' });
  const mut = useLogin();
  const setPending = useAuth((s) => s.setPending);
  const setApproval = useAuth((s) => s.setApproval);

  const onSubmit = (values: LoginInput) =>
    mut.mutate(values, {
      // Not a hardcoded home route — see `postAuthLanding`. Signing in from a
      // v2 screen used to land you in the OLD UI with no way back.
      onSuccess: () => router.replace(postAuthLanding()),
      onError: (err) => {
        if (err instanceof LoginError) {
          if (err.code === 'EMAIL_NOT_VERIFIED') {
            toast.error(err.message);
            return;
          }
          if (err.code === 'ACCOUNT_PENDING') {
            // A pending account is a working BUYER session: login() already
            // persisted the tokens AND a synthesised profile, so send the user
            // into the app. We still record the pending facts for the seller
            // status surfaces — but `isPending` must never block navigation, and
            // routing here to /(auth)/pending is what made it a dead end.
            setPending(true);
            setApproval((err.extra as ApprovalStateExtra | undefined)?.approval ?? null);
            return router.replace(postAuthLanding());
          }
          if (err.code === 'BUYER_NOT_ALLOWED') {
            toast.error(err.message);
            return;
          }
          if (err.code === 'INVALID_CREDENTIALS') {
            // The email is marked invalid WITHOUT a message: which of the two
            // was wrong is not something we are told, and guessing out loud
            // ("email not found") is also an account-enumeration oracle. The
            // password line carries the one sentence.
            //
            // NO TOAST HERE. The same sentence was printed twice — once under
            // the password field and once in a toast over the top of it — which
            // is the "anything removable?" item of UX_DESIGN_RULES.md failing on
            // the most common error in the app. Every OTHER branch below keeps
            // its toast, because those have no field to attach to.
            setError('email', { message: ' ' });
            setError('password', { message: err.message });
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

  const footer = (
    <PrimaryAction
      label={t('mobile.auth.signIn')}
      onPress={handleSubmit(onSubmit)}
      loading={mut.isPending}
      testID="v2-auth-login-submit"
    />
  );

  // Hidden while the keyboard is up — see `AuthShell`'s `footerQuiet`.
  const footerQuiet = (
    <QuietAction
      label={t('mobile.auth.doLater', { defaultValue: 'Do later' })}
      onPress={() => router.replace(homeRoute())}
      tone="accent"
      variant="captionMedium"
      testID="v2-auth-login-skip"
    />
  );

  return (
    <AuthShell
      mode="signin"
      eyebrow={t('mobile.auth.sustainabilityFirst')}
      title={t('mobile.auth.welcomeBack')}
      subtitle={t('mobile.auth.welcomeSubtitle', {
        defaultValue: 'Sign in to buy and sell used lab & industrial equipment.',
      })}
      email={email}
      footer={footer}
      footerQuiet={footerQuiet}
      testID="v2-auth-login"
    >
      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <Field
            label={t('mobile.auth.emailLabelCaps', { defaultValue: 'Email address' })}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            ref={emailRef}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder={t('mobile.auth.emailPlaceholderCompany')}
            invalid={Boolean(errors.email)}
            help={errors.email?.message?.trim() ? t(errors.email.message) : undefined}
            testID="v2-auth-login-email"
          />
        )}
      />

      <View style={styles.passwordBlock}>
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <Field
              label={t('mobile.auth.password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              ref={passwordRef}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
              invalid={Boolean(errors.password)}
              help={errors.password?.message?.trim() ? t(errors.password.message) : undefined}
              testID="v2-auth-login-password"
              trailing={
                <RevealToggle
                  on={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  labels={{
                    show: t('mobile.auth.showPasswordA11y'),
                    hide: t('mobile.auth.hidePasswordA11y'),
                  }}
                />
              }
            />
          )}
        />
        <QuietAction
          label={t('mobile.auth.forgotPassword')}
          onPress={() => router.push('/(auth)/forgot-password')}
          tone="accent"
          variant="captionMedium"
          align="start"
          testID="v2-auth-login-forgot"
        />
      </View>

      {/*
        ⛔ THE TAGLINE USED TO BE HERE and was removed on the device pass,
        2026-09-23. Two reasons, both visible only on glass:

        1. It repeated the hero. "SUSTAINABILITY FIRST" above the title is
           already the brand line; "Empowering the circular economy through
           responsible industrial trade." underneath two fields said the same
           thing again, quieter — the "does any sentence repeat the one above
           it?" item of the design checklist.
        2. It had nothing to sit against. A two-field form leaves ~280pt
           between the last control and the sticky footer, so the tagline
           floated in the middle of that gap rather than closing the page. It
           read as something that had come loose.

        What is left is honest empty space under a short form. If brand copy
        must come back, it belongs in the wash with the eyebrow, not adrift in
        the sheet.
      */}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  /** The field and its recovery link are one unit; the gap is the inner step. */
  passwordBlock: { marginTop: space['5xl'], gap: space.xl },
});
