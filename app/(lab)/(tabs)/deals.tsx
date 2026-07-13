// (lab) Messages — the buyer↔seller conversation inbox (mobile port of the web
// `101lab-2/src/pages/chat/BuyerAllChatList.tsx`). Replaces the old Deals
// placeholder. Lists every seller the buyer has a conversation with (via
// `useConversations` → Node `GET /chat/buyer/:id/sellers`, kept live over the
// shared socket); tapping a row opens the direct thread (`/(lab)/deal/[id]`).
//
// The same thread screen is the target of the Match Detail "Contact seller" CTA
// — one messaging surface for both entry points. Tab bar SHOWS here (the thread
// hides it). Redesign: gradient header badge + a proper empty state (soft chat
// medallion → "See your matches"), matching the mockup's Messages phones.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, MessageSquareText, Search } from 'lucide-react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { LabScreenBg } from '@/features/lab/components';
import { brand, fonts, greenDarkest, greenLight, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { usePop, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { useConversations } from '@/features/lab/messages/useConversations';
import { ConversationRow } from '@/features/lab/messages/components/ConversationRow';
import type { ConversationRow as ConversationRowData } from '@/features/lab/messages/chatApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const LAB_GUTTER = 22;

export default function LabMessages() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { conversations, isLoading, isError, isEmpty, refetch } = useConversations();

  const cta = usePressScale();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) => {
      const name = (c.display_name || c.user_email || '').toString().toLowerCase();
      const listing = (c.batch_title || c.product_name || '').toString().toLowerCase();
      return name.includes(term) || listing.includes(term);
    });
  }, [conversations, q]);

  const openThread = (c: ConversationRowData) => {
    const name = (c.display_name || c.user_email || t('mobile.labMessages.sellerFallback')).toString();
    const listingTitle = (c.batch_title || c.product_name || '').toString();
    router.push({
      pathname: '/(lab)/deal/[id]',
      params: { id: String(c.batch_id), sellerId: String(c.ID), name, listingTitle },
    });
  };

  const goToMatches = () => {
    haptics.tap();
    router.push('/(lab)/(tabs)/matches');
  };

  const showEmpty = !isLoading && !isError && (isEmpty || conversations.length === 0);

  return (
    <LabScreenBg>
    <Screen
      scroll
      padded={false}
      edges={['top']}
      keyboardAware={false}
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: LAB_GUTTER,
        paddingBottom: 96 + insets.bottom,
      }}
    >
      {/* Header — gradient medallion + title (mockup `.mw-head`). */}
      <Animated.View entering={usePop()} style={styles.header}>
        <LinearGradient
          colors={['#2A7D59', greenDarkest]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <MessageSquareText size={18} color={greenLight} strokeWidth={2} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('mobile.labMessages.title')}</Text>
          <Text style={styles.subtitle}>{t('mobile.labMessages.subtitle')}</Text>
        </View>
      </Animated.View>

      {/* Search — only when there's something to search. */}
      {conversations.length > 0 ? (
        <View style={styles.searchBar}>
          <Search size={16} color={lab.inkMeta} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder={t('mobile.labMessages.searchPlaceholder')}
            placeholderTextColor={lab.inkFaint}
          />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={brand.primary} />
          <Text style={styles.centeredText}>{t('mobile.labMessages.loading')}</Text>
        </View>
      ) : isError ? (
        <EmptyState
          title={t('mobile.labMessages.errorTitle')}
          description={t('mobile.labMessages.errorBody')}
          actionLabel={t('mobile.labMessages.retry')}
          onAction={refetch}
        />
      ) : showEmpty ? (
        <View style={styles.empty}>
          <View style={styles.emptyMedallion}>
            <MessageSquareText size={38} color={greenMedium} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('mobile.labMessages.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>
            {t('mobile.labMessages.emptyBody')}
          </Text>
          <AnimatedPressable
            onPress={goToMatches}
            onPressIn={cta.onPressIn}
            onPressOut={cta.onPressOut}
            style={[styles.emptyCta, cta.style]}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labMessages.seeMatches')}
          >
            <Text style={styles.emptyCtaText}>{t('mobile.labMessages.seeMatches')}</Text>
            <ChevronRight size={15} color="#fff" strokeWidth={2.4} />
          </AnimatedPressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>{t('mobile.labMessages.noMatch', { query: q })}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((c, i) => (
            <ConversationRow key={`${c.ID}-${c.batch_id}`} data={c} index={i} onPress={openThread} />
          ))}
        </View>
      )}
    </Screen>
    </LabScreenBg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: 16 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 26, color: lab.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: lab.inkSub, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: lab.hairline,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: brand.surface,
    marginBottom: spacing.xs,
  },
  searchInput: { flex: 1, minHeight: 42, fontFamily: fonts.regular, fontSize: 14, color: lab.ink },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 72 },
  centeredText: { fontFamily: fonts.regular, fontSize: 13, color: lab.inkSub, textAlign: 'center' },
  list: { marginTop: spacing.xs },
  // Empty state (mockup `.empty`) — vertically centred within the scroll body.
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'] },
  emptyMedallion: {
    width: 90,
    height: 90,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.headingBold, fontSize: 18, lineHeight: 22, color: lab.ink, textAlign: 'center' },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: lab.inkSub,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 260,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: greenDarkest,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyCtaText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
});
