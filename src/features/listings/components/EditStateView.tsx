import { ActivityIndicator, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Button, Text } from '@/components/ui';
import { brand } from '@/constants/theme';

type Action = { label: string; onPress: () => void };

interface Props {
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Renders a spinner in place of the icon. */
  busy?: boolean;
  title: string;
  body?: string;
  /** The one obvious next step. Every dead end on this flow has exactly one. */
  primary?: Action;
  /** Escape hatch (e.g. "Back to my listings"). Rendered as a quiet ghost. */
  secondary?: Action;
}

/**
 * The single full-screen state used for loading, every error the contract
 * lists, and every lock reason.
 *
 * One component rather than five bespoke layouts, so "explanatory loading" and
 * "every error has a recovery" are structural: a state literally cannot be
 * added without a sentence, and the primary action slot is the only CTA on
 * screen.
 */
export function EditStateView({ icon, busy, title, body, primary, secondary }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-2xl" style={{ gap: 12 }}>
      {busy ? (
        <ActivityIndicator size="large" color={brand.primary} />
      ) : icon ? (
        <View
          className="w-16 h-16 rounded-full items-center justify-center bg-brand-surface-muted"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <MaterialIcons name={icon} size={28} color={brand.primary} />
        </View>
      ) : null}

      <Text variant="subtitle" tone="primary" className="text-center">
        {title}
      </Text>

      {body ? (
        <Text variant="body" tone="tertiary" className="text-center" style={{ maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}

      {primary ? (
        <Button
          label={primary.label}
          onPress={primary.onPress}
          variant="primary"
          size="md"
          style={{ marginTop: 8, minWidth: 220 }}
        />
      ) : null}

      {secondary ? (
        <Button label={secondary.label} onPress={secondary.onPress} variant="ghost" size="sm" />
      ) : null}
    </View>
  );
}
