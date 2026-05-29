import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet, Text } from '@/components/ui';
import { COUNTRY_OPTIONS } from '@/features/scanner/constants/countries';
import { brand } from '@/constants/theme';

interface Props {
  visible: boolean;
  /** Currently-selected country (drives the radio-active state). */
  value?: string;
  onSelect: (country: string) => void;
  onClose: () => void;
}

/**
 * W4 (scan_v3) — search-filter country picker for `LocationCard`. Replaces
 * the free-text TextInput per-row country with a dropdown over the 95-country
 * list ported from web. Built on the existing `Sheet` + `Sheet.Option`
 * primitive so the visual matches other pickers (language, marketplace).
 *
 * Web parity: the dropdown UI in `ReviewSubmitScreen.tsx:842-865`. Web uses
 * MUI Select; mobile uses a bottom-sheet with search-on-top — comparable
 * UX on touch.
 */
export function CountryPicker({ visible, value, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={t('mobile.detail.selectCountry', { defaultValue: 'Select country' })}
      subtitle={t('mobile.detail.selectCountrySubtitle', {
        defaultValue: 'Where will buyers pick up this item?',
      })}
      snapTo="80%"
    >
      <View className="px-lg pt-sm pb-sm">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.detail.countrySearchPlaceholder', {
            defaultValue: 'Search…',
          })}
          placeholderTextColor={brand.placeholder}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          className="bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground"
          accessibilityLabel={t('mobile.detail.countrySearchPlaceholder', {
            defaultValue: 'Search…',
          })}
        />
      </View>

      {filtered.length === 0 ? (
        <View className="px-lg py-md">
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.detail.countrySearchEmpty', {
              defaultValue: 'No countries match "{{q}}"',
              q: query,
            })}
          </Text>
        </View>
      ) : (
        filtered.map((country) => (
          <Sheet.Option
            key={country}
            label={country}
            active={country === value}
            onPress={() => {
              setQuery('');
              onSelect(country);
              onClose();
            }}
          />
        ))
      )}
    </Sheet>
  );
}
