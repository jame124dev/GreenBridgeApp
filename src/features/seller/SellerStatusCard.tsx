// SellerStatusCard — the one rendering of "where is my seller application?".
//
// Shared by `app/(lab)/sell/apply.tsx` (the surface the sell gate opens) and
// `app/(auth)/pending.tsx`, so the three states read identically wherever the
// user meets them. Purely presentational: it takes the status row and an actions
// slot, and performs no navigation or fetching of its own — that keeps it usable
// from `pending.tsx`, which is forbidden any outbound navigation (App Store
// Guideline 3.1.1; see `src/__tests__/externalLinks.test.ts`).
//
// Copy rules baked in here rather than left to each caller:
//   - **pending** never implies the app is unusable. A pending seller
//     application blocks LISTING and nothing else — browsing, AI chat, wants and
//     messaging all work — and saying otherwise is what made a fresh install
//     feel like a dead end.
//   - **rejected** always states the reviewer's reason when the server sent one,
//     because "declined" with no reason is an unrecoverable error.
//
// Strings use `t(key, { defaultValue })` so the screen reads in English until
// Phase 4 adds the locale entries.
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Hourglass, MessageSquareWarning } from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { brand } from '@/constants/theme';
import { formatBatchDate } from '@/lib/dates';
import type { SellerUpgradeStatus, SellerUpgradeStatusValue } from '@/services/seller/sellerUpgrade';

type Tone = {
  icon: typeof CheckCircle2;
  fg: string;
  bg: string;
  border: string;
};

const TONES: Record<SellerUpgradeStatusValue, Tone> = {
  pending: {
    icon: Hourglass,
    fg: brand.warningText,
    bg: brand.warningBg,
    border: brand.warningBorder,
  },
  approved: {
    icon: CheckCircle2,
    fg: brand.primaryDim,
    bg: brand.successBg,
    border: brand.successBorder,
  },
  rejected: {
    icon: MessageSquareWarning,
    fg: brand.destructiveStrong,
    bg: brand.destructiveBg,
    border: '#fecaca',
  },
};

type Props = {
  status: SellerUpgradeStatus;
  /** The action area. One dominant CTA per state — supplied by the screen so the
   *  card itself never navigates. */
  children?: React.ReactNode;
};

export function SellerStatusCard({ status, children }: Props) {
  const { t } = useTranslation();
  const tone = TONES[status.status];
  const Icon = tone.icon;

  const copy = {
    pending: {
      pill: t('mobile.seller.status.pillPending', { defaultValue: 'Under review' }),
      title: t('mobile.seller.status.titlePending', {
        defaultValue: 'Your application is with our team',
      }),
      body: t('mobile.seller.status.bodyPending', {
        defaultValue:
          'Most applications are reviewed within one business day, and we email you as soon as it is decided. Nothing else is needed from you right now.',
      }),
    },
    approved: {
      pill: t('mobile.seller.status.pillApproved', { defaultValue: 'Approved' }),
      title: t('mobile.seller.status.titleApproved', { defaultValue: 'You can list equipment' }),
      body: t('mobile.seller.status.bodyApproved', {
        defaultValue:
          'Your seller account is active. Snap a few photos and our AI drafts the listing for you.',
      }),
    },
    rejected: {
      pill: t('mobile.seller.status.pillRejected', { defaultValue: 'Needs changes' }),
      title: t('mobile.seller.status.titleRejected', {
        defaultValue: 'We could not approve this yet',
      }),
      body: t('mobile.seller.status.bodyRejected', {
        defaultValue:
          'Our team needs something corrected before you can list. Update the details below and send the application again — there is no limit on attempts.',
      }),
    },
  }[status.status];

  return (
    <Card variant="outlined" testID="seller-status-card">
      <View className="p-lg" style={{ gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View
            className="w-[36px] h-[36px] rounded-xl items-center justify-center"
            style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}
          >
            <Icon size={19} color={tone.fg} strokeWidth={2.2} />
          </View>
          <View
            className="rounded-full px-md py-[3px]"
            style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}
          >
            <Text variant="caption" className="font-bold" style={{ color: tone.fg }}>
              {copy.pill}
            </Text>
          </View>
        </View>

        <Text variant="subtitle">{copy.title}</Text>
        <Text variant="bodySm" tone="secondary">
          {copy.body}
        </Text>

        {/* Facts, only when the server actually sent them — an empty "Company: —"
            row is noise, not information. */}
        {status.company_name ? (
          <View className="flex-row" style={{ gap: 6 }}>
            <Text variant="caption" tone="tertiary">
              {t('mobile.seller.status.companyLabel', { defaultValue: 'Company' })}
            </Text>
            <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={2}>
              {status.company_name}
            </Text>
          </View>
        ) : null}
        {status.reviewed_at ? (
          <View className="flex-row" style={{ gap: 6 }}>
            <Text variant="caption" tone="tertiary">
              {t('mobile.seller.status.reviewedLabel', { defaultValue: 'Reviewed' })}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatBatchDate(status.reviewed_at)}
            </Text>
          </View>
        ) : null}

        {/* The reviewer's own words. Without this a rejection is a dead end: the
            user has no idea what to change. */}
        {status.admin_notes ? (
          <View
            className="rounded-xl p-md"
            style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}
            accessibilityLabel={t('mobile.seller.status.notesLabel', {
              defaultValue: 'What our team said',
            })}
          >
            <Text variant="caption" className="font-bold mb-xs" style={{ color: tone.fg }}>
              {t('mobile.seller.status.notesLabel', { defaultValue: 'What our team said' })}
            </Text>
            <Text variant="bodySm" tone="primary" testID="seller-status-notes">
              {status.admin_notes}
            </Text>
          </View>
        ) : null}

        {/* A rejection with no reviewer note still has to say what to do next. */}
        {status.status === 'rejected' && !status.admin_notes ? (
          <Text variant="bodySm" tone="secondary">
            {t('mobile.seller.status.noNotes', {
              defaultValue:
                'Our team did not leave a note. Check that the company name and tax ID match your registration documents, then resend.',
            })}
          </Text>
        ) : null}

        {/* Every state says the account still works — this card is about LISTING,
            never about access to the app. */}
        {status.status !== 'approved' ? (
          <Text variant="caption" tone="tertiary">
            {t('mobile.seller.status.stillUsable', {
              defaultValue:
                'Meanwhile your account works as normal: browse equipment, ask the AI assistant, post what you are looking for and message sellers.',
            })}
          </Text>
        ) : null}

        {children ? <View style={{ gap: 8 }}>{children}</View> : null}
      </View>
    </Card>
  );
}
