// Border-radius scale, tuned to the Stitch "Industrial Marketplace System"
// shape language: soft, not heavily rounded — standard elements ~4px, cards
// ~8px, pills full. The large end is compressed vs. the old scale (cards read
// tighter / more industrial); the small end is unchanged.
//
// NOTE: Stitch specs a 4px radius for "standard elements" (inputs/buttons/
// chips). We deliberately did NOT force that globally — several of those use
// literal radii or shared `md`, and shrinking them needs a per-component pass.

export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 8, // cards / large containers — Stitch rounded-lg (0.5rem)
  xl: 10,
  '2xl': 12,
  '3xl': 12,
  '4xl': 16,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;
