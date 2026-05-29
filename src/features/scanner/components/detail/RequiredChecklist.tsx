import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  CONDITION_LABELS,
} from '@/features/scanner/constants';
import { getRequiredStatus } from '@/features/scanner/requiredStatus';
import type { DetailFormInput } from '@/features/scanner/schema';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import type { DraftItem } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

const STEP_DONE = brand.primaryDim;
const STEP_PENDING = brand.tertiaryDim;

interface Props {
  draft: DraftItem;
}

/**
 * Live REQUIRED checklist — amber while incomplete, green when all rows pass.
 *
 * S6.2.b2.i — converted to NativeWind. STEP_DONE / STEP_PENDING are kept as
 * local constants (formerly re-exported from styles.ts) — they're not raw
 * style objects, just brand-token aliases used inline on the MaterialIcons
 * color prop.
 */
export function RequiredChecklist({ draft }: Props) {
  const { t } = useTranslation();
  const { watch } = useFormContext<DetailFormInput>();
  const formValues = watch();
  const categories = useLabCategories(formValues.marketplace);

  const required = getRequiredStatus(formValues, draft.photos?.length ?? 0);
  const allRequired = required.allComplete;
  const categoryLabel = categories.data?.options.find(
    (o) => o.id === formValues.categoryId,
  )?.label;
  const pricePerUnitValue = formValues.pricePerUnit ?? '';

  // When all required rows pass, collapse to a single compact green strip —
  // the user no longer needs the row-by-row breakdown.
  if (allRequired) {
    return (
      <View className="flex-row items-center gap-sm rounded-sm border bg-brand-success-bg border-brand-success-border px-md py-2.5">
        <MaterialIcons name="check-circle" size={20} color={STEP_DONE} />
        <Text className="flex-1 font-label text-md text-brand-tertiary-foreground" style={{ letterSpacing: 0.8 }}>
          {t('mobile.detail.required.header_complete')}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-sm border p-2xl gap-1.5 bg-brand-tertiary-surface border-brand-tertiary-dim">
      <View className="flex-row items-center justify-between mb-1.5">
        <Text
          className="font-label text-md text-brand-tertiary-foreground"
          style={{ letterSpacing: 0.8 }}
        >
          {t('mobile.detail.required.header_inprogress', {
            done: required.doneCount,
            total: required.total,
          })}
        </Text>
        <View className="flex-row items-center gap-xs">
          <View className="rounded-full bg-brand-primary" style={{ width: 8, height: 8 }} />
          <Text className="font-label text-brand-tertiary-foreground" style={{ fontSize: 10 }}>
            {t('mobile.detail.required.liveBadge', { defaultValue: 'LIVE' })}
          </Text>
        </View>
      </View>

      <ChecklistRow
        done={required.rows.photos}
        label={t('mobile.detail.required.photos')}
        detail={
          required.rows.photos
            ? t('mobile.detail.required.photosDetail_some', { count: draft.photos.length })
            : t('mobile.detail.required.photosDetail_empty')
        }
      />
      <ChecklistRow
        done={required.rows.title}
        label={t('mobile.detail.required.title')}
        detail={
          required.rows.title
            ? (formValues.title ?? '').trim()
            : t('mobile.detail.required.titleDetail_empty')
        }
      />
      <ChecklistRow
        done={required.rows.description}
        label={t('mobile.detail.required.description')}
        detail={
          required.rows.description
            ? t('mobile.detail.required.done')
            : t('mobile.detail.required.descriptionDetail_empty')
        }
      />
      <ChecklistRow
        done={required.rows.category}
        label={t('mobile.detail.required.category')}
        detail={
          required.rows.category
            ? (categoryLabel ?? t('mobile.detail.required.done'))
            : t('mobile.detail.required.categoryDetail_empty')
        }
      />
      <ChecklistRow
        done={required.rows.condition}
        label={t('mobile.detail.required.condition')}
        detail={
          required.rows.condition
            ? formValues.condition
                .map((k) =>
                  t(`mobile.detail.condition.${k}`, {
                    defaultValue: (CONDITION_LABELS as Record<string, string>)[k],
                  }),
                )
                .join(', ')
            : t('mobile.detail.required.conditionDetail_empty')
        }
      />
      <ChecklistRow
        done={required.rows.price}
        label={t('mobile.detail.required.price')}
        detail={
          required.rows.price
            ? formValues.priceFormat === 'offer'
              ? t('mobile.detail.required.priceDetail_offer')
              : `${draft.priceCurrency} ${pricePerUnitValue}`
            : t('mobile.detail.required.priceDetail_empty')
        }
      />
      <ChecklistRow
        done={required.rows.location}
        label={t('mobile.detail.required.location')}
        detail={
          required.rows.location
            ? (() => {
                const first = formValues.locations[0]?.trim() ?? '';
                const country = formValues.locationCountries[0]?.trim() ?? '';
                const head = [first, country].filter(Boolean).join(', ');
                const extra = formValues.locations.length - 1;
                return extra > 0 ? `${head} (+${extra} more)` : head;
              })()
            : t('mobile.detail.required.locationDetail_empty')
        }
      />

    </View>
  );
}

function ChecklistRow({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <View
      className="flex-row items-center gap-sm rounded-xs p-sm"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
    >
      <MaterialIcons
        name={done ? 'check-circle' : 'error'}
        size={22}
        color={done ? STEP_DONE : STEP_PENDING}
      />
      <View className="flex-1">
        <Text className="font-bold text-lg text-brand-foreground">{label}</Text>
        <Text
          className={`font-sans text-md ${done ? 'text-brand-text-muted' : 'text-brand-destructive font-semi'}`}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
    </View>
  );
}
