// Static tab config for the FrostedTabBar (NewVersion/08-bottom-nav.md §5.1).
// Keep TabBadge pure (count prop) so the badge source can later swap to a
// React Query / Zustand selector with a one-line change here.
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
  { name: 'deals', label: 'Chat', labelKey: 'chat', Icon: MessageSquare },
  { name: 'account', label: 'Account', labelKey: 'account', Icon: User },
] as const;

// Static badge counts — matches the prototype's hardcoded "3".
export const STATIC_BADGES: Record<BadgeKey, number> = { matches: 3, deals: 0 };
