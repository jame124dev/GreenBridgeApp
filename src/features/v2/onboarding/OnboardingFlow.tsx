/**
 * Seller onboarding — UI MOCK of the web `/auth2` wizard.
 *
 * ⚠️ MOCK ONLY. No API call anywhere in this tree (owner instruction,
 * 2026-10-05). State lives in `useOnboardingMock` and dies with the screen.
 *
 * ⚠️ DEV ROUTE ONLY — see `app/(auth)/onboarding-mock.tsx`. App Review rejected
 * this app TWICE under Guideline 3.1.1 for collecting business identity
 * (company name, tax number, registration certificate) in-app. The steps here
 * deliberately collect NONE of that: seller type, equipment categories, volume
 * and calibration only. The business-identity screens from the web flow are
 * NOT built. See `app/(lab)/sell/apply.tsx:12-48` before adding any field.
 *
 * ── WHAT THIS REUSES, AND WHY NOTHING IS HAND-ROLLED ──
 *
 * Per `UI_SOURCING_RULES.md` §0, everything here came from the kit or from an
 * existing screen in this repo. Nothing was built from scratch:
 *
 *   `AuthShell`           the wash-hero frame + sticky keyboard-aware footer
 *   `AuthStepRail`        the progress rail, already i18n'd in all 6 languages
 *   `app/(auth)/forgot-password.tsx`  the multi-step-inside-AuthShell pattern
 *   `OptionCard`          single-select rows (role, seller type, volume, calib)
 *   `PillButton`          multi-select — `role="checkbox"`, draws its own ✓
 *   `Timeline`            named submit phases, the kit's answer to a spinner
 *   `PrimaryAction` / `QuietAction`  the one CTA and the quiet way out
 *
 * `Chip` is NOT used for categories: it takes no `onPress` — it is a badge,
 * not a control. `PillButton` is the kit's multi-select.
 *
 * ── THE RAIL COUNTS REAL STEPS ──
 *
 * `total={steps.length}`, derived in `mockState`. The design system forbids a
 * padded count, and the count genuinely varies: a buyer renders none of this.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  View,
  findNodeHandle,
  type TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { homeRoute } from '@/features/v2/routing/postAuthLanding';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { AuthShell } from '@/features/v2/auth/AuthShell';
import { AuthStepRail } from '@/features/v2/auth/AuthStepRail';
import {
  Field,
  GlyphButton,
  OptionCard,
  PillButton,
  PrimaryAction,
  QuietAction,
  RevealToggle,
  Text,
  Timeline,
} from '@/features/v2/ui';
import { CARD_PAD, icon, radius, space, useV2Colors } from '@/theme/v2';

import {
  ACCOUNT_FIELDS,
  BUSINESS_FIELDS,
  CALIBRATION_OPTIONS,
  LOCATION_FIELDS,
  MOCK_CATEGORIES,
  REQUIRED_FIELDS,
  VOLUME_OPTIONS,
  useOnboardingMock,
} from './mockState';
import { SellerTermsRow, SellerTermsSheet } from './SellerTerms';
import { useOnboardingApi } from './useOnboardingApi';

/**
 * Where this screen's copy lives, and the brand token that is interpolated
 * INTO it rather than translated with it.
 *
 * "101LAB" is a product name: a translator handed "Welcome to 101LAB!" will
 * eventually localise the name too. It is passed as `{{brand}}` so every
 * locale file carries the sentence and none carries the name.
 */
const T = 'mobile.auth.onboarding.';
const BRAND = '101LAB';

/**
 * Label, placeholder and keyboard per field id. `bizRole` changes with seller
 * type — the same fork the web's `buildSteps` makes.
 *
 * ⚠️ TAKES `t` AND RESOLVES AT RENDER. This is called from the render body,
 * so the copy follows a language change; a module-level table would not.
 */
function fieldCopy(id: string, isReseller: boolean, t: TFunction) {
  const f = (k: string) => t(`${T}fields.${k}`);
  switch (id) {
    case 'bizName':
      return {
        label: f(isReseller ? 'bizName.labelReseller' : 'bizName.labelCompany'),
        placeholder: f(isReseller ? 'bizName.placeholderReseller' : 'bizName.placeholderCompany'),
        max: 120,
        autoComplete: 'organization' as const,
        autoCapitalize: 'words' as const,
      };
    case 'website':
      return {
        label: f('website.label'),
        placeholder: f('website.placeholder'),
        max: 200,
        keyboard: 'url' as const,
        autoCapitalize: 'none' as const,
      };
    case 'taxId':
      return { label: f('taxId.label'), placeholder: f('taxId.placeholder'), max: 30 };
    case 'bizRole':
      return isReseller
        ? {
            label: f('bizRole.labelReseller'),
            placeholder: f('bizRole.placeholderReseller'),
            max: 2,
            keyboard: 'number-pad' as const,
          }
        : {
            label: f('bizRole.labelCompany'),
            placeholder: f('bizRole.placeholderCompany'),
            max: 80,
            autoComplete: 'organization-title' as const,
            autoCapitalize: 'words' as const,
          };
    case 'bizPhone':
      return {
        label: f('bizPhone.label'),
        placeholder: f('bizPhone.placeholder'),
        max: 40,
        keyboard: 'phone-pad' as const,
        autoComplete: 'tel' as const,
      };
    case 'street':
      return {
        label: f('street.label'),
        placeholder: f('street.placeholder'),
        max: 150,
        autoComplete: 'street-address' as const,
        autoCapitalize: 'words' as const,
      };
    case 'city':
      return {
        label: f('city.label'),
        placeholder: f('city.placeholder'),
        max: 80,
        autoCapitalize: 'words' as const,
      };
    case 'postal':
      return {
        label: f('postal.label'),
        placeholder: f('postal.placeholder'),
        max: 10,
        autoComplete: 'postal-code' as const,
        autoCapitalize: 'characters' as const,
      };
    case 'region':
      return {
        label: f('region.label'),
        placeholder: f('region.placeholder'),
        max: 80,
        autoCapitalize: 'words' as const,
      };
    case 'country':
      return { label: f('country.label'), placeholder: f('country.placeholder'), max: 80 };
    default:
      // Unknown id — a bug path, not copy. The raw id is the most useful thing
      // to show, and there is nothing to translate.
      return { label: id, placeholder: '', max: 120 };
  }
}

/**
 * The submit phases. Named, in the order they happen — the design system's
 * "Progress — named phases, never a bare spinner". In the mock these advance
 * on a timer; wired for real they advance per request.
 *
 * ⚠️ A FUNCTION OF `t`, NOT A CONST. As a module-level array this was built at
 * IMPORT time — before i18next resolved the stored language — so all four
 * phase names froze in whatever bundle loaded first and never followed a
 * language change.
 */
function submitPhases(t: TFunction): { label: string; detail?: string }[] {
  return [
    { label: t(`${T}submit.phaseSaved`) },
    { label: t(`${T}submit.phaseChecked`) },
    { label: t(`${T}submit.phaseCreating`), detail: t(`${T}submit.phaseCreatingDetail`) },
    { label: t(`${T}submit.phaseSending`) },
  ];
}
const SUBMIT_PHASE_COUNT = 4;

/**
 * The save-failed notice. ONE component, used by both the wizard steps and the
 * account step.
 *
 * ⚠️ IT IS ANNOUNCED, NOT JUST DRAWN. `FORM_INPUT_RULES.md` §5: an error
 * message needs `accessibilityLiveRegion` — `accessibilityRole="alert"` alone
 * does not speak on Android TalkBack. `Field.tsx:196-200` sets exactly this
 * pair for field-level errors, so before this the flow announced a bad postal
 * code but went silent when the SAVE failed: the user pressed Continue, the
 * screen did not move, and nothing said why.
 *
 * It is one component because it was two verbatim copies — and the second copy
 * is where the live region went missing.
 */
function ApiError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const c = useV2Colors();
  const { t } = useTranslation();
  return (
    // `UX_DESIGN_RULES`: an error says what happened AND offers a real control
    // to recover with — never prose on its own. A notice is not a pressable
    // surface, so it does not ramp. flat: message surface.
    <View style={[styles.errorBox, { backgroundColor: c.surface, borderColor: c.danger }]}>
      <Text
        variant="body"
        color="danger"
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        {message}
      </Text>
      <QuietAction label={t(`${T}cta.tryAgain`)} onPress={onRetry} align="start" />
    </View>
  );
}

/**
 * Why a press did nothing. See `softGate` below — a disabled primary is a
 * dead end, so on the two steps whose gate is a separate control the button
 * stays live and says what is missing instead.
 */
function GateNote({ message }: { message: string }) {
  return (
    <Text
      variant="caption"
      color="danger"
      style={styles.gateNote}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      {message}
    </Text>
  );
}

export function OnboardingFlow() {
  const ob = useOnboardingMock();
  const c = useV2Colors();
  const { t } = useTranslation();
  const [submitPhase, setSubmitPhase] = useState<number | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  /**
   * True until the resume attempt settles. Without it the role screen paints
   * for a beat and is then replaced by step 4 — which reads as the app losing
   * your place and then finding it, the opposite of the reassurance resuming
   * is supposed to give. Web shows "Loading your progress…" for the same
   * reason (`SellerOnboarding.tsx:747`).
   */
  const [resuming, setResuming] = useState(true);
  /** Set by a press that was refused — see `softGate`. */
  const [gateShown, setGateShown] = useState(false);
  /** The consent checkbox, so focus can come back to it when the sheet closes. */
  const termsBoxRef = useRef<View | null>(null);
  const api = useOnboardingApi();

  /**
   * Reopen a half-finished onboarding — the web's `?resume=1`, see `resume.ts`.
   *
   * Runs ONCE on mount and never again: the dependency list is deliberately
   * empty, because `ob` and `api` are new objects every render and including
   * them would re-seed the wizard on each keystroke, dragging the person back
   * to the resume step mid-answer. `loadProgress` never throws and returns
   * `null` whenever there is nothing to restore, so the only job here is to
   * stop showing the spinner.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snapshot = await api.loadProgress();
      if (cancelled) return;
      if (snapshot) ob.restore(snapshot);
      setResuming(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Everything a step save needs, read fresh at the moment of saving. */
  const answers = {
    sellerType: ob.sellerType,
    values: ob.values,
    categories: ob.categories,
    volume: ob.volume,
    calibration: ob.calibration,
  };

  /**
   * Leave a step: save it first, and only advance if the save succeeded.
   * With the API off this is a no-op and the flow behaves as the pure mock.
   */
  const advanceWithSave = async () => {
    if (!ob.canAdvance) {
      ob.next(); // surfaces the field errors
      return;
    }
    const ok = await api.saveStep(ob.current!, answers);
    if (ok) ob.next();
  };

  /**
   * Mock submission. A real one awaits each call; this walks the same phases
   * on a timer so the Timeline can be seen doing its job. Cleared on unmount
   * so a fast back-out cannot set state on a dead component.
   */
  useEffect(() => {
    if (submitPhase === null) return;
    if (submitPhase >= SUBMIT_PHASE_COUNT) {
      /*
        ⚠️ THE COMPLETION FLAG IS AWAITED AND ITS FAILURE IS SURFACED.
        Web swallows this error and redirects anyway, and the dashboard gate
        then bounces the seller straight back into the wizard — a loop with
        nothing on screen explaining it. Here a failure drops back to the last
        step with the message, so "retry" is a real control.
      */
      let cancelled = false;
      void (async () => {
        const ok = await api.finish();
        if (cancelled) return;
        if (ok) ob.setDone(true);
        else setSubmitPhase(null);
      })();
      return () => {
        cancelled = true;
      };
    }
    const id = setTimeout(() => setSubmitPhase((p) => (p ?? 0) + 1), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitPhase]);

  const backGlyph = (onPress: () => void) => (
    <View style={styles.headerRow}>
      {/* `mobile.common.back`, not `common.back`: there is no top-level
          `common` namespace in the locale files, so the old key always missed
          and rendered its English defaultValue in all six languages. */}
      <GlyphButton accessibilityLabel={t('mobile.common.back')} onPress={onPress}>
        <ChevronLeft size={icon.hero} color={c.ink} strokeWidth={1.75} />
      </GlyphButton>
    </View>
  );

  /**
   * Leave the wizard, keeping what has been answered.
   *
   * ⚠️ THIS ACTUALLY SAVES, UNLIKE THE WEB'S BUTTON OF THE SAME NAME.
   * Web's `exitWizard` (`SellerOnboarding.tsx:511`) only navigates — the label
   * is true there purely because every earlier step was saved by its Continue,
   * so the step you are LOOKING at is lost. Here the current step is written
   * first whenever it is complete, which is what "Save & exit" says.
   *
   * An incomplete step is skipped rather than part-written: these answers are
   * single values, so a partial save is not "some progress", it is a wrong
   * answer stored against the account.
   *
   * Only reachable from inside the wizard, i.e. after the account exists —
   * there is nothing to save, and nothing to come back to, before that.
   */
  const saveAndExit = async () => {
    if (ob.canAdvance && ob.current) await api.saveStep(ob.current, answers);
    router.replace(homeRoute());
  };

  /**
   * Help, pointed at the assistant rather than a new support screen.
   *
   * `/v2/chat` already exists, and `CHATBOT_RULES.md`'s care strip gives it a
   * real "Talk to a person" handoff — so this reuses a surface that can
   * actually resolve the question instead of adding another dead FAQ link.
   * `push`, not `replace`: Back must return to the exact step, with answers
   * intact, or "help" costs you the form.
   */
  const openHelp = () => router.push('/v2/chat');

  /** Wizard-only header: Back on the left, the two text ways out on the right. */
  const wizardHeader = (onBackPress: () => void) => (
    <View style={styles.headerRow}>
      <GlyphButton accessibilityLabel={t('mobile.common.back')} onPress={onBackPress}>
        <ChevronLeft size={icon.hero} color={c.ink} strokeWidth={1.75} />
      </GlyphButton>
      <View style={styles.headerActions}>
        <QuietAction label={t(`${T}cta.help`)} onPress={openHelp} />
        <QuietAction label={t(`${T}cta.saveExit`)} onPress={saveAndExit} />
      </View>
    </View>
  );

  // ── Resuming ───────────────────────────────────────────────────────────
  // Held before every other branch so the role screen cannot flash first.
  if (resuming) {
    return (
      <AuthShell mode="signup" segmented={false} testID="v2-onboarding-resuming">
        <View style={styles.outcome}>
          <ActivityIndicator color={c.accent} />
          <Text
            variant="body"
            color="inkMuted"
            style={styles.resumeNote}
            accessibilityLiveRegion="polite"
          >
            {t(`${T}resume.loading`)}
          </Text>
        </View>
      </AuthShell>
    );
  }

  // ── Outcome ────────────────────────────────────────────────────────────
  if (ob.done) {
    const seller = ob.role === 'seller';
    return (
      <AuthShell
        mode="signup"
        segmented={false}
        testID="v2-onboarding-done"
        footer={
          <PrimaryAction
            label={t(seller ? `${T}done.ctaSeller` : `${T}done.ctaBuyer`)}
            onPress={ob.reset}
            testID="v2-onboarding-done-cta"
          />
        }
        footerQuiet={<QuietAction label={t(`${T}done.quietCta`)} onPress={ob.reset} />}
      >
        <View style={styles.outcome}>
          <Text variant="display">
            {t(seller ? `${T}done.titleSeller` : `${T}done.titleBuyer`)}
          </Text>
          <Text variant="lead" color="inkMuted" style={styles.outcomeBody}>
            {t(seller ? `${T}done.bodySeller` : `${T}done.bodyBuyer`)}
          </Text>
          {seller ? (
            <View style={styles.outcomeTimeline}>
              <Timeline
                steps={[
                  { label: t(`${T}done.timelineReview`) },
                  { label: t(`${T}done.timelineEmail`) },
                  { label: t(`${T}done.timelineLive`) },
                ]}
                current={0}
              />
            </View>
          ) : null}
        </View>
      </AuthShell>
    );
  }

  // ── Submitting ─────────────────────────────────────────────────────────
  if (submitPhase !== null) {
    const phases = submitPhases(t);
    const phaseIndex = Math.min(submitPhase, phases.length - 1);
    return (
      <AuthShell
        mode="signup"
        segmented={false}
        title={t(`${T}submit.title`)}
        testID="v2-onboarding-submitting"
        footer={
          <PrimaryAction label={t(`${T}submit.cta`)} onPress={() => {}} loading disabled />
        }
      >
        <Timeline steps={phases} current={phaseIndex} live />
        {/*
          ⚠️ THE TIMELINE IS SILENT. Its container carries `progressbar` +
          `accessibilityValue` (`Timeline.tsx:90`), and RN does NOT announce a
          changed `accessibilityValue` — so the four phases advanced on a 900ms
          timer with nothing spoken, on a screen whose only other control is a
          disabled button. Each row's state is carried by dot size and text
          colour alone, so all four read as four identical strings.

          This line is the spoken channel: one live region naming the phase and
          its position, re-announced each time the phase changes. The
          per-row state labels belong in `Timeline.tsx`, which is shared kit and
          outside this change — see the report.
        */}
        <Text
          variant="caption"
          color="inkMuted"
          style={styles.phaseStatus}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
        >
          {t(`${T}submit.phaseStatus`, {
            current: phaseIndex + 1,
            total: phases.length,
            label: phases[phaseIndex].label,
          })}
        </Text>
      </AuthShell>
    );
  }

  // ── Role choice ────────────────────────────────────────────────────────
  // One select + one CTA, rather than the web's two cards each carrying their
  // own solid "Log in" — two competing primaries on one screen.
  /*
    ── THE ACCOUNT SCREEN ──
    Email, name, phone, password. Deliberately NOT company / tax ID / business
    type / certificate — that is the Guideline 3.1.1 category and it stays on
    the later `__DEV__` steps. This is the same shape `app/(auth)/register.tsx`
    already ships, which is the shape App Review accepted.

    ⚠️ NO EMAIL VERIFICATION STEP. Today's mobile signup is a three-call triad
    with a 6-digit code (`services/auth/register.ts`); `signup-with-link-v2`,
    which the web wizard uses and which this calls, has no equivalent. Shipping
    this as the signup would silently drop in-app verification. Decide before
    it replaces `register.tsx` — see `Docs/v2/authv2/02-account.md`.
  */
  if (ob.roleConfirmed && !ob.accountCreated) {
    return (
      <AccountStep
        ob={ob}
        api={api}
        onBack={ob.reset}
        onCreated={() => {
          // A buyer has no wizard — the account IS the whole signup.
          if (ob.role === 'buyer') ob.setDone(true);
          else ob.setAccountCreated(true);
        }}
      />
    );
  }

  if (!ob.roleConfirmed) {
    return (
      <RoleChoice
        role={ob.role}
        onSelect={ob.setRole}
        /*
          ⚠️ BOTH ROLES go to the account screen. This branch used to read
          `if (role === 'buyer') setDone(true)`, written when there was no
          account screen — and it survived the screen being added, so a buyer
          reached "You're all set to buy" in TWO TAPS having supplied no email,
          no password and no account. The confirmation then told them a link had
          been sent to an address nobody asked for.

          The role fork belongs AFTER the account exists, and it is already
          there: `AccountStep`'s `onCreated` sends a buyer to the outcome and a
          seller into the wizard.
        */
        onContinue={ob.confirmRole}
      />
    );
  }

  // ── Wizard steps ───────────────────────────────────────────────────────
  const rail = <AuthStepRail index={ob.index} total={ob.steps.length} />;
  const onBack = () => {
    setGateShown(false);
    if (!ob.back()) ob.reset();
  };
  const lastStep = ob.index === ob.steps.length - 1;

  /**
   * ⚠️ TWO STEPS KEEP A LIVE BUTTON, BECAUSE A DISABLED ONE IS A DEAD END.
   *
   * On the field steps a blocked Continue calls `ob.next()`, which reveals the
   * field errors — the press explains itself. On `categories` and
   * `calibration` the gate is a SEPARATE control (a pill, a checkbox), so a
   * disabled button gave the user nothing at all: no error, no announcement,
   * just a muted fill. That is colour alone, and a screen reader says only
   * "dimmed", never why. `UX_DESIGN_RULES` — never trap, every error says how
   * to recover. So the press is allowed through and refused out loud.
   */
  const softGate = ob.current === 'categories' || ob.current === 'calibration';
  const gateMessage =
    ob.current === 'categories'
      ? t(`${T}gate.categories`)
      : ob.calibration === null
        ? t(`${T}gate.calibrationAndTerms`)
        : t(`${T}gate.terms`);
  /** Hides itself the moment the gate is satisfied — no stale note to clear. */
  const gateBlocked = gateShown && !ob.canAdvance;

  const footer = (
    <PrimaryAction
      label={t(lastStep ? `${T}cta.submitForReview` : `${T}cta.continue`)}
      disabled={(!softGate && !ob.canAdvance) || api.saving}
      loading={api.saving}
      onPress={() => {
        if (!ob.canAdvance) {
          setGateShown(true);
          return;
        }
        setGateShown(false);
        if (lastStep) {
          // The calibration answer saves first, then the completion sequence —
          // the order the web gets wrong.
          void (async () => {
            const ok = await api.saveStep('calibration', answers);
            if (ok) setSubmitPhase(0);
          })();
        } else {
          void advanceWithSave();
        }
      }}
      testID="v2-onboarding-continue"
    />
  );
  const shell = (title: string, subtitle: string | undefined, body: React.ReactNode, id: string) => (
    <AuthShell
      mode="signup"
      segmented={false}
      compactOnKeyboard
      leading={
        <>
          {wizardHeader(onBack)}
          {rail}
        </>
      }
      title={title}
      subtitle={subtitle}
      footer={footer}
      testID={id}
    >
      {api.error ? (
        <ApiError message={api.error} onRetry={() => void advanceWithSave()} />
      ) : null}
      {body}
    </AuthShell>
  );

  switch (ob.current) {
    case 'sellerType':
      return shell(
        t(`${T}sellerType.title`),
        t(`${T}sellerType.subtitle`),
        <View style={styles.stack}>
          <OptionCard
            selected={ob.sellerType === 'reseller'}
            onSelect={() => ob.setSellerType('reseller')}
            title={t(`${T}sellerType.resellerTitle`)}
            description={t(`${T}sellerType.resellerDescription`)}
            testID="v2-onboarding-type-reseller"
          />
          <OptionCard
            selected={ob.sellerType === 'company'}
            onSelect={() => ob.setSellerType('company')}
            title={t(`${T}sellerType.companyTitle`)}
            description={t(`${T}sellerType.companyDescription`)}
            testID="v2-onboarding-type-company"
          />
        </View>,
        'v2-onboarding-seller-type',
      );

    case 'business':
      return shell(
        t(ob.isReseller ? `${T}business.titleReseller` : `${T}business.titleCompany`),
        t(`${T}business.subtitle`),
        <FieldStack ids={BUSINESS_FIELDS} ob={ob} onSubmit={ob.next} />,
        'v2-onboarding-business',
      );

    case 'location':
      return shell(
        t(`${T}location.title`),
        t(`${T}location.subtitle`),
        <FieldStack ids={LOCATION_FIELDS} ob={ob} onSubmit={ob.next} />,
        'v2-onboarding-location',
      );

    case 'categories':
      return shell(
        t(`${T}categories.title`),
        t(`${T}categories.subtitle`),
        <View style={styles.wrap}>
          {MOCK_CATEGORIES.map((cat) => (
            <PillButton
              key={cat.slug}
              label={cat.name}
              tone="choice"
              role="checkbox"
              selected={ob.categories.includes(cat.slug)}
              onPress={() => ob.toggleCategory(cat.slug)}
              testID={`v2-onboarding-cat-${cat.slug}`}
            />
          ))}
          {gateBlocked ? <GateNote message={gateMessage} /> : null}
        </View>,
        'v2-onboarding-categories',
      );

    case 'volume': {
      // Rebuilt from sellerType at render, never captured: going back and
      // changing the answer must change this copy, or the screen asks one
      // question while recording another.
      const opts = VOLUME_OPTIONS[ob.sellerType ?? 'reseller'];
      return shell(
        t(
          ob.sellerType === 'reseller'
            ? `${T}volume.titleReseller`
            : `${T}volume.titleCompany`,
        ),
        undefined,
        <View style={styles.stack}>
          {opts.map((o) => (
            <OptionCard
              key={o.value}
              selected={ob.volume === o.value}
              onSelect={() => ob.setVolume(o.value)}
              title={t(o.titleKey)}
              description={t(o.descriptionKey)}
              testID={`v2-onboarding-volume-${o.value}`}
            />
          ))}
        </View>,
        'v2-onboarding-volume',
      );
    }

    case 'calibration':
      return shell(
        t(`${T}calibration.title`),
        t(`${T}calibration.subtitle`),
        <View style={styles.stack}>
          {CALIBRATION_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              selected={ob.calibration === o.value}
              onSelect={() => ob.setCalibration(o.value)}
              title={t(o.titleKey)}
              description={t(o.descriptionKey)}
              testID={`v2-onboarding-calib-${o.value}`}
            />
          ))}

          {/* The last step is the submit, so the Platform Terms gate lives
              here — see the note on `termsAccepted` in mockState. */}
          <View style={styles.terms}>
            <SellerTermsRow
              accepted={ob.termsAccepted}
              onToggle={ob.toggleTerms}
              onOpen={() => setTermsOpen(true)}
              boxRef={termsBoxRef}
            />
            {gateBlocked ? <GateNote message={gateMessage} /> : null}
          </View>
          <SellerTermsSheet
            visible={termsOpen}
            onClose={() => {
              setTermsOpen(false);
              /*
                Hand focus back to the control that opened the sheet. Without
                this a screen-reader user lands at the TOP of the calibration
                step and has to traverse the whole thing again to find out the
                box is now ticked. The delay lets the Modal finish dismissing —
                focusing a view behind a sheet that is still on screen is a
                no-op.
              */
              setTimeout(() => {
                const node = findNodeHandle(termsBoxRef.current);
                if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
              }, 250);
            }}
            onAgree={ob.acceptTerms}
          />
        </View>,
        'v2-onboarding-calibration',
      );

    default:
      return null;
  }
}

/**
 * A column of `Field`s for one step.
 *
 * Optional fields say so in the label — three of the five business fields are
 * optional, and an unmarked field reads as required. Errors appear on blur via
 * `errorFor`, or all at once after a failed Continue.
 */
function FieldStack({
  ids,
  ob,
  onSubmit,
}: {
  ids: readonly string[];
  ob: ReturnType<typeof useOnboardingMock>;
  onSubmit: () => void;
}) {
  /**
   * ⚠️ THE FOCUS CHAIN IS NOT OPTIONAL ON THIS FORM.
   *
   * `FORM_INPUT_RULES.md` §4: "Every field in a sequence gets
   * `returnKeyType="next"` and focuses the next one; the last gets
   * `returnKeyType="go"` and submits. Four fields with no `returnKeyType` are
   * four dead ends."
   *
   * Measured on-device 2026-10-05 before this existed: the keyboard's action
   * key read **Done** on field 1 of 5, so reaching field 2 meant dismissing the
   * keyboard, scrolling, and tapping — five times. With the visible slot at
   * 158dp the Next key was the only workable way down the form, and it was not
   * wired.
   */
  const refs = useRef<Record<string, TextInput | null>>({});
  const { t } = useTranslation();

  return (
    <View style={styles.fields}>
      {ids.map((id, i) => {
        const copy = fieldCopy(id, ob.isReseller, t);
        const required = REQUIRED_FIELDS.includes(id);
        const err = ob.errorFor(id);
        const last = i === ids.length - 1;
        return (
          <Field
            key={id}
            ref={(r: TextInput | null) => {
              refs.current[id] = r;
            }}
            /*
              Sentence case, with the modifier quieter than the field name.
              The "(optional)" modifier is interpolated, not concatenated: the
              parenthesis convention and the position of the modifier relative
              to the label differ by language.
            */
            label={required ? copy.label : t(`${T}fields.optionalSuffix`, { label: copy.label })}
            placeholder={copy.placeholder}
            value={ob.values[id] ?? ''}
            onChangeText={(v) => ob.setValue(id, v)}
            onBlur={() => ob.touch(id)}
            maxLength={copy.max}
            keyboardType={copy.keyboard}
            autoComplete={copy.autoComplete}
            autoCapitalize={copy.autoCapitalize ?? 'sentences'}
            returnKeyType={last ? 'go' : 'next'}
            blurOnSubmit={last}
            onSubmitEditing={() => {
              if (last) onSubmit();
              else refs.current[ids[i + 1]]?.focus();
            }}
            help={err ? t(err.key, err.params) : undefined}
            invalid={!!err}
            testID={`v2-onboarding-field-${id}`}
          />
        );
      })}
    </View>
  );
}

/**
 * Copy per account field. Autofill tokens per `FORM_INPUT_RULES.md` §1.
 *
 * ⚠️ BUILT FROM `t` AT RENDER, not a module const — same freeze-at-import
 * problem as `submitPhases`. The password LABEL reuses `mobile.auth.password`,
 * which already exists in all six locale files with exactly this copy; the
 * rest are this flow's own.
 */
function accountCopy(t: TFunction): Record<
  string,
  {
    label: string;
    placeholder: string;
    /** A rule that must survive typing — a placeholder disappears on keystroke 1. */
    help?: string;
    secure?: boolean;
    keyboard?: 'email-address' | 'phone-pad';
    autoComplete?: string;
    max: number;
  }
> {
  const a = (k: string) => t(`${T}account.${k}`);
  return {
    email: {
      label: a('email.label'),
      placeholder: a('email.placeholder'),
      keyboard: 'email-address',
      autoComplete: 'email',
      max: 254,
    },
    fullName: {
      label: a('fullName.label'),
      placeholder: a('fullName.placeholder'),
      autoComplete: 'name',
      max: 100,
    },
    phone: {
      label: a('phone.label'),
      placeholder: a('phone.placeholder'),
      keyboard: 'phone-pad',
      autoComplete: 'tel',
      max: 20,
    },
    password: {
      label: t('mobile.auth.password'),
      placeholder: a('password.placeholder'),
      // The rule lived in the placeholder, so it vanished on the first keystroke
      // — i.e. it was gone for everyone who had started typing a password that
      // breaks it. `help` persists. `FORM_INPUT_RULES.md` §3.
      help: a('password.help'),
      secure: true,
      // ⚠️ `new-password` on BOTH, so the OS offers to generate and never
      // autofills the existing password into a signup.
      autoComplete: 'new-password',
      max: 72,
    },
    confirmPassword: {
      label: a('confirmPassword.label'),
      placeholder: a('confirmPassword.placeholder'),
      secure: true,
      autoComplete: 'new-password',
      max: 72,
    },
  };
}

function AccountStep({
  ob,
  api,
  onBack,
  onCreated,
}: {
  ob: ReturnType<typeof useOnboardingMock>;
  api: ReturnType<typeof useOnboardingApi>;
  onBack: () => void;
  onCreated: () => void;
}) {
  const c = useV2Colors();
  const { t, i18n } = useTranslation();
  const refs = useRef<Record<string, TextInput | null>>({});
  const copyFor = accountCopy(t);
  const seller = ob.role === 'seller';
  /**
   * ONE piece of state for BOTH password fields — the behaviour `Field.tsx`
   * documents at `RevealToggle`. Revealing only one of a password/confirm pair
   * leaves the single question the pair exists to answer unanswerable.
   *
   * Before this neither field had a toggle at all, so "Passwords do not match"
   * was a dead end: no way to see either value, so the only recovery was to
   * clear both and retype. That is a memory test, which is what WCAG 2.2
   * SC 3.3.8 is about.
   */
  const [reveal, setReveal] = useState(false);

  const submit = async () => {
    if (!ob.accountValid) {
      ob.revealErrors();
      return;
    }
    const name = (ob.values.fullName ?? '').trim();
    const [first, ...rest] = name.split(/\s+/);
    const ok = await api.createAccount({
      email: (ob.values.email ?? '').trim(),
      password: ob.values.password ?? '',
      first_name: first || name,
      // The API wants two fields; a single-word name becomes both, as on web.
      last_name: rest.join(' ') || first || name,
      phone: ob.values.phone ?? '',
      role: ob.role ?? 'buyer',
      // The user's language, not a hardcoded 'en' — the web's bug. `i18n`'s
      // resolved code, so a Thai seller's transactional mail is Thai.
      lang: i18n.resolvedLanguage ?? i18n.language ?? 'en',
    });
    if (ok) onCreated();
  };

  return (
    <AuthShell
      mode="signup"
      segmented={false}
      compactOnKeyboard
      eyebrow={t(seller ? `${T}account.eyebrowSeller` : `${T}account.eyebrowBuyer`)}
      title={t(`${T}account.title`, { brand: BRAND })}
      subtitle={t(`${T}account.subtitle`)}
      leading={
        <View style={styles.headerRow}>
          {/* `mobile.common.back` — see the note in `backGlyph`. */}
          <GlyphButton accessibilityLabel={t('mobile.common.back')} onPress={onBack}>
            <ChevronLeft size={icon.hero} color={c.ink} strokeWidth={1.75} />
          </GlyphButton>
        </View>
      }
      testID="v2-onboarding-account"
      footer={
        <PrimaryAction
          label={t(seller ? `${T}account.ctaSeller` : `${T}account.ctaBuyer`)}
          disabled={!ob.accountValid || api.saving}
          loading={api.saving}
          onPress={() => void submit()}
          testID="v2-onboarding-account-cta"
        />
      }
    >
      {api.error ? <ApiError message={api.error} onRetry={() => void submit()} /> : null}

      <View style={styles.fields}>
        {ACCOUNT_FIELDS.map((id, i) => {
          const copy = copyFor[id];
          const err = ob.accountErrorFor(id);
          const last = i === ACCOUNT_FIELDS.length - 1;
          return (
            <Field
              key={id}
              ref={(r: TextInput | null) => {
                refs.current[id] = r;
              }}
              label={copy.label}
              placeholder={copy.placeholder}
              value={ob.values[id] ?? ''}
              onChangeText={(v) => ob.setValue(id, v)}
              onBlur={() => ob.touch(id)}
              secureTextEntry={copy.secure && !reveal}
              trailing={
                copy.secure ? (
                  <RevealToggle on={reveal} onToggle={() => setReveal((v) => !v)} />
                ) : undefined
              }
              keyboardType={copy.keyboard}
              autoComplete={copy.autoComplete as never}
              autoCapitalize={id === 'fullName' ? 'words' : 'none'}
              maxLength={copy.max}
              returnKeyType={last ? 'go' : 'next'}
              blurOnSubmit={last}
              onSubmitEditing={() => {
                if (last) void submit();
                else refs.current[ACCOUNT_FIELDS[i + 1]]?.focus();
              }}
              help={err ? t(err.key, err.params) : copy.help}
              invalid={!!err}
              testID={`v2-onboarding-acct-${id}`}
            />
          );
        })}
      </View>

      <Text variant="caption" color="inkMuted" style={styles.legal}>
        {t(`${T}account.legal`, { brand: BRAND })}
      </Text>
    </AuthShell>
  );
}

function RoleChoice({
  role,
  onSelect,
  onContinue,
}: {
  role: 'buyer' | 'seller' | null;
  onSelect: (r: 'buyer' | 'seller') => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AuthShell
      mode="signup"
      segmented={false}
      eyebrow={t(`${T}role.eyebrow`)}
      title={t(`${T}role.title`, { brand: BRAND })}
      subtitle={t(`${T}role.subtitle`)}
      testID="v2-onboarding-role"
      footer={
        <PrimaryAction
          label={t(`${T}cta.continue`)}
          disabled={role === null}
          onPress={onContinue}
          testID="v2-onboarding-role-continue"
        />
      }
    >
      <View style={styles.stack}>
        <OptionCard
          selected={role === 'buyer'}
          onSelect={() => onSelect('buyer')}
          title={t(`${T}role.buyerTitle`)}
          description={t(`${T}role.buyerDescription`)}
          testID="v2-onboarding-role-buyer"
        />
        <OptionCard
          selected={role === 'seller'}
          onSelect={() => onSelect('seller')}
          title={t(`${T}role.sellerTitle`)}
          description={t(`${T}role.sellerDescription`)}
          testID="v2-onboarding-role-seller"
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', marginTop: space.md },
  stack: { gap: space.lg },
  /** Categories wrap; `PillButton` carries its own 44pt-safe height. */
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  /**
   * Group-to-group gap. Measured before this: 48dp above the first label and
   * 14dp between groups — the pad above was 3.4× the pad between, so the first
   * field read as detached and the rest as one crowded block.
   */
  fields: { gap: space['2xl'] },
  /** Space, not a hairline — the terms are a separate decision from the answer. */
  terms: { marginTop: space.xl },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: CARD_PAD,
    marginBottom: space.xl,
    gap: space.sm,
  },
  legal: { marginTop: space.xl },
  /** Sits with the control it is about, matching `Field`'s own help spacing. */
  gateNote: { marginTop: space.md },
  phaseStatus: { marginTop: space.xl },
  outcome: { gap: space.md },
  resumeNote: { marginTop: space.md, textAlign: 'center' },
  /**
   * Back on the left, the two text actions pushed to the right. `space-between`
   * rather than a spacer View so the row still reads correctly when the back
   * glyph is absent (the first wizard step renders one anyway, but the outcome
   * and resume screens do not mount this row at all).
   */
  headerActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.lg,
  },
  outcomeBody: { marginTop: space.xs },
  outcomeTimeline: { marginTop: space['3xl'] },
});
