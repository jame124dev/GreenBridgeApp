// The one piece of friction on the publish path, shown BEFORE the user taps
// Submit — not after.
//
// Authoring is open to everyone (see `@/features/seller/sellerSubmitGate`), so a
// user can reach a finished draft without ever having been told that publishing
// needs seller details. Discovering that by tapping the primary CTA and being
// thrown onto a company form is exactly the "no surprises / feedback before
// action" rule in UX_DESIGN_RULES. This notice sits directly above the CTA on
// both submit screens and says what will happen, in the wording that matches the
// user's actual state.
//
// Renders NOTHING when the user may publish, so the happy path is untouched.
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Clock, FileText, RotateCcw } from 'lucide-react-native';

import { useSellerUpgradeStatus } from '@/features/seller/useSellerUpgrade';
import { IS_CUSTOMER } from '@/lib/flags';
import { fonts, radius } from '@/constants/theme';

/** Amber = "action needed, nothing is broken". Matches DealManagedBanner's pair. */
const AMBER = { bg: '#FFFBEB', border: '#FDE68A', ink: '#92400E', icon: '#B45309' };
/** Slate = purely informational: applied and waiting, nothing for them to do. */
const SLATE = { bg: '#F8FAFC', border: '#E2E8F0', ink: '#334155', icon: '#475569' };

export function SellerApprovalNotice() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useSellerUpgradeStatus();

  // Seller fork never fetches this and is never gated — say nothing there.
  if (!IS_CUSTOMER) return null;
  // Don't flash a scary notice while the answer is still in flight; the gate
  // itself still fails closed if they tap during the fetch.
  if (isLoading) return null;
  if (status?.status === 'approved') return null;

  const pending = status?.status === 'pending';
  const rejected = status?.status === 'rejected';
  const palette = pending ? SLATE : AMBER;

  const Icon = pending ? Clock : rejected ? RotateCcw : FileText;

  const body = pending
    ? t('mobile.sellGate.noticePending', {
        defaultValue:
          'Your seller details are with our team. We’ll email you once approved — your draft is saved until then.',
      })
    : rejected
      ? t('mobile.sellGate.noticeRejected', {
          defaultValue:
            'Your seller details need a correction before this can be published. Your draft is saved.',
        })
      : t('mobile.sellGate.noticeNone', {
          defaultValue:
            'One-off step: to publish, we need your company details. Takes about two minutes — your draft is saved.',
        });

  return (
    <View
      style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="alert"
    >
      <Icon size={17} color={palette.icon} strokeWidth={2} style={styles.icon} />
      <Text style={[styles.text, { color: palette.ink }]}>{body}</Text>
    </View>
  );
}

/**
 * The submit CTA's label for the user's current state — so the button never
 * promises to publish something it is about to redirect away from.
 */
export function useSubmitCtaLabel(defaultLabel: string): string {
  const { t } = useTranslation();
  const { data: status, isLoading } = useSellerUpgradeStatus();

  if (!IS_CUSTOMER || isLoading || status?.status === 'approved') return defaultLabel;
  if (status?.status === 'pending') {
    return t('mobile.sellGate.ctaPending', { defaultValue: 'View review status' });
  }
  return t('mobile.sellGate.ctaApply', { defaultValue: 'Add seller details to publish' });
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { flexShrink: 0 },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
});
