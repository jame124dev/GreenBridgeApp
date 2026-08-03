// Notification type → icon + i18n label key + accent colours. Mobile port of
// nextjs-port/src/shared/components/notifications/notificationMeta.ts, merging
// the web's buyer + seller maps (the lab app is a combined buyer/seller user).
import type { LucideIcon } from 'lucide-react-native';
import {
  Bell,
  Banknote,
  Calendar,
  CheckCircle2,
  Gavel,
  MessageSquare,
  PackageCheck,
  PartyPopper,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react-native';

export type NotificationAccent =
  | 'blue' | 'green' | 'amber' | 'violet' | 'indigo' | 'emerald' | 'neutral';

/** Accent → { tile bg, icon fg }. Matches the web tailwind palette. */
export const ACCENT: Record<NotificationAccent, { bg: string; fg: string }> = {
  blue: { bg: '#EFF6FF', fg: '#2563EB' },
  green: { bg: '#ECFDF5', fg: '#059669' },
  amber: { bg: '#FFFBEB', fg: '#D97706' },
  violet: { bg: '#F5F3FF', fg: '#7C3AED' },
  indigo: { bg: '#EEF2FF', fg: '#4F46E5' },
  emerald: { bg: '#ECFDF5', fg: '#047857' },
  neutral: { bg: '#F1F5F9', fg: '#64748B' },
};

export interface NotificationTypeMeta {
  Icon: LucideIcon;
  /** i18n key suffix under mobile.labNotif.type.* */
  labelKey: string;
  accent: NotificationAccent;
}

const META: Record<string, NotificationTypeMeta> = {
  chat: { Icon: MessageSquare, labelKey: 'message', accent: 'blue' },
  // AI background recognition → "your listing draft is ready". Amber + sparkles
  // to match the DRAFT / AI badge language on the drafts cards.
  recognition: { Icon: Sparkles, labelKey: 'recognitionReady', accent: 'amber' },
  'Bid Accepted': { Icon: PartyPopper, labelKey: 'bidAccepted', accent: 'green' },
  'Offer Accepted': { Icon: CheckCircle2, labelKey: 'offerAccepted', accent: 'green' },
  'Batch Updated': { Icon: Calendar, labelKey: 'batchUpdate', accent: 'amber' },
  'Listing Approved': { Icon: CheckCircle2, labelKey: 'listingApproved', accent: 'green' },
  'Auction Group Approved': { Icon: Gavel, labelKey: 'auctionApproved', accent: 'green' },
  network_invitation: { Icon: UserPlus, labelKey: 'networkInvite', accent: 'indigo' },
  network_accepted: { Icon: Users, labelKey: 'networkAccepted', accent: 'indigo' },
  payment_received: { Icon: Banknote, labelKey: 'paymentReceived', accent: 'emerald' },
  order_created: { Icon: ShoppingBag, labelKey: 'orderCreated', accent: 'violet' },
  order_status_updated: { Icon: PackageCheck, labelKey: 'orderUpdate', accent: 'violet' },
};

/**
 * Every server notification type we render a specific label for. Exported so
 * the i18n test can walk it — a new entry in META then fails the locale check
 * instead of shipping a raw key path to the notification list.
 */
export const NOTIFICATION_TYPES = Object.keys(META);

const DEFAULT_META: NotificationTypeMeta = { Icon: Bell, labelKey: 'default', accent: 'neutral' };

export function notificationMeta(type: string): NotificationTypeMeta {
  return META[type] ?? DEFAULT_META;
}
