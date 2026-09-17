/**
 * `Row` — the list row. Drafts, matches, conversations, account settings.
 *
 *     [ thumb ]  Waters Alliance e2695            ›
 *                Needs 2 photos and a price
 *
 * 46pt leading block, 14pt gap, title + optional secondary line, optional
 * trailing element. 16pt vertical padding inside the 24pt gutter.
 *
 * Two things it gets right that hand-rolled rows in this app have got wrong
 * before:
 *
 * • `minWidth: 0` on the text column. Without it a long flex child refuses to
 *   shrink and `numberOfLines` never truncates — the row just pushes the
 *   chevron off-screen. AI-written listing titles here run to 90 characters,
 *   so this is the normal case, not the edge case.
 *
 * • The whole row is the tap target, and it is 66pt+ tall, so it clears the
 *   44pt minimum without hitSlop.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import {
  GUTTER,
  ROW_SUBLINE_GAP,
  badgeDot,
  control,
  icon,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';

import { Chip } from './Chip';
import { MaterialFill } from './Surface';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Row({
  title,
  subtitle,
  meta,
  stamp,
  marker,
  leading,
  trailing,
  onPress,
  titleLines = 1,
  titleVariant = 'rowTitle',
  tone = 'default',
  subtitleTone = 'subtle',
  accessibilityLabel,
  accessibilityHint,
  testID,
}: {
  title: string;
  subtitle?: string;
  /**
   * A THIRD line, below the subtitle, in the same caption size but always
   * `inkSubtle`.
   *
   * Added for the detected-items list, whose row has to carry two separate
   * kinds of fact — the money (`USD 14,000 · ×3`) and the specification
   * (`Used · 2019 · Taipei`). `subtitle` is capped at one line by design and
   * running both into it produced a string that truncated before the second
   * half was ever visible.
   *
   * Use it only when the two lines really are different kinds of thing. A row
   * whose subtitle simply ran long wants shorter copy, not a second line.
   */
  meta?: string;
  /**
   * A short timestamp — "4h", "Tue". Sits on the TITLE's baseline at the right
   * of the title line, not vertically centred in the row: a conversation's age
   * belongs to its subject line, and centring it against a two-line row leaves
   * it floating between the two.
   */
  stamp?: string;
  /**
   * Unread. A 7pt accent dot at the trailing edge.
   *
   * ⚠️ Its slot is reserved WHENEVER the prop is passed, `false` included.
   * Rendering the dot conditionally slid the stamp on read rows 21pt further
   * right than the stamp on unread ones, and a column of timestamps that does
   * not line up reads as a rendering fault rather than as a state. Pass
   * `marker={false}`, never `marker={undefined}`, on a row in a list where any
   * row can be unread.
   */
  marker?: boolean;
  /** 46pt square block — thumbnail, avatar or icon tile. Use `RowThumb` for the standard treatment. */
  leading?: ReactNode;
  /** Chevron, value, badge. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** 2 for titles that must be readable in full — the seller reviewing what they are about to publish. */
  titleLines?: 1 | 2;
  /**
   * `rowTitle` (14/500) is the subject of the row — a listing, a match.
   * `row` (14/400) is a navigation row where the destination, not the label,
   * is the point: Account's settings list draws these lighter.
   */
  titleVariant?: 'rowTitle' | 'row';
  /**
   * `muted` draws the title in `inkSubtle`. For a row that is deliberately
   * demoted — a paused want, an expired listing. The muting IS the signal, so
   * it belongs on the row rather than in each caller's styles.
   */
  tone?: 'default' | 'muted';
  /**
   * `muted` lifts the second line from `inkSubtle` to `inkMuted` — for a row
   * whose subtitle is live content rather than metadata: the last message in a
   * conversation, which a person actually reads.
   */
  subtitleTone?: 'subtle' | 'muted';
  /**
   * Overrides the composed "title. subtitle" label.
   *
   * The row is a single accessible element, so anything inside `trailing` — a
   * relevance percentage, a count, "Instant" — is NEVER announced. Pass a full
   * label whenever the trailing content carries meaning.
   */
  accessibilityLabel?: string;
  /** What happens on activation, when the label alone does not say. */
  accessibilityHint?: string;
  testID?: string;
}) {
  // Full-bleed rows dim rather than scale: shrinking the whole screen width
  // reads as a rendering glitch, not as a press.
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  const markerColor = useV2Colors().accent;

  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        {stamp === undefined ? (
          <Text
            variant={titleVariant}
            color={tone === 'muted' ? 'inkSubtle' : 'ink'}
            numberOfLines={titleLines}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        ) : (
          <View style={styles.titleLine}>
            <Text
              variant={titleVariant}
              color={tone === 'muted' ? 'inkSubtle' : 'ink'}
              numberOfLines={titleLines}
              ellipsizeMode="tail"
              style={styles.titleFlex}
            >
              {title}
            </Text>
            <Text variant="small" color="inkSubtle" style={styles.stamp}>
              {stamp}
            </Text>
          </View>
        )}
        {subtitle ? (
          <Text
            variant="caption"
            color={subtitleTone === 'muted' ? 'inkMuted' : 'inkSubtle'}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.sub}
          >
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text
            variant="caption"
            color="inkSubtle"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.sub}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {marker === undefined ? null : (
        <View style={styles.markerSlot}>
          {marker ? <View style={[styles.marker, { backgroundColor: markerColor }]} /> : null}
        </View>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      // `meta` joins the announced label too. It is a THIRD visible line, and a
      // line a sighted seller reads while a screen-reader user does not is the
      // same defect as unannounced `trailing` content, warned about above.
      accessibilityLabel={
        accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join('. ')
      }
      accessibilityHint={accessibilityHint}
      style={[styles.row, animatedStyle]}
    >
      {content}
    </AnimatedPressable>
  );
}

/**
 * The standard 46pt tinted tile behind a thumbnail or placeholder icon.
 *
 * Pass `uri` and it renders the photo, falling back to `children` (a
 * placeholder glyph) when there is none. Listings here frequently have no
 * photo yet — that is the normal case for a draft, not an error — so the
 * fallback is the tile itself rather than a broken-image box.
 */
export function RowThumb({ uri, children }: { uri?: string | null; children?: ReactNode }) {
  const c = useV2Colors();
  return (
    <View style={[styles.thumb, { backgroundColor: c.fill }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <>
          {/* Material on the EMPTY tile only. A photograph is not a surface —
              running a ramp over one would tint the seller's picture. */}
          <MaterialFill role="fill" ink="ink" radius={radius.sm} />
          {children}
        </>
      )}
    </View>
  );
}

/**
 * The trailing cluster on a settings or navigation row: an optional chip, an
 * optional value, then the chevron.
 *
 * ⚠️ None of this is announced. The row is a single accessible element, so
 * whatever you put here is invisible to a screen reader — pass the value into
 * the row's `accessibilityLabel` too.
 */
export function RowTrailing({
  value,
  chip,
  chipTone = 'neutral',
  chevron = true,
}: {
  value?: string;
  chip?: string;
  chipTone?: 'accent' | 'neutral';
  chevron?: boolean;
}) {
  const c = useV2Colors();
  return (
    <View style={styles.trailingCluster}>
      {chip ? <Chip label={chip} tone={chipTone} /> : null}
      {value ? (
        <Text variant="body" color="inkSubtle" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {chevron ? <ChevronRight size={icon.md} color={c.inkDisabled} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    paddingHorizontal: GUTTER,
    paddingVertical: space['3xl'],
  },
  leading: { flexShrink: 0 },
  // minWidth:0 is what lets numberOfLines actually truncate inside a flex row.
  text: { flex: 1, minWidth: 0 },
  sub: { marginTop: ROW_SUBLINE_GAP },
  // Baseline, not centre: the stamp reads as part of the title line.
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.lg },
  titleFlex: { flex: 1, minWidth: 0 },
  stamp: { flexShrink: 0 },
  trailing: { flexShrink: 0 },
  markerSlot: { width: badgeDot.size, flexShrink: 0 },
  marker: { width: badgeDot.size, height: badgeDot.size, borderRadius: radius.pill },
  trailingCluster: { flexDirection: 'row', alignItems: 'center', gap: space['2xl'] },
  thumb: {
    width: control.thumb,
    height: control.thumb,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
