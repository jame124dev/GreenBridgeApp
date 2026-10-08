/**
 * Icon sizes and control heights for the scan detail form.
 *
 * WHY THIS FILE EXISTS: a rendering audit of this form on 2026-10-07 counted
 * SEVEN icon sizes in use across its components — 11, 13, 15, 16, 18, 20 and
 * 22px. No single one was wrong, which is exactly why it survived several
 * reviews: a size is only wrong relative to its neighbours. The effect is a
 * form that reads as unsettled without anything you can point at.
 *
 * Four steps, each with a stated ROLE. Pick by what the icon is doing, never by
 * what looks right in isolation — "looks right in isolation" is how we got
 * seven. If a new icon needs a size not here, the scale is wrong and this file
 * changes; do not add a one-off at the call site.
 */
export const ICON = {
  /** Inline with small-caps labels or `text-sm` body: AI badges, hint rows. */
  inline: 14,
  /** Adornment INSIDE a control: a chip's leading icon, a pill's check glyph. */
  adornment: 16,
  /** A field's own leading icon, and row affordances (chevron, stepper). */
  field: 20,
  /** Selection controls and expand toggles that must read as tappable. */
  control: 22,
} as const;

/**
 * Height of every BOXED control that can share a row with another one.
 *
 * The price-format pills and the quantity stepper sat side by side on the same
 * row, both top-aligned, at 159px and 154px tall respectively (measured off a
 * device screenshot, 1080x2400) — so their bottom edges stepped by 5px. The
 * pills got their height from `py-2.5` plus a 44pt minimum; the stepper from a
 * fixed `h-12`. Two different height models on one row cannot stay aligned.
 *
 * 48 rather than 44: it is what `h-12` already was, it clears the WCAG 2.5.8
 * minimum with room to spare, and shrinking the stepper would have been the
 * change that needed justifying.
 */
export const CONTROL_HEIGHT = 48;
