// Static tab config for the FrostedTabBar (NewVersion/08-bottom-nav.md §5.1).
// Layout/labels/icons only — badge COUNTS are live and live in FrostedTabBar
// (`useMatchesBadgeCount`). The prototype's `STATIC_BADGES = { matches: 3 }`
// used to live here and shipped a hardcoded "3" on every account, including
// brand-new ones with zero wants; never reintroduce a literal count here.
import { Home, Search, Sparkles, MessageSquare, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export type BadgeKey = 'matches' | 'deals';

// `labelKey` is the i18n key suffix under `mobile.labNav` — this is a plain data
// module (no React), so the label is translated at render in FrostedTabBar via
// t(`mobile.labNav.${labelKey}`). `label` stays as the English fallback.
export const TAB_CONFIG: readonly {
  name: string;
  label: string;
  labelKey: string;
  Icon: LucideIcon;
  badgeKey?: BadgeKey;
}[] = [
  { name: 'home', label: 'Home', labelKey: 'home', Icon: Home },
  { name: 'browse', label: 'Browse', labelKey: 'browse', Icon: Search },
  { name: 'matches', label: 'Matches', labelKey: 'matches', Icon: Sparkles, badgeKey: 'matches' },
  // `deals` = the Messages inbox. Its badge is unread MESSAGES, resolved live in
  // FrostedTabBar via `useUnreadMessagesCount` (never a literal here — see above).
  { name: 'deals', label: 'Chat', labelKey: 'chat', Icon: MessageSquare, badgeKey: 'deals' },
  { name: 'account', label: 'Account', labelKey: 'account', Icon: User },
] as const;
