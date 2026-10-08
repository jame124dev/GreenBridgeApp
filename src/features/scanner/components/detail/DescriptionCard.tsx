import { Text, TextInput, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { brand } from '@/constants/theme';
import { DESCRIPTION_MAX } from '@/features/scanner/descriptionLimit';
import type { DetailFormInput } from '@/features/scanner/schema';

import { FieldGroup } from './SectionBand';
import { FieldLabel } from './FieldLabel';
import { useAiFilled } from './aiProvenance';

const inputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground';

export function DescriptionCard() {
  const { t } = useTranslation();
  const { control } = useFormContext<DetailFormInput>();
  // Badge states a fact, not a decoration — see `aiProvenance.ts`. It used to
  // sit beside this field while the field was empty.
  const aiFilled = useAiFilled();

  return (
    <FieldGroup>
      <Controller
        control={control}
        name="description"
        render={({ field: { value, onChange, onBlur }, fieldState }) => {
          // `maxLength` below stops the SELLER at the limit, but it does not
          // truncate a value written programmatically — the AI's own generated
          // description used to arrive over it (635 characters on a BD FACSVerse
          // scan, 543 on an AOI machine; device passes 2026-08-19) through
          // `reset(draftToFormValues(draft))`.
          //
          // Both AI mappers now cap at DESCRIPTION_MAX (`fitDescription`), so a
          // NEW draft can no longer be born over the limit. This state is still
          // reachable — a draft persisted in MMKV before that fix keeps its long
          // text — so the warning stays, and it must not be a silent grey "97/500".
          //
          // Same treatment the lab listing editor already gives it
          // (`LabListingEditSheet.tsx:817` counterOver -> `:1293`
          // fieldCounterOver); this card was the odd one out.
          const length = value?.length ?? 0;
          const over = length - DESCRIPTION_MAX;
          const isOver = over > 0;

          return (
            <View className="gap-1.5">
              {/* `required` — description IS one of the seven rows in
                  `REQUIRED_ROWS`, and the checklist and the footer chip both
                  say so. Without the marker this card was the only required
                  field on the page that looked optional, so a seller read it
                  as skippable and met the block at Submit instead. */}
              <FieldLabel
                text={t('mobile.detail.sectionDescription')}
                ai={aiFilled('description', value)}
                required
              />
              <TextInput
                className={inputCls}
                style={{ minHeight: 110 }}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                /*
                  The biggest input on the screen had NO placeholder — a blank
                  110pt rectangle, required, while the AI filled in the easy
                  fields around it. That is the point sellers abandon.

                  The examples are deliberately industrial rather than generic
                  "describe your item": hours, calibration and what is in the
                  box are the questions a buyer of used lab equipment asks
                  first, so prompting for them raises the odds the listing can
                  be answered without a back-and-forth. Vinted does the same
                  thing with "e.g. only worn a few times, true to size".
                */
                placeholder={t('mobile.detail.descriptionPlaceholder', {
                  defaultValue:
                    'Hours used, calibration status, what is included (cables, probes, manuals), any faults.',
                })}
                placeholderTextColor={brand.placeholder}
                multiline
                numberOfLines={5}
                maxLength={DESCRIPTION_MAX}
                textAlignVertical="top"
              />
              <Text
                testID="description-counter"
                className={`font-label text-sm text-right ${
                  isOver ? 'text-brand-destructive' : 'text-brand-placeholder'
                }`}
                // Only in the OVER state, and as a sentence: a screen reader
                // reads the bare "635/500" as a fraction, which is exactly the
                // information a sighted user gets from the colour. Under the
                // limit the plain text is fine and stays unannotated, so this
                // adds one translated string rather than two.
                accessibilityLabel={
                  isOver
                    ? t('mobile.detail.descriptionOverLimitA11y', {
                        defaultValue: '{{length}} characters, {{over}} over the {{max}} limit',
                        length,
                        over,
                        max: DESCRIPTION_MAX,
                      })
                    : undefined
                }
              >
                {length}/{DESCRIPTION_MAX}
              </Text>
              {isOver ? (
                // A red number says something is wrong; it does not say what to
                // do (UX_DESIGN_RULES: "Does every error have recovery?"). Name
                // the overage so trimming is a definite task, not a guess.
                <Text
                  testID="description-over-limit"
                  className="text-brand-destructive text-md text-right"
                >
                  {t('mobile.detail.descriptionTooLong', {
                    defaultValue:
                      '{{over}} characters over the {{max}} limit — please shorten it.',
                    over,
                    max: DESCRIPTION_MAX,
                  })}
                </Text>
              ) : null}
              {fieldState.error ? (
                <Text className="text-brand-destructive text-md" style={{ marginTop: 2 }}>
                  {fieldState.error.message}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </FieldGroup>
  );
}
