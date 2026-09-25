/**
 * `GroupMosaic` — one detected GROUP rendered as a single fixed-size tile:
 * a hero photo with the rest wrapped beside it, and `+N` over the last when
 * the group holds more than four.
 *
 *     ┌───────────┬─────┬─────┐
 *     │           │     │     │
 *     │   hero    ├─────┼─────┤
 *     │           │     │ +3  │
 *     └───────────┴─────┴─────┘
 *
 * ── PROVENANCE (UI_SOURCING_RULES.md) ─────────────────────────────────────
 *
 * VENDORED from `react-native-fb-collage` (MIT, © 2017 Mehar Bhutta),
 * `src/fb-collage.component.tsx` + `src/fb-collage.style.ts`, cloned to
 * `ui_git_repo/fb-collage/` and copied here. The MIT notice is reproduced at
 * the foot of this file.
 *
 * What was borrowed is the GEOMETRY — hero at `flex: 1`, the remainder in a
 * `flexWrap: 'column'` block of quarter tiles, a cap at four with the overflow
 * count blurred over the fourth. That arithmetic is the whole reason to copy
 * rather than write: it degrades correctly at 1, 2, 3, 4 and 40 photos, and
 * getting those five cases right from scratch is an afternoon.
 *
 * What was searched first, and why it lost:
 *   L1 in-tree — `GroupPhotoCard` (the step-1 card) is a horizontal STRIP of
 *      one group's photos. Right for reviewing one group, wrong for comparing
 *      ten: ten strips is the ragged, unbounded thing being replaced.
 *   L1 web — `GreenBridgeSeller-release/src/pages/new-submission-upload/`
 *      renders this decision inline in a 3500-line page; nothing extractable.
 *   L2 kit — no image-composition primitive at all.
 *   L3 others — `react-native-reusables` (MIT, cloned to `ui_git_repo/rnr/`)
 *      ships `radio-group.tsx`, but it is a bare 16pt dot + label on NativeWind
 *      and `@rn-primitives`, and NativeWind is what the v2 layer moved off
 *      (see `reference_nativewind_drops_function_styles`).
 *      `react-native-thumbnail-group` looked exactly right from its README
 *      — "grouped thumbnails like the iOS Photos app" — but the repo contains
 *      a LICENSE and nothing else; the source was never published.
 *      `@paraboly/react-native-card`, `react-native-simple-card` and
 *      `react-native-card-view` are card shells with no composition logic.
 *
 * ── WHAT WAS CHANGED ON THE WAY IN ────────────────────────────────────────
 *
 * 1. Class component → function. Everything in this app is hooks; the original
 *    is from 2017 and computes its styles in the CONSTRUCTOR, so a resize
 *    never reaches them.
 * 2. `ImageBackground` + `TouchableOpacity` → `Image` + a plain `View`. The
 *    tile is a preview inside a radio card: making each photo independently
 *    pressable would put twelve competing targets inside one option and steal
 *    the card's own tap.
 * 3. Hardcoded `#0000009d` and `fontSize: 24` → `scrimDeep` / `onScrim` and a
 *    `Text` variant. The original's overlay is a translucent black that
 *    composites differently over every photo; `scrimDeep` does not depend on
 *    what is behind it (same reasoning as the × in `group-photo-card.tsx`).
 * 4. `blurRadius` on the `+N` tile dropped. It is unsupported on some Android
 *    image pipelines and silently no-ops, so the count would land on an
 *    unblurred photo at full contrast on exactly the devices that need it most.
 *    The deep scrim does that job predictably.
 * 5. A `failed` guard per image. These are local `file://` captures that go
 *    stale when the OS clears its cache — the same trap documented on
 *    `GroupPhotoCard`. The original renders a silent grey hole.
 */
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ImageOff } from 'lucide-react-native';

import { Text } from '@/features/v2/ui';
import { radius, space, useV2Colors } from '@/theme/v2';

/** How many photos fit before the last tile becomes a `+N` counter. */
const MAX_TILES = 4;

export function GroupMosaic({
  uris,
  size,
}: {
  uris: string[];
  /** The tile is square. Callers size it; it does not measure itself. */
  size: number;
}) {
  const c = useV2Colors();
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  if (uris.length === 0) {
    return (
      <View
        style={[styles.frame, { width: size, height: size, backgroundColor: c.fill }]}
        // flat: an empty placeholder has no content to light.
      >
        <ImageOff color={c.inkSubtle} size={18} strokeWidth={1.8} />
      </View>
    );
  }

  const shown = uris.slice(0, MAX_TILES);
  const overflow = uris.length - MAX_TILES;
  const rest = shown.slice(1);

  const photo = (uri: string, i: number, style: object) => (
    <View
      key={`${uri}-${i}`}
      // The ground behind a photograph that fills it edge to edge — visible
      // only while the image loads or when it fails, so a gradient here is one
      // nobody ever sees, and the mosaic's seams already carry the structure.
      // flat: (Row.tsx:248)
      style={[styles.cell, style, { backgroundColor: c.fill }]}
    >
      {failed[i] ? (
        <View style={styles.centre}>
          <ImageOff color={c.inkSubtle} size={14} strokeWidth={1.8} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed((p) => ({ ...p, [i]: true }))}
        />
      )}
      {/*
        The `+N` sits on the LAST shown tile, which is the original's rule —
        the fourth slot doubles as the counter rather than stealing a fifth.
      */}
      {i === shown.length - 1 && overflow > 0 ? (
        // flat: a scrim over a photograph, not a surface.
        <View style={[styles.centre, styles.overlay, { backgroundColor: c.scrimDeep }]}>
          <Text variant="micro" color="onScrim">
            {`+${overflow}`}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={[styles.frame, { width: size, height: size }]}
      /*
        One image, decorative: the group's identity is spoken by the card that
        owns this tile, and per-photo labels inside a preview would make a
        screen reader read ten groups as forty items.
      */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The hero takes the left half, or the whole tile when it is alone. */}
      <View style={styles.hero}>{photo(shown[0], 0, StyleSheet.absoluteFill as object)}</View>

      {rest.length > 0 ? (
        /*
          `flexWrap: 'wrap'` on a COLUMN, straight from the original: with two
          remaining photos it makes one full-height column, with three it wraps
          into a 2×2 quarter grid. One rule, four layouts.
        */
        <View style={styles.restColumn}>
          {rest.map((uri, i) =>
            photo(uri, i + 1, rest.length === 1 ? styles.restFull : styles.restQuarter),
          )}
        </View>
      ) : null}
    </View>
  );
}

const GAP = 2;

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP,
  },
  hero: { flex: 1, alignSelf: 'stretch' },
  restColumn: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  restFull: { width: '100%', height: '100%' },
  // 50% minus half the gap, so two across plus one gap is exactly the column.
  restQuarter: { width: `${50}%`, height: `${50}%`, flexGrow: 1, flexBasis: '45%' },
  cell: { overflow: 'hidden', position: 'relative' },
  // `absoluteFillObject` is not in this RN version's types — the spreadable
  // object is `absoluteFill` itself.
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {},
});

/*
  ── MIT LICENCE (react-native-fb-collage) ─────────────────────────────────

  Copyright (c) Mehar Bhutta

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/
