/**
 * 7e — Review · location. Step 4 of 4, and the one that carries publish.
 *
 * Shape, top to bottom (docs/v2-design/screens/7e.html):
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [←]  Review your item                        Draft     │
 *   │  STEP 4 OF 4 · LOCATION                        100%     │
 *   │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁      │
 *   └─────────────────────────────────────────────────────────┘
 *   LOCATION                            ( ⌖ Use my location )
 *   [ 📍  Rawalpindi, Punjab                              ]
 *   [ 🌐  Pakistan                                      ⌄ ]
 *   ( + Add another location )
 *   ─────────────────────────────────────────────────────────
 *   INSTALLATION
 *   ( Installed )  ( ✓ Deinstalled )
 *   Ready to ship today.
 *   ─────────────────────────────────────────────────────────
 *   ┌ soft green panel ───────────────────────────────────────┐
 *   │  ✓  Everything required is complete                     │
 *   │     You can submit whenever you are ready.              │
 *   └─────────────────────────────────────────────────────────┘
 *   ┌ footer ─────────────────────────────────────────────────┐
 *   │  (       Save to my inventory       →       )           │
 *   │  (        Submit for listing                )  ← only  │
 *   │                                  when canSubmitListing() │
 *   └─────────────────────────────────────────────────────────┘
 *
 *   ⚠️ The canvas drew "Save as draft | Submit listing". Changed 2026-10-06 by
 *   `todo/PRIVATE_INVENTORY_WORKORDER.md` §4.1: the flow ends in the inventory
 *   for everyone; submitting is the second, gated action.
 *
 * ── THE BANNER IS A VERDICT, SO IT HAS TO BE ABLE TO SAY NO ──────────────
 *
 * The canvas draws only the happy half: "Everything required is complete."
 * With real drafts that is often false — a missing title, an unanswered
 * marketplace, no price — and a banner that says "complete" over a draft
 * Submit will reject is the kind of small lie that costs trust in the whole
 * screen. So it has two states off ONE derivation (`wizardState.stepCompletion`,
 * which buckets the shipped `detailSchema` rows onto the four steps): the drawn
 * green verdict, or a quiet neutral panel that NAMES the step, says what it
 * wants, and offers the trip back. That is the "error recovery with a next
 * step" rule, and it is why the panel is not decorative.
 *
 * ── LOCATION IS A LIST, NOT A FIELD ─────────────────────────────────────
 *
 * `locations[]` and `locationCountries[]` are PARALLEL arrays and `detailSchema`
 * asserts their lengths match, so every add and remove writes both. The address
 * input is multiline for a reason found on device: a geocoded line ("Ashiyana …
 * ganj, Lucknow, Uttar Pradesh, 226022") overflows one line, and Android
 * scrolls a single-line input to the caret — so the field opened showing the
 * MIDDLE of the address with the house number off the left edge.
 *
 * ── DATA & WRITES ───────────────────────────────────────────────────────
 *
 * Reads the real draft via `wizardState.useReviewItem()`. Address text commits
 * on blur (`patchQueuedItem` writes the whole session to MMKV synchronously —
 * per keystroke that is a disk write per letter); taps commit immediately.
 * All of that is device-local.
 *
 * ⚠️ PUBLISH IS INERT. `Submit listing` is drawn, gated and pressable, and it
 * writes NOTHING: the server call creates real listings on a live backend.
 * The press does the local commit, then says plainly that nothing was sent —
 * see `TODO(v2-writes)` on `onSubmit`. "Save as draft" is the same story.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Globe,
  LocateFixed,
  MapPin,
  Plus,
  X,
} from 'lucide-react-native';

import {
  PillButton,
  SoftPanel,
  EmptyState,
  Field,
  GlyphButton,
  Hairline,
  PrimaryAction,
  QuietAction,
  Screen,
  SectionNote,
  Text,
  Timeline,
  MaterialFill,
} from '@/features/v2/ui';
import {
  GUTTER,
  control,
  icon,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';
import { CountryPicker } from '@/features/scanner/components/detail/CountryPicker';
import { INSTALLATION_OPTIONS } from '@/features/scanner/constants';
import { getDeviceLocation } from '@/services/location/getDeviceLocation';
import type { DraftItem, InstallationMode } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';

import { Eyebrow, StepHeader } from '@/features/v2/scan/review/reviewKit';
import {
  TIMELINE_STEPS,
  allStepsComplete,
  firstIncompleteStep,
  reviewStepHref,
  reviewStepIndex,
  reviewStepLabel,
  stepCompletion,
  stepNeeds,
  useReviewItem,
  type ReviewStep,
} from '@/features/v2/scan/review/wizardState';
import { useInventoryEnding } from '@/features/v2/scan/review/useInventoryEnding';

const THIS_STEP = 'location' as const;
const STEP_INDEX = reviewStepIndex(THIS_STEP);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Keep a parallel array exactly as long as the list it shadows. */
function padTo(source: readonly string[], length: number): string[] {
  return Array.from({ length }, (_, i) => source[i] ?? '');
}

// ── A local primitive: the read-only row that opens a picker ───────────────

/**
 * `Field` shaped, but it opens a sheet instead of a keyboard — the country row
 * here, and the category row on 7c.
 *
 * The kit's `Field` is a `TextInput` and has no picker variant, which is a KIT
 * GAP reported with the build. Free text was the pre-`CountryPicker` shape and
 * produced "USA", "U.S.A." and "united states" in the same column.
 */
function PickerRow({
  value,
  placeholder,
  glyph,
  accessibilityLabel,
  onPress,
  testID,
}: {
  value: string;
  placeholder: string;
  glyph: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  const filled = value.trim().length > 0;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={filled ? { text: value } : undefined}
      style={[styles.pickerRow, { backgroundColor: c.surface }, animatedStyle]}
    >
      <MaterialFill role="surface" ink="ink" radius={radius.xl} />
      {glyph}
      <Text
        variant="action"
        color={filled ? 'ink' : 'inkDisabled'}
        numberOfLines={1}
        style={styles.pickerValue}
      >
        {filled ? value : placeholder}
      </Text>
      <ChevronDown size={icon.lg} color={c.inkSubtle} strokeWidth={1.8} />
    </AnimatedPressable>
  );
}

// ── The screen ─────────────────────────────────────────────────────────────

type LocateState = { busy: boolean; error: string | null };

export default function V2ReviewLocation() {
  const c = useV2Colors();
  const { index, item, total, patch } = useReviewItem();

  /**
   * Address text lives here until blur, for the same MMKV reason as 7d's price
   * field. Seeded once so a re-render cannot yank the caret mid-word; always at
   * least one row, because the drawing shows one and an empty list has nothing
   * to type into.
   */
  const [addresses, setAddresses] = useState<string[]>(() =>
    item?.locations.length ? [...item.locations] : [''],
  );
  const [countryRow, setCountryRow] = useState<number | null>(null);
  const [locate, setLocate] = useState<LocateState>({ busy: false, error: null });
  /**
   * The ending: "Save to my inventory" for everyone, "Submit for listing" for a
   * seller who may publish (work order §4.1). Both submit endpoints, both gates
   * and the readiness sweep still live in `usePublishDraft`, underneath.
   */
  const { t } = useTranslation();
  const ending = useInventoryEnding();
  const { publish } = ending;

  const countries = useMemo(
    () => padTo(item?.locationCountries ?? [], addresses.length),
    [item?.locationCountries, addresses.length],
  );

  /**
   * The draft as it stands RIGHT NOW, including text not yet committed.
   *
   * The banner and the Submit gate both read completion off this rather than
   * off the stored draft — otherwise typing the last required address leaves
   * the verdict saying "incomplete" until the field happens to lose focus, and
   * Submit stays disabled while the screen shows a filled-in form.
   */
  const liveItem: DraftItem | null = useMemo(
    () => (item ? { ...item, locations: addresses, locationCountries: countries } : null),
    [item, addresses, countries],
  );

  const completion = useMemo(() => stepCompletion(liveItem), [liveItem]);
  const ready = allStepsComplete(completion);
  const blocking: ReviewStep | null = firstIncompleteStep(completion);

  const commitAddresses = () => {
    if (!item) return;
    patch({ locations: addresses, locationCountries: padTo(countries, addresses.length) });
  };

  const setRow = (i: number, value: string) => {
    setAddresses((prev) => prev.map((a, n) => (n === i ? value : a)));
  };

  const addRow = () => {
    haptics.tap();
    const nextAddresses = [...addresses, ''];
    setAddresses(nextAddresses);
    patch({ locations: nextAddresses, locationCountries: padTo(countries, nextAddresses.length) });
  };

  const removeRow = (i: number) => {
    haptics.tap();
    const nextAddresses = addresses.filter((_, n) => n !== i);
    const nextCountries = countries.filter((_, n) => n !== i);
    setAddresses(nextAddresses);
    patch({ locations: nextAddresses, locationCountries: nextCountries });
  };

  const pickCountry = (value: string) => {
    if (countryRow === null) return;
    haptics.tap();
    const next = countries.map((cc, n) => (n === countryRow ? value : cc));
    // Addresses go with it: `patch` replaces whole arrays, and sending only the
    // countries would drop any address typed since the last commit.
    patch({ locations: addresses, locationCountries: next });
  };

  /**
   * GPS into row 1.
   *
   * Failure is NOT an alert. The address field is right there and typing is a
   * perfectly good answer, so the reason and the retry sit under the row and
   * the person can simply carry on — an alert would demand a dismissal first.
   */
  const useMyLocation = async () => {
    haptics.tap();
    setLocate({ busy: true, error: null });
    const res = await getDeviceLocation();
    if (!res.ok) {
      setLocate({
        busy: false,
        error:
          res.reason === 'denied'
            ? 'Location access is off for this app. Type the pickup address instead, or turn it on in Settings.'
            : 'We could not read your location. Check that GPS is on, or type the pickup address.',
      });
      haptics.error();
      return;
    }
    const nextAddresses = addresses.length > 0 ? [...addresses] : [''];
    nextAddresses[0] = res.location.address;
    const nextCountries = padTo(countries, nextAddresses.length);
    nextCountries[0] = res.location.country;
    setAddresses(nextAddresses);
    patch({ locations: nextAddresses, locationCountries: nextCountries });
    setLocate({ busy: false, error: null });
    haptics.success();
  };

  const onInstallation = (next: InstallationMode) => {
    haptics.tap();
    patch({ installation: next });
  };

  const onBack = () => {
    commitAddresses();
    haptics.tap();
    router.back();
  };

  const onGoToStep = (step: ReviewStep) => {
    commitAddresses();
    haptics.tap();
    router.push(reviewStepHref(step, index));
  };

  /**
   * Not gated on `ready`: an incomplete item belongs in the inventory too —
   * that is where the seller finishes it later. Commit first, for the same
   * reason as Submit below: the save reads the STORE.
   */
  const onSaveToInventory = () => {
    commitAddresses();
    ending.saveToInventory();
  };

  const onSubmit = () => {
    // COMMIT FIRST. `addresses` is local text state and the sweep inside
    // `publish()` reads the STORE — without this, a seller who types their
    // address and taps Submit without blurring the field is told the listing
    // "needs a pickup address" they can see on screen.
    commitAddresses();
    ending.submitForListing();
  };

  const header = (
    <StepHeader step={THIS_STEP} itemIndex={index} itemTotal={total} onBack={onBack} />
  );

  /**
   * The same header WITHOUT the step counter, percentage and bar.
   *
   * A cold open is not "step N of 4" — there is nothing to be N of. With
   * the progress chrome on, this screen read "75%" above "there is no item
   * to review": the interface claiming progress it has not made.
   */
  const headerNoProgress = (
    <StepHeader step={THIS_STEP} itemIndex={index} itemTotal={total} onBack={onBack} progress={false} />
  );

  // A cold open — deep link, or a restart with nothing persisted.
  if (!item) {
    return (
      <Screen header={headerNoProgress} tabBar={false} testID="v2-review-location">
        <EmptyState
          title="Nothing to review yet"
          body="This is where a scan lands once the AI has read it. Scan an item and the four review steps open with it."
          actionLabel="Scan an item"
          onAction={() => router.replace(routes.v2Camera)}
          secondaryLabel="Back to home"
          onSecondary={() => router.replace(routes.v2Home)}
        />
      </Screen>
    );
  }

  const installation = item.installation;
  const installationHint = INSTALLATION_OPTIONS.find((o) => o.value === installation)?.hint;

  const railSteps = TIMELINE_STEPS.map((s, i) =>
    i === STEP_INDEX
      ? { ...s, detail: stepNeeds(liveItem, THIS_STEP) ?? 'Nothing left on this step' }
      : s,
  );

  return (
    <Screen
      header={header}
      tabBar={false}
      testID="v2-review-location"
      footer={
        <View style={styles.footer}>
          {/*
            The one green pill on the last step, and the ending for everyone —
            saving needs no approval, so it cannot refuse anyone (§4.1).
          */}
          <PrimaryAction
            label={
              ending.isSaving
                ? t('mobile.scanv2.inventory.saving', { defaultValue: 'Saving…' })
                : t('mobile.scanv2.inventory.saveButton', { defaultValue: 'Save to my inventory' })
            }
            onPress={onSaveToInventory}
            disabled={ending.isSaving || publish.isPending}
            icon={<ArrowRight size={icon.md} color={c.onAccent} strokeWidth={2} />}
            style={styles.footerAction}
            testID="v2-review-location-save"
          />
          {/*
            The second action, beneath — only for a seller who may publish.
            Disabled while anything required is missing (the panel above names
            the step), and while the POST is in flight: a second tap would
            publish the same draft twice. The hook guards it too.
          */}
          {ending.canSubmit ? (
            <PrimaryAction
              variant="tinted"
              label={
                publish.isPending
                  ? t('mobile.scanv2.inventory.submitting', { defaultValue: 'Submitting…' })
                  : t('mobile.scanv2.inventory.submitButton', { defaultValue: 'Submit for listing' })
              }
              onPress={onSubmit}
              disabled={!ready || ending.isSaving || publish.isPending}
              style={styles.footerAction}
              testID="v2-review-location-submit"
            />
          ) : null}
        </View>
      }
    >
      {/*
        The four steps. `live={false}` — nothing is progressing on its own; the
        person is the one moving. On `base` rather than inside the header sheet
        because the rail's connector is `fill`, a ~1.02:1 step against `wash`.
      */}
      <View style={styles.timeline}>
        <Timeline steps={railSteps} current={STEP_INDEX} live={false} />
      </View>
      <Hairline inset="gutter" />

      {/* ── Location ── */}
      <View style={styles.firstSection}>
        <Eyebrow
          label="Location"
          trailing={
            <PillButton
              label={locate.busy ? 'Finding you…' : 'Use my location'}
              tone="soft"
              disabled={locate.busy}
              onPress={useMyLocation}
              glyph={<LocateFixed size={icon.sm} color={c.accentInk} strokeWidth={2} />}
              accessibilityHint="Fills the first pickup address from your phone's location"
              testID="v2-review-location-gps"
            />
          }
        />

        <View style={styles.rows}>
          {addresses.map((address, i) => (
            <View key={`row-${i}`} style={styles.locationGroup}>
              {i > 0 ? (
                <Text variant="eyebrow" color="inkSubtle">
                  {`Additional location ${i + 1}`}
                </Text>
              ) : null}

              <Field
                value={address}
                onChangeText={(t) => setRow(i, t)}
                onBlur={commitAddresses}
                placeholder="Street, district, city"
                // Multiline, and NOT because the address is long-form: Android
                // scrolls a single-line input to the caret, which hid the start
                // of every geocoded address behind the left edge.
                multiline
                numberOfLines={2}
                submitBehavior="blurAndSubmit"
                autoComplete="postal-address"
                textContentType="fullStreetAddress"
                leading={<MapPin size={icon.lg} color={c.inkSubtle} strokeWidth={1.8} />}
                trailing={
                  i > 0 ? (
                    <GlyphButton
                      accessibilityLabel={`Remove additional location ${i + 1}`}
                      onPress={() => removeRow(i)}
                    >
                      <X size={icon.lg} color={c.inkSubtle} strokeWidth={1.8} />
                    </GlyphButton>
                  ) : null
                }
                accessibilityLabel={i === 0 ? 'Pickup address' : `Pickup address ${i + 1}`}
                testID={`v2-review-location-address-${i}`}
              />

              <PickerRow
                value={countries[i] ?? ''}
                placeholder="Select country"
                glyph={<Globe size={icon.lg} color={c.inkSubtle} strokeWidth={1.8} />}
                accessibilityLabel={i === 0 ? 'Country' : `Country for location ${i + 1}`}
                onPress={() => setCountryRow(i)}
                testID={`v2-review-location-country-${i}`}
              />
            </View>
          ))}

          {locate.error ? (
            <SectionNote tone="danger" actionLabel="Try again" onAction={useMyLocation}>
              {locate.error}
            </SectionNote>
          ) : null}

          <PillButton
            label="Add another location"
            tone="ghost"
            onPress={addRow}
            glyph={<Plus size={icon.md} color={c.accentInk} strokeWidth={2} />}
            accessibilityHint="Adds a second pickup address for this item"
            testID="v2-review-location-add"
          />
        </View>
      </View>

      <View style={styles.break}>
        <Hairline inset="gutter" />
      </View>

      {/* ── Installation ── */}
      <View style={styles.section}>
        <Eyebrow label="Installation" />
        <View style={styles.pillRow}>
          {INSTALLATION_OPTIONS.map((opt) => (
            <PillButton
              key={opt.value}
              label={opt.label}
              selected={installation === opt.value}
              onPress={() => onInstallation(opt.value)}
              testID={`v2-review-location-install-${opt.value}`}
            />
          ))}
        </View>
        {/*
          The hint is the consequence, not a restatement of the label: this
          choice is what the backend stores as `operation_status[]`, and it is
          what tells a buyer whether they have to send someone to uninstall it.
        */}
        {installationHint ? (
          <Text variant="caption" color="inkMuted" style={styles.hint}>
            {installationHint}
          </Text>
        ) : null}
      </View>

      <View style={styles.break}>
        <Hairline inset="gutter" />
      </View>

      {/* ── The verdict ── */}
      <View style={styles.verdictSection}>
        <SoftPanel ground={ready ? 'wash' : 'surface'}>
          <View style={styles.verdictRow}>
            {ready ? (
              <CircleCheck size={icon['2xl']} color={c.accent} strokeWidth={2} />
            ) : (
              <CircleAlert size={icon['2xl']} color={c.inkSubtle} strokeWidth={2} />
            )}
            <View style={styles.verdictText}>
              <Text variant="rowTitle">
                {ready
                  ? 'Everything required is complete'
                  : `${reviewStepLabel(blocking ?? THIS_STEP)} still needs something`}
              </Text>
              <Text variant="caption" color="inkMuted" style={styles.verdictSub}>
                {ready
                  ? ending.canSubmit
                    ? t('mobile.scanv2.inventory.verdictCanSubmit', {
                        defaultValue: 'Submit it for listing now, or keep it in your inventory.',
                      })
                    : t('mobile.scanv2.inventory.verdictSaveOnly', {
                        defaultValue: "Save it to your inventory. You choose what to list once you're approved.",
                      })
                  : (stepNeeds(liveItem, blocking ?? THIS_STEP) ??
                    'Open the step to see what is missing.')}
              </Text>
            </View>
          </View>

          {/* The trip back. One control, and it names where it goes. */}
          {!ready && blocking && blocking !== THIS_STEP ? (
            <QuietAction
              label={`Go to ${reviewStepLabel(blocking)}`}
              onPress={() => onGoToStep(blocking)}
              tone="accent"
              variant="captionMedium"
              align="start"
              testID="v2-review-location-goto"
            />
          ) : null}
        </SoftPanel>

        {/*
          A publish that did not happen, and why. Two different failures, two
          different messages — an item that is not ready is the seller's to fix
          and names the step; a server failure is not, and says nothing was
          sent so they do not publish twice.
        */}
        {publish.blocked ? (
          <View style={styles.submitNotice}>
            <SectionNote
              tone="danger"
              actionLabel={`Go to ${reviewStepLabel(publish.blocked.step)}`}
              onAction={() => {
                const b = publish.blocked;
                if (!b) return;
                publish.clear();
                router.push(reviewStepHref(b.step, b.itemIndex < 0 ? index : b.itemIndex));
              }}
            >
              {publish.blocked.itemTotal > 1
                ? `Item ${publish.blocked.itemIndex + 1} of ${publish.blocked.itemTotal} is not ready — ${publish.blocked.needs.toLowerCase()}.`
                : `${publish.blocked.needs}.`}
            </SectionNote>
          </View>
        ) : publish.error ? (
          <View style={styles.submitNotice}>
            <SectionNote tone="danger" actionLabel="Dismiss" onAction={publish.clear}>
              {publish.error}
            </SectionNote>
          </View>
        ) : null}
      </View>

      {/*
        The shipped 95-country sheet. Still drawn in old-UI tokens, like the
        `SignInPrompt` mounted in `app/v2/_layout.tsx` — TODO(v2-design): it
        wants the kit, not a one-off restyle here. Free text was the shape
        before it and produced "USA", "U.S.A." and "united states" in one column.
      */}
      <CountryPicker
        visible={countryRow !== null}
        value={countryRow !== null ? (countries[countryRow] ?? '') : ''}
        onSelect={pickCountry}
        onClose={() => setCountryRow(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeline: { paddingHorizontal: GUTTER, paddingBottom: space['7xl'] },
  firstSection: { paddingHorizontal: GUTTER, paddingTop: space['7xl'] },
  section: { paddingHorizontal: GUTTER },
  verdictSection: { paddingHorizontal: GUTTER },
  break: { marginVertical: space['7xl'] },

  // ── location rows ──
  rows: { gap: space.xl },
  locationGroup: { gap: space.md },
  pickerRow: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    minHeight: control.input,
    paddingHorizontal: space['3xl'],
    borderRadius: radius.xl,
  },
  pickerValue: { flex: 1, minWidth: 0 },

  // ── installation ──
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  hint: { marginTop: space['2xl'] },

  // ── verdict ──
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  verdictText: { flex: 1, minWidth: 0 },
  verdictSub: { marginTop: space.xxs },
  submitNotice: { paddingTop: space.md },

  // ── footer ──
  // A column, not a row: "Save to my inventory" and "Submit for listing" are
  // both too long to share a 390pt line without truncating.
  footer: { gap: space.sm },
  footerAction: { borderRadius: radius.pill },
});
