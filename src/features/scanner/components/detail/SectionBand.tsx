import { Children, Fragment, createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { brand } from '@/constants/theme';

/**
 * Grey section bands + the full-bleed white groups that sit under them.
 *
 * WHY THIS EXISTS. The review screen stacked eight identical bordered cards, so
 * the four fields that block submission looked exactly like the four the AI had
 * already finished — "everything has the same visual weight" was the one finding
 * all three reviewers reached independently (`Docs/scan/FORM_UX_PANEL.md` §A).
 * Mercari's answer, which `_refs/ref-mercari-list-an-item.jpg` shows and
 * `FORM_UX_RESEARCH.md` §2.1 argues for, is a grey spacer band carrying a plain
 * sentence-case heading, then full-bleed white content with a hairline between
 * rows: one divider doing the work a border per card was doing badly.
 *
 * ⚠️ WHY THE OLD CARD FRAME IS A CONTEXT AND NOT A DELETION.
 *
 * `IdentityCard`, `DescriptionCard`, `CategoryConditionCard`, `PricingCard`,
 * `SpecsCard` and `LocationCard` are mounted by THREE screens, not one:
 * `app/scan/detail.tsx`, `app/scan/grouped-edit.tsx` and
 * `app/(lab)/listing-edit.tsx`. Only the first is being restructured. Ripping the
 * frame out of the components unconditionally would leave the other two as
 * borderless fields floating on a near-white ground with nothing separating one
 * group from the next — a regression on screens this pass is not allowed to
 * re-lay-out. So the frame moves BEHIND a context whose default is the frame:
 * every existing mount renders exactly what it rendered before, and the one
 * screen that opts in gets the bands.
 *
 * When the other two screens are restructured, flip the default to `'flush'` and
 * delete the `'card'` branch — do not add a third surface.
 */
export type FieldGroupSurface = 'card' | 'flush';

const SurfaceContext = createContext<FieldGroupSurface>('card');

/** Opts a subtree into the banded, full-bleed presentation. */
export function FieldGroupSurfaceProvider({
  value,
  children,
}: {
  value: FieldGroupSurface;
  children: ReactNode;
}) {
  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

export function useFieldGroupSurface(): FieldGroupSurface {
  return useContext(SurfaceContext);
}

/**
 * The grey spacer band that titles the group beneath it.
 *
 * Sentence case, not the letterspaced caps the field labels use: this is a
 * statement about what follows ("Details", "Pricing"), and GOV.UK's question-page
 * pattern is explicit that a group heading should read as a statement while the
 * labels under it recede.
 *
 * `title` is optional. A bare band is a PLAIN SPACER — Vinted uses one between
 * the photo strip and the first field block, where a heading would be naming
 * something the fields already say.
 */
export function SectionBand({ title }: { title?: string }) {
  return (
    <View style={[styles.band, !title && styles.bandBare]}>
      {title ? <Text style={styles.bandTitle}>{title}</Text> : null}
    </View>
  );
}

/**
 * One group of fields.
 *
 * In `'flush'` mode the group is a full-bleed white block, hairline-ruled top and
 * bottom against the grey band, with a hairline between each DIRECT CHILD. That
 * is why the cards group their own rows into single children where two controls
 * belong together (brand + model + the nameplate hint are one child, not three):
 * the divider boundaries are the card's statement about what belongs with what,
 * and this component only draws them.
 */
export function FieldGroup({ children }: { children: ReactNode }) {
  const surface = useFieldGroupSurface();

  if (surface === 'card') {
    return (
      <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
        {children}
      </View>
    );
  }

  // `toArray` drops the `null`s that the cards' `{cond ? … : null}` branches
  // yield, so a hidden row never leaves a stray divider behind.
  const rows = Children.toArray(children);
  return (
    <View style={styles.flush}>
      {rows.map((child, i) => (
        <Fragment key={(child as { key?: string }).key ?? i}>
          {i > 0 ? <View style={styles.hairline} /> : null}
          <View style={styles.flushRow}>{child}</View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    // The screen's own ground, stated explicitly: the band has to read as grey
    // whatever it is dropped onto, and `Screen` owning the colour is not a
    // guarantee this component can rely on.
    backgroundColor: brand.background,
    // 24 matches GUTTER, so the heading sits on the same left edge as the field
    // content below it even though the white block draws to both screen edges.
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  // No heading to make room for: the band is only the gap between two blocks.
  bandBare: { paddingTop: 16, paddingBottom: 0 },
  bandTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 16,
    color: brand.foreground,
  },
  flush: {
    backgroundColor: brand.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: brand.border,
    paddingHorizontal: 24,
  },
  flushRow: { paddingVertical: 14 },
  // `brand.divider` (#eef2f9) is all but invisible against white; `brand.border`
  // is the lightest rule that still reads as a rule on a device.
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: brand.border },
});
