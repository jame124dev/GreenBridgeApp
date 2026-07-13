// LabLocationPromptStrip — the in-chat "current location vs enter manually"
// affordance for the SELL flow. A slim, full-width strip pinned directly above
// the chat composer (inside composerWrap, above AttachmentChips). It renders
// only when the listing draft still needs a location, and it injects the
// resolved location as a REAL chat turn via the existing send() — so the AI
// fills BOTH location and country in one turn, exactly as if the user had typed
// "Located in Bangkok, Thailand".
//
// Reuses the SAME shared service (getDeviceLocation) — no new GPS/geocode code.
// The chat gates mounting on `locationNeeded` (draft.missing_required includes
// 'location'), so on resolve/send the next draft frame drops 'location' and the
// strip unmounts; the exit animation makes that collapse feel intentional.
//
// States (all graceful, never a red error in the thread):
//   • idle           → MapPin + "Add your location" + [📍 Use current][Enter manually].
//   • detecting      → primary chip shows a white spinner + "Locating…", disabled.
//   • resolved       → haptics.success(); onSend(resolved turn); strip collapses.
//   • denied         → inline amber hint, keep "Enter manually" prominent, stay open.
//   • unavailable    → drop the auto chip (leave "Enter manually") + neutral toast.
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { brand, fonts, greenDark, greenDarkest, radius, spacing } from '@/constants/theme';
import { usePop, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { getDeviceLocation } from '@/services/location/getDeviceLocation';
import { readCachedLocation } from '@/features/location/pickupStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type LabLocationPromptStripProps = {
  /**
   * Inject a chat turn — this is the chat's own send(); the strip calls it with
   * `Located in {city}, {country}` so the AI fills location + country. Same
   * pathway the response cards use, so multi-turn continuity/dedup is preserved.
   */
  onSend: (text: string) => void;
  /** Focus the composer TextInput — the "Enter manually" path. */
  onManual: () => void;
  /**
   * Dismiss the ask ("Not now") — the caller hides the strip for the session.
   * Location stays addable via Edit details or by typing, so this is a
   * one-time, non-blocking ask rather than a persistent nag.
   */
  onDismiss: () => void;
};

/** Build the injected turn from a resolved location. Prefer "label, country";
 *  fall back to the full address (or label) when country is empty so the AI
 *  still gets a usable location string and can ask for country if it needs it. */
function locationTurnText(loc: { address: string; country: string; label: string }): string {
  const city = loc.label?.trim() || loc.address?.trim();
  const country = loc.country?.trim();
  if (city && country) return `Located in ${city}, ${country}`;
  if (city) return `Located in ${city}`;
  return country ? `Located in ${country}` : 'Located here';
}

export function LabLocationPromptStrip({ onSend, onManual, onDismiss }: LabLocationPromptStripProps) {
  const { t } = useTranslation();
  const entering = usePop();
  const [detecting, setDetecting] = useState(false);
  const [denied, setDenied] = useState(false);
  // Once a detect resolves 'unavailable', drop the auto option entirely and
  // leave only "Enter manually" (never a red error).
  const [autoUnavailable, setAutoUnavailable] = useState(false);
  // Guard so a rapid double-tap (or a late resolve after the user already sent)
  // can't fire getDeviceLocation()/onSend twice.
  const busyRef = useRef(false);

  const onUseCurrent = async () => {
    if (busyRef.current || detecting) return;
    busyRef.current = true;
    haptics.tap();
    setDenied(false);
    setDetecting(true);
    try {
      // A warm cache lets us inject instantly if a fresh fix isn't strictly
      // needed — but we still prefer a live detect for accuracy; the cache is a
      // silent fallback if the live read yields nothing usable.
      const res = await getDeviceLocation();
      if (res.ok) {
        haptics.success();
        onSend(locationTurnText(res.location));
        // Strip will unmount on the next draft frame (location satisfied); no
        // success line here — the draft card is the source of truth.
        return;
      }
      if (res.reason === 'denied') {
        // No haptic — the inline hint carries it. Keep the strip open so
        // recovery ("Enter manually") is one tap.
        setDenied(true);
        return;
      }
      // unavailable (native module missing / geocode failed). Try the cache
      // before giving up — a stale dev-client may still have a prior fix.
      const cached = readCachedLocation();
      if (cached) {
        haptics.success();
        onSend(locationTurnText(cached));
        return;
      }
      setAutoUnavailable(true);
      toast(t('mobile.labCommon.locationUnavailable'));
    } finally {
      setDetecting(false);
      busyRef.current = false;
    }
  };

  const onEnterManually = () => {
    haptics.tap();
    onManual();
  };

  const onNotNow = () => {
    haptics.tap();
    onDismiss();
  };

  return (
    <Animated.View entering={entering} exiting={FadeOut.duration(180)} style={styles.strip}>
      <View style={styles.leadRow}>
        <View style={styles.leadLabel}>
          <MapPin size={14} color={greenDark} strokeWidth={2.2} />
          <Text style={styles.leadText}>{t('mobile.labCommon.addYourLocation')}</Text>
        </View>
        <Pressable
          onPress={onNotNow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labCommon.dismissLocationPrompt')}
        >
          <Text style={styles.notNow}>{t('mobile.labCommon.notNow')}</Text>
        </Pressable>
      </View>

      <View style={styles.btnRow}>
        {autoUnavailable ? null : (
          <UseCurrentChip detecting={detecting} onPress={onUseCurrent} />
        )}
        <ManualChip onPress={onEnterManually} />
      </View>

      {denied ? (
        <Text style={styles.deniedHint}>
          {t('mobile.labCommon.locationOffHint')}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** Primary "📍 Use current location" chip — greenDark fill, white spinner while
 *  detecting. Reserves a min width so the spinner swap causes no layout jump. */
function UseCurrentChip({ detecting, onPress }: { detecting: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={detecting}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.labCommon.useCurrentLocation')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.primaryChip, detecting && styles.chipBusy]}>
        {detecting ? (
          <ActivityIndicator size="small" color="#fff" style={styles.chipSpinner} />
        ) : (
          <MapPin size={15} color="#fff" strokeWidth={2.4} />
        )}
        <Text style={styles.primaryChipText}>{detecting ? t('mobile.labCommon.locating') : t('mobile.labCommon.useCurrentLocation')}</Text>
      </View>
    </AnimatedPressable>
  );
}

/** Ghost "Enter manually" chip — greenDark-border, focuses the composer. */
function ManualChip({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.labCommon.enterLocationManually')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.ghostChip}>
        <Text style={styles.ghostChipText}>{t('mobile.labCommon.enterManually')}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.successBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leadLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leadText: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: greenDark,
  },
  notNow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: brand.mutedForeground,
  },
  // Wraps to a second row on ≤375pt if both chips can't fit (btnRow wraps).
  btnRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm, flexWrap: 'wrap' },
  primaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 180, // reserve width so the spinner ↔ label swap doesn't reflow
    backgroundColor: greenDark,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  chipBusy: { opacity: 0.85 },
  chipSpinner: { width: 15, height: 15 },
  primaryChipText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  ghostChip: {
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: greenDarkest,
    backgroundColor: brand.surface,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  ghostChipText: { fontFamily: fonts.bold, fontSize: 12.5, color: greenDarkest },
  deniedHint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: brand.warningText,
    marginTop: spacing.sm,
  },
});
