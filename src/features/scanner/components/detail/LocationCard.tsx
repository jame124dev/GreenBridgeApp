import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useUserProfile } from '@/features/auth/useUserProfile';
import { readCachedLocation } from '@/features/location/pickupStore';
import { INSTALLATION_OPTIONS } from '@/features/scanner/constants';
import { countryFlagEmoji } from '@/features/scanner/countryFlag';
import type { DetailFormInput } from '@/features/scanner/schema';
import { haptics } from '@/lib/haptics';
import {
  getDeviceLocation,
  hasLocationPermission,
} from '@/services/location/getDeviceLocation';
import { useScanDraft } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { CountryPicker } from './CountryPicker';
import { FieldGroup } from './SectionBand';
import { FieldLabel } from './FieldLabel';
import { OptionSheet } from './OptionSheet';
import { PickerRow } from './PickerRow';
import { ICON } from './metrics';
import { locationErrorAt } from './locationErrors';

const iconInputCls =
  'flex-row items-center gap-sm bg-brand-surface border border-brand-border-strong rounded-xs px-md';
const iconInputFieldCls = 'flex-1 py-2.5 font-sans text-xl text-brand-foreground';

/**
 * Pickup location list + country + marketplace + installation.
 *
 * S6.2.b2.i — converted to NativeWind. The per-row layout stays as nested
 * Views; remove-button hitslop kept inline. Installation segmented + marketplace
 * pill row both className-driven.
 *
 * `variant` (default `'draft'` — existing behaviour, byte-for-byte):
 *   'edit' is the published-listing editor (`app/(lab)/listing-edit.tsx`).
 *   The v1 edit contract carries ONE `location` string and no country, and the
 *   listing already has an address, so in that variant the card
 *     - skips the empty-state autofill effect. In the draft flow "no address
 *       yet" means "guess one from GPS/profile"; on a published listing the
 *       same code would silently overwrite the seller's real pickup address
 *       (an INSTANT-apply field) with wherever the phone happens to be.
 *     - renders a single address row and hides "Add another location".
 *     - hides the country picker, because a country change could not be sent
 *       and an input whose value is discarded is worse than no input.
 */
export function LocationCard({ variant = 'draft' }: { variant?: 'draft' | 'edit' } = {}) {
  const isEdit = variant === 'edit';
  const { t } = useTranslation();
  const { control, setValue, watch, formState } = useFormContext<DetailFormInput>();

  /*
    E.3 — the address row is the ONE required field on this form that rendered
    no error of its own. Title, description, category, condition and price each
    show their message inline; location showed nothing, so a seller whose
    address failed validation got a red LOCATION chip in the footer and an alert
    listing field names, and then landed on a field that looked perfectly fine.

    It is a plain `TextInput` rather than a `Controller` (it writes through
    `updateRow`, which keeps the address and country arrays the same length), so
    there is no `fieldState` to read — the issue has to be pulled off
    `formState.errors` by index. That mapping lives in `locationErrors.ts`
    rather than here, because rendering this card needs the device-location
    service, the user profile and the draft store, and the mapping needs none of
    them: extracted, it is covered by `__tests__/locationErrors.test.ts` against
    the real schema and resolver.
  */
  const errorForRow = (index: number) => locationErrorAt(formState.errors, index);
  const [locating, setLocating] = useState(false);
  // W4 (scan_v3): which row's country picker is open. `null` = closed.
  const [countryPickerRow, setCountryPickerRow] = useState<number | null>(null);

  const locations = watch('locations');
  const locationCountries = watch('locationCountries');
  const installation = watch('installation');

  // W7 (scan_v3) — W8 profile-address fallback. When neither the draft, the
  // cached pickup location, nor a fresh device-GPS reading produces an
  // address, fall back to the seller's saved profile address (web parity
  // with `NewSubmissionUploadPage.tsx:191-222`).
  const userProfile = useUserProfile();

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    (async () => {
      const cur = useScanDraft.getState().current;
      if (cur && cur.locations.length > 0 && cur.locations[0].trim()) return;

      const cached = readCachedLocation();
      if (cached?.address || cached?.country) {
        setValue('locations', [cached.address ?? ''], { shouldValidate: true });
        setValue('locationCountries', [cached.country ?? ''], { shouldValidate: true });
        return;
      }

      // Try device GPS. If it returns a usable location, prefer it.
      if (await hasLocationPermission()) {
        const res = await getDeviceLocation();
        if (cancelled) return;
        if (res.ok) {
          setValue('locations', [res.location.address], { shouldValidate: true });
          setValue('locationCountries', [res.location.country], { shouldValidate: true });
          return;
        }
      }

      // W7/W8 — last resort: pull from the seller's profile address. The
      // profile query is cached in React Query so this read is non-blocking
      // for repeat visits; on a fresh login it may be undefined and the
      // effect will short-circuit, falling back to manual entry.
      const profileAddr = userProfile.data?.personalInfo.address;
      if (cancelled || !profileAddr) return;
      const street = profileAddr.street?.trim() ?? '';
      const city = profileAddr.city?.trim() ?? '';
      const composed = [street, city].filter((s) => s.length > 0).join(', ');
      const country = profileAddr.country?.trim() ?? '';
      if (composed || country) {
        setValue('locations', [composed], { shouldValidate: true });
        setValue('locationCountries', [country], { shouldValidate: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, setValue, userProfile.data]);

  const useMyLocation = async () => {
    haptics.tap();
    setLocating(true);
    try {
      const res = await getDeviceLocation();
      if (res.ok) {
        const nextLocs = locations.length > 0 ? [...locations] : [''];
        const nextCountries =
          locationCountries.length > 0 ? [...locationCountries] : [''];
        nextLocs[0] = res.location.address;
        nextCountries[0] = res.location.country;
        setValue('locations', nextLocs, { shouldValidate: true });
        setValue('locationCountries', nextCountries, { shouldValidate: true });
      } else if (res.reason === 'denied') {
        Alert.alert(
          t('mobile.detail.locationDeniedTitle', { defaultValue: 'Location permission needed' }),
          t('mobile.detail.locationDeniedBody', {
            defaultValue: 'Enable location access in Settings to auto-fill the pickup address.',
          }),
        );
      } else {
        Alert.alert(
          t('mobile.detail.locationUnavailableTitle', { defaultValue: "Couldn't get location" }),
          t('mobile.detail.locationUnavailableBody', {
            defaultValue: 'Make sure location/GPS is on, then try again.',
          }),
        );
      }
    } finally {
      setLocating(false);
    }
  };

  const updateRow = (index: number, key: 'address' | 'country', value: string) => {
    if (key === 'address') {
      const next = [...locations];
      next[index] = value;
      setValue('locations', next, { shouldValidate: true });
    } else {
      const next = [...locationCountries];
      next[index] = value;
      setValue('locationCountries', next, { shouldValidate: true });
    }
  };

  const addRow = () => {
    haptics.tap();
    setValue('locations', [...locations, ''], { shouldValidate: false });
    setValue('locationCountries', [...locationCountries, ''], { shouldValidate: false });
  };

  const removeRow = (index: number) => {
    haptics.tap();
    setValue(
      'locations',
      locations.filter((_, i) => i !== index),
      { shouldValidate: true },
    );
    setValue(
      'locationCountries',
      locationCountries.filter((_, i) => i !== index),
      { shouldValidate: true },
    );
  };

  const rowCount = isEdit ? 1 : Math.max(locations.length, locationCountries.length, 1);

  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const installOptions = INSTALLATION_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(`mobile.detail.installOption.${opt.value}.label`, opt.label),
    // The buyer-facing promise, shown in the sheet AS WELL as under the row.
    // "Ready to ship today" is a commitment published to buyers (see the note
    // below), so it has to be readable at the moment of choosing, not only
    // afterwards.
    description: t(`mobile.detail.installOption.${opt.value}.hint`, opt.hint),
  }));
  const installLabel = installation
    ? installOptions.find((o) => o.value === installation)?.label ?? ''
    : '';

  return (
    <FieldGroup>
      {/* The address rows, "Use my location" and "Add another location" are ONE
          group: they are all the same answer, repeated. Installation is the
          second child, so the hairline falls where the question changes. */}
      <View className="gap-sm">
      <View className="flex-row items-center justify-between">
        <FieldLabel text={t('mobile.detail.sectionLocation')} required />
        <Pressable
          onPress={useMyLocation}
          disabled={locating}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.detail.useMyLocation', { defaultValue: 'Use my location' })}
          className="flex-row items-center gap-xs px-sm py-xs rounded-pill bg-brand-primary-surface"
        >
          {locating ? (
            <ActivityIndicator size="small" color={brand.primary} />
          ) : (
            <MaterialIcons name="my-location" size={ICON.adornment} color={brand.primary} />
          )}
          <Text className="font-semi text-sm text-brand-primary">
            {t('mobile.detail.useMyLocation', { defaultValue: 'Use my location' })}
          </Text>
        </Pressable>
      </View>

      {Array.from({ length: rowCount }).map((_, index) => (
        <View key={`loc-${index}`} className="gap-xs">
          {index > 0 ? (
            <Text
              className="font-label text-sm text-brand-text-muted"
              style={{ letterSpacing: 0.5 }}
            >
              {t('mobile.detail.additionalLocation', {
                defaultValue: 'Additional location #{{n}}',
                n: index + 1,
              })}
            </Text>
          ) : null}
          <View
            className={iconInputCls}
            /* 1.4.1 — the message below carries the meaning; the red rim is a
               second, redundant cue, never the only one. */
            style={errorForRow(index) ? { borderColor: brand.destructive } : undefined}
          >
            <MaterialIcons name="location-on" size={ICON.field} color={brand.placeholder} />
            {/* MULTILINE for the same reason the title is: a geocoded address
                ("Ashiyana … ganj, Lucknow, Uttar Pradesh, 226022") overflows a
                single line, and Android scrolls a single-line TextInput to the
                caret — so the field opened showing the MIDDLE of the address with
                the house and street scrolled off the left. The seller could not
                see where they were saying the item was. */}
            <TextInput
              className={iconInputFieldCls}
              value={locations[index] ?? ''}
              onChangeText={(v) => updateRow(index, 'address', v)}
              placeholder={t('mobile.detail.addressPlaceholder')}
              placeholderTextColor={brand.placeholder}
              multiline
              numberOfLines={2}
              submitBehavior="blurAndSubmit"
              textAlignVertical="top"
              /* Programmatic invalid state, so a screen reader is told the
                 field is wrong rather than only shown it. `aria-invalid` is
                 the prop React Native actually supports — there is no
                 `accessibilityInvalid`. */
              aria-invalid={errorForRow(index) !== undefined}
              accessibilityLabel={t('mobile.detail.addressPlaceholder')}
            />
            {index > 0 ? (
              <Pressable
                onPress={() => removeRow(index)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.detail.removeLocation', {
                  defaultValue: 'Remove location',
                })}
                className="px-xs"
              >
                <MaterialIcons name="close" size={ICON.adornment} color={brand.placeholder} />
              </Pressable>
            ) : null}
          </View>
          {/* Directly under the field it is about — not in the footer, not in
              an alert. Both of those already exist and neither tells the
              seller WHICH of several address rows is the problem. */}
          {errorForRow(index) ? (
            <Text className="font-sans text-md text-brand-destructive" style={{ marginTop: 2 }}>
              {errorForRow(index)}
            </Text>
          ) : null}
          {/* W4 (scan_v3): country is now a sheet-picker, not free-text.
              The Pressable mimics the existing iconInput shell so the visual
              rhythm with the address row above stays intact.
              Hidden in the 'edit' variant — country is not an editable field in
              the v1 listing-edit contract. */}
          {isEdit ? null : (
          <Pressable
            className={iconInputCls}
            style={{ marginTop: 6, minHeight: 44 }}
            onPress={() => setCountryPickerRow(index)}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.detail.countryPlaceholder', {
              defaultValue: 'Select country',
            })}
            accessibilityValue={
              locationCountries[index]?.trim()
                ? { text: locationCountries[index] }
                : undefined
            }
          >
            {/*
              The REAL national flag, as every address / phone-number picker
              does it — not the generic `MaterialIcons "public"` globe that used
              to sit here. That glyph is a filled circle with the meridians
              knocked OUT, so at 20px the knockouts fall under a pixel and it
              renders as a grey smudge beside the crisp pin above it.

              `lineHeight` is not optional: Android clips the top of an emoji
              laid out at its own font size. The fixed `width` keeps "India"
              aligned with the address text above whichever branch renders.
            */}
            {countryFlagEmoji(locationCountries[index]) ? (
              <Text style={{ fontSize: 18, lineHeight: 23, width: 20 }}>
                {countryFlagEmoji(locationCountries[index])}
              </Text>
            ) : (
              /* Unresolvable name (or nothing chosen yet) has no flag — a
                 monochrome stand-in, never a blank gutter. */
              <MaterialIcons name="flag" size={ICON.field} color={brand.placeholder} />
            )}
            <View className={iconInputFieldCls} style={{ justifyContent: 'center' }}>
              <Text
                className={
                  locationCountries[index]?.trim()
                    ? 'font-sans text-xl text-brand-foreground'
                    : 'font-sans text-xl text-brand-placeholder'
                }
                numberOfLines={1}
              >
                {locationCountries[index]?.trim() ||
                  t('mobile.detail.countryPlaceholder')}
              </Text>
            </View>
            {/*
              `chevron-right`, NOT `expand-more`. A down-chevron is a promise
              that the thing below it expands in place; this row opens a bottom
              sheet, which is exactly what Category, Condition and Installation
              do — and all three show a right-chevron (`PickerRow`). Two glyphs
              for one behaviour on one screen made the country row read as a
              different KIND of control than it is.
            */}
            <MaterialIcons name="chevron-right" size={ICON.field} color={brand.placeholder} />
          </Pressable>
          )}
        </View>
      ))}

      {isEdit ? null : (
      <Pressable
        onPress={addRow}
        /*
          SOLID border, not dashed. A dashed box is the convention for a DROP
          TARGET — somewhere you put a file — which is exactly how `PhotosCard`
          and `DocumentsCard` use it on this same form. Adding a second address
          is an ordinary action, so it gets an ordinary button.
        */
        className="flex-row items-center justify-center gap-1.5 border border-brand-border-strong rounded-xs py-2.5"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.detail.addLocation', { defaultValue: 'Add another location' })}
      >
        <MaterialIcons name="add" size={ICON.adornment} color={brand.primary} />
        <Text className="font-label text-lg text-brand-primary">
          {t('mobile.detail.addLocation', { defaultValue: 'Add another location' })}
        </Text>
      </Pressable>
      )}

      {/* W4 (scan_v3): country sheet-picker, opened from the per-row country
          row. Single instance — the active row index lives in component state.
          Inside the address group rather than beside it: a portal has no row of
          its own, and as a sibling of the groups it would leave `FieldGroup`
          ruling a hairline off empty space. */}
      <CountryPicker
        visible={countryPickerRow !== null}
        value={
          countryPickerRow !== null
            ? (locationCountries[countryPickerRow] ?? '')
            : ''
        }
        onSelect={(country) => {
          if (countryPickerRow !== null) {
            updateRow(countryPickerRow, 'country', country);
          }
        }}
        onClose={() => setCountryPickerRow(null)}
      />
      </View>

      <Controller
        control={control}
        name="installation"
        render={({ field: { onChange } }) => (
          <View>
            <PickerRow
              label={t('mobile.detail.sectionInstallation', { defaultValue: 'INSTALLATION' })}
              value={installLabel}
              placeholder={t('mobile.detail.installationNotSet', {
                defaultValue: 'Not set — is it still installed?',
              })}
              valueLines={1}
              testID="picker-row-installation"
              onPress={() => setInstallSheetOpen(true)}
            >
            {installation ? (
              /*
                ⚠️ SAID TO BE A PROMISE, NOT A HINT.

                "Ready to ship today" was rendered as plain muted helper text,
                indistinguishable from the placeholder guidance elsewhere on
                this form — but it is a commitment published to buyers, derived
                from a toggle labelled "Deinstalled", which does not obviously
                mean "ships today". A seller could make that promise without
                ever registering that they had.

                The attribution is one line and fixes it: the sentence is
                unchanged, but the seller now knows who reads it.
              */
              <View className="flex-row items-center gap-xs mt-xs">
                {/* The eye carries "this is what buyers are told" without
                    spending words on it — the screen is already text-heavy.

                    MaterialIcons `visibility`, not lucide's `Eye`: lucide draws
                    STROKES and MaterialIcons draws FILLS, so a lucide glyph
                    among thirty filled ones reads thinner and lighter than its
                    neighbours no matter what size it is given. It was also the
                    smallest mark on the form at 13px. */}
                <MaterialIcons name="visibility" size={ICON.inline} color={brand.textMuted} />
                <Text className="flex-1 font-sans text-sm text-brand-text-muted">
                  {t(
                    `mobile.detail.installOption.${installation}.hint`,
                    INSTALLATION_OPTIONS.find((o) => o.value === installation)?.hint ?? '',
                  )}
                </Text>
              </View>
            ) : null}
            </PickerRow>
            <OptionSheet
              visible={installSheetOpen}
              title={t('mobile.detail.selectInstallationTitle', {
                defaultValue: 'Installation',
              })}
              options={installOptions}
              selected={installation ?? ''}
              onSelect={(v) => {
                haptics.tap();
                onChange(v);
              }}
              onClose={() => setInstallSheetOpen(false)}
            />
          </View>
        )}
      />
    </FieldGroup>
  );
}
