/**
 * Seller Platform Terms — the consent row and the full-text sheet.
 *
 * ⚠️ THE TERMS TEXT IS NOT WRITTEN HERE AND MUST NEVER BE. It lives in
 * `./content/sellerTerms.ts`, copied **byte-identical** from the web flow
 * (`101lab-2`, `src/features/auth/content/sellerTerms.ts`) so the two clients
 * cannot drift. That file's own header says the split exists "so legal can
 * update the wording without touching the UI" — retyping any of it here, or
 * paraphrasing a clause to fit a phone, would break exactly that.
 *
 * `SELLER_TERMS_VERSION` is what gets recorded on acceptance. A consent with no
 * version against it is not evidence of anything.
 *
 * ── WHY A FULL-SCREEN SHEET AND NOT THE WEB'S INLINE PANEL ──
 *
 * The web renders the clauses in a 300px scrolling panel inside the signup
 * form. On a phone that is a scroll region inside a scroll region inside a
 * keyboard-aware scroll view — the user cannot tell which one they are
 * dragging, and 21 clauses through a 300px window is unreadable anyway. So the
 * row is a consent control and the text gets the whole screen.
 *
 * Built on RN's `<Modal>`, the same primitive `LanguageSheet` uses and which
 * `AuthShell` already mounts — not a new sheet library.
 *
 * ⚠️ Plain `Pressable` from `react-native`, NOT gesture-handler's. RNGH
 * controls inside a `<Modal>` need their own `GestureHandlerRootView`
 * (`FORM_INPUT_RULES.md` §8) and did not respond at all under
 * react-native-web; the kit's `OptionCard` uses RN's for the same reason.
 */
import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  findNodeHandle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { GlyphButton, PrimaryAction, Text } from '@/features/v2/ui';
import { GUTTER, icon, radius, space, useV2Colors } from '@/theme/v2';

import {
  SELLER_TERMS_CLAUSES,
  SELLER_TERMS_INTRO,
  SELLER_TERMS_SUBTITLE,
  SELLER_TERMS_TITLE,
} from './content/sellerTerms';

/** The gating consent row. Tapping the box toggles; tapping the title opens. */
export function SellerTermsRow({
  accepted,
  onToggle,
  onOpen,
  boxRef,
}: {
  accepted: boolean;
  onToggle: () => void;
  onOpen: () => void;
  /**
   * The checkbox itself, so the caller can return screen-reader focus here
   * after the full-text sheet closes — see `SellerTermsSheet`.
   */
  boxRef?: React.MutableRefObject<View | null>;
}) {
  const c = useV2Colors();
  const { t } = useTranslation();

  /**
   * ⚠️ ONE KEY FOR THE WHOLE SENTENCE, SPLIT AT THE TITLE — NOT A PREFIX KEY
   * AND A SUFFIX KEY.
   *
   * The sentence wraps an inline link, and it used to be three literals:
   * "I have read and agree to the " + the title + ", and I confirm…". Keying
   * those two halves separately would hard-code ENGLISH word order: in ja, zh
   * and th the clause that follows the document name in English precedes it,
   * and a translator handed a fragment ending in "the " has nothing to work
   * with. So the locale file holds the complete sentence with a `{{title}}`
   * placeholder, free to sit anywhere in it, and the link is drawn where the
   * TRANSLATION puts the title.
   *
   * `<Trans>` was the other candidate and is wrong here: it would nest the
   * link inside a `<Text>`, and the link's tap target is a drawn 44dp
   * `Pressable` (see below) that a `<Text>` child cannot carry.
   *
   * If a translation drops the placeholder, `at` is -1 and the whole sentence
   * renders with the link appended — degraded, never a blank row.
   */
  const sentence = t('mobile.auth.onboarding.terms.consent', { title: SELLER_TERMS_TITLE });
  const at = sentence.indexOf(SELLER_TERMS_TITLE);
  const before = at >= 0 ? sentence.slice(0, at) : sentence;
  const after = at >= 0 ? sentence.slice(at + SELLER_TERMS_TITLE.length) : '';

  return (
    <View style={styles.row}>
      <Pressable
        ref={(r) => {
          if (boxRef) boxRef.current = r;
        }}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel={sentence}
        /*
          ⚠️ A REAL 48dp BOX, NOT `hitSlop`.

          This used to be slop and the comment here claimed 48. It was not:
          the layout box was the 24dp box plus `boxTap`'s 4dp top pad (24×28),
          and the slop added md/sm left/right — 38dp WIDE, 44 high. So it
          failed Android's 48 on both axes and iOS's 44 on width, and because
          slop is invisible to a layout dump nothing could measure it.

          Same finding and same remedy as `Field.tsx`'s `GlyphButton`, which
          swapped a 42dp slop-only target for `minWidth`/`minHeight`. 48, not
          `MIN_TOUCH` (44): this is the control that legally gates "Submit for
          review", so it takes the larger of the two platform minimums.
        */
        style={styles.boxTap}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: accepted ? c.accent : c.fieldBorder,
              // flat: a 24pt checkbox is too small for a ramp to read as
              // anything but noise; the tick carries the state.
              backgroundColor: accepted ? c.accent : c.base,
            },
          ]}
        >
          {accepted ? <Check size={icon.sm} color={c.onAccent} strokeWidth={3} /> : null}
        </View>
      </Pressable>

      <View style={styles.rowText}>
        {before ? <Text variant="body">{before}</Text> : null}
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.auth.onboarding.terms.readA11y', {
            title: SELLER_TERMS_TITLE,
          })}
          /*
            The drawn box, not slop: `bodyMedium` is 13/20, so 12dp of pad
            top and bottom brings the target to 44dp — and unlike slop it is
            measurable, and it cannot be eaten by the sibling lines of the
            wrapping sentence it sits inside. Horizontal slop stays, because
            the link is inline type and widening it would break the sentence.
          */
          hitSlop={{ left: space.sm, right: space.sm }}
          style={styles.linkTap}
        >
          <Text variant="bodyMedium" color="accentInk" style={styles.link}>
            {SELLER_TERMS_TITLE}
          </Text>
        </Pressable>
        {after ? <Text variant="body">{after}</Text> : null}
      </View>
    </View>
  );
}

/** Full-screen reader. Agreeing from in here also ticks the row. */
export function SellerTermsSheet({
  visible,
  onClose,
  onAgree,
}: {
  visible: boolean;
  onClose: () => void;
  onAgree: () => void;
}) {
  const c = useV2Colors();
  const { t } = useTranslation();
  /**
   * ⚠️ A bare `<Modal>` is OUTSIDE the app's SafeAreaView, so it inherits no
   * insets. Measured on-device before this: the title sat under the status
   * clock at y≈83 and "I agree" was drawn behind the gesture bar. The modal
   * has to ask for the insets itself.
   */
  const insets = useSafeAreaInsets();

  /**
   * ⚠️ A FULL-SCREEN SHEET THAT OPENS SILENTLY IS A SHEET A SCREEN-READER USER
   * DOES NOT KNOW IS THERE. Without this, focus stayed on whatever was last
   * touched on the calibration step while 21 clauses mounted over the top of
   * it. `accessibilityViewIsModal` (the same prop `SignInSheet` sets on its
   * card) keeps focus inside the sheet; moving focus to the title says it
   * arrived. The caller returns focus to the consent row on close.
   */
  const titleRef = useRef<View | null>(null);
  useEffect(() => {
    if (!visible) return;
    // A frame of slack: the Modal's children are not in the native tree on the
    // tick `visible` flips, so focusing immediately is a no-op.
    const id = setTimeout(() => {
      const node = findNodeHandle(titleRef.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }, 150);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      {/*
        ⚠️ `GestureHandlerRootView` IS REQUIRED HERE, and its absence is silent.
        `FORM_INPUT_RULES.md` §8: RNGH controls inside a `<Modal>` need their
        own root view. `PrimaryAction` uses `Pressable` from
        `react-native-gesture-handler` (`PrimaryAction.tsx:26`), so without this
        the "I agree" button renders perfectly and does nothing at all — which
        is exactly what it did on-device before this wrapper: the tap landed,
        the sheet stayed open, no error anywhere.
      */}
      <GestureHandlerRootView style={styles.sheet}>
      {/* flat: the sheet IS the page while it is open — same reasoning as
          `AuthShell`'s cap, a ramp would light a full-screen ground. */}
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: c.base }]}>
        <View style={[styles.sheetHead, { paddingTop: insets.top + space.lg }]}>
          <View style={styles.sheetTitles}>
            <View ref={titleRef} accessible accessibilityRole="header">
              <Text variant="h2">{SELLER_TERMS_TITLE}</Text>
            </View>
            <Text variant="caption" color="inkSubtle" style={styles.sheetSub}>
              {SELLER_TERMS_SUBTITLE}
            </Text>
          </View>
          {/*
            `GlyphButton`, not a bare `Pressable` with slop. The bare version
            measured 36dp (a 20dp glyph + 8dp slop a side) — 8 under iOS and 12
            under Android — and on iOS it is the ONLY way out of this Modal,
            since there is no hardware back. `GlyphButton` already enforces
            `minWidth`/`minHeight` = `MIN_TOUCH` and sets role + label.
          */}
          <GlyphButton accessibilityLabel={t('mobile.common.close')} onPress={onClose}>
            <X size={icon.xl} color={c.ink} strokeWidth={1.75} />
          </GlyphButton>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator
        >
          <Text variant="body" color="inkMuted">
            {SELLER_TERMS_INTRO}
          </Text>
          {SELLER_TERMS_CLAUSES.map((clause) => (
            <View key={clause.heading} style={styles.clause}>
              <Text variant="bodyMedium">{clause.heading}</Text>
              {clause.paragraphs.map((p, i) => (
                <Text key={i} variant="body" color="inkMuted" style={styles.para}>
                  {p}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.sheetFoot,
            { borderTopColor: c.hairline, paddingBottom: insets.bottom + space.lg },
          ]}
        >
          <PrimaryAction
            label={t('mobile.auth.onboarding.terms.agreeCta')}
            onPress={() => {
              onAgree();
              onClose();
            }}
            testID="v2-onboarding-terms-agree"
          />
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  /** See the note at the control: a real 48dp box, drawn, not slop. */
  boxTap: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Wraps as one paragraph so the link sits inline in the sentence. */
  rowText: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  link: { textDecorationLine: 'underline' },
  /** 13/20 type + 12 top + 12 bottom = a 44dp drawn target. */
  linkTap: { paddingVertical: space.xl },
  sheet: { flex: 1 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    paddingHorizontal: GUTTER,
    paddingBottom: space.lg,
  },
  sheetTitles: { flex: 1 },
  sheetSub: { marginTop: space.xs },
  scroll: { flex: 1 },
  scrollBody: { paddingHorizontal: GUTTER, paddingBottom: space['6xl'] },
  clause: { marginTop: space['2xl'], gap: space.sm },
  para: { marginTop: space.xs },
  sheetFoot: { borderTopWidth: 1, paddingHorizontal: GUTTER, paddingTop: space.lg },
});
