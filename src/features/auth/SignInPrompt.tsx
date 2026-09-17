import { Modal, Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { brand, spacing } from '@/constants/theme';

import { GATE_COPY } from './gateCopy';
import { useSignInPromptStore } from './signInPromptStore';

/**
 * The one place a guest is asked for an account.
 *
 * Mounted once in `app/(lab)/_layout.tsx`; opened from anywhere via
 * `requireAuth(reason, action)`. Copy is per-reason so the prompt names the
 * thing the person just tried to do — "Sign in to message sellers" tells them
 * why; a bare "Sign in required" makes them guess.
 *
 * Browsing, searching and the AI assistant never reach here: they are not
 * account-based, and gating them is what App Review rejected 1.0.3 (21) for
 * under Guideline 5.1.1(v). See `signInPromptStore.ts`.
 */

export function SignInPrompt() {
  const { t } = useTranslation();
  const reason = useSignInPromptStore((s) => s.reason);
  const close = useSignInPromptStore((s) => s.close);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (!reason) return null;
  /*
    ⚠️ STAND DOWN ON v2 ROUTES.

    `app/v2/_layout.tsx` mounts `features/v2/auth/SignInSheet`, which reads this
    same store. Both layouts can be mounted at once — expo-router keeps the
    previous group alive when you navigate into another — so one tap opened TWO
    sheets, this one stacked behind the v2 one. Seen on Account in dark: a band
    of the LIGHT backdrop (#76827E) peeking above the dark sheet's top edge,
    because this prompt is taller.

    Deleted along with the old UI; until then the route decides which gate
    renders, and it can only ever be one.
  */
  if (pathname.startsWith('/v2')) return null;
  const copy = GATE_COPY[reason];

  const go = (path: '/(auth)/login' | '/(auth)/register') => {
    close();
    router.push(path);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      {/* Tapping the scrim dismisses: a guest who changed their mind must not be
          trapped in a wall, which is the whole point of the 5.1.1 fix. */}
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.auth.gate.dismiss', { defaultValue: 'Dismiss' })}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
      >
        {/* Inner Pressable swallows taps so pressing the card does not close it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: brand.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.xl,
            // ⛔ Observed on the emulator: without this the LAST button
            // ("Keep browsing") sat under the system nav bar and was clipped.
            // That button is the guest's way OUT of the prompt -- clipping it
            // turns the 5.1.1 fix back into a wall. `+ spacing.md` keeps a
            // finger's worth of clearance on gesture-bar devices too.
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
        >
          <Text variant="title">
            {t(`mobile.auth.gate.${reason}.title`, { defaultValue: copy.title })}
          </Text>
          <Text tone="secondary">
            {t(`mobile.auth.gate.${reason}.body`, { defaultValue: copy.body })}
          </Text>

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              label={t('mobile.auth.gate.createAccount', { defaultValue: 'Create account' })}
              onPress={() => go('/(auth)/register')}
              fullWidth
            />
            <Button
              label={t('mobile.auth.gate.signIn', { defaultValue: 'I already have an account' })}
              onPress={() => go('/(auth)/login')}
              variant="secondary"
              fullWidth
            />
            <Button
              label={t('mobile.auth.gate.keepBrowsing', { defaultValue: 'Keep browsing' })}
              onPress={close}
              variant="ghost"
              fullWidth
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
