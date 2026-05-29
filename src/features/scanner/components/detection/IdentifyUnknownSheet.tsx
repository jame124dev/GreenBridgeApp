import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Sheet, Text } from '@/components/ui';
import { brand } from '@/constants/theme';

interface Props {
  visible: boolean;
  initialName?: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

/**
 * W5 (scan_v3) — Identify-unknown dialog. Opens when the seller taps the
 * "Identify" pill on a product card whose AI-extracted title is empty.
 * Captures a single line of text (the product name) and writes it back to
 * the wizard's local `editedProducts[i].fields.title`.
 *
 * Web parity: `DetectionChoiceScreen.tsx` opens a small Dialog with a TextField
 * + Save button. Mobile uses the existing `Sheet` primitive for parity with
 * other pickers in this flow.
 */
export function IdentifyUnknownSheet({ visible, initialName, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? '');

  // Reset the input when the sheet opens with a new initialName (e.g. user
  // taps Identify on a different product). Use `visible` as the trigger so
  // re-opening on the same product still re-seeds. The setState here IS the
  // effect's purpose — synchronizing the local input value to the incoming
  // initialName prop on each visibility transition.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) setName(initialName ?? '');
  }, [visible, initialName]);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.detection.identifyTitle', {
        defaultValue: 'Identify this product',
      })}
      subtitle={t('mobile.detection.identifySubtitle', {
        defaultValue: 'The AI couldn’t name this one. What is it?',
      })}
      snapTo="50%"
    >
      <View className="px-lg pt-md gap-md">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('mobile.detection.identifyPlaceholder', {
            defaultValue: 'e.g. Agilent 1260 HPLC',
          })}
          placeholderTextColor={brand.placeholder}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleSave}
          className="bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground"
          accessibilityLabel={t('mobile.detection.identifyPlaceholder', {
            defaultValue: 'Product name',
          })}
        />

        <Button
          label={t('mobile.detection.identifySave', { defaultValue: 'Save' })}
          onPress={handleSave}
          disabled={!canSave}
          fullWidth
        />

        <Text variant="caption" tone="tertiary" className="text-center">
          {t('mobile.detection.identifyHint', {
            defaultValue: 'You can refine other details on the next screen.',
          })}
        </Text>
      </View>
    </Sheet>
  );
}
