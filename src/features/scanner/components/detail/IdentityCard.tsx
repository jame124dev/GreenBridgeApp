import { Text, TextInput, View } from 'react-native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { DetailFormInput } from '@/features/scanner/schema';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

const inputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground';
const titleInputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-heading-semi text-4xl text-brand-foreground';

/**
 * Identity card — title + brand/model/year (S2.2 expansion).
 *
 * S6.2.b2.i — converted to NativeWind. Card container, field gaps, and input
 * styling all use className. `placeholderTextColor` retains the brand token
 * via JS (no Tailwind hook for placeholder color in NativeWind).
 *
 * `variant` (default `'draft'` — existing behaviour unchanged):
 *   'edit' is the published-listing editor. Model and year are hidden there
 *   because the v1 edit contract has no slot for them — on create they are
 *   folded into `product_content` by `appendSpecsToDescription`, and the editor
 *   exposes the description itself, so keeping the inputs would offer two ways
 *   to change one thing and silently discard one of them. Title and brand ARE
 *   contract fields and stay editable.
 *
 * `needsClearerPhoto` (⛔ FIX 1b, 2026-08-20) is the server's `needs_clearer_photo`
 * off the draft. It means "I could not read a NAMEPLATE" — a statement about
 * BRAND and MODEL, which is why FIX 1 stopped it forcing a MARKETPLACE question
 * in `routingNeedsAsk`. The fact still had to land somewhere true and actionable,
 * so it lands here, on the two fields it is about. Default `undefined` ⇒ every
 * caller that does not pass it is byte-for-byte unchanged.
 */
export function IdentityCard({
  variant = 'draft',
  needsClearerPhoto,
}: { variant?: 'draft' | 'edit'; needsClearerPhoto?: boolean } = {}) {
  const isEdit = variant === 'edit';
  const { t } = useTranslation();
  const { control } = useFormContext<DetailFormInput>();

  // Watched, not read once: the hint must vanish the moment the seller answers.
  const brandValue = useWatch({ control, name: 'brand' });
  const modelValue = useWatch({ control, name: 'model' });
  const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  // MODEL is not rendered in the `edit` variant, so judging on it there would
  // hold a hint open against a field the seller cannot see.
  const identityIncomplete = isEdit
    ? !filled(brandValue)
    : !filled(brandValue) || !filled(modelValue);
  const showNameplateHint = needsClearerPhoto === true && identityIncomplete;

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="title"
        render={({ field: { value, onChange, onBlur }, fieldState }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionTitle')} ai />
            {/* MULTILINE ON PURPOSE. Titles run to 80 chars and a single-line
                TextInput on Android scrolls to the caret, so a long AI-written
                title opened showing its MIDDLE — "…solutions Stream In-Situ TEM"
                with the start cut off, or "'air of Tan Upholstered Armchairs"
                missing its first letter. The seller could not read what they
                were about to publish. Two lines shows the whole thing.
                `submitBehavior="blurAndSubmit"` keeps Enter closing the keyboard
                instead of inserting a newline into a title. */}
            <TextInput
              className={titleInputCls}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={80}
              multiline
              numberOfLines={2}
              submitBehavior="blurAndSubmit"
              textAlignVertical="top"
            />
            <Text className="font-label text-sm text-brand-placeholder text-right">
              {value?.length ?? 0}/80
            </Text>
            {fieldState.error ? (
              <Text className="text-brand-destructive text-md" style={{ marginTop: 2 }}>
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      <View className="flex-row gap-sm">
        <Controller
          control={control}
          name="brand"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-1 gap-1.5">
              <FieldLabel text={t('mobile.detail.sectionBrand', { defaultValue: 'BRAND' })} ai />
              <TextInput
                className={inputCls}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('mobile.detail.brandPlaceholder', { defaultValue: 'e.g. Agilent' })}
                placeholderTextColor={brand.placeholder}
              />
            </View>
          )}
        />
        {isEdit ? null : (
        <Controller
          control={control}
          name="model"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-1 gap-1.5">
              <FieldLabel text={t('mobile.detail.sectionModel', { defaultValue: 'MODEL' })} ai />
              <TextInput
                className={inputCls}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('mobile.detail.modelPlaceholder', { defaultValue: 'e.g. HPLC-2000' })}
                placeholderTextColor={brand.placeholder}
              />
            </View>
          )}
        />
        )}
      </View>

      {/* ⛔ FIX 1b — the illegible nameplate, said where it is ACTIONABLE.
          ONE line for the PAIR, under the row: brand and model share a flex-row,
          so each column is about half the card and the same sentence in both
          would wrap to three lines twice to say one thing about one photo.
          Muted, not destructive — nothing is wrong, something is just unknown.
          Gated on the fields still being empty so a seller who has already typed
          them never sees a warning about work they have done. */}
      {showNameplateHint ? (
        <Text className="font-sans text-md text-brand-text-muted" style={{ marginTop: 2 }}>
          {t('mobile.detail.nameplateHint', {
            defaultValue:
              "We couldn't read the nameplate in your photos — add what you know, or retake a closer shot.",
          })}
        </Text>
      ) : null}

      {isEdit ? null : (
      <Controller
        control={control}
        name="year"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionYear', { defaultValue: 'YEAR' })} ai />
            <TextInput
              className={inputCls}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="number-pad"
              maxLength={4}
              placeholder={t('mobile.detail.yearPlaceholder', { defaultValue: 'e.g. 2018' })}
              placeholderTextColor={brand.placeholder}
            />
          </View>
        )}
      />
      )}
    </View>
  );
}
