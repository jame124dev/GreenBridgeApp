import { Alert, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useScanDraft } from '@/stores/scanDraftStore';
import type { BatchVisibility } from '@/types/batch';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

const VISIBILITY_OPTIONS: {
  key: BatchVisibility;
  labelKey: string;
  hintKey: string;
  defaultLabel: string;
  defaultHint: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  {
    key: 'PUBLIC',
    labelKey: 'mobile.detail.visibilityPublic',
    hintKey: 'mobile.detail.visibilityPublicHint',
    defaultLabel: 'Public',
    defaultHint: 'Visible on the marketplace',
    icon: 'public',
  },
  {
    key: 'PRIVATE',
    labelKey: 'mobile.detail.visibilityPrivate',
    hintKey: 'mobile.detail.visibilityPrivateHint',
    defaultLabel: 'Private',
    defaultHint: 'Only you can see this batch',
    icon: 'visibility-off',
  },
  {
    key: 'NETWORK',
    labelKey: 'mobile.detail.visibilityNetwork',
    hintKey: 'mobile.detail.visibilityNetworkHint',
    defaultLabel: 'Network',
    defaultHint: 'Selected buyers only',
    icon: 'hub',
  },
];

/**
 * Per-listing visibility (single mode only). Network requires web — show
 * an explanatory alert rather than enabling a half-supported flow on mobile.
 *
 * S7 — labels + hints + Alert + section heading routed through `t()` with
 * `defaultValue` fallbacks. Pressable carries accessibilityRole + label.
 */
export function VisibilityCard() {
  const { t } = useTranslation();
  const visibility = useScanDraft((s) => s.current?.visibility ?? 'PUBLIC');
  const patch = useScanDraft((s) => s.patch);

  const selectVisibility = (key: BatchVisibility) => {
    if (key === 'NETWORK') {
      Alert.alert(
        t('mobile.detail.visibilityNetworkAlertTitle', { defaultValue: 'Network visibility' }),
        t('mobile.detail.visibilityNetworkAlertBody', {
          defaultValue:
            'Assigning network buyers is available on the web dashboard for now. Choose Public or Private, or set Network on web after submit.',
        }),
      );
      return;
    }
    patch({ visibility: key });
  };

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <FieldLabel
        text={t('mobile.detail.sectionVisibility', { defaultValue: 'LISTING VISIBILITY' })}
      />
      <View className="gap-1.5">
        {VISIBILITY_OPTIONS.map((opt) => {
          const active = visibility === opt.key;
          const label = t(opt.labelKey, { defaultValue: opt.defaultLabel });
          return (
            <Pressable
              key={opt.key}
              className={`border rounded-sm p-md gap-xs ${
                active ? 'border-brand-primary border-2 bg-brand-primary-surface' : 'border-brand-border-strong'
              }`}
              onPress={() => selectVisibility(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <View className="flex-row justify-between items-start">
                <MaterialIcons
                  name={opt.icon}
                  size={22}
                  color={active ? brand.primary : brand.textMuted}
                />
                {active ? (
                  <MaterialIcons name="check-circle" size={18} color={brand.primary} />
                ) : null}
              </View>
              <Text
                className={`font-heading-semi text-xl ${active ? 'text-brand-primary' : 'text-brand-foreground'}`}
              >
                {label}
              </Text>
              <Text className="font-sans text-base text-brand-text-muted">
                {t(opt.hintKey, { defaultValue: opt.defaultHint })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
