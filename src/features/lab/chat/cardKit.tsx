// Shared primitives + formatting helpers for the (lab) chat response cards.
// RN port of the web `aiChatShared.tsx` scaffolding (CardShell, chips, condLabel,
// toolLabel, relTime, field formatting). Keeps literal hexes out of the cards —
// everything reads `@/constants/theme` tokens. No JSX-free logic lives here that
// isn't rendering-adjacent; the cards import from this module.
import { StyleSheet, Text, View } from 'react-native';

import i18n from '@/i18n';
import { fonts, radius, spacing } from '@/constants/theme';
import { createThemedStyles, useTheme } from './theme';

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

/* -- cleanTitle ------------------------------------------------------------
 * Catalog titles from the legacy WordPress DB carry Windows-1252 mojibake: a
 * byte like 0x97 (an em dash in CP1252) was stored raw as the C1 control char
 * U+0097 instead of decoding to U+2014, so every font renders a tofu box (e.g.
 * Nikon SMZ800N <box> Zoom Stereomicroscope). Repair the common CP1252
 * punctuation, fold the Unicode dash family to a plain hyphen, and drop any
 * remaining non-printing / private-use / replacement characters -- while
 * leaving letters (INCLUDING CJK product names) untouched. Display-only + safe
 * to double-apply. */
const CP1252_C1: Record<number, string> = {
  0x82: ',', 0x84: '"', 0x85: '...', 0x8b: '<', 0x91: "'", 0x92: "'",
  0x93: '"', 0x94: '"', 0x95: '-', 0x96: '-', 0x97: '-', 0x9b: '>',
};
// Dash family (incl. non-breaking hyphen U+2011, which Inter lacks) -> hyphen.
const DASH_RE = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
// C0 controls + DEL, soft hyphen, zero-width/bidi marks, line/para seps, word
// joiner, the Private Use Area, BOM, and the Specials block (incl. the
// object-replacement U+FFFC and replacement U+FFFD characters).
const STRIP_RE = /[\u0000-\u001F\u007F\u00AD\u200B-\u200F\u2028\u2029\u2060\uE000-\uF8FF\uFEFF\uFFF9-\uFFFD]/g;
export const cleanTitle = (s?: string | null): string => {
  if (!s) return '';
  return s
    .replace(/[\u0080-\u009F]/g, (c) => CP1252_C1[c.charCodeAt(0)] ?? '')
    .replace(DASH_RE, '-')
    .replace(STRIP_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

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
  const styles = useCardKitStyles();
  return (
    <View style={[styles.chip, tone === 'emerald' ? styles.chipEmerald : styles.chipGray]}>
      <Text style={[styles.chipText, tone === 'emerald' && styles.chipTextEmerald]}>{children}</Text>
    </View>
  );
}

/** A status chip with a caller-provided tint. */
export function StatusChip({ label, color, bg }: { label: string; color: string; bg: string }) {
  const styles = useCardKitStyles();
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
  const styles = useCardKitStyles();
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

// These tint maps are consumed inside render loops in cards.tsx. R2: they read
// the ACTIVE theme (semantic tokens + Phase-1 compat bridges) so the tints switch
// light/dark — hence a hook. Light values are unchanged (pixel-identical). The
// label logic (`tc()` i18n) and per-status color/bg choices are preserved; only
// the color SOURCE moved from the light singleton to `useTheme()`.
export function useStatusTints() {
  const theme = useTheme();
  const emerald = {
    color: theme.color['accent.pressed'],
    bg: theme.compat['status.successSurface'],
  };
  const grey = {
    color: theme.color['text.muted'],
    bg: theme.color['surface.alt'],
  };
  const amber = {
    color: theme.compat['status.warningStrong'],
    bg: theme.compat['status.warningSurface'],
  };
  const blue = {
    color: theme.compat['status.infoStrong'],
    bg: theme.compat['status.infoSurface'],
  };

  const batch = (s?: string): { label: string; color: string; bg: string } => {
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

  const bid = (s?: string): { label: string; color: string; bg: string } => {
    switch (s) {
      case 'pending':
        return { label: tc('statusPending'), ...amber };
      case 'accepted':
      case 'winning':
        return { label: s === 'winning' ? tc('bidWinning') : tc('bidAccepted'), ...emerald };
      case 'rejected':
      case 'outbid':
        return {
          label: s === 'outbid' ? tc('bidOutbid') : tc('bidDeclined'),
          color: theme.color['status.danger'],
          bg: theme.color['status.dangerSurface'],
        };
      case 'counter_offer':
        return { label: tc('bidCounterOffer'), ...blue };
      default:
        return { label: s || '—', ...grey };
    }
  };

  return { batch, bid };
}

// Colors from the theme (D2 semantic tokens) + Phase-1 compat bridges where D1
// has no token; layout/spacing/radius/fonts stay theme-independent literals.
const useCardKitStyles = createThemedStyles((t) => ({
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
  chipEmerald: {
    backgroundColor: t.compat['status.successSurface'],
    borderColor: t.compat['status.successBorder'],
  },
  chipGray: { backgroundColor: t.color['surface.alt'], borderColor: t.color['border.subtle'] },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
    color: t.color['text.muted'],
  },
  chipTextEmerald: { color: t.color['accent.pressed'] },
  // Pill-shaped status badge; the fixed hairline border keeps it crisp against
  // the caller-provided tint and matches the squat "Draft" pill to a badge edge.
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
  },
  statusChipText: { fontFamily: fonts.label, fontSize: 10, lineHeight: 13, letterSpacing: 1.0 },
  shell: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    backgroundColor: t.color['surface.raised'],
    padding: spacing.lg,
    ...t.elevation('raised'),
  },
  shellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    // Hairline under the eyebrow gives the titled band a crisp shelf.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.compat['border.divider'],
    paddingBottom: spacing.sm,
  },
  // Unified eyebrow voice (IBM Plex small-caps, 11/14, letterSpacing 1.2).
  shellTitle: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: t.color['accent.pressed'],
  },
}));
