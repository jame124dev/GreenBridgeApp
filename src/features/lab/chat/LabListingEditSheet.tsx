// LabListingEditSheet — the native "Edit listing" editor for the in-chat AI
// listing draft (the mobile port of the web `ListingEditModal`). A tall,
// keyboard-aware `@gorhom/BottomSheetModal` that opens from the draft card's
// "Edit details" affordance. It seeds instantly from the tapped card's draft,
// GETs the freshest `/listing-draft` and re-hydrates, lets the seller edit all
// fields + photos, maps inline 422 errors, and on Save PUTs only the changed
// fields (+ image_urls when photos changed). On 200 it dismisses and calls
// `onSaved(payload)` so chat.tsx can append a fresh listing_draft card (the
// existing singleton dedup supersedes the stale one).
//
// Design: three sectioned cards (PHOTOS / EQUIPMENT / LISTING SETUP) restyled to
// the lab chat-card language — IBM Plex small-caps green eyebrows, Hanken
// titles, Inter body, bordered chips, concentric 8/12/16 radii on a 4/8 spine.
// Reuses: labStream's auth-header assembly (via listingDraftApi), uploadGcsPhotos
// (validate=false), fetchLabCategories (React Query), CountryPicker, the Sheet
// primitive, theme tokens, recipes, haptics.
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { toast } from 'sonner-native';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ImagePlus,
  RefreshCw,
  Sparkles,
  Star,
  X,
} from 'lucide-react-native';

import { AppImage, Sheet } from '@/components/ui';
import {
  brand,
  elevation,
  fonts,
  greenDark,
  greenDarkest,
  greenMedium,
  radius,
  spacing,
  warnAmber,
} from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { usePop, usePressScale, useSpin, POP_STAGGER_MS } from '@/animations/recipes';
import { useAuth } from '@/stores/authStore';
import { fetchLabCategories, type LabCategory } from '@/services/scanner/fetchCategories';
import {
  gcsUrlForAnalyze,
  uploadGcsPhotos,
} from '@/services/scanner/uploadGcsPhotos';
import type { Photo } from '@/stores/scanDraftStore';
import { CountryPicker } from '@/features/scanner/components/detail/CountryPicker';
import {
  asString,
  extractFieldErrors,
  fieldsOf,
  getListingDraft,
  hasAuthToken,
  imagesOf,
  putListingDraft,
  type DraftField,
  type DraftPayload,
  type SeedDraft,
} from '@/features/lab/data/listingDraftApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── Constants (ported VERBATIM from the web ListingEditModal) ─────────────── */

// Canonical condition keys — must match GBS VALID_CONDITION_KEYS exactly (Node
// rejects anything else).
const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'usedFunctional', label: 'Used (Functional)' },
  { value: 'forParts', label: 'For Parts' },
  { value: 'wasteDisposal', label: 'Waste Disposal' },
  { value: 'demolitionRemoval', label: 'Demolition / Removal' },
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'JPY', 'CNY', 'TWD', 'THB'] as const;
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  TWD: 'NT$',
  THB: '฿',
};

/** Sentinel subcategory value that reveals the free-text `suggested_subcategory`. */
const OTHER_SUBCATEGORY = '__other__';

/**
 * Split a baked-in category name into a clean primary label + a muted examples
 * line. Anchored to a TRAILING parenthetical only, requires a non-empty head,
 * and falls back to the whole name. DISPLAY ONLY — never persist `primary` back
 * into values.category / category_id (the resolve effect + backend match on the
 * full original name). Never run user free-text (suggested_subcategory) through it.
 *   "Cold Storage (-80C Freezers, LN2 Tanks)" -> { primary:"Cold Storage", examples:"-80C Freezers, LN2 Tanks" }
 *   "Fume Hoods & Biosafety Cabinets"          -> { primary:"Fume Hoods & Biosafety Cabinets", examples:"" }
 */
function splitCatName(name: string): { primary: string; examples: string } {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m && m[1].trim()) return { primary: m[1].trim(), examples: m[2].trim() };
  return { primary: name.trim(), examples: '' };
}

/** MAX photos on a draft (mirror web MAX_DRAFT_ATTACHMENTS; 20 hard cap by GCS). */
const MAX_DRAFT_ATTACHMENTS = 20;

/* ── Title-case + market-metric humanisation (ported from the web modal) ───── */

const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

const formatMetricValue = (key: string, v: unknown): string => {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('tier' in o || 'estimated_weeks' in o) {
      const tier = o.tier ? titleCase(String(o.tier)) : '';
      const weeks = o.estimated_weeks
        ? `~${String(o.estimated_weeks).replace('-', '–')} wks`
        : '';
      return [tier, weeks].filter(Boolean).join(' · ') || '—';
    }
    return Object.entries(o)
      .map(([kk, vv]) => `${kk.replace(/_/g, ' ')}: ${String(vv)}`)
      .join(', ');
  }
  if (key === 'heat_tier') return titleCase(String(v));
  return String(v);
};

/* ── Public imperative ref ─────────────────────────────────────────────────── */

export type LabListingEditSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  conversationId: string;
  /** The tapped card's draft — seeds the form instantly before the GET resolves. */
  seed: unknown;
  /** Called with the freshest payload after a successful save (chat appends a
   *  fresh listing_draft card so the dedup supersedes the old one). */
  onSaved: (payload: DraftPayload) => void;
};

/* ── Sheet ─────────────────────────────────────────────────────────────────── */

export const LabListingEditSheet = forwardRef<LabListingEditSheetRef, Props>(
  function LabListingEditSheet({ conversationId, seed, onSaved }, ref) {
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const sheetRef = useRef<BottomSheetModal>(null);

    // Seller identity — null → guest (uploadGcsPhotos + save need a real id).
    const sellerId = useAuth((s) => s.profile?.id ?? null);

    // Form state — string-backed for inputs; coerced to typed values on save.
    const [values, setValues] = useState<Record<string, string>>({});
    const [sources, setSources] = useState<Record<string, string>>({});
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [location, setLocation] = useState('');
    const [marketMetrics, setMarketMetrics] = useState<Record<string, unknown> | null>(
      null,
    );
    const [lowConfidence, setLowConfidence] = useState<Set<string>>(new Set());
    const [missingRequired, setMissingRequired] = useState<Set<string>>(new Set());
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Cascading category selection (string ids mirrored into values.category /
    // category_id / suggested_subcategory on change).
    const [parentCatId, setParentCatId] = useState('');
    const [subCatId, setSubCatId] = useState('');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const [netError, setNetError] = useState(false);

    // Picker sheets
    const [catSheetOpen, setCatSheetOpen] = useState(false);
    const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
    const [countryOpen, setCountryOpen] = useState(false);

    // The set we hydrated from — used to compute the changed-only PUT body.
    const initialValues = useRef<Record<string, string>>({});
    const initialImages = useRef<string[]>([]);
    const initialLocation = useRef('');
    const savedRef = useRef(false);

    const spinStyle = useSpin();

    // Categories (React Query cached), matching the seller scanner's approach.
    const {
      data: catData,
      isLoading: catLoading,
      isError: catError,
      refetch: refetchCategories,
    } = useQuery({
      queryKey: ['labCategories', i18n.language, '101lab'],
      queryFn: () => fetchLabCategories(i18n.language, '101lab'),
      staleTime: 5 * 60_000,
    });
    const categories: LabCategory[] = useMemo(() => catData ?? [], [catData]);

    const setField = useCallback(
      (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v })),
      [],
    );

    /* ── Hydrate ─────────────────────────────────────────────────────────── */

    const hydrate = useCallback((d: SeedDraft | DraftPayload | null | undefined) => {
      const fields = fieldsOf(d);
      const next: Record<string, string> = {};
      const nextSources: Record<string, string> = {};
      for (const [key, entry] of Object.entries(fields)) {
        if (key === 'market_metrics' || key === 'price_suggestions') continue;
        const e = entry as DraftField;
        next[key] = asString(e?.value);
        if (e?.source) nextSources[key] = e.source;
      }
      // Defaults so an un-round-tripped server draft agrees with the display.
      if (!next.price_format) next.price_format = 'buyNow';
      if (!next.price_currency) next.price_currency = 'USD';

      setValues(next);
      setSources(nextSources);
      initialValues.current = { ...next };

      // Location may arrive as an array; v1 shows a single string.
      const locVal = (fields.location as DraftField | undefined)?.value;
      const loc = Array.isArray(locVal)
        ? (locVal as unknown[]).map(asString).filter(Boolean)[0] ?? ''
        : asString(locVal);
      setLocation(loc);
      initialLocation.current = loc;

      const imgs = imagesOf(d);
      setImageUrls(imgs);
      initialImages.current = imgs;

      const mm = (fields.market_metrics as DraftField | undefined)?.value;
      setMarketMetrics(
        mm && typeof mm === 'object' ? (mm as Record<string, unknown>) : null,
      );
      setLowConfidence(new Set(d?.low_confidence || []));
      setMissingRequired(new Set(d?.missing_required || []));
      // Reset the cascading category resolver so it re-runs against new values.
      setParentCatId('');
      setSubCatId('');
    }, []);

    // GET the freshest draft on present, after seeding from the card.
    const runGet = useCallback(async () => {
      setNetError(false);
      // Guest with no token → GET would 401; keep the seeded form, show the gate.
      const authed = await hasAuthToken();
      if (!authed || sellerId == null) {
        setIsGuest(true);
        return;
      }
      setIsGuest(false);
      setLoading(true);
      try {
        const { status, body } = await getListingDraft(conversationId);
        if (status === 401) {
          setIsGuest(true);
          return;
        }
        if (status >= 200 && status < 300 && body) {
          hydrate(body as DraftPayload);
        }
        // Non-2xx (not 401): keep the seeded form — user can still edit + save.
      } catch {
        // Transport failure — keep the seeded form, silent (save can still try).
      } finally {
        setLoading(false);
      }
    }, [conversationId, hydrate, sellerId]);

    /* ── Present / dismiss ───────────────────────────────────────────────── */

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          savedRef.current = false;
          setErrors({});
          hydrate(seed as SeedDraft);
          sheetRef.current?.present();
          void runGet();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [seed, hydrate, runGet],
    );

    const resetState = useCallback(() => {
      setValues({});
      setSources({});
      setImageUrls([]);
      setLocation('');
      setMarketMetrics(null);
      setLowConfidence(new Set());
      setMissingRequired(new Set());
      setErrors({});
      setParentCatId('');
      setSubCatId('');
      setLoading(false);
      setSaving(false);
      setUploading(false);
      setIsGuest(false);
      setNetError(false);
      initialValues.current = {};
      initialImages.current = [];
      initialLocation.current = '';
    }, []);

    /* ── Category resolve (AI value → parent/sub id pair) ────────────────── */

    // Resolve the AI-supplied category name / id back to the parent/sub id pair
    // once the category tree loads (so the picker shows the AI's pick). This is a
    // legitimate "sync to async-loaded external data" case — the tree isn't
    // available synchronously on hydrate — so it runs in an effect and is
    // skipped once the user starts interacting with the picker.
    const catName = (values.category || '').trim();
    const catIdRaw = (values.category_id || '').trim();
    useEffect(() => {
      if (!categories.length) return;
      if (parentCatId || subCatId) return; // user already interacting
      if (!catName && !catIdRaw) return;
      const setPair = (parent: string, sub: string) => {
        setParentCatId(parent);
        if (sub) setSubCatId(sub);
      };
      for (const parent of categories) {
        const subById = catIdRaw
          ? parent.subcategories.find((s) => String(s.id) === catIdRaw)
          : undefined;
        const subByName = catName
          ? parent.subcategories.find(
              (s) => s.name.toLowerCase() === catName.toLowerCase(),
            )
          : undefined;
        const sub = subById || subByName;
        if (sub) return setPair(String(parent.id), String(sub.id));
        if (catName && parent.name.toLowerCase() === catName.toLowerCase()) {
          return setPair(String(parent.id), '');
        }
      }
    }, [categories, catName, catIdRaw, parentCatId, subCatId]);

    const subcategories = useMemo(() => {
      if (!parentCatId) return [];
      return categories.find((p) => String(p.id) === parentCatId)?.subcategories ?? [];
    }, [categories, parentCatId]);

    const onParentPick = useCallback(
      (id: string) => {
        haptics.tap();
        setParentCatId(id);
        setSubCatId('');
        const parent = categories.find((p) => String(p.id) === id);
        setValues((prev) => ({
          ...prev,
          category: parent?.name ?? '',
          category_id: parent ? String(parent.id) : '',
          suggested_subcategory: '',
        }));
        // Flat-leaf parent (no subcategories) IS the selectable leaf — commit in
        // one tap instead of expanding to a lone "Other…".
        if (parent && parent.subcategories.length === 0) {
          setCatSheetOpen(false);
        }
      },
      [categories],
    );

    const onSubPick = useCallback(
      (id: string) => {
        haptics.tap();
        setSubCatId(id);
        if (id === OTHER_SUBCATEGORY) {
          const parent = categories.find((p) => String(p.id) === parentCatId);
          setValues((prev) => ({
            ...prev,
            category: parent?.name ?? prev.category,
            category_id: parent ? String(parent.id) : '',
          }));
          setCatSheetOpen(false);
          return;
        }
        const sub = subcategories.find((s) => String(s.id) === id);
        setValues((prev) => ({
          ...prev,
          category: sub?.name ?? prev.category,
          category_id: sub ? String(sub.id) : prev.category_id,
          suggested_subcategory: '',
        }));
        setCatSheetOpen(false);
      },
      [categories, parentCatId, subcategories],
    );

    /* ── Photos ──────────────────────────────────────────────────────────── */

    const addPhotos = useCallback(async () => {
      if (sellerId == null) return; // guarded — guest can't upload
      const room = MAX_DRAFT_ATTACHMENTS - imageUrls.length;
      if (room <= 0) {
        toast.error(
          t('mobile.labEdit.maxPhotos', {
            defaultValue: 'You can attach up to {{count}} photos.',
            count: MAX_DRAFT_ATTACHMENTS,
          }),
        );
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error(
          t('mobile.labEdit.photoAccessTitle', { defaultValue: 'Photo access needed' }),
          {
            description: t('mobile.labEdit.photoAccessBody', {
              defaultValue: 'Enable photo access in Settings to attach a photo.',
            }),
          },
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;
      haptics.tap();
      const photos: Photo[] = result.assets
        .slice(0, room)
        .map((a) => ({ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 }));
      if (photos.length === 0) return;

      setUploading(true);
      try {
        const r = await uploadGcsPhotos(photos, { sellerId });
        const added = r.files.map(gcsUrlForAnalyze);
        if (added.length) setImageUrls((prev) => [...prev, ...added]);
      } catch {
        toast.error(
          t('mobile.labEdit.uploadFailed', {
            defaultValue: "Couldn't upload your photos. Please try again.",
          }),
        );
      } finally {
        setUploading(false);
      }
    }, [imageUrls.length, sellerId]);

    const removeImage = useCallback((idx: number) => {
      haptics.tap();
      setImageUrls((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    /* ── Save ────────────────────────────────────────────────────────────── */

    const coerce = (key: string, raw: string): unknown => {
      const t = raw.trim();
      if (t === '') return '';
      if (key === 'quantity' || key === 'year') {
        const n = parseInt(t, 10);
        return Number.isNaN(n) ? t : n;
      }
      if (key === 'price_per_unit' || key === 'weight_per_unit') {
        const n = parseFloat(t);
        return Number.isNaN(n) ? t : n;
      }
      return raw;
    };

    const buildDiff = useCallback(() => {
      const changed: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(values)) {
        if (key === 'location') continue; // handled separately
        if ((initialValues.current[key] ?? '') !== v) {
          changed[key] = coerce(key, v);
        }
      }
      // Location: v1 sends a single string.
      const loc = location.trim();
      if (loc !== initialLocation.current.trim()) {
        changed.location = loc;
      }
      const imagesChanged =
        JSON.stringify(imageUrls) !== JSON.stringify(initialImages.current);
      return { changed, imagesChanged };
    }, [values, location, imageUrls]);

    const doSave = useCallback(async () => {
      if (saving) return;
      setErrors({});
      setNetError(false);

      const { changed, imagesChanged } = buildDiff();
      if (Object.keys(changed).length === 0 && !imagesChanged) {
        sheetRef.current?.dismiss(); // no-op — matches web
        return;
      }

      setSaving(true);
      try {
        const { status, body } = await putListingDraft(
          conversationId,
          changed,
          imagesChanged ? imageUrls : undefined,
        );
        if (status === 401) {
          setIsGuest(true);
          return;
        }
        if (status === 422) {
          const fieldErrors = extractFieldErrors(body);
          setErrors(fieldErrors);
          haptics.warning();
          return;
        }
        if (status < 200 || status >= 300 || !body) {
          setNetError(true);
          haptics.error();
          return;
        }
        savedRef.current = true;
        haptics.success();
        onSaved(body as DraftPayload);
        sheetRef.current?.dismiss();
      } catch {
        setNetError(true);
        haptics.error();
      } finally {
        setSaving(false);
      }
    }, [saving, buildDiff, conversationId, imageUrls, onSaved]);

    /* ── Derived per-field provenance ────────────────────────────────────── */

    const isLow = (k: string) => lowConfidence.has(k);
    const isAi = (k: string) =>
      sources[k] === 'detected' && (values[k] ?? '').trim() !== '';
    const isNeeds = (k: string) =>
      missingRequired.has(k) && (values[k] ?? '').trim() === '';

    const priceFormat = values.price_format || 'buyNow';
    const currency = values.price_currency || 'USD';
    const titleLen = (values.product_title || '').length;
    const descLen = (values.product_content || '').length;

    // Structured breadcrumb for the trigger — computed from id lookups (a true
    // parent › sub), split for readability. Display-only; persisted values are
    // untouched. Parent-only leaves `sub` empty so the trigger shows one line.
    const categoryLabel: { parent: string; sub: string } = (() => {
      const p = categories.find((x) => String(x.id) === parentCatId);
      const s = p?.subcategories.find((x) => String(x.id) === subCatId);
      const parentHead = p ? splitCatName(p.name).primary : '';
      const subHead =
        subCatId === OTHER_SUBCATEGORY
          ? values.suggested_subcategory
            ? t('mobile.labEdit.otherWithValue', {
                defaultValue: 'Other: {{value}}',
                value: values.suggested_subcategory,
              })
            : t('mobile.labEdit.other', { defaultValue: 'Other…' })
          : s
            ? splitCatName(s.name).primary
            : '';
      // Fallback: the AI can supply a free-text category (e.g. "laboratory
      // freezers") that maps to no tree node, so the id lookup above yields
      // nothing. Rather than show an empty "Select category…" when we DO have a
      // value, surface the raw category string (split for readability) so the
      // seller sees what the AI picked and can refine it. Never blank a filled
      // field.
      if (!parentHead && (values.category || '').trim()) {
        const raw = splitCatName(String(values.category).trim());
        return {
          parent: raw.primary,
          sub: (values.suggested_subcategory || '').trim(),
        };
      }
      return { parent: parentHead, sub: subHead };
    })();

    /* ── Backdrop + footer ───────────────────────────────────────────────── */

    const renderBackdrop = useCallback(
      (p: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop
          {...p}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.4}
          pressBehavior="close"
        />
      ),
      [],
    );

    const [footerHeight, setFooterHeight] = useState(84);

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => {
        if (isGuest) return null;
        return (
          <BottomSheetFooter {...props}>
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
              onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            >
              <FooterGhost
                label={t('mobile.labEdit.cancel', { defaultValue: 'Cancel' })}
                disabled={saving}
                onPress={() => {
                  haptics.tap();
                  sheetRef.current?.dismiss();
                }}
              />
              <FooterPrimary
                label={t('mobile.labEdit.saveChanges', { defaultValue: 'Save changes' })}
                saving={saving}
                onPress={doSave}
              />
            </View>
          </BottomSheetFooter>
        );
      },
      [isGuest, insets.bottom, saving, doSave],
    );

    /* ── Render ──────────────────────────────────────────────────────────── */

    return (
      <>
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={['92%']}
          index={0}
          enableDynamicSizing={false}
          enablePanDownToClose
          topInset={insets.top}
          onDismiss={resetState}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          handleIndicatorStyle={styles.grabber}
          backgroundStyle={styles.sheetBg}
          backdropComponent={renderBackdrop}
          footerComponent={isGuest ? undefined : renderFooter}
        >
          {/* Fixed header band (does not scroll) */}
          <View style={styles.header}>
            <View style={styles.headerLead}>
              <View style={styles.headerCoin}>
                <Sparkles size={15} color={greenDark} />
              </View>
              <Text style={styles.headerTitle}>
                {t('mobile.labEdit.editListing', { defaultValue: 'Edit listing' })}
              </Text>
              {loading ? (
                <Animated.View style={spinStyle}>
                  <RefreshCw size={15} color={greenDark} />
                </Animated.View>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                haptics.tap();
                sheetRef.current?.dismiss();
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.labEdit.close', { defaultValue: 'Close' })}
              style={styles.headerClose}
            >
              <X size={20} color={brand.mutedForeground} />
            </Pressable>
          </View>

          {isGuest ? (
            <GuestPanel onClose={() => sheetRef.current?.dismiss()} />
          ) : (
            <BottomSheetScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.body,
                { paddingBottom: footerHeight + insets.bottom + spacing.xl },
              ]}
            >
              {netError ? (
                <Banner
                  tone="destructive"
                  icon={<AlertTriangle size={15} color={brand.destructive} />}
                  text={t('mobile.labEdit.errSaveConnection', {
                    defaultValue: "Couldn't save your changes — check your connection.",
                  })}
                  actionLabel={t('mobile.labEdit.retry', { defaultValue: 'Retry' })}
                  onAction={doSave}
                />
              ) : null}
              {Object.keys(errors).length > 0 ? (
                <Banner
                  tone="destructive"
                  icon={<AlertTriangle size={15} color={brand.destructive} />}
                  text={t('mobile.labEdit.fixHighlighted', {
                    defaultValue: 'Please fix the highlighted fields.',
                  })}
                />
              ) : null}

              {/* ── 1. PHOTOS ─────────────────────────────────────────────── */}
              <EditSectionCard
                index={0}
                title={t('mobile.labEdit.photosCount', {
                  defaultValue: 'Photos ({{count}})',
                  count: imageUrls.length,
                })}
                status={
                  imageUrls.length > 0 ? (
                    <View style={styles.statusReady}>
                      <Check size={13} color={greenDark} />
                      <Text style={styles.statusReadyText}>
                        {t('mobile.labEdit.ready', { defaultValue: 'Ready' })}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.statusNeed}>
                      {t('mobile.labEdit.photoRequired', { defaultValue: 'Photo required' })}
                    </Text>
                  )
                }
              >
                <PhotoGrid
                  urls={imageUrls}
                  uploading={uploading}
                  canAdd={sellerId != null && imageUrls.length < MAX_DRAFT_ATTACHMENTS}
                  onAdd={addPhotos}
                  onRemove={removeImage}
                />
              </EditSectionCard>

              {/* ── 2. EQUIPMENT ──────────────────────────────────────────── */}
              <EditSectionCard
                index={1}
                title={t('mobile.labEdit.equipment', { defaultValue: 'Equipment' })}
              >
                <EditTextField
                  label={t('mobile.labEdit.title', { defaultValue: 'Title' })}
                  value={values.product_title || ''}
                  onChangeText={(v) => setField('product_title', v)}
                  placeholder={t('mobile.labEdit.titlePlaceholder', {
                    defaultValue: 'e.g. Buchi Rotavapor R-300',
                  })}
                  maxLength={80}
                  counter={`${titleLen}/80`}
                  helper={t('mobile.labEdit.shownToBuyers', { defaultValue: 'Shown to buyers' })}
                  autoCapitalize="sentences"
                  error={errors.product_title}
                  ai={isAi('product_title')}
                  verify={isLow('product_title')}
                  needs={isNeeds('product_title')}
                />

                <EditMultilineField
                  label={t('mobile.labEdit.description', { defaultValue: 'Description' })}
                  value={values.product_content || ''}
                  onChangeText={(v) => setField('product_content', v)}
                  placeholder={t('mobile.labEdit.descriptionPlaceholder', {
                    defaultValue: 'Describe the item, its history, accessories…',
                  })}
                  maxLength={500}
                  counter={`${descLen}/500`}
                  counterOver={descLen > 500}
                  helper={t('mobile.labEdit.aiDrafted', { defaultValue: 'AI drafted' })}
                  error={errors.product_content}
                  ai={isAi('product_content')}
                  verify={isLow('product_content')}
                />

                {/* Brand / Model */}
                <View style={styles.row2}>
                  <View style={styles.col}>
                    <EditTextField
                      label={t('mobile.labEdit.brand', { defaultValue: 'Brand' })}
                      value={values.brand || ''}
                      onChangeText={(v) => setField('brand', v)}
                      error={errors.brand}
                      ai={isAi('brand')}
                      verify={isLow('brand')}
                    />
                  </View>
                  <View style={styles.col}>
                    <EditTextField
                      label={t('mobile.labEdit.model', { defaultValue: 'Model' })}
                      value={values.model || ''}
                      onChangeText={(v) => setField('model', v)}
                      error={errors.model}
                      ai={isAi('model')}
                      verify={isLow('model')}
                    />
                  </View>
                </View>

                {/* Serial / Year */}
                <View style={styles.row2}>
                  <View style={styles.col}>
                    <EditTextField
                      label={t('mobile.labEdit.serialNumber', { defaultValue: 'Serial number' })}
                      value={values.serial_number || ''}
                      onChangeText={(v) => setField('serial_number', v)}
                      error={errors.serial_number}
                      ai={isAi('serial_number')}
                      verify={isLow('serial_number')}
                    />
                  </View>
                  <View style={styles.col}>
                    <EditNumberField
                      label={t('mobile.labEdit.year', { defaultValue: 'Year' })}
                      value={values.year || ''}
                      onChangeText={(v) => setField('year', v)}
                      keyboardType="number-pad"
                      error={errors.year}
                      ai={isAi('year')}
                      verify={isLow('year')}
                    />
                  </View>
                </View>

                {/* Category (cascading) — full-width so long names + the
                    parent › sub breadcrumb read without truncation. */}
                <View>
                  <EditFieldLabel
                    ai={isAi('category')}
                    verify={isLow('category')}
                    needs={isNeeds('category')}
                  >
                    {t('mobile.labEdit.category', { defaultValue: 'Category' })}
                  </EditFieldLabel>
                  <PickerRow
                    value={categoryLabel.parent}
                    subValue={categoryLabel.sub || undefined}
                    placeholder={t('mobile.labEdit.selectCategory', {
                      defaultValue: 'Select category…',
                    })}
                    error={!!(errors.category || errors.category_id)}
                    onPress={() => {
                      haptics.tap();
                      setCatSheetOpen(true);
                    }}
                  />
                  <FieldError msg={errors.category || errors.category_id} />
                </View>

                {/* Free-text subcategory when "Other…" is chosen */}
                {subCatId === OTHER_SUBCATEGORY ? (
                  <EditTextField
                    label={t('mobile.labEdit.describeSubcategory', {
                      defaultValue: 'Describe the subcategory',
                    })}
                    value={values.suggested_subcategory || ''}
                    onChangeText={(v) => setField('suggested_subcategory', v)}
                    maxLength={60}
                    placeholder={t('mobile.labEdit.subcategoryPlaceholder', {
                      defaultValue: 'e.g. Freeze dryers',
                    })}
                    error={errors.suggested_subcategory}
                  />
                ) : null}

                {/* Country / Quantity — Country re-homed here now that Category
                    owns a full-width row (keeps both fields paired, no orphan). */}
                <View style={styles.row2}>
                  <View style={styles.col}>
                    <EditFieldLabel ai={isAi('country')} verify={isLow('country')}>
                      {t('mobile.labEdit.country', { defaultValue: 'Country' })}
                    </EditFieldLabel>
                    <PickerRow
                      value={values.country || ''}
                      placeholder={t('mobile.labEdit.selectCountry', {
                        defaultValue: 'Select country…',
                      })}
                      error={!!errors.country}
                      onPress={() => {
                        haptics.tap();
                        setCountryOpen(true);
                      }}
                    />
                    <FieldError msg={errors.country} />
                  </View>
                  <View style={styles.col}>
                    <EditNumberField
                      label={t('mobile.labEdit.quantity', { defaultValue: 'Quantity' })}
                      value={values.quantity || ''}
                      onChangeText={(v) => setField('quantity', v)}
                      keyboardType="number-pad"
                      error={errors.quantity}
                      ai={isAi('quantity')}
                      verify={isLow('quantity')}
                    />
                  </View>
                </View>

                {/* Weight / Operation status */}
                <View style={styles.row2}>
                  <View style={styles.col}>
                    <EditNumberField
                      label={t('mobile.labEdit.weight', { defaultValue: 'Weight' })}
                      value={values.weight_per_unit || ''}
                      onChangeText={(v) => setField('weight_per_unit', v)}
                      keyboardType="decimal-pad"
                      error={errors.weight_per_unit}
                      ai={isAi('weight_per_unit')}
                      verify={isLow('weight_per_unit')}
                    />
                  </View>
                  <View style={styles.col}>
                    <EditTextField
                      label={t('mobile.labEdit.operationStatus', {
                        defaultValue: 'Operation status',
                      })}
                      value={values.operation_status || ''}
                      onChangeText={(v) => setField('operation_status', v)}
                      error={errors.operation_status}
                      ai={isAi('operation_status')}
                      verify={isLow('operation_status')}
                    />
                  </View>
                </View>

                {/* Dimensions */}
                <EditTextField
                  label={t('mobile.labEdit.dimensions', { defaultValue: 'Dimensions' })}
                  value={values.dimensions || ''}
                  onChangeText={(v) => setField('dimensions', v)}
                  error={errors.dimensions}
                  ai={isAi('dimensions')}
                  verify={isLow('dimensions')}
                />
              </EditSectionCard>

              {/* ── 3. LISTING SETUP ──────────────────────────────────────── */}
              <EditSectionCard
                index={2}
                title={t('mobile.labEdit.listingSetup', { defaultValue: 'Listing setup' })}
                chip={
                  <View style={styles.reqChip}>
                    <Sparkles size={11} color={warnAmber} />
                    <Text style={styles.reqChipText}>
                      {t('mobile.labEdit.required', { defaultValue: 'Required' })}
                    </Text>
                  </View>
                }
              >
                {/* Condition */}
                <View>
                  <EditFieldLabel
                    ai={isAi('item_condition')}
                    verify={isLow('item_condition')}
                    needs={isNeeds('item_condition')}
                  >
                    {t('mobile.labEdit.condition', { defaultValue: 'Condition' })}
                  </EditFieldLabel>
                  <PillGroup
                    options={CONDITION_OPTIONS}
                    value={values.item_condition || ''}
                    onSelect={(v) => setField('item_condition', v)}
                  />
                  <FieldError msg={errors.item_condition} />
                </View>

                {/* Price */}
                <View>
                  <EditFieldLabel
                    ai={isAi('price_per_unit')}
                    verify={isLow('price_per_unit')}
                    needs={isNeeds('price_per_unit')}
                  >
                    {t('mobile.labEdit.price', { defaultValue: 'Price' })}
                  </EditFieldLabel>
                  <PillGroup
                    options={[
                      {
                        value: 'buyNow',
                        label: t('mobile.labEdit.buyNow', { defaultValue: 'Buy Now' }),
                      },
                      {
                        value: 'offer',
                        label: t('mobile.labEdit.makeOffer', { defaultValue: 'Make Offer' }),
                      },
                    ]}
                    value={priceFormat}
                    onSelect={(v) => {
                      if (v === 'offer') {
                        setValues((prev) => ({
                          ...prev,
                          price_format: 'offer',
                          price_per_unit: '',
                        }));
                      } else {
                        setField('price_format', 'buyNow');
                      }
                    }}
                  />
                  {priceFormat === 'offer' ? (
                    <View style={styles.offerNote}>
                      <Text style={styles.offerNoteText}>
                        <Text style={styles.offerNoteBold}>
                          {t('mobile.labEdit.makeOfferBold', { defaultValue: 'Make an offer.' })}
                        </Text>{' '}
                        {t('mobile.labEdit.makeOfferBody', {
                          defaultValue: 'Buyers submit offers and you accept or decline.',
                        })}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.priceBar,
                          !!errors.price_per_unit && styles.priceBarError,
                        ]}
                      >
                        <Text style={styles.priceSym}>
                          {CURRENCY_SYMBOLS[currency] || currency}
                        </Text>
                        <BottomSheetTextInput
                          style={styles.priceInput}
                          value={values.price_per_unit || ''}
                          onChangeText={(v) => setField('price_per_unit', v)}
                          keyboardType="decimal-pad"
                          placeholder={t('mobile.labEdit.pricePlaceholder', {
                            defaultValue: '0.00',
                          })}
                          placeholderTextColor={brand.placeholder}
                        />
                        <Pressable
                          onPress={() => {
                            haptics.tap();
                            setCurrencySheetOpen(true);
                          }}
                          hitSlop={8}
                          style={styles.currencyTap}
                          accessibilityRole="button"
                          accessibilityLabel={t('mobile.labEdit.changeCurrency', {
                            defaultValue: 'Change currency',
                          })}
                        >
                          <Text style={styles.currencyText}>{currency}</Text>
                          <ChevronDown size={14} color={brand.mutedForeground} />
                        </Pressable>
                      </View>
                      <FieldError msg={errors.price_per_unit} />
                      <FieldError msg={errors.price_currency} />
                    </>
                  )}
                </View>

                {/* Location */}
                <EditTextField
                  label={t('mobile.labEdit.location', { defaultValue: 'Location' })}
                  value={location}
                  onChangeText={setLocation}
                  placeholder={t('mobile.labEdit.locationPlaceholder', {
                    defaultValue: 'e.g. Taipei, Taiwan',
                  })}
                  autoCapitalize="words"
                  error={errors.location}
                  ai={isAi('location')}
                  verify={isLow('location')}
                  needs={missingRequired.has('location') && !location.trim()}
                />

                {/* Market metrics (read-only) */}
                {marketMetrics ? (
                  <View>
                    <EditFieldLabel>
                      {t('mobile.labEdit.marketMetrics', {
                        defaultValue: 'Market metrics (read-only)',
                      })}
                    </EditFieldLabel>
                    <View style={styles.metricsBox}>
                      {Object.entries(marketMetrics).map(([k, v]) => (
                        <View key={k} style={styles.metricRow}>
                          <Text style={styles.metricKey}>
                            {titleCase(k.replace(/_/g, ' '))}
                          </Text>
                          <Text style={styles.metricVal}>
                            {formatMetricValue(k, v)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </EditSectionCard>
            </BottomSheetScrollView>
          )}
        </BottomSheetModal>

        {/* Picker sheets (RN Modal — render above the gorhom sheet) */}
        <LabCategorySheet
          visible={catSheetOpen}
          categories={categories}
          loading={catLoading}
          netError={catError}
          onRetry={() => {
            haptics.tap();
            void refetchCategories();
          }}
          parentCatId={parentCatId}
          subCatId={subCatId}
          onParentPick={onParentPick}
          onSubPick={onSubPick}
          onClose={() => setCatSheetOpen(false)}
        />
        <LabCurrencySheet
          visible={currencySheetOpen}
          value={currency}
          onSelect={(c) => {
            setField('price_currency', c);
            setCurrencySheetOpen(false);
          }}
          onClose={() => setCurrencySheetOpen(false)}
        />
        <CountryPicker
          visible={countryOpen}
          value={values.country || ''}
          onSelect={(c) => setField('country', c)}
          onClose={() => setCountryOpen(false)}
        />
      </>
    );
  },
);

/* ── EditSectionCard ───────────────────────────────────────────────────────── */

function EditSectionCard({
  index,
  title,
  status,
  chip,
  children,
}: {
  index: number;
  title: string;
  status?: React.ReactNode;
  chip?: React.ReactNode;
  children: React.ReactNode;
}) {
  const entering = usePop(index * POP_STAGGER_MS);
  return (
    <Animated.View entering={entering} style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionEyebrow}>{title.toUpperCase()}</Text>
        <View style={styles.sectionHeadRight}>
          {status}
          {chip}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

/* ── Field label + provenance pills ─────────────────────────────────────────── */

function EditFieldLabel({
  children,
  ai,
  verify,
  needs,
}: {
  children: React.ReactNode;
  ai?: boolean;
  verify?: boolean;
  needs?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{String(children).toUpperCase()}</Text>
      {ai ? (
        <View style={styles.aiPill}>
          <Sparkles size={9} color={greenDark} />
          <Text style={styles.aiPillText}>AI</Text>
        </View>
      ) : null}
      {verify ? (
        <View style={styles.verifyPill}>
          <AlertTriangle size={9} color={warnAmber} />
          <Text style={styles.verifyPillText}>
            {t('mobile.labEdit.verify', { defaultValue: 'verify' })}
          </Text>
        </View>
      ) : null}
      {needs ? (
        <Text style={styles.needsText}>
          {t('mobile.labEdit.needs', { defaultValue: 'needs' })}
        </Text>
      ) : null}
    </View>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={styles.fieldError}>{msg}</Text>;
}

/* ── Text / number / multiline fields ───────────────────────────────────────── */

type BaseFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  counter?: string;
  counterOver?: boolean;
  helper?: string;
  error?: string;
  ai?: boolean;
  verify?: boolean;
  needs?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
};

function FieldFooterRow({
  helper,
  counter,
  counterOver,
}: {
  helper?: string;
  counter?: string;
  counterOver?: boolean;
}) {
  if (!helper && !counter) return null;
  return (
    <View style={styles.fieldFooterRow}>
      <Text style={styles.fieldHelper}>{helper ?? ''}</Text>
      {counter ? (
        <Text style={[styles.fieldCounter, counterOver && styles.fieldCounterOver]}>
          {counter}
        </Text>
      ) : null}
    </View>
  );
}

function EditTextField(props: BaseFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <EditFieldLabel ai={props.ai} verify={props.verify} needs={props.needs}>
        {props.label}
      </EditFieldLabel>
      <BottomSheetTextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!props.error && styles.inputError,
        ]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={brand.placeholder}
        maxLength={props.maxLength}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <FieldFooterRow
        helper={props.helper}
        counter={props.counter}
        counterOver={props.counterOver}
      />
      <FieldError msg={props.error} />
    </View>
  );
}

function EditNumberField(
  props: BaseFieldProps & { keyboardType: 'number-pad' | 'decimal-pad' },
) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <EditFieldLabel ai={props.ai} verify={props.verify} needs={props.needs}>
        {props.label}
      </EditFieldLabel>
      <BottomSheetTextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!props.error && styles.inputError,
        ]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={brand.placeholder}
        keyboardType={props.keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <FieldError msg={props.error} />
    </View>
  );
}

function EditMultilineField(props: BaseFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <EditFieldLabel ai={props.ai} verify={props.verify} needs={props.needs}>
        {props.label}
      </EditFieldLabel>
      <BottomSheetTextInput
        style={[
          styles.input,
          styles.inputMultiline,
          focused && styles.inputFocused,
          !!props.error && styles.inputError,
        ]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={brand.placeholder}
        maxLength={props.maxLength}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        autoCapitalize="sentences"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <FieldFooterRow
        helper={props.helper}
        counter={props.counter}
        counterOver={props.counterOver}
      />
      <FieldError msg={props.error} />
    </View>
  );
}

/* ── PillGroup (single-select chip grid) ────────────────────────────────────── */

function PillGroup({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.pillGrid}>
      {options.map((o) => (
        <Pill
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => {
            haptics.tap();
            onSelect(o.value);
          }}
        />
      ))}
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[style, styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/* ── PickerRow (tappable field opening a Sheet) ─────────────────────────────── */

function PickerRow({
  value,
  subValue,
  placeholder,
  error,
  onPress,
}: {
  value: string;
  /** When set, renders a two-line "parent / › sub" breadcrumb stack. */
  subValue?: string;
  placeholder: string;
  error?: boolean;
  onPress: () => void;
}) {
  const twoLine = !!subValue;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pickerRow,
        twoLine && styles.pickerRowTwoLine,
        error && styles.inputError,
      ]}
      accessibilityRole="button"
    >
      {twoLine ? (
        <View style={styles.pickerStack}>
          <Text numberOfLines={1} style={styles.pickerParent}>
            {value || placeholder}
          </Text>
          <Text numberOfLines={1} style={styles.pickerSubValue}>
            {'› '}
            {subValue}
          </Text>
        </View>
      ) : (
        <Text
          numberOfLines={1}
          style={[styles.pickerValue, !value && styles.pickerPlaceholder]}
        >
          {value || placeholder}
        </Text>
      )}
      <ChevronDown size={16} color={brand.mutedForeground} />
    </Pressable>
  );
}

/* ── PhotoGrid ──────────────────────────────────────────────────────────────── */

function PhotoGrid({
  urls,
  uploading,
  canAdd,
  onAdd,
  onRemove,
}: {
  urls: string[];
  uploading: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.photoGrid}>
      {urls.map((url, i) => (
        <View key={`${url}-${i}`} style={styles.photoTile}>
          <AppImage source={{ uri: url }} style={styles.photoImg} />
          <View style={styles.photoTag}>
            <Text style={styles.photoTagText}>{String(i + 1).padStart(2, '0')}</Text>
          </View>
          {i === 0 ? (
            <View style={styles.photoStar}>
              <Star size={12} color="#fff" fill={warnAmber} />
            </View>
          ) : null}
          <Pressable
            onPress={() => onRemove(i)}
            hitSlop={10}
            style={styles.photoRemove}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labEdit.removePhoto', {
              defaultValue: 'Remove photo {{n}}',
              n: i + 1,
            })}
          >
            <X size={13} color="#fff" />
          </Pressable>
        </View>
      ))}
      {canAdd ? (
        <Pressable
          onPress={onAdd}
          disabled={uploading}
          style={[styles.photoTile, styles.photoAdd]}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labEdit.addPhotos', { defaultValue: 'Add photos' })}
        >
          {uploading ? (
            <ActivityIndicator color={greenDark} />
          ) : (
            <>
              <ImagePlus size={20} color={greenDark} />
              <Text style={styles.photoAddText}>
                {t('mobile.labEdit.add', { defaultValue: 'Add' })}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Category + currency picker sheets (built on the shared Sheet primitive) ── */

function LabCategorySheet({
  visible,
  categories,
  loading,
  netError,
  onRetry,
  parentCatId,
  subCatId,
  onParentPick,
  onSubPick,
  onClose,
}: {
  visible: boolean;
  categories: LabCategory[];
  loading: boolean;
  netError: boolean;
  onRetry: () => void;
  parentCatId: string;
  subCatId: string;
  onParentPick: (id: string) => void;
  onSubPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const empty = categories.length === 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.labEdit.selectCategoryTitle', { defaultValue: 'Select category' })}
      subtitle={t('mobile.labEdit.selectCategorySubtitle', {
        defaultValue: 'Pick a category, then a subcategory',
      })}
      maxHeight={520}
    >
      {empty && netError ? (
        <Pressable
          onPress={onRetry}
          style={styles.catRetry}
          accessibilityRole="button"
        >
          <AlertTriangle size={16} color={brand.destructive} />
          <Text style={styles.catRetryText}>
            {t('mobile.labEdit.categoriesLoadError', {
              defaultValue: "Couldn't load categories — tap to retry",
            })}
          </Text>
        </Pressable>
      ) : empty && loading ? (
        <View style={styles.catSkeletonWrap}>
          <View style={styles.catSkeleton} />
          <View style={styles.catSkeleton} />
          <View style={styles.catSkeleton} />
        </View>
      ) : (
        categories.map((parent) => {
          const pid = String(parent.id);
          const isParent = parentCatId === pid;
          const parentPrimary = splitCatName(parent.name).primary;
          return (
            <View key={pid}>
              <Sheet.Option
                label={parentPrimary}
                active={false}
                rightAdornment={
                  <ChevronDown
                    size={16}
                    color={brand.mutedForeground}
                    style={isParent ? styles.chevronOpen : undefined}
                  />
                }
                style={isParent ? styles.optionParentExpanded : undefined}
                onPress={() => onParentPick(pid)}
              />
              {isParent
                ? [
                    ...parent.subcategories.map((s) => {
                      const split = splitCatName(s.name);
                      return (
                        <Sheet.Option
                          key={String(s.id)}
                          indent
                          label={split.primary}
                          description={split.examples || undefined}
                          active={subCatId === String(s.id)}
                          onPress={() => onSubPick(String(s.id))}
                        />
                      );
                    }),
                    <Sheet.Option
                      key={`${pid}-other`}
                      indent
                      label={t('mobile.labEdit.other', { defaultValue: 'Other…' })}
                      active={subCatId === OTHER_SUBCATEGORY}
                      onPress={() => onSubPick(OTHER_SUBCATEGORY)}
                    />,
                  ]
                : null}
            </View>
          );
        })
      )}
    </Sheet>
  );
}

function LabCurrencySheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (c: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.labEdit.selectCurrency', { defaultValue: 'Select currency' })}
      maxHeight={360}
    >
      {CURRENCY_OPTIONS.map((c) => (
        <Sheet.Option
          key={c}
          label={`${c}  ·  ${CURRENCY_SYMBOLS[c]}`}
          active={c === value}
          onPress={() => {
            haptics.tap();
            onSelect(c);
          }}
        />
      ))}
    </Sheet>
  );
}

/* ── Banner (top-of-scroll status) ──────────────────────────────────────────── */

function Banner({
  tone,
  icon,
  text,
  actionLabel,
  onAction,
}: {
  tone: 'destructive';
  icon: React.ReactNode;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.banner, tone === 'destructive' && styles.bannerDestructive]}>
      {icon}
      <Text style={styles.bannerText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            haptics.tap();
            onAction();
          }}
          hitSlop={8}
          style={styles.bannerAction}
        >
          <Text style={styles.bannerActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Guest panel ────────────────────────────────────────────────────────────── */

function GuestPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.guestPanel}>
      <View style={styles.guestCoin}>
        <Sparkles size={22} color={greenDark} />
      </View>
      <Text style={styles.guestTitle}>
        {t('mobile.labEdit.signInTitle', { defaultValue: 'Sign in to edit this listing' })}
      </Text>
      <Text style={styles.guestSub}>
        {t('mobile.labEdit.signInBody', {
          defaultValue:
            'Create a free account or sign in to fix listing details and manage your photos.',
        })}
      </Text>
      <Pressable
        onPress={() => {
          haptics.tap();
          onClose();
        }}
        style={styles.guestBtn}
        accessibilityRole="button"
      >
        <Text style={styles.guestBtnText}>
          {t('mobile.labEdit.gotIt', { defaultValue: 'Got it' })}
        </Text>
      </Pressable>
    </View>
  );
}

/* ── Footer buttons ─────────────────────────────────────────────────────────── */

function FooterGhost({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[style, styles.footerGhost, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={6}
    >
      <Text style={styles.footerGhostText}>{label}</Text>
    </AnimatedPressable>
  );
}

function FooterPrimary({
  label,
  saving,
  onPress,
}: {
  label: string;
  saving: boolean;
  onPress: () => void;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  const spin = useSpin();
  return (
    <AnimatedPressable
      style={[style, styles.footerPrimary, saving && { opacity: 0.6 }]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={saving}
      hitSlop={6}
    >
      {saving ? (
        <Animated.View style={spin}>
          <RefreshCw size={15} color="#fff" />
        </Animated.View>
      ) : (
        <Check size={16} color="#fff" />
      )}
      <Text style={styles.footerPrimaryText}>{label}</Text>
    </AnimatedPressable>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  grabber: { backgroundColor: brand.borderStrong, width: 44 },
  sheetBg: {
    backgroundColor: brand.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: brand.divider,
  },
  headerLead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCoin: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: brand.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    letterSpacing: -0.2,
    color: brand.foreground,
  },
  headerClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { padding: spacing.lg, gap: spacing.lg },

  // Section card
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    overflow: 'hidden',
    ...elevation.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: brand.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: brand.divider,
  },
  sectionEyebrow: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: greenDark,
  },
  sectionHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBody: { padding: spacing.lg, gap: spacing.lg },
  statusReady: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusReadyText: { fontFamily: fonts.semibold, fontSize: 12, color: greenDark },
  statusNeed: { fontFamily: fonts.semibold, fontSize: 12, color: brand.destructive },
  reqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: brand.warningBg,
    borderWidth: 1,
    borderColor: brand.warningBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reqChipText: {
    fontFamily: fonts.label,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: brand.warningText,
  },

  // Layout
  row2: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1, minWidth: 0 },

  // Field label
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: brand.mutedForeground,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: brand.successBg,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiPillText: { fontFamily: fonts.bold, fontSize: 9, color: greenDark },
  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: brand.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  verifyPillText: { fontFamily: fonts.semibold, fontSize: 9, color: brand.warningText },
  needsText: { fontFamily: fonts.semibold, fontSize: 9, color: greenMedium },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: brand.foreground,
    backgroundColor: brand.surface,
  },
  inputFocused: { borderColor: greenDark },
  inputError: { borderColor: brand.destructive },
  inputMultiline: { minHeight: 96, paddingTop: 10 },
  fieldFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  fieldHelper: { fontFamily: fonts.regular, fontSize: 11, color: brand.placeholder },
  fieldCounter: { fontFamily: fonts.regular, fontSize: 11, color: brand.placeholder },
  fieldCounterOver: { color: brand.destructive },
  fieldError: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: brand.destructive,
    marginTop: 4,
  },

  // Pills
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    minWidth: '47%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    backgroundColor: brand.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pillSelected: { backgroundColor: greenDark, borderColor: greenDark },
  pillText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: brand.foreground,
    textAlign: 'center',
  },
  pillTextSelected: { color: '#fff' },

  // Picker row
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: brand.surface,
  },
  pickerValue: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: brand.foreground },
  pickerPlaceholder: { color: brand.placeholder },
  // Two-line breadcrumb variant (Category): top-aligned + taller padding so the
  // stacked parent/sub don't clip. Single-line callers keep the centered path.
  pickerRowTwoLine: { alignItems: 'flex-start', paddingVertical: 8 },
  pickerStack: { flex: 1, marginRight: 8 },
  pickerParent: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: brand.foreground,
  },
  pickerSubValue: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: greenDark,
    marginTop: 2,
  },

  // Category picker: parent grouping tint + accordion chevron + load states.
  optionParentExpanded: { backgroundColor: '#f8fafc' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  catRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.border,
    marginBottom: 8,
  },
  catRetryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: brand.destructive,
  },
  catSkeletonWrap: { gap: 10, paddingVertical: 4 },
  catSkeleton: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: brand.surfaceMuted,
  },

  // Price bar
  priceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    minHeight: 52,
    backgroundColor: brand.surface,
    overflow: 'hidden',
  },
  priceBarError: { borderColor: brand.destructive },
  priceSym: {
    paddingHorizontal: 12,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: brand.mutedForeground,
  },
  priceInput: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: -0.4,
    color: brand.foreground,
    paddingVertical: 8,
  },
  currencyTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: brand.border,
    backgroundColor: brand.surfaceMuted,
  },
  currencyText: { fontFamily: fonts.semibold, fontSize: 13, color: brand.foreground },
  offerNote: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: brand.warningBorder,
    backgroundColor: brand.warningBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  offerNoteText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: brand.warningText,
  },
  offerNoteBold: { fontFamily: fonts.bold },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: brand.surfaceMuted,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoTag: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  photoTagText: { fontFamily: fonts.bold, fontSize: 9, color: '#fff' },
  photoStar: { position: 'absolute', top: 3, left: 3 },
  photoRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(17,17,17,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    borderWidth: 2,
    borderColor: brand.successBorder,
    borderStyle: 'dashed',
    backgroundColor: brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddText: { fontFamily: fonts.semibold, fontSize: 10, color: greenDark },

  // Metrics
  metricsBox: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    backgroundColor: brand.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  metricKey: { fontFamily: fonts.regular, fontSize: 12, color: brand.mutedForeground },
  metricVal: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: brand.foreground,
  },

  // Banners
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerDestructive: {
    backgroundColor: brand.destructiveBg,
    borderColor: brand.destructive,
  },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: brand.destructiveStrong },
  bannerAction: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.destructive,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bannerActionText: { fontFamily: fonts.bold, fontSize: 12, color: brand.destructive },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: brand.divider,
    backgroundColor: brand.surface,
  },
  footerGhost: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
  },
  footerGhostText: { fontFamily: fonts.semibold, fontSize: 14, color: brand.mutedForeground },
  footerPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: greenDark,
  },
  footerPrimaryText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },

  // Guest
  guestPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  guestCoin: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: brand.successBg,
    borderWidth: 1,
    borderColor: brand.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  guestTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: brand.foreground,
    textAlign: 'center',
  },
  guestSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: brand.mutedForeground,
    textAlign: 'center',
  },
  guestBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: greenDarkest,
  },
  guestBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
});
