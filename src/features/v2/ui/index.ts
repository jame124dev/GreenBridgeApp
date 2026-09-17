/**
 * v2 primitive kit.
 *
 * Screens compose these. A screen that needs a primitive this kit does not
 * have should ADD one here rather than inline it — that is the difference
 * between eleven screens that look like one app and eleven that nearly do.
 *
 * Most of what follows arrived as a KIT GAP report from a screen build:
 * `BrandBar`, `Chip` and `Tabs` were each independently rebuilt by two or
 * three screens before being reconciled here.
 */

// Shell
export { Screen, useTabBarReserve } from './Screen';
export { Surface, MaterialFill } from './Surface';
export { ScrimPill, type ScrimPillTone } from './ScrimPill';
export { StagedChip } from './StagedChip';
export { PickerRow } from './PickerRow';
export { TabBar } from './TabBar';

// Type
export { Text, type TextColor, type TextProps } from './Text';

// Structure
export { Hairline } from './Hairline';
export { SectionHeader } from './SectionHeader';
export { SectionNote } from './SectionNote';
export { EmptyState } from './EmptyState';
export { BrandBar } from './BrandBar';
export { Tabs, HOME_MODE_TABS, type TabItem, type HomeMode } from './Tabs';

// Content
export { Bubble, type BubbleFrom } from './Bubble';
export { Row, RowThumb, RowTrailing } from './Row';
export { TintedRow } from './TintedRow';
export { PromoBanner } from './PromoBanner';
export { Chip } from './Chip';
export { SoftPanel } from './SoftPanel';
export { Stepper } from './Stepper';
export { Field, GlyphButton, type FieldProps } from './Field';
export { ProgressLine } from './ProgressLine';
export { Timeline, type TimelineStep } from './Timeline';

// Motion — see the file header for which of these is gated vs eased.
export { EnterOnMount, Shimmer } from './Motion';

// Actions
export { PrimaryAction } from './PrimaryAction';
export { QuietAction } from './QuietAction';
export { PillButton, type PillTone } from './PillButton';
export { IconAction } from './IconAction';

// Development only — renders null in production builds.
export { SchemeToggleDev } from './SchemeToggleDev';
