import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { brand } from '@/constants/theme';

import { ICON } from './metrics';

interface Props {
  text: string;
  ai?: boolean;
  required?: boolean;
}

/**
 * Label-caps field label with optional red `*` and an AI badge.
 *
 * S6.2.b2.i — converted to NativeWind. `letterSpacing: 0.6` (legacy) cannot be
 * expressed in our Tailwind scale; preserved via inline `style={{ letterSpacing }}`.
 *
 * ⚠️ DEMOTED ON PURPOSE — AND THE CASE IS NOT THE REASON.
 *
 * `BRAND` in semibold caps above `Keithley` in body text put the scaffolding
 * above the content, and every reference screen inverts that: recessive grey
 * label, prominent black value. The fix NN/g's glanceable-fonts work supports is
 * EMPHASIS, not case — for one or two words glanced in isolation, which is
 * exactly what a label is, all-caps costs nothing measurable. What costs is
 * twelve of them stacked down a page each as loud as the answer beside it. So
 * the weight drops (semibold → medium) and the size drops (12 → 11); the caps
 * stay. `FORM_UX_RESEARCH.md` §1.2 is the full argument and §2.2 the symptom.
 */
export function FieldLabel({ text, ai, required }: Props) {
  return (
    <View className="flex-row items-center gap-1.5">
      {/*
        ⚠️ THE LABEL STAYS MUTED; ONLY THE ASTERISK IS RED.

        It used to turn the WHOLE label `text-brand-destructive`, so "PRICE *"
        rendered in error red even when the checklist two cards below showed
        Price as ✓ DONE. Red was carrying two meanings at once — "required"
        and "missing" — and the reviewer who caught it put the cost plainly:
        once the seller finds one red label that is actually satisfied, they
        stop trusting every other red thing on the screen, including the three
        that really are missing.

        Required-ness is permanent, so it gets the permanent, quiet marker.
        MISSING-ness is a state, and it already has its own channel: the
        inline "Description is required" under the field, the red chip in the
        footer, and the orange checklist row.
      */}
      <Text className="font-label-medium text-sm text-brand-text-muted" style={{ letterSpacing: 0.6 }}>
        {text}
        {required ? <Text className="text-brand-destructive">{' *'}</Text> : null}
      </Text>
      {ai ? (
        <View className="flex-row items-center gap-xxs bg-brand-primary-accent px-1.5 rounded-xs" style={{ paddingVertical: 1 }}>
          <MaterialIcons name="auto-awesome" size={ICON.inline} color={brand.primary} />
          <Text className="font-label text-brand-primary" style={{ fontSize: 10 }}>AI</Text>
        </View>
      ) : null}
    </View>
  );
}
