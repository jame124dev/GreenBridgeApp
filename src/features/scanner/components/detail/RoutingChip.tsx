import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { brand } from '@/constants/theme';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import {
  CLEARED_CATEGORY_FORM_FIELDS,
  deriveRoutingState,
  routingWhyLine,
  signalFromDraft,
} from '@/features/scanner/routing/routingState';
import { useSupportedMarketplaces } from '@/features/scanner/routing/useSupportedMarketplaces';
import type { DetailFormInput } from '@/features/scanner/schema';
import { haptics } from '@/lib/haptics';
import type { DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';

import { FieldLabel } from './FieldLabel';
import { MarketplaceSheet } from './MarketplaceSheet';

/**
 * The three display bands for `site_type_confidence`.
 *
 * ⛔ This is the ONLY place in the app that compares the confidence number to
 * anything, and it picks a WORD — it changes no state, blocks nothing and routes
 * nothing. plan §2.1 forbids a behavioural threshold in v1 because any cut-off
 * would be calibrated on zero logged agreement observations. If you are about to
 * write `if (state.confidence > 0.8)` in a branch that decides something, three
 * tests will stop you: marketplaceUnlock's "a low confidence number alone does
 * NOT change any mapped field", and routingState's "never flips the trigger" /
 * "never changes the state".
 */
const CONFIDENCE_BAND = {
  high: { key: 'mobile.detail.routing.confHigh', en: 'High' },
  medium: { key: 'mobile.detail.routing.confMedium', en: 'Medium' },
  low: { key: 'mobile.detail.routing.confLow', en: 'Low' },
} as const;

const band = (c: number): keyof typeof CONFIDENCE_BAND =>
  c >= 0.85 ? 'high' : c >= 0.6 ? 'medium' : 'low';

interface Props {
  draft: DraftItem;
  /**
   * Persist the seller's answer. `detail.tsx` passes
   * `(m) => patch({ marketplace: m, marketplaceConfirmed: true, ...cleared })`;
   * `grouped-edit.tsx` passes the `patchQueuedItem(index, …)` equivalent.
   * The chip does NOT reach into the store itself — one write path per screen.
   */
  onConfirm: (marketplace: MarketplaceKey) => void;
}

/**
 * The routing confirmation, as a chip above IdentityCard (plan §6.1).
 *
 * THREE states, per plan §2.2:
 *   confirmed + prefill    — "WE'LL LIST THIS ON · 101LAB", quiet "Change"
 *   confirmed + no prefill — same, plus "Category: not set — pick one below"
 *   ask                    — a question, NOTHING pre-selected, and an
 *                            instructive CTA that names the action
 *
 * Stitch 4a/4b supply the product logic (the statement, the WHY line, the
 * "we won't guess" promise, the instructive CTA, best-guess-first). Styling is
 * this repo's: the container class is byte-identical to IdentityCard's, and every
 * value comes from `constants/theme.ts` via the `brand-*` Tailwind aliases. The
 * Stitch mocks use a 4/8/16/24/32 spacing scale and nine font sizes that this
 * app does not have; reconciling the two scales is a separate, unapproved task.
 *
 * ⚠️ This component writes `marketplace` ONLY from `onPress` inside the sheet.
 * Never move that into a `watch` effect — see the hydration-race note in
 * useDetailController.
 */
export function RoutingChip({ draft, onConfirm }: Props) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<DetailFormInput>();
  const supported = useSupportedMarketplaces();
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = watch('marketplace');
  const state = deriveRoutingState({
    current,
    confirmed: draft.marketplaceConfirmed !== false,
    signal: signalFromDraft(draft),
    supported,
  });

  // One marketplace on offer ⇒ nothing to confirm, nothing to change. The chip
  // disappears entirely and the screen is 1.0.3. This is also the fail-closed
  // path (offline / 404 / cold cache).
  if (supported.length <= 1) return null;

  const labelFor = (m: MarketplaceKey) =>
    MARKETPLACE_OPTIONS.find((o) => o.value === m)?.label ?? m;
  // Integration C7 — Phase 5's ONE description string, ONE key, ONE home.
  const descriptionFor = (m: MarketplaceKey) => {
    const o = MARKETPLACE_OPTIONS.find((x) => x.value === m);
    if (!o) return '';
    return t(`mobile.detail.marketplaceOption.${m}.description`, {
      defaultValue: o.description,
    });
  };

  const pick = (m: MarketplaceKey) => {
    // Identical contract to the pre-unlock MarketplaceCard onPress: a REAL user
    // switch invalidates the marketplace-specific category/subcategory and any
    // "Other" brand. Done here, on the tap — NOT in a watch-effect.
    //
    // ⚠️ blocker (c): these setValue calls are NOT sufficient on the single path.
    // `onConfirm` -> `patch()` gives `current` a new object identity, which
    // re-fires useDetailController's `reset(draftToFormValues(draft))` and writes
    // the STORE's categoryId back over whatever we set here. The store patch in
    // `onConfirm` is what actually clears it. These calls still matter on
    // `grouped-edit.tsx`, which has NO reset effect (its useForm sets
    // defaultValues once), so the form there would otherwise keep showing the
    // old category until Save.
    setValue('marketplace', m, { shouldValidate: false });
    if (m !== current) {
      for (const [k, v] of Object.entries(CLEARED_CATEGORY_FORM_FIELDS)) {
        setValue(k as keyof DetailFormInput, v as never, { shouldValidate: false });
      }
    }
    onConfirm(m);
  };

  const sheet = (
    <MarketplaceSheet
      visible={sheetOpen}
      supported={supported}
      value={state.kind === 'ask' ? null : current}
      suggested={state.suggested}
      onSelect={pick}
      onClose={() => setSheetOpen(false)}
    />
  );

  // ── ASK ──────────────────────────────────────────────────────────────────
  if (state.kind === 'ask') {
    return (
      <View
        className="bg-brand-warning-bg border border-brand-warning-border rounded-sm p-2xl gap-sm"
        accessibilityRole="summary"
      >
        <View className="flex-row items-center gap-1.5">
          <MaterialIcons name="help-outline" size={16} color={brand.warningText} />
          <Text className="font-heading-semi text-3xl text-brand-foreground" style={{ flex: 1 }}>
            {t('mobile.detail.routing.askTitle', {
              defaultValue: "We're not sure where this belongs",
            })}
          </Text>
        </View>

        <Text className="font-sans text-lg text-brand-text-muted">
          {t('mobile.detail.routing.askBody', {
            defaultValue: "Pick a marketplace and we'll load the right categories.",
          })}
        </Text>

        {state.suggested ? (
          <Text className="font-sans text-md text-brand-text-muted">
            {t('mobile.detail.routing.askGuess', {
              defaultValue: 'Our best guess is {{marketplace}}.',
              marketplace: labelFor(state.suggested),
            })}
          </Text>
        ) : null}

        {/* Instructive primary — Stitch 4b's "Choose a marketplace to continue".
            It is a real Pressable, not a disabled-looking button, because
            tapping it must DO the thing it names: a dead control is what
            UX_DESIGN_RULES.md's "every action provides feedback" rules out.
            minHeight, not height — Thai and Vietnamese labels wrap. */}
        <Pressable
          onPress={() => {
            haptics.tap();
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.detail.routing.askCta', {
            defaultValue: 'Choose a marketplace to continue',
          })}
          style={({ pressed }) => ({
            marginTop: 4,
            minHeight: 48,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? brand.primaryDim : brand.primary,
          })}
        >
          <Text className="font-semi text-2xl" style={{ color: brand.primaryForeground }}>
            {t('mobile.detail.routing.askCta', {
              defaultValue: 'Choose a marketplace to continue',
            })}
          </Text>
        </Pressable>

        <Text className="font-sans text-md text-brand-text-muted">
          {t('mobile.detail.routing.setOnce', {
            defaultValue: "Category and currency are set once you choose — we won't guess them.",
          })}
        </Text>

        {sheet}
      </View>
    );
  }

  // ── CONFIRMED ────────────────────────────────────────────────────────────
  const why = routingWhyLine(draft);

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <View className="flex-row items-center justify-between gap-sm">
        {/* minW-0 so a long marketplace label truncates instead of shoving
            "Change" off the row. */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel
            text={t('mobile.detail.routing.willListOn', { defaultValue: "WE'LL LIST THIS ON" })}
            ai
          />
          <View className="flex-row items-center gap-xs" style={{ marginTop: 2 }}>
            {/* Marketplace identity as a DOT, never a filled background — the
                statement must not read as a status chip. */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: brand.primaryDim,
              }}
            />
            <Text
              className="font-heading text-4xl text-brand-foreground"
              numberOfLines={1}
              style={{ flex: 1, minWidth: 0 }}
            >
              {labelFor(current)}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          hitSlop={12}
          accessibilityLabel={t('mobile.detail.routing.change', { defaultValue: 'Change' })}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text className="font-semi text-lg" style={{ color: brand.primaryDim }}>
            {t('mobile.detail.routing.change', { defaultValue: 'Change' })}
          </Text>
        </Pressable>
      </View>

      <Text className="font-sans text-md text-brand-text-muted">{descriptionFor(current)}</Text>

      {/* Confidence: word AND number, so the word translates and the number
          still reads in TH/VI/ZH/JA. Renders ONLY when the server supplied it —
          a persisted pre-S0-2 draft has null, and a made-up percentage is worse
          than none. */}
      {state.confidence != null ? (
        <Text className="font-sans text-md text-brand-text-muted">
          {t('mobile.detail.routing.confidence', {
            defaultValue: 'AI confidence: {{word}} · {{pct}}%',
            // Each band carries its OWN English fallback. The plan's snippet
            // passed `defaultValue: 'High'` for all three, so a missing
            // confMedium/confLow key would have rendered a LOW score as "High"
            // — a wrong number-word pair, which is worse than no word.
            word: t(CONFIDENCE_BAND[band(state.confidence)].key, {
              defaultValue: CONFIDENCE_BAND[band(state.confidence)].en,
            }),
            pct: Math.round(state.confidence * 100),
          })}
        </Text>
      ) : null}

      {why ? (
        <View className="gap-1.5" style={{ marginTop: 2 }}>
          <FieldLabel text={t('mobile.detail.routing.why', { defaultValue: 'WHY' })} />
          <Text className="font-sans text-md text-brand-text-muted">
            {t(why.key, {
              defaultValue:
                why.key === 'mobile.detail.routing.whyNameplate'
                  ? 'Nameplate reads "{{identity}}".'
                  : 'No brand or model was legible in the photos.',
              identity: why.identity,
            })}
          </Text>
        </View>
      ) : null}

      {/* "Not set" instead of a guess — plan §2.2 row 3 / §4.1. Says WHY the
          field is empty, so an empty required field reads as a decision rather
          than a bug. The CLEAR itself happens in the store (lock 2 / lock 3 /
          onConfirm); this line is only the explanation. */}
      {!state.prefillCategory && !watch('categoryId') ? (
        <Text className="font-sans text-md" style={{ color: brand.warningText, marginTop: 2 }}>
          {t('mobile.detail.routing.categoryNotSet', {
            defaultValue: 'Category: not set — pick one below. We would rather ask than guess.',
          })}
        </Text>
      ) : null}

      {sheet}
    </View>
  );
}
