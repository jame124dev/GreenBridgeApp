import { Pressable, Text, View, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';

import { persistDocumentsForDraft } from '@/services/upload/persistPhotos';
import { useScanDraft, type DraftItem } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

interface Props {
  draft: DraftItem;
  /**
   * Optional patch callback. When provided, document add/remove writes flow
   * through this instead of the store's `patch` action — used by the
   * multi-product wizard to route writes at a specific `queuedItems` index
   * rather than to `current` (multi_product_wizard_plan W3, pre-coding
   * note #2). When omitted (the single-product editor's case), the legacy
   * `s.patch` → `current` path is used.
   */
  onPatch?: (patch: Partial<DraftItem>) => void;
}

/**
 * Optional documents attached to the listing — PDFs, manuals, certs.
 *
 * S6.2.b2.i — converted to NativeWind.
 */
export function DocumentsCard({ draft, onPatch }: Props) {
  const { t } = useTranslation();
  const storePatch = useScanDraft((s) => s.patch);
  const patch = onPatch ?? storePatch;

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const added = result.assets.map((a) => ({
      uri: a.uri,
      name: a.name ?? 'document',
      mimeType: a.mimeType ?? 'application/octet-stream',
    }));
    try {
      const merged = [...draft.documents, ...added];
      const persisted = await persistDocumentsForDraft(merged, draft.id);
      patch({ documents: persisted });
    } catch {
      Alert.alert(
        t('mobile.detail.docSaveFailedTitle'),
        t('mobile.detail.docSaveFailedBody'),
      );
    }
  };

  const removeDocument = (index: number) => {
    patch({ documents: draft.documents.filter((_, i) => i !== index) });
  };

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <FieldLabel text={t('mobile.detail.sectionDocuments')} />
      {draft.documents.map((doc, i) => (
        <View
          key={`${doc.uri}-${i}`}
          className="flex-row items-center gap-sm bg-brand-surface-muted rounded-xs px-md py-2.5"
        >
          <MaterialIcons name="description" size={18} color={brand.textMuted} />
          <Text className="flex-1 font-sans text-lg text-brand-foreground" numberOfLines={1}>
            {doc.name}
          </Text>
          <Pressable
            onPress={() => removeDocument(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.detail.removeDocument', {
              defaultValue: 'Remove document {{name}}',
              name: doc.name,
            })}
          >
            <Text className="font-label text-base text-brand-destructive">
              {t('mobile.common.remove')}
            </Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        className="flex-row items-center justify-center gap-1.5 border border-brand-border-strong border-dashed rounded-xs py-2.5"
        onPress={pickDocuments}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.detail.addDocument')}
      >
        <MaterialIcons name="add" size={18} color={brand.primary} />
        <Text className="font-label text-lg text-brand-primary">
          {t('mobile.detail.addDocument')}
        </Text>
      </Pressable>
    </View>
  );
}
