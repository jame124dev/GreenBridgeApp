import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useUserProfile } from '@/features/auth/useUserProfile';
import { readCachedLocation } from '@/features/location/pickupStore';
import { INSTALLATION_OPTIONS } from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import { haptics } from '@/lib/haptics';
import {
  getDeviceLocation,
  hasLocationPermission,
} from '@/services/location/getDeviceLocation';
import { useScanDraft } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { CountryPicker } from './CountryPicker';
import { FieldLabel } from './FieldLabel';

const iconInputCls =
  'flex-row items-center gap-sm bg-brand-surface border border-brand-border-strong rounded-xs px-md';
const iconInputFieldCls = 'flex-1 py-2.5 font-sans text-xl text-brand-foreground';

/**
 * Pickup location list + country + marketplace + installation.
 *
 * S6.2.b2.i — converted to NativeWind. The per-row layout stays as nested
 * Views; remove-button hitslop kept inline. Installation segmented + marketplace
 * pill row both className-driven.
 */
export function LocationCard() {
  const { t } = useTranslation();
  const { control, setValue, watch } = useFormContext<DetailFormInput>();
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
  }, [setValue, userProfile.data]);

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

  const rowCount = Math.max(locations.length, locationCountries.length, 1);

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
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
            <MaterialIcons name="my-location" size={16} color={brand.primary} />
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
          <View className={iconInputCls}>
            <MaterialIcons name="location-on" size={20} color={brand.placeholder} />
            <TextInput
              className={iconInputFieldCls}
              value={locations[index] ?? ''}
              onChangeText={(v) => updateRow(index, 'address', v)}
              placeholder={t('mobile.detail.addressPlaceholder')}
              placeholderTextColor={brand.placeholder}
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
                <MaterialIcons name="close" size={18} color={brand.placeholder} />
              </Pressable>
            ) : null}
          </View>
          {/* W4 (scan_v3): country is now a sheet-picker, not free-text.
              The Pressable mimics the existing iconInput shell so the visual
              rhythm with the address row above stays intact. */}
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
            <MaterialIcons name="public" size={20} color={brand.placeholder} />
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
            <MaterialIcons name="expand-more" size={20} color={brand.placeholder} />
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={addRow}
        className="flex-row items-center justify-center gap-1.5 border border-brand-border-strong border-dashed rounded-xs py-2.5"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.detail.addLocation', { defaultValue: 'Add another location' })}
      >
        <MaterialIcons name="add" size={18} color={brand.primary} />
        <Text className="font-label text-lg text-brand-primary">
          {t('mobile.detail.addLocation', { defaultValue: 'Add another location' })}
        </Text>
      </Pressable>

      <Controller
        control={control}
        name="installation"
        render={({ field: { onChange } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionInstallation', { defaultValue: 'INSTALLATION' })} />
            <View className="flex-row gap-1.5">
              {INSTALLATION_OPTIONS.map((opt) => {
                const active = installation === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    className={`flex-1 py-2.5 rounded-xs border items-center ${
                      active ? 'bg-brand-primary border-brand-primary' : 'border-brand-border-strong'
                    }`}
                    onPress={() => {
                      haptics.tap();
                      onChange(opt.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={opt.label}
                  >
                    <Text
                      className={`font-label-medium text-lg ${active ? 'text-brand-primary-foreground' : 'text-brand-text-muted'}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {installation ? (
              <Text className="font-sans text-sm text-brand-text-muted mt-xs">
                {INSTALLATION_OPTIONS.find((o) => o.value === installation)?.hint}
              </Text>
            ) : null}
          </View>
        )}
      />

      {/* W4 (scan_v3): country sheet-picker, opened from the per-row country
          row. Single instance — the active row index lives in component state. */}
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
  );
}
