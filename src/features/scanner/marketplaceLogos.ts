import type { ImageSourcePropType } from 'react-native';

import type { MarketplaceKey } from '@/stores/scanDraftStore';

/**
 * The real marketplace wordmarks, pulled from each live storefront
 * (101lab.co, 101machines.com, 101it.co) on 2026-08-20 and stored unmodified.
 *
 * ⚠️ READ THIS BEFORE USING THEM IN A LIST.
 * All three are the SAME artwork apart from one word: an identical navy/teal
 * globe, then "101LAB" / "101MACHINE" / "101IT", then an identical
 * "by GREENBIDZ" sub-line. Rendered side by side you get three identical globes,
 * three identical sub-lines, and the only thing that distinguishes them — the
 * word — rendered smallest. So:
 *
 *   • ONE at a time (the confirmed state): use the logo. It reads well and it is
 *     the strongest signal of "this is where your item is going".
 *   • SEVERAL together (the picker): the logo is decoration, not information.
 *     Lead with the NAME as text plus the identity colour, and keep the logo
 *     small and secondary.
 *
 * At a row height of ~20px the "by GREENBIDZ" sub-line is illegible — that is a
 * property of the artwork, not of the layout. A wordmark-only variant (globe and
 * sub-line removed) would fix it, but cropping a brand mark ourselves is a
 * branding decision, so it is left to the owner rather than done here.
 *
 * 101recycle has NO logo of its own: its storefront (101recycle.com) serves the
 * corporate GreenBidz mark. `logoFor` returns null for it, and every caller must
 * handle that — identity colour + name is the fallback. 101recycle is also not
 * in the mobile allow-list yet (integration C2), so today the null path is only
 * reachable if someone widens that env var.
 */
const LOGOS: Partial<Record<MarketplaceKey, ImageSourcePropType>> = {
  '101lab': require('../../../assets/images/marketplaces/101lab.png') as ImageSourcePropType,
  '101machine': require('../../../assets/images/marketplaces/101machine.png') as ImageSourcePropType,
  '101it': require('../../../assets/images/marketplaces/101it.png') as ImageSourcePropType,
};

/** Aspect ratio (w / h) per logo, measured from the source files, so a caller
 *  can set a height and get the width right without guessing or distorting. */
const RATIOS: Partial<Record<MarketplaceKey, number>> = {
  '101lab': 251 / 98,
  '101machine': 378 / 116,
  '101it': 622 / 222,
};

/** The marketplace's own mark, or null when it does not have one. */
export function logoFor(m: MarketplaceKey): ImageSourcePropType | null {
  return LOGOS[m] ?? null;
}

/** Width for a given rendered height, preserving the source aspect ratio. */
export function logoWidthFor(m: MarketplaceKey, height: number): number {
  const r = RATIOS[m];
  return r ? Math.round(height * r) : 0;
}

/**
 * Identity colour per marketplace — the brand palette, reserved for identity and
 * never used as a filled background (a statement must not read as a status chip).
 * These are the four GreenBidz brand colours from the design system.
 */
export const MARKETPLACE_COLOR: Record<MarketplaceKey, string> = {
  '101lab': '#35C3AA',
  '101machine': '#2F4572',
  '101it': '#7AD5D7',
  '101recycle': '#82C880',
};
