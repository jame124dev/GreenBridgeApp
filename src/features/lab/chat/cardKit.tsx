// Shared primitives + formatting helpers for the (lab) chat response cards.
// RN port of the web `aiChatShared.tsx` scaffolding (CardShell, chips, condLabel,
// toolLabel, relTime, field formatting). Keeps literal hexes out of the cards —
// everything reads `@/constants/theme` tokens. No JSX-free logic lives here that
// isn't rendering-adjacent; the cards import from this module.
import { StyleSheet, Text, View } from 'react-native';

import i18n from '@/i18n';
import { brand, elevation, fonts, greenDark, radius, spacing } from '@/constants/theme';

// Resolve a labCards key against the current language. Called from within card
// components that subscribe via useTranslation, so re-renders stay reactive.
const tc = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(`mobile.labCards.${key}`, opts);

/* ── Label maps (ported verbatim from aiChatShared) ───────────────────────── */

// Values are labCards i18n keys, resolved at call time by condLabel.
const CONDITION_LABELS: Record<string, string> = {
  new: 'condNew',
  usedFunctional: 'condUsedFunctional',
  forParts: 'condForParts',
  wasteDisposal: 'condWasteDisposal',
  demolitionRemoval: 'condDemolitionRemoval',
  working: 'condWorking',
  likeNew: 'condLikeNew',
  refurbished: 'condRefurbished',
};

export const condLabel = (c?: string | null): string => {
  if (!c) return '';
  if (CONDITION_LABELS[c]) return tc(CONDITION_LABELS[c]);
  const norm = c.replace(/[_\s]+/g, '').toLowerCase();
  for (const [k, v] of Object.entries(CONDITION_LABELS)) {
    if (k.toLowerCase() === norm) return tc(v);
  }
  return c.charAt(0).toUpperCase() + c.slice(1);
};

export const countryLabel = (c?: string | null): string =>
  c === 'TW' ? tc('countryTaiwan') : c || '';

// Values are labCards i18n keys, resolved at call time by toolLabel.
const TOOL_LABELS: Record<string, string> = {
  get_marketplace_overview: 'toolMarketplaceOverview',
  get_catalog_summary: 'toolCatalogOverview',
  get_recent_batches: 'toolLiveAuctions',
  search_products: 'toolSearchedListings',
  search_from_image: 'toolReadYourPhoto',
  get_product: 'toolListingDetails',
  get_my_bids: 'toolYourBids',
  get_seller_summary: 'toolYourListings',
  get_seller_activity: 'toolYourListings',
  get_bids_on_my_listings: 'toolBidsOnYourListings',
  detect_listing_from_images: 'toolReadYourPhotos',
  update_listing_draft: 'toolUpdatedDraft',
  get_listing_draft: 'toolLoadedDraft',
  create_listing: 'toolCreatedListing',
  present_listing_options: 'toolListingOptions',
  get_platform_info: 'toolPlatformInfo',
  draft_want_to_buy: 'toolDraftedYourWant',
  create_want_to_buy: 'toolSavedYourWant',
  list_my_wants: 'toolYourWants',
  get_want_matches: 'toolWantMatches',
};

export const toolLabel = (name: string): string =>
  (TOOL_LABELS[name] ? tc(TOOL_LABELS[name]) : undefined) ||
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/* ── Value formatting ─────────────────────────────────────────────────────── */

export const isBlankValue = (v: unknown): boolean =>
  v == null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

export const formatValue = (v: unknown): string => {
  if (Array.isArray(v)) return v.join(', ');
  if (v != null && typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

export const num = (n?: number | null): string => (n == null ? '0' : n.toLocaleString());

/** A short relative time ("in 3 days" / "2 days ago" / "today"). null on bad input. */
export const relTime = (iso?: string | null): string | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = t - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const min = 60_000,
    hr = 3_600_000,
    day = 86_400_000;
  if (abs < hr) {
    const m = Math.max(1, Math.round(abs / min));
    return past ? tc('relMinAgo', { count: m }) : tc('relInMin', { count: m });
  }
  if (abs < day) {
    const h = Math.round(abs / hr);
    return past ? tc('relHoursAgo', { count: h }) : tc('relInHours', { count: h });
  }
  const dd = Math.round(abs / day);
  if (dd === 0) return tc('relToday');
  if (dd === 1) return past ? tc('relYesterday') : tc('relTomorrow');
  return past ? tc('relDaysAgo', { count: dd }) : tc('relInDays', { count: dd });
};

/* ── Presentational primitives ────────────────────────────────────────────── */

/** Small chip — emerald (accent) or neutral. */
export function Chip({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'emerald' | 'gray';
}) {
  return (
    <View style={[styles.chip, tone === 'emerald' ? styles.chipEmerald : styles.chipGray]}>
      <Text style={[styles.chipText, tone === 'emerald' && styles.chipTextEmerald]}>{children}</Text>
    </View>
  );
}

/** A status chip with a caller-provided tint. */
export function StatusChip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: bg }]}>
      <Text style={[styles.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

/** Card wrapper with an uppercase accent header (matches web CardShell). */
export function CardShell({
  title,
  action,
  accent,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.shellHeader}>
        <Text style={[styles.shellTitle, accent ? { color: accent } : null]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/* ── Batch / bid status maps → tint tokens ────────────────────────────────── */

const emerald = { color: greenDark, bg: brand.successBg };
const grey = { color: brand.mutedForeground, bg: brand.surfaceMuted };
const amber = { color: brand.warningText, bg: brand.warningBg };
const blue = { color: brand.infoText, bg: brand.infoBg };

export const batchStatusTint = (
  s?: string,
): { label: string; color: string; bg: string } => {
  switch (s) {
    case 'live_for_bids':
      return { label: tc('statusLive'), ...emerald };
    case 'sold':
      return { label: tc('statusSold'), ...grey };
    case 'upcoming':
      return { label: tc('statusUpcoming'), ...blue };
    case 'pending':
      return { label: tc('statusPending'), ...amber };
    case 'draft':
      return { label: tc('statusDraft'), ...grey };
    case 'closed':
      return { label: tc('statusClosed'), ...grey };
    case 'unsold':
      return { label: tc('statusUnsold'), ...grey };
    default:
      return {
        label: s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—',
        ...grey,
      };
  }
};

export const bidStatusTint = (
  s?: string,
): { label: string; color: string; bg: string } => {
  switch (s) {
    case 'pending':
      return { label: tc('statusPending'), ...amber };
    case 'accepted':
    case 'winning':
      return { label: s === 'winning' ? tc('bidWinning') : tc('bidAccepted'), ...emerald };
    case 'rejected':
    case 'outbid':
      return { label: s === 'outbid' ? tc('bidOutbid') : tc('bidDeclined'), color: brand.destructive, bg: brand.destructiveBg };
    case 'counter_offer':
      return { label: tc('bidCounterOffer'), ...blue };
    default:
      return { label: s || '—', ...grey };
  }
};

const styles = StyleSheet.create({
  // Chips get a 1px border + 4px vertical padding so every pill reads as a
  // tactile badge (rescues the near-invisible gray "Used, working" condition
  // chip). Tone-specific borders match each tone's fill family.
  chip: {
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipEmerald: { backgroundColor: brand.successBg, borderColor: brand.successBorder },
  chipGray: { backgroundColor: brand.surfaceMuted, borderColor: brand.border },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
    color: brand.mutedForeground,
  },
  chipTextEmerald: { color: greenDark },
  // Pill-shaped status badge; the fixed hairline border keeps it crisp against
  // the caller-provided tint and matches the squat "Draft" pill to a badge edge.
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: brand.border,
  },
  statusChipText: { fontFamily: fonts.label, fontSize: 10, lineHeight: 13, letterSpacing: 1.0 },
  shell: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    padding: spacing.lg,
    ...elevation.sm,
  },
  shellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    // Hairline under the eyebrow gives the titled band a crisp shelf.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: brand.divider,
    paddingBottom: spacing.sm,
  },
  // Unified eyebrow voice (IBM Plex small-caps, 11/14, letterSpacing 1.2).
  shellTitle: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: greenDark,
  },
});
