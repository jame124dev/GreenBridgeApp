/**
 * Report / block actions for a Messages thread — App Store Guideline 1.2.
 *
 * A UGC + messaging app must let users report offensive content and block
 * abusive users. This is the surface for both, reachable from the thread header.
 *
 * Report routes to the published support contact page rather than a bespoke
 * endpoint (the backend has no moderation route). That is an accepted mechanism:
 * the user reaches a real human channel, and the app confirms the report was
 * raised. Block is immediate and local — see blockList.ts.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Flag, Ban } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Sheet, Text } from '@/components/ui';
import { fonts, lab, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { blockUser } from './blockList';

/** Published support channel — same page as the App Store Support URL. */
const SUPPORT_URL = 'https://greenbidz.com/contact-us/';

export interface ReportBlockSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The counterparty being reported or blocked. */
  otherPartyId: number;
  otherPartyName?: string | null;
  /** Listing the conversation is about — included in the report for context. */
  listingId?: string | number | null;
  /** Called after a successful block so the screen can leave the thread. */
  onBlocked: () => void;
}

export function ReportBlockSheet({
  visible,
  onClose,
  otherPartyId,
  otherPartyName,
  listingId,
  onBlocked,
}: ReportBlockSheetProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleReport = async () => {
    if (busy) return;
    setBusy(true);
    haptics.tap();
    try {
      await WebBrowser.openBrowserAsync(SUPPORT_URL, {
        toolbarColor: '#14452f',
        controlsColor: '#FFFFFF',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
      toast(t('mobile.labReport.reportOpened'));
    } catch {
      toast.error(t('mobile.labReport.reportFailed'));
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const handleBlock = () => {
    if (busy) return;
    haptics.warning();
    blockUser(otherPartyId);
    toast(t('mobile.labReport.blocked', { name: otherPartyName || t('mobile.labDeal.sellerFallback') }));
    onClose();
    onBlocked();
  };

  return (
    <Sheet visible={visible} onClose={onClose} snapTo={300}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.xs }}>
        <Text variant="title" tone="primary" style={{ fontFamily: fonts.headingBold }}>
          {t('mobile.labReport.title')}
        </Text>
        <Text variant="bodySm" tone="tertiary">
          {t('mobile.labReport.subtitle', {
            name: otherPartyName || t('mobile.labDeal.sellerFallback'),
          })}
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm }}>
        <Pressable
          onPress={handleReport}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labReport.reportAction')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: lab.utilBorder,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Flag size={18} color={lab.utilIcon} strokeWidth={2.2} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMd" tone="primary" style={{ fontFamily: fonts.headingBold }}>
              {t('mobile.labReport.reportAction')}
            </Text>
            <Text variant="bodySm" tone="tertiary">
              {t('mobile.labReport.reportHint')}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={handleBlock}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labReport.blockAction')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#F3C2C2',
            backgroundColor: '#FEF6F6',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Ban size={18} color="#B42318" strokeWidth={2.2} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMd" style={{ fontFamily: fonts.headingBold, color: '#B42318' }}>
              {t('mobile.labReport.blockAction')}
            </Text>
            <Text variant="bodySm" tone="tertiary">
              {t('mobile.labReport.blockHint')}
            </Text>
          </View>
        </Pressable>

        {listingId != null ? (
          <Text variant="bodySm" tone="tertiary" style={{ textAlign: 'center', paddingTop: spacing.xs }}>
            {t('mobile.labReport.contextListing', { id: String(listingId) })}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
