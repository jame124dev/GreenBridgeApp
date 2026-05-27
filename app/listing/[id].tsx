import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ExternalLink,
  Package,
  Tag,
  Info,
  User,
  FileText,
  Gavel,
  Calendar,
  Clock,
  MapPin,
  Layers,
  TrendingUp,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';

import { useTranslation } from 'react-i18next';

import { AppImage } from '@/components/ui';
import { fonts } from '@/theme/typography';
import { useBatchDetail } from '@/features/scanner/useBatchDetail';
import type { BatchDetail, ProductDetail } from '@/services/scanner/fetchBatchDetail';
import { formatBatchDate as formatDate, formatBatchDateTime as formatDateTime } from '@/lib/dates';
import { getSellerListingWebUrl } from '@/lib/env';
import { safeBack } from '@/lib/safeBack';

// Polished detail view — hero image, at-a-glance stat strip, compact info cards.
// Same API endpoint as the web SellerBatchDetails.tsx; structure flattened for one phone column.

function formatCurrency(amount?: number, currency?: string): string {
  if (amount == null) return '—';
  const prefix = currency === 'TWD' ? 'NT$' : '$';
  return `${prefix}${amount.toLocaleString()} ${currency ?? ''}`.trim();
}

export default function ListingDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const batchPk = id ? Number(id) : NaN;
  const { data, isLoading, isError, refetch } = useBatchDetail(
    Number.isFinite(batchPk) ? batchPk : undefined,
  );

  const webUrl = getSellerListingWebUrl(Number.isFinite(batchPk) ? batchPk : undefined);

  const openWeb = () => {
    if (!webUrl) return;
    void Linking.openURL(webUrl);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <ChevronLeft color="#121c28" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('mobile.listing.heading')}</Text>
        {webUrl ? (
          <Pressable onPress={openWeb} hitSlop={12} accessibilityLabel={t('mobile.listing.openOnWebsite')}>
            <ExternalLink color="#121c28" size={20} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#14452f" style={{ marginTop: 24 }} />
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.error}>{t('mobile.listing.loadFailed')}</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>{t('mobile.common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Hero batch={data} />
          <StatStrip batch={data} />
          <ProductsSection products={data.products} />
          <BiddingSection bidding={data.bidding} />
          <BatchInfoSection batch={data} />
          <InspectionSection inspection={data.inspection} />

          {webUrl ? (
            <Pressable style={styles.webBtn} onPress={openWeb}>
              <ExternalLink color="#fff" size={18} />
              <Text style={styles.webBtnText}>{t('mobile.listing.openOnWebsite')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Hero header with cover image + overlaid title/status ────────────────────

function Hero({ batch }: { batch: BatchDetail }) {
  const cover = batch.products[0]?.images?.[0];
  const approved = batch.approvalStatus === 'approved';
  const rejected = batch.approvalStatus === 'rejected';
  const approvalLabel = batch.approvalStatus
    ? batch.approvalStatus.toUpperCase()
    : null;
  const approvalTone = approved
    ? heroApproval.approved
    : rejected
      ? heroApproval.rejected
      : heroApproval.pending;
  const approvalTextTone = approved
    ? heroApproval.approvedText
    : rejected
      ? heroApproval.rejectedText
      : heroApproval.pendingText;

  return (
    <View style={styles.hero}>
      {cover ? (
        <AppImage source={{ uri: cover }} style={styles.heroImage} />
      ) : (
        <LinearGradient
          colors={['#14452f', '#236b48']}
          style={styles.heroImage}
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']}
        style={styles.heroGradient}
      />
      <View style={styles.heroBody}>
        <Text style={styles.heroBatchId}>ID {batch.batchPk}</Text>
        <Text style={styles.heroTitle}>Batch #{batch.batchNumber}</Text>
        <View style={styles.heroPillRow}>
          {batch.status ? (
            <View style={styles.heroStatusPill}>
              <Text style={styles.heroStatusPillText}>
                {batch.status.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          ) : null}
          {approvalLabel ? (
            <View style={[styles.heroApprovalPill, approvalTone]}>
              {approved ? (
                <CheckCircle2 color="#15803d" size={11} />
              ) : rejected ? (
                <AlertCircle color="#b91c1c" size={11} />
              ) : (
                <Clock color="#b45309" size={11} />
              )}
              <Text style={[styles.heroApprovalPillText, approvalTextTone]}>{approvalLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── At-a-glance stat strip ──────────────────────────────────────────────────

function StatStrip({ batch }: { batch: BatchDetail }) {
  const stats: { label: string; value: string }[] = [
    { label: 'Items', value: String(batch.productCount) },
    { label: 'Bids', value: String(batch.bidding?.buyerBidCount ?? 0) },
    {
      label: 'Comm.',
      value: batch.commissionPercent != null ? `${batch.commissionPercent}%` : '—',
    },
    { label: 'Step', value: batch.step != null ? String(batch.step) : '—' },
  ];
  return (
    <View style={styles.statStrip}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.statCell, i < stats.length - 1 && styles.statCellDivider]}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Products ────────────────────────────────────────────────────────────────

function ProductsSection({ products }: { products: ProductDetail[] }) {
  if (products.length === 0) return null;
  return (
    <SectionCard
      icon={<Package color="#14452f" size={16} />}
      title="Products"
      rightLabel={`${products.length} item${products.length !== 1 ? 's' : ''}`}
    >
      {products.map((p) => <ProductCard key={p.productId} product={p} />)}
    </SectionCard>
  );
}

function ProductCard({ product }: { product: ProductDetail }) {
  const cover = product.images[0];
  const extras = product.images.slice(1, 5);
  const overflow = product.images.length > 5 ? product.images.length - 5 : 0;

  return (
    <View style={styles.productCard}>
      <View style={styles.productRow}>
        {cover ? (
          <AppImage source={{ uri: cover }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImageFallback]}>
            <Package color="#94a3b8" size={26} />
          </View>
        )}
        <View style={styles.productBody}>
          <Text style={styles.productTitle} numberOfLines={2}>{product.title || 'Untitled'}</Text>
          {product.description ? (
            <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
          ) : null}

          <View style={styles.tagRow}>
            {product.category ? (
              <View style={styles.tag}>
                <Tag color="#64748b" size={11} />
                <Text style={styles.tagText}>{product.category}</Text>
              </View>
            ) : null}
            {product.condition ? (
              <View style={styles.conditionPill}>
                <Text style={styles.conditionText}>{product.condition.replace(/_/g, ' ')}</Text>
              </View>
            ) : null}
            {product.operationStatus ? (
              <View style={styles.tag}>
                <Info color="#64748b" size={11} />
                <Text style={styles.tagText}>{product.operationStatus.replace(/_/g, ' ')}</Text>
              </View>
            ) : null}
            {product.sellerName ? (
              <View style={styles.tag}>
                <User color="#64748b" size={11} />
                <Text style={styles.tagText}>{product.sellerName}</Text>
              </View>
            ) : null}
          </View>

          {(product.brand || product.model || product.year || product.weight) && (
            <View style={styles.specRow}>
              {product.brand ? <SpecCell label="Brand" value={product.brand} /> : null}
              {product.model ? <SpecCell label="Model" value={product.model} /> : null}
              {product.year ? <SpecCell label="Year" value={product.year} /> : null}
              {product.weight ? <SpecCell label="Weight" value={product.weight} /> : null}
            </View>
          )}
        </View>
      </View>

      {extras.length > 0 ? (
        <View style={styles.extraThumbs}>
          {extras.map((u, i) => (
            <AppImage key={`${u}-${i}`} source={{ uri: u }} style={styles.extraThumb} />
          ))}
          {overflow > 0 ? (
            <View style={[styles.extraThumb, styles.extraThumbMore]}>
              <Text style={styles.extraThumbMoreText}>+{overflow}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {product.docs.length > 0 ? (
        <View style={styles.docRow}>
          {product.docs.map((u, i) => (
            <Pressable key={`${u}-${i}`} onPress={() => void Linking.openURL(u)} style={styles.docChip}>
              <FileText color="#14452f" size={12} />
              <Text style={styles.docChipText}>Document {i + 1}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.specCell}>
      <Text style={styles.specCellLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

// ─── Bidding (restructured vertical list, not cramped grid) ──────────────────

function BiddingSection({ bidding }: { bidding?: BatchDetail['bidding'] }) {
  if (!bidding) return null;
  return (
    <SectionCard
      icon={<Gavel color="#14452f" size={16} />}
      title="Bidding"
      rightLabel={bidding.status?.toUpperCase()}
    >
      <View style={styles.kvList}>
        <KVRow icon={<Calendar color="#64748b" size={14} />} label="Start" value={formatDateTime(bidding.startDate)} />
        <KVRow icon={<Calendar color="#64748b" size={14} />} label="End" value={formatDateTime(bidding.endDate)} />
        <KVRow icon={<Layers color="#64748b" size={14} />} label="Type" value={bidding.type === 'make_offer' ? 'Make Offer' : 'Fixed Price'} />
        {bidding.targetPrice != null ? (
          <KVRow icon={<TrendingUp color="#64748b" size={14} />} label="Target Price" value={formatCurrency(bidding.targetPrice, bidding.currency)} />
        ) : null}
        {bidding.location ? (
          <KVRow icon={<MapPin color="#64748b" size={14} />} label="Location" value={bidding.location} />
        ) : null}
        <KVRow
          icon={<Layers color="#64748b" size={14} />}
          label="Bid Types"
          value={[
            bidding.allowWholePrice && 'Whole Price',
            bidding.allowWeightPrice && 'Weight-Based',
          ].filter(Boolean).join(', ') || '—'}
        />
        {bidding.buyerBidCount != null ? (
          <KVRow icon={<Gavel color="#64748b" size={14} />} label="Total Bids" value={String(bidding.buyerBidCount)} />
        ) : null}
      </View>
    </SectionCard>
  );
}

// ─── Batch Info (compact 2-column grid) ──────────────────────────────────────

function BatchInfoSection({ batch }: { batch: BatchDetail }) {
  const cells: { label: string; value: string }[] = [
    { label: 'Batch #', value: String(batch.batchNumber) },
    { label: 'Status', value: batch.status?.replace(/_/g, ' ') ?? '—' },
    { label: 'Approval', value: batch.approvalStatus ?? 'pending' },
    { label: 'Step', value: batch.step != null ? `Step ${batch.step}` : '—' },
  ];
  if (batch.commissionPercent != null) {
    cells.push({ label: 'Commission', value: `${batch.commissionPercent}%` });
  }
  cells.push({ label: 'Created', value: formatDate(batch.createdAt) });

  // Pad to even count so the grid lines up
  if (cells.length % 2 === 1) cells.push({ label: '', value: '' });

  return (
    <SectionCard icon={<Layers color="#14452f" size={16} />} title="Batch Info">
      <View style={styles.metaGrid}>
        {cells.map((c, i) => (
          <View key={`${c.label}-${i}`} style={styles.metaCell}>
            {c.label ? (
              <>
                <Text style={styles.metaLabel}>{c.label}</Text>
                <Text style={styles.metaValue}>{c.value || '—'}</Text>
              </>
            ) : null}
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

// ─── Inspection (only render when data exists) ───────────────────────────────

function InspectionSection({ inspection }: { inspection?: BatchDetail['inspection'] }) {
  if (!inspection || (inspection.schedule.length === 0 && inspection.companies.length === 0)) {
    return null;
  }
  return (
    <SectionCard icon={<Calendar color="#14452f" size={16} />} title="Inspection">
      {inspection.schedule.length > 0 ? (
        <View style={styles.kvList}>
          {inspection.schedule.map((slot, i) => (
            <View key={i} style={styles.inspectionSlot}>
              <Text style={styles.inspectionDateLabel}>Date {i + 1}</Text>
              <View style={styles.inspectionRow}>
                <Calendar color="#64748b" size={14} />
                <Text style={styles.inspectionDate}>{formatDate(slot.date)}</Text>
              </View>
              {slot.times.map((time, ti) => (
                <View key={ti} style={styles.inspectionRow}>
                  <Clock color="#94a3b8" size={12} />
                  <Text style={styles.inspectionTime}>{time}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {inspection.companies.length > 0 ? (
        <View style={styles.companyBlock}>
          <Text style={styles.smallLabel}>Registered Companies</Text>
          {inspection.companies.map((c, i) => (
            <View key={i} style={styles.companyRow}>
              <Building2 color="#64748b" size={14} />
              <Text style={styles.companyName} numberOfLines={1}>{c.companyName}</Text>
              <View style={styles.companyStatus}>
                <Text style={styles.companyStatusText}>
                  {c.skipped ? 'Skipped' : c.status ?? 'Registered'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}

// ─── Shared blocks ───────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  rightLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {rightLabel ? (
          <View style={styles.sectionRightPill}>
            <Text style={styles.sectionRightPillText}>{rightLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function KVRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.kvRow}>
      <View style={styles.kvLabelWrap}>
        {icon}
        <Text style={styles.kvLabel}>{label}</Text>
      </View>
      <Text style={styles.kvValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

const heroApproval = StyleSheet.create({
  approved: { backgroundColor: 'rgba(240, 253, 244, 0.95)' },
  approvedText: { color: '#15803d' },
  pending: { backgroundColor: 'rgba(255, 251, 235, 0.95)' },
  pendingText: { color: '#b45309' },
  rejected: { backgroundColor: 'rgba(254, 242, 242, 0.95)' },
  rejectedText: { color: '#b91c1c' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 16, color: '#121c28' },
  center: { padding: 24, alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  // Hero
  hero: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  heroBody: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    gap: 4,
  },
  heroBatchId: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#ffffff',
  },
  heroPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  heroStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  heroStatusPillText: { fontFamily: fonts.bold, fontSize: 10, color: '#0f172a', letterSpacing: 0.6 },
  heroApprovalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroApprovalPillText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },

  // Stat strip
  statStrip: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    paddingVertical: 12,
  },
  statCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  statCellDivider: { borderRightWidth: 1, borderRightColor: '#eef2f6' },
  statValue: { fontFamily: fonts.bold, fontSize: 18, color: '#0f172a' },
  statLabel: { fontFamily: fonts.semibold, fontSize: 10, color: '#94a3b8', letterSpacing: 0.6 },

  // Section card (unified palette — no tinted headers)
  sectionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e5ec',
    borderRadius: 14,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    backgroundColor: '#fafbfc',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: fonts.label, fontSize: 13, color: '#0f172a', letterSpacing: 0.2 },
  sectionRightPill: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e1e5ec',
  },
  sectionRightPillText: { fontFamily: fonts.semibold, fontSize: 10, color: '#475569', letterSpacing: 0.4 },
  sectionBody: { padding: 14, gap: 10 },

  // Product
  productCard: {
    borderWidth: 1,
    borderColor: '#e1e5ec',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  productRow: { flexDirection: 'row', gap: 12 },
  productImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: '#f1f4f7' },
  productImageFallback: { justifyContent: 'center', alignItems: 'center' },
  productBody: { flex: 1, gap: 6 },
  productTitle: { fontFamily: fonts.semibold, fontSize: 14, color: '#0f172a' },
  productDesc: { fontFamily: fonts.regular, fontSize: 12, color: '#64748b', lineHeight: 17 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontFamily: fonts.semibold, fontSize: 11, color: '#64748b' },
  conditionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    backgroundColor: '#ffffff',
  },
  conditionText: { fontFamily: fonts.semibold, fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  specCell: { fontFamily: fonts.regular, fontSize: 11, color: '#475569' },
  specCellLabel: { fontFamily: fonts.semibold, color: '#0f172a' },
  extraThumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  extraThumb: { width: 52, height: 52, borderRadius: 6, backgroundColor: '#f1f4f7' },
  extraThumbMore: { justifyContent: 'center', alignItems: 'center' },
  extraThumbMoreText: { fontFamily: fonts.bold, fontSize: 12, color: '#64748b' },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  docChipText: { fontFamily: fonts.semibold, fontSize: 11, color: '#14452f' },

  // KV list (used by Bidding + Inspection)
  kvList: { gap: 10 },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kvLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kvLabel: { fontFamily: fonts.semibold, fontSize: 12, color: '#64748b' },
  kvValue: { fontFamily: fonts.semibold, fontSize: 13, color: '#0f172a', flexShrink: 1, textAlign: 'right' },

  // Compact 2-column meta grid
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  metaCell: { width: '50%', paddingVertical: 6 },
  metaLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.7, color: '#94a3b8' },
  metaValue: { fontFamily: fonts.semibold, fontSize: 13, color: '#0f172a', marginTop: 2 },

  // Inspection
  inspectionSlot: { gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1e5ec', paddingBottom: 8 },
  inspectionDateLabel: { fontFamily: fonts.bold, fontSize: 10, color: '#94a3b8', letterSpacing: 0.7 },
  inspectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inspectionDate: { fontFamily: fonts.semibold, fontSize: 13, color: '#0f172a' },
  inspectionTime: { fontFamily: fonts.regular, fontSize: 12, color: '#64748b' },
  companyBlock: { marginTop: 6, gap: 6 },
  smallLabel: { fontFamily: fonts.bold, fontSize: 10, color: '#94a3b8', letterSpacing: 0.7 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  companyName: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#0f172a' },
  companyStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    backgroundColor: '#ffffff',
  },
  companyStatusText: { fontFamily: fonts.semibold, fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Footer
  error: { fontFamily: fonts.regular, fontSize: 15, color: '#dc3737' },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: '#14452f', marginTop: 12 },
  webBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#14452f',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  webBtnText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 15 },
});
