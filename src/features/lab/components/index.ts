// Barrel for (lab) customer-app chrome components.
export { FrostedTabBar, useTabBarHeight, TAB_BAR_BASE_HEIGHT } from './FrostedTabBar';
export { TabBarItem } from './TabBarItem';
export { TabBadge } from './TabBadge';
export { TAB_CONFIG, STATIC_BADGES, type BadgeKey } from './tabConfig';
export { LabPlaceholder, type NextAction } from './LabPlaceholder';
export { AttachmentChips } from './AttachmentChips';
export { HomeRecentListings } from './HomeRecentListings';
export { LabScreenBg } from './LabScreenBg';
export { UploadSourceSheet, type UploadSource } from './UploadSourceSheet';

// Matches & Messages redesign — shared visual primitives.
export { RelevanceRing, type RelevanceRingProps } from './RelevanceRing';
export { ProductThumb, type ProductThumbProps } from './ProductThumb';

// Home / Tell-AI screen components (spec 01-home-tell-ai).
export { LabHeader } from './homeLabHeader';
export { LabLocationChip, LabSetLocationChip } from './LabLocationChip';
export { LabLocationPromptStrip } from './LabLocationPromptStrip';
export { ModeToggle } from './homeModeToggle';
export { AiComposer } from './homeAiComposer';
export { ComposerSendButton } from './homeComposerSendButton';
export { QuickStartChip } from './homeQuickStartChip';
export { OrbitLogo } from './homeOrbitLogo';
export { SparkleIcon } from './homeSparkleIcon';

// Processing screen components (spec 02-processing).
export { ProcessingSpinner } from './ProcessingSpinner';
export { ProcessingStepRow } from './ProcessingStepRow';

// Deal Room screen components (spec 07-deal-room).
export { DealManagedBanner } from './DealManagedBanner';
export { DealMessageBubble } from './DealMessageBubble';
export { DealComposer } from './DealComposer';
export { DealVerifiedSeal, DealSparkle } from './dealIcons';
