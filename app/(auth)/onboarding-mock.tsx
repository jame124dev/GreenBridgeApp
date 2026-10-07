/**
 * `/(auth)/onboarding-mock` — DEV-ONLY host for the seller-onboarding UI mock.
 *
 * ⚠️ WHY THIS IS GATED, AND WHY THE GATE IS NOT A FEATURE FLAG.
 *
 * App Review rejected this app twice under **Guideline 3.1.1** for collecting
 * business identity in-app (`app/(lab)/sell/apply.tsx:12-48`). The screens
 * behind this route collect none of it — seller type, categories, volume and
 * calibration only — but the flow they belong to is unresolved, and until that
 * question is answered this must not be reachable in a shipped binary.
 *
 * `__DEV__` is the right gate precisely because **Guideline 2.3.1 forbids
 * hidden features that are disabled at review and enabled afterwards**. A
 * remote flag would be exactly that. `__DEV__` is false in every release
 * build, the branch is dead-code-eliminated by the bundler, and there is no
 * switch anyone can flip after review — which is the distinction that matters.
 *
 * No entry point links here. Reach it by typing the path:
 *   web  → http://localhost:8081/onboarding-mock
 *   app  → a deep link in a dev client
 */
import { Redirect } from 'expo-router';

import { OnboardingFlow } from '@/features/v2/onboarding/OnboardingFlow';

export default function OnboardingMockRoute() {
  if (!__DEV__) return <Redirect href="/(auth)/login" />;
  return <OnboardingFlow />;
}
