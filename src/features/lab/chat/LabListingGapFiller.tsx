// LabListingGapFiller — the native port of the web `ListingGapFiller`. A slim,
// on-brand slide-through stepper that asks ONLY for the draft's gaps (fields the
// AI couldn't fill = missing_required, or wasn't sure about = low_confidence),
// one field per slide, each with a TYPE-MATCHED input. Single-choice inputs
// (country/category/condition/operation/grade) auto-advance on pick; typed
// inputs advance on submit/Next. Each step PUTs the SINGLE field via
// `putListingDraft` and calls `onSaved(payload)` so the draft card above updates
// live. When every gap is satisfied it shows a brief "all set" completion state.
//
// Mounted inside chat.tsx's composerWrap (the slot LabLocationPromptStrip used
// to occupy) — a composer sibling above AttachmentChips, so it rides above the
// keyboard and never scrolls away.
//
// CRITICAL correctness (avoids the web's fixed-step-index pitfalls): this does
// NOT drive by a frozen gap list + step counter. It recomputes gaps LIVE from
// the latest `data` prop every render and tracks a per-mount `satisfied` Set
// (useRef) of keys the user has answered/skipped THIS session. The "current"
// slide is the first live gap not in `satisfied`. This means:
//   • a low_confidence field that STAYS low-confidence after save can't loop —
//     it's in `satisfied` so we move past it;
//   • the optimistic-save → recompute double-advance race can't skip a field —
//     advancement is purely "mark satisfied", never a +1 index bump.
//
// Reuses (never reinvents): putListingDraft/fieldsOf/imagesOf/asString/
// hasAuthToken/extractFieldErrors from listingDraftApi; CountryPicker; the Sheet
// primitive; getDeviceLocation + readCachedLocation for the GPS action;
// uploadGcsPhotos + gcsUrlForAnalyze (+ expo-image-picker) for the photo step;
// fetchLabCategories (React Query) for the category list; recipes/haptics/theme.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { toast } from 'sonner-native';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Gauge,
  HandCoins,
  Hash,
  ImagePlus,
  MapPin,
  PartyPopper,
  Scale,
  Sparkles,
  Tag,
  Type as TypeIcon,
} from 'lucide-react-native';

import { Sheet } from '@/components/ui';
import {
  fonts,
  radius,
  spacing,
} from '@/constants/theme';
import { createThemedStyles, useColor } from '@/features/lab/chat/theme';
import { haptics } from '@/lib/haptics';
import { usePressScale, usePop } from '@/animations/recipes';
import { useAuth } from '@/stores/authStore';
import { fetchLabCategories, type LabCategory } from '@/services/scanner/fetchCategories';
import { gcsUrlForAnalyze, uploadGcsPhotos } from '@/services/scanner/uploadGcsPhotos';
import type { Photo } from '@/stores/scanDraftStore';
import { CountryPicker } from '@/features/scanner/components/detail/CountryPicker';
import { getDeviceLocation } from '@/services/location/getDeviceLocation';
import { readCachedLocation } from '@/features/location/pickupStore';
import {
  asString,
  extractFieldErrors,
  fieldsOf,
  hasAuthToken,
  imagesOf,
  putListingDraft,
  type DraftPayload,
} from '@/features/lab/data/listingDraftApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── Field meta (ported VERBATIM from the web FIELD_META) ──────────────────── */

type GapKind =
  | 'country'
  | 'category'
  | 'condition'
  | 'operation'
  | 'grade'
  | 'price'
  | 'number'
  | 'text'
  | 'image';

type LucideIcon = typeof TypeIcon;

const FIELD_META: Record<
  string,
  { kind: GapKind; prompt: string; placeholder?: string; icon: LucideIcon }
> = {
  images: { kind: 'image', prompt: 'Add at least one photo', icon: ImagePlus },
  country: { kind: 'country', prompt: 'Which country is it in?', icon: MapPin },
  // Location reuses the searchable country picker (an equipment listing's
  // location is its country/region) — picking it also fills `country`.
  location: { kind: 'country', prompt: 'Where is it located?', icon: MapPin },
  category: { kind: 'category', prompt: 'Which category fits best?', icon: Tag },
  item_condition: { kind: 'condition', prompt: 'What condition is it in?', icon: Gauge },
  price_per_unit: { kind: 'price', prompt: 'Set a price', icon: DollarSign },
  year: { kind: 'number', prompt: 'What year is it from?', placeholder: 'e.g. 2021', icon: Calendar },
  quantity: { kind: 'number', prompt: 'How many units?', placeholder: '1', icon: Hash },
  weight_per_unit: { kind: 'number', prompt: 'Weight (kg)?', placeholder: 'e.g. 120', icon: Scale },
  product_title: { kind: 'text', prompt: 'What should the listing be titled?', icon: TypeIcon },
  brand: { kind: 'text', prompt: "What's the brand?", icon: TypeIcon },
  model: { kind: 'text', prompt: "What's the model?", icon: TypeIcon },
  serial_number: { kind: 'text', prompt: 'Serial number?', icon: TypeIcon },
  operation_status: { kind: 'operation', prompt: 'Is it installed or deinstalled?', icon: Gauge },
  item_grade: { kind: 'grade', prompt: "What's its grade?", icon: Gauge },
  dimensions: { kind: 'text', prompt: 'Dimensions (L × W × H)?', icon: TypeIcon },
  product_content: { kind: 'text', prompt: 'Add a short description', icon: TypeIcon },
};

// Canonical condition keys — must match GBS VALID_CONDITION_KEYS exactly.
const CONDITIONS: [string, string][] = [
  ['new', 'New'],
  ['usedFunctional', 'Used (Functional)'],
  ['forParts', 'For Parts'],
  ['wasteDisposal', 'Waste Disposal'],
  ['demolitionRemoval', 'Demolition / Removal'],
];
const OPERATION_STATUSES: [string, string][] = [
  ['installed', 'Installed'],
  ['deinstalled', 'Deinstalled'],
];
const GRADES: [string, string][] = [
  ['A', 'Grade A'],
  ['B', 'Grade B'],
  ['C', 'Grade C'],
  ['D', 'Grade D'],
];
const CHIP_OPTIONS: Record<string, [string, string][]> = {
  condition: CONDITIONS,
  operation: OPERATION_STATUSES,
  grade: GRADES,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  TWD: 'NT$',
  THB: '฿',
};

const humanize = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Concise, lower-cased field label for the "almost there" sentence. Reuses the
 *  FIELD_META prompt mapping's intent (images → "photo") and falls back to a
 *  humanized key for everything else. */
const REQUIRED_LABEL: Record<string, string> = { images: 'photo' };
const requiredLabel = (k: string) => REQUIRED_LABEL[k] ?? humanize(k).toLowerCase();

/** Coerce a typed value (ported VERBATIM from the web `coerce`). */
const coerce = (key: string, raw: string): unknown => {
  const t = String(raw).trim();
  if (t === '') return '';
  if (key === 'year' || key === 'quantity') {
    const n = parseInt(t, 10);
    return Number.isNaN(n) ? t : n;
  }
  if (key === 'price_per_unit' || key === 'weight_per_unit') {
    const n = parseFloat(t);
    return Number.isNaN(n) ? t : n;
  }
  return raw;
};

/** AI 3-tier price guidance, reachable at the top level of the payload or nested
 *  under fields.price_suggestions.value. Read defensively (mobile DraftPayload
 *  doesn't declare it). */
type PriceSuggestions = { new?: string | number; used?: string | number; scrap?: string | number };
function readPriceSuggestions(data: DraftPayload): PriceSuggestions | null {
  const fields = fieldsOf(data);
  const nested = fields.price_suggestions?.value;
  const flat = (data as { price_suggestions?: unknown }).price_suggestions;
  const src = (nested ?? flat) as unknown;
  if (src && typeof src === 'object') return src as PriceSuggestions;
  return null;
}

/** Live gap list = missing_required ∪ low_confidence (dedup, preserve order).
 *  Drop `country` when `location` is already a step. Sort `images` first. */
function computeGaps(data: DraftPayload): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [...(data.missing_required || []), ...(data.low_confidence || [])]) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  const filtered = out.filter((k) => !(k === 'country' && out.includes('location')));
  filtered.sort((a, b) => (a === 'images' ? -1 : b === 'images' ? 1 : 0));
  return filtered;
}

/* ── Slide (per-key enter-from-right / exit-left animation) ────────────────── */

function Slide({ slideKey, children }: { slideKey: string; children: React.ReactNode }) {
  // Start VISIBLE (x:0, opacity:1) so the first slide can never paint blank if
  // the mount effect is delayed/skipped. Animate the enter-from-right slide only
  // on subsequent slide CHANGES (tracked via prevKey), keeping the transition
  // feel without ever hiding the initial content.
  const x = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prevKey = useRef(slideKey);
  useEffect(() => {
    if (prevKey.current === slideKey) return; // first mount → stay visible
    prevKey.current = slideKey;
    x.value = 28;
    opacity.value = 0;
    x.value = withSpring(0, { damping: 32, stiffness: 380 });
    opacity.value = withTiming(1, { duration: 200 });
  }, [slideKey, x, opacity]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

type Props = {
  /** The most-recent listing_draft card payload. */
  data: DraftPayload;
  conversationId: string;
  /** Append a fresh listing_draft card (reuse the chat's existing onSaved). */
  onSaved: (payload: DraftPayload) => void;
  /** Focus the composer input (the "type it instead" escape hatch). */
  onManual: () => void;
};

export function LabListingGapFiller({ data, conversationId, onSaved, onManual }: Props) {
  const entering = usePop();
  const { t, i18n } = useTranslation();
  const sellerId = useAuth((s) => s.profile?.id ?? null);
  const styles = useGapStyles();
  const placeholderColor = useColor('text.placeholder');
  const dangerColor = useColor('status.danger');
  const accentPressedColor = useColor('accent.pressed');
  const successColor = useColor('status.success');

  // Keys the user has answered/skipped THIS mount — the current slide is the
  // first live gap NOT in this set. Purely additive; never reset per data frame,
  // so a field that stays low-confidence after save can't re-open (no loop).
  const satisfiedRef = useRef<Set<string>>(new Set());
  // Bump to force a recompute of `key` after we mutate the satisfied ref.
  const [tickN, forceTick] = useState(0);
  const tick = useCallback(() => forceTick((n) => n + 1), []);

  const gaps = useMemo(() => computeGaps(data), [data]);
  const fields = fieldsOf(data);
  const currency = (asString(fields.price_currency?.value) || 'USD').toUpperCase();
  const priceSug = readPriceSuggestions(data);

  // The current key: first live gap the user hasn't satisfied this session.
  const key = useMemo(
    () => gaps.find((g) => !satisfiedRef.current.has(g)) ?? null,
    // `gaps` changes per data frame; `tickN` re-runs it after a satisfy/skip
    // (which only mutates the satisfied ref, leaving `gaps` referentially equal).
    [gaps, tickN], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const meta = key
    ? FIELD_META[key] ?? { kind: 'text' as GapKind, prompt: `Add ${humanize(key)}`, icon: TypeIcon }
    : null;
  const isLowConf = key ? (data.low_confidence || []).includes(key) : false;

  // Per-slide transient input state.
  const [value, setValue] = useState('');
  const [cat, setCat] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [netError, setNetError] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // Location denied/unavailable inline hints (never a red error in the thread).
  const [locDenied, setLocDenied] = useState(false);
  const busyRef = useRef(false);

  // Reset input state when the current slide changes (seed from the draft value).
  useEffect(() => {
    if (!key) return;
    setValue(asString(fields[key]?.value));
    setCat(null);
    setCountryOpen(false);
    setCatOpen(false);
    setNetError(false);
    setFieldError(null);
    setLocDenied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Categories (React Query cached), only when a category gap exists.
  const needCategories = gaps.includes('category');
  const { data: catData } = useQuery({
    queryKey: ['labCategories', i18n.language, '101lab'],
    queryFn: () => fetchLabCategories(i18n.language, '101lab'),
    staleTime: 5 * 60_000,
    enabled: needCategories,
  });
  const catOptions = useMemo(() => {
    const cats: LabCategory[] = catData ?? [];
    const out: { id: string; name: string; label: string }[] = [];
    for (const p of cats) {
      for (const s of p.subcategories || []) {
        out.push({ id: String(s.id), name: s.name, label: `${p.name} › ${s.name}` });
      }
    }
    return out;
  }, [catData]);

  /** Mark the current key satisfied and advance (recomputes the slide). */
  const advance = useCallback(() => {
    if (key) satisfiedRef.current.add(key);
    tick();
  }, [key, tick]);

  /** Handle a PUT response's status, mirroring the editor. Returns true on OK. */
  const handleResponse = useCallback(
    (status: number, body: DraftPayload | Record<string, unknown> | null): boolean => {
      if (status === 401) {
        setIsGuest(true);
        return false;
      }
      if (status === 422) {
        const errs = extractFieldErrors(body);
        const msg = key ? errs[key] : undefined;
        setFieldError(
          msg ??
            t('mobile.labGap.valueRejected', {
              defaultValue: 'That value was rejected — try again.',
            }),
        );
        haptics.warning();
        return false;
      }
      if (status < 200 || status >= 300 || !body) {
        setNetError(true);
        haptics.error();
        return false;
      }
      onSaved(body as DraftPayload);
      return true;
    },
    [key, onSaved],
  );

  /** PUT the given fields (+ optional image_urls); advance on success. */
  const putAndAdvance = useCallback(
    async (fieldsBody: Record<string, unknown>, imageUrls?: string[]) => {
      if (saving) return;
      setSaving(true);
      setNetError(false);
      setFieldError(null);
      try {
        const { status, body } = await putListingDraft(conversationId, fieldsBody, imageUrls);
        if (handleResponse(status, body)) {
          haptics.success();
          advance();
        }
      } catch {
        setNetError(true);
        haptics.error();
      } finally {
        setSaving(false);
      }
    },
    [saving, conversationId, handleResponse, advance],
  );

  /** Typed / chip / picker save: coerce + pair location↔country. */
  const save = useCallback(
    (rawValue: string, catSel?: { id: string; name: string } | null) => {
      if (saving || !key) return;
      const body: Record<string, unknown> = {};
      if (meta?.kind === 'category') {
        if (!catSel) {
          advance();
          return;
        }
        body.category = catSel.name;
        body.category_id = catSel.id;
      } else {
        const v = coerce(key, rawValue);
        if (v === '' || v == null) {
          advance();
          return;
        }
        body[key] = v;
        // Location picker fills both location + country in one tap (and back).
        if (meta?.kind === 'country') {
          if (key === 'location') body.country = v;
          else if (key === 'country') body.location = v;
        }
      }
      void putAndAdvance(body);
    },
    [saving, key, meta, advance, putAndAdvance],
  );

  /** Price escape hatch: switch to make-offer (no fixed price) and advance. */
  const acceptOffers = useCallback(() => {
    if (saving) return;
    void putAndAdvance({ price_format: 'offer' });
  }, [saving, putAndAdvance]);

  /** GPS action on the location slide: resolve a device fix, PUT location +
   *  country, advance. Denied/unavailable degrade gracefully (never red). */
  const onUseCurrent = useCallback(async () => {
    if (busyRef.current || detecting) return;
    busyRef.current = true;
    haptics.tap();
    setLocDenied(false);
    setDetecting(true);
    try {
      const apply = (loc: { country: string; label: string; address: string }) => {
        const place = (loc.label || loc.address || loc.country || '').trim();
        const country = (loc.country || '').trim();
        const body: Record<string, unknown> = {};
        if (place) body.location = place;
        if (country) body.country = country;
        if (!place && !country) return false;
        void putAndAdvance(body);
        return true;
      };
      const res = await getDeviceLocation();
      if (res.ok) {
        if (apply(res.location)) return;
      } else if (res.reason === 'denied') {
        setLocDenied(true);
        return;
      }
      // unavailable (or resolved but empty) → try the cached fix before giving up.
      const cached = readCachedLocation();
      if (cached && apply(cached)) return;
      toast(
        t('mobile.labGap.locationUnavailable', {
          defaultValue: "Location isn't available right now — search or type it instead.",
        }),
      );
    } finally {
      setDetecting(false);
      busyRef.current = false;
    }
  }, [detecting, putAndAdvance]);

  /** Shared photo flow: GCS-upload the picked assets, merge with existing
   *  image_urls, PUT, advance. Used by BOTH the library and camera sources. */
  const uploadAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (sellerId == null) {
        setIsGuest(true);
        return;
      }
      const photos: Photo[] = assets.map((a) => ({
        uri: a.uri,
        width: a.width ?? 0,
        height: a.height ?? 0,
      }));
      if (photos.length === 0) return;
      setUploading(true);
      setNetError(false);
      try {
        const r = await uploadGcsPhotos(photos, { sellerId });
        const added = r.files.map(gcsUrlForAnalyze);
        if (!added.length) {
          setNetError(true);
          return;
        }
        const existing = imagesOf(data).filter(Boolean);
        // Photo PUT sends no fields, only the merged image_urls list.
        await putAndAdvance({}, [...existing, ...added]);
      } catch {
        setNetError(true);
        haptics.error();
      } finally {
        setUploading(false);
      }
    },
    [sellerId, data, putAndAdvance],
  );

  /** Photo source A — pick one or more from the library. */
  const onPickLibrary = useCallback(async () => {
    if (uploading || saving) return;
    if (sellerId == null) {
      setIsGuest(true);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error(
        t('mobile.labGap.photoAccessTitle', { defaultValue: 'Photo access needed' }),
        {
          description: t('mobile.labGap.photoAccessBody', {
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
    await uploadAssets(result.assets);
  }, [uploading, saving, sellerId, uploadAssets]);

  /** Photo source B — snap one with the camera (a photo can't be "typed", so
   *  the camera is the natural second source on this slide). */
  const onPickCamera = useCallback(async () => {
    if (uploading || saving) return;
    if (sellerId == null) {
      setIsGuest(true);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.error(
        t('mobile.labGap.cameraAccessTitle', { defaultValue: 'Camera access needed' }),
        {
          description: t('mobile.labGap.cameraAccessBody', {
            defaultValue: 'Enable camera access in Settings to take a photo.',
          }),
        },
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;
    haptics.tap();
    await uploadAssets(result.assets);
  }, [uploading, saving, sellerId, uploadAssets]);

  const onSkip = useCallback(() => {
    haptics.tap();
    advance();
  }, [advance]);

  // REMAINING REQUIRED gaps read from the LIVE server list every render (NOT the
  // satisfied set) — this is the authoritative "can it publish yet?" signal.
  // Low-confidence-only fields are optional confirmations and must NOT block.
  // Guard a malformed/empty missing_required → [] (publishable path).
  const remainingRequired = useMemo(
    () => (Array.isArray(data.missing_required) ? data.missing_required.filter(Boolean) : []),
    [data.missing_required],
  );

  // "Finish required": reopen the flow at the first remaining required field by
  // un-satisfying those keys and forcing `key` to recompute to that field.
  const onFinishRequired = useCallback(() => {
    haptics.tap();
    for (const k of remainingRequired) satisfiedRef.current.delete(k);
    tick();
  }, [remainingRequired, tick]);

  const onManualPress = useCallback(() => {
    haptics.tap();
    onManual();
  }, [onManual]);

  // Nothing to fill → render nothing (chat.tsx also gates, but be defensive).
  if (gaps.length === 0) return null;

  // Guest gate — mirror the editor: a graceful sign-in nudge, never a crash.
  if (isGuest) {
    return (
      <Animated.View entering={entering} exiting={FadeOut.duration(180)} style={styles.shell}>
        <View style={styles.guestRow}>
          <View style={styles.headerCoin}>
            <Sparkles size={14} color={accentPressedColor} />
          </View>
          <Text style={styles.guestText}>
            {t('mobile.labGap.guestFinish', {
              defaultValue: 'Sign in to finish and publish this listing.',
            })}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // Completion state — the stepper has no more slides to show. Branch on REALITY:
  // is the draft actually publishable (no missing_required left), or did the user
  // skip a required field (still blocked)?
  if (!key || !meta) {
    // Publishable — nothing required remains → keep the celebratory finish (the
    // draft card above shows its Publish affordance only in this state).
    if (remainingRequired.length === 0) {
      return (
        <Animated.View entering={entering} exiting={FadeOut.duration(180)} style={styles.doneShell}>
          <PartyPopper size={16} color={successColor} />
          <Text style={styles.doneText}>
            {t('mobile.labGap.allSet', {
              defaultValue: 'All set — review the draft above and tap Publish.',
            })}
          </Text>
        </Animated.View>
      );
    }
    // Still blocked — one or more required fields were skipped. Be honest: name
    // exactly what's left, and offer to re-open the flow at the first of them.
    const labels = remainingRequired.map(requiredLabel);
    return (
      <Animated.View entering={entering} exiting={FadeOut.duration(180)} style={styles.blockedShell}>
        <View style={styles.blockedHeadRow}>
          <View style={styles.promptCoin}>
            <ClipboardList size={15} color={accentPressedColor} />
          </View>
          <View style={styles.blockedHeadText}>
            <Text style={styles.blockedTitle}>
              {t('mobile.labGap.almostThere', { defaultValue: 'Almost there' })}
            </Text>
            <Text style={styles.blockedBody}>
              {t('mobile.labGap.blockedAdd', { defaultValue: 'Add' })}{' '}
              {labels.map((lbl, i) => (
                <Text key={remainingRequired[i]}>
                  <Text style={styles.blockedField}>{lbl}</Text>
                  {i < labels.length - 2
                    ? ', '
                    : i === labels.length - 2
                      ? ` ${t('mobile.labGap.blockedAnd', { defaultValue: 'and' })} `
                      : ''}
                </Text>
              ))}{' '}
              {t('mobile.labGap.blockedToPublish', { defaultValue: 'to publish.' })}
            </Text>
          </View>
        </View>
        <FinishRequiredButton onPress={onFinishRequired} />
      </Animated.View>
    );
  }

  const stepNum = gaps.findIndex((g) => g === key) + 1;
  // A field the server still lists as required reads as "Do later" (skipping it
  // won't complete the listing); a low_confidence-only field keeps "Skip".
  const isRequired = remainingRequired.includes(key);
  const Icon = meta.icon;
  const isChip = !!CHIP_OPTIONS[meta.kind];
  const isTyped = meta.kind === 'number' || meta.kind === 'text' || meta.kind === 'price';
  const canNext = value.trim() !== '';
  // "Type it" (answer in words in the chat) only makes sense where the on-slide
  // input can't capture nuance — the PICKER/CHIP kinds (country, category,
  // condition, status, grade). It's meaningless on the photo slide (you can't
  // type a photo) and redundant on typed slides (they already have an input).
  const showTypeIt = meta.kind === 'country' || meta.kind === 'category' || isChip;

  return (
    <Animated.View entering={entering} exiting={FadeOut.duration(180)} style={styles.shell}>
      {/* Header + step count */}
      <View style={styles.headerRow}>
        <View style={styles.headerLead}>
          <Sparkles size={13} color={accentPressedColor} strokeWidth={2.4} />
          <Text style={styles.headerTitle}>
            {t('mobile.labGap.finishListing', { defaultValue: 'Finish your listing' })}
          </Text>
        </View>
        <Text style={styles.stepCount}>
          {t('mobile.labGap.stepOf', {
            defaultValue: 'step {{current}} of {{total}}',
            current: stepNum,
            total: gaps.length,
          })}
        </Text>
      </View>

      {/* Segmented progress bar */}
      <View style={styles.progressRow}>
        {gaps.map((g, i) => {
          const filled = satisfiedRef.current.has(g);
          const current = g === key;
          return (
            <View key={g} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: filled ? '100%' : current ? '45%' : '0%' },
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.body}>
        {netError ? (
          <Pressable
            onPress={onSkip}
            style={styles.banner}
            accessibilityRole="button"
          >
            <AlertTriangle size={13} color={dangerColor} />
            <Text style={styles.bannerText}>
              {t('mobile.labGap.errSave', {
                defaultValue:
                  "Couldn't save that — check your connection, then retry or skip.",
              })}
            </Text>
          </Pressable>
        ) : null}

        <Slide slideKey={key}>
          {/* Prompt row */}
          <View style={styles.promptRow}>
            <View style={styles.promptCoin}>
              <Icon size={15} color={accentPressedColor} />
            </View>
            <Text style={styles.promptText}>
              {t(`mobile.labGap.prompt.${key}`, { defaultValue: meta.prompt })}
            </Text>
            {isLowConf ? (
              <View style={styles.confirmBadge}>
                <Text style={styles.confirmBadgeText}>
                  {t('mobile.labGap.confirm', { defaultValue: 'confirm' })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Input by type */}
          {meta.kind === 'country' ? (
            <View style={styles.gap8}>
              <UseCurrentChip detecting={detecting} onPress={onUseCurrent} />
              <PickerRow
                value={value}
                placeholder={t('mobile.labGap.searchCountry', { defaultValue: 'Search country…' })}
                onPress={() => {
                  haptics.tap();
                  setCountryOpen(true);
                }}
              />
              {locDenied ? (
                <Text style={styles.deniedHint}>
                  {t('mobile.labGap.locationOff', {
                    defaultValue: 'Location off — enable it in Settings, or search above.',
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {meta.kind === 'category' ? (
            <PickerRow
              value={cat?.name ?? ''}
              placeholder={
                catOptions.length
                  ? t('mobile.labGap.searchCategory', { defaultValue: 'Search category…' })
                  : t('mobile.labGap.loading', { defaultValue: 'Loading…' })
              }
              onPress={() => {
                haptics.tap();
                setCatOpen(true);
              }}
            />
          ) : null}

          {isChip ? (
            <View style={styles.pillGrid}>
              {CHIP_OPTIONS[meta.kind].map(([slug, label]) => (
                <ChoicePill
                  key={slug}
                  label={label}
                  selected={value === slug}
                  disabled={saving}
                  onPress={() => {
                    setValue(slug);
                    save(slug);
                  }}
                />
              ))}
            </View>
          ) : null}

          {meta.kind === 'price' ? (
            <View style={styles.gap8}>
              <View style={styles.priceBar}>
                <Text style={styles.priceSym}>{CURRENCY_SYMBOLS[currency] || currency}</Text>
                <TextInput
                  style={styles.priceInput}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="decimal-pad"
                  placeholder={t('mobile.labGap.pricePlaceholder', { defaultValue: 'e.g. 5000' })}
                  placeholderTextColor={placeholderColor}
                  onSubmitEditing={() => {
                    if (canNext) save(value);
                  }}
                />
              </View>
              {priceSug && (priceSug.new || priceSug.used || priceSug.scrap) ? (
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>
                    {t('mobile.labGap.aiEstimate', { defaultValue: 'AI estimate:' })}
                  </Text>
                  {(
                    [
                      ['new', 'New'],
                      ['used', 'Used'],
                      ['scrap', 'Scrap'],
                    ] as const
                  ).map(([tier, label]) => {
                    const raw = priceSug[tier];
                    if (raw == null || raw === '') return null;
                    const num = String(raw).replace(/[^0-9.]/g, '');
                    if (!num) return null;
                    return (
                      <Pressable
                        key={tier}
                        disabled={saving}
                        onPress={() => {
                          haptics.tap();
                          setValue(num);
                          save(num);
                        }}
                        style={styles.estimateChip}
                        accessibilityRole="button"
                      >
                        <Text style={styles.estimateChipText}>
                          {label} · {currency} {Number(num).toLocaleString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Pressable
                disabled={saving}
                onPress={() => {
                  haptics.tap();
                  acceptOffers();
                }}
                style={styles.offerBtn}
                accessibilityRole="button"
              >
                <HandCoins size={13} color={accentPressedColor} />
                <Text style={styles.offerBtnText}>
                  {t('mobile.labGap.acceptOffers', { defaultValue: 'Accept offers instead' })}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {meta.kind === 'number' || meta.kind === 'text' ? (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              keyboardType={meta.kind === 'number' ? 'number-pad' : 'default'}
              placeholder={
                meta.placeholder ||
                t('mobile.labGap.enterField', {
                  defaultValue: 'Enter {{field}}',
                  field: humanize(key),
                })
              }
              placeholderTextColor={placeholderColor}
              autoCapitalize={meta.kind === 'text' ? 'sentences' : 'none'}
              onSubmitEditing={() => {
                if (canNext) save(value);
              }}
            />
          ) : null}

          {meta.kind === 'image' ? (
            // A photo can't be "typed" — so this slide offers the two real photo
            // sources (library + camera) instead. (The footer hides "Type it".)
            <View style={styles.photoSources}>
              <Pressable
                disabled={uploading}
                onPress={onPickLibrary}
                style={styles.uploadBox}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.labGap.uploadFromLibrary', {
                  defaultValue: 'Upload a photo from your library',
                })}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator color={accentPressedColor} />
                    <Text style={styles.uploadTitle}>
                      {t('mobile.labGap.uploading', { defaultValue: 'Uploading…' })}
                    </Text>
                  </>
                ) : (
                  <>
                    <ImagePlus size={22} color={accentPressedColor} />
                    <Text style={styles.uploadTitle}>
                      {t('mobile.labGap.uploadPhoto', { defaultValue: 'Upload a photo' })}
                    </Text>
                    <Text style={styles.uploadHint}>
                      {t('mobile.labGap.uploadHint', {
                        defaultValue: 'JPG / PNG · you can pick more than one',
                      })}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                disabled={uploading}
                onPress={onPickCamera}
                style={styles.cameraBtn}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.labGap.takePhoto', {
                  defaultValue: 'Take a photo with the camera',
                })}
              >
                <Camera size={16} color={accentPressedColor} />
                <Text style={styles.cameraBtnText}>
                  {t('mobile.labGap.useCamera', { defaultValue: 'Use camera' })}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
        </Slide>

        {/* Actions — footer is contextual: "Type it" only on picker/chip slides
            (see showTypeIt). It floats left via marginRight:auto, so omitting it
            leaves Skip/Next right-aligned (actions is justifyContent:flex-end). */}
        <View style={styles.actions}>
          {showTypeIt ? (
            <Pressable
              onPress={onManualPress}
              hitSlop={8}
              style={styles.manualBtn}
              accessibilityRole="button"
            >
              <Text style={styles.manualText}>
                {t('mobile.labGap.typeIt', { defaultValue: 'Type it' })}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSkip}
            disabled={saving}
            hitSlop={8}
            style={styles.skipBtn}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>
              {isRequired
                ? t('mobile.labGap.doLater', { defaultValue: 'Do later' })
                : t('mobile.labGap.skip', { defaultValue: 'Skip' })}
            </Text>
          </Pressable>
          {isTyped ? (
            <NextButton
              label={
                stepNum >= gaps.length
                  ? t('mobile.labGap.finish', { defaultValue: 'Finish' })
                  : t('mobile.labGap.next', { defaultValue: 'Next' })
              }
              disabled={saving || !canNext}
              saving={saving}
              onPress={() => save(value)}
            />
          ) : null}
        </View>
      </View>

      {/* Picker sheets (RN Modal — render above the composer) */}
      <CountryPicker
        visible={countryOpen}
        value={value}
        onSelect={(c) => {
          setValue(c);
          save(c);
        }}
        onClose={() => setCountryOpen(false)}
      />
      <CategoryPickerSheet
        visible={catOpen}
        options={catOptions}
        activeId={cat?.id ?? ''}
        onSelect={(o) => {
          const sel = { id: o.id, name: o.name };
          setCat(sel);
          setCatOpen(false);
          save('', sel);
        }}
        onClose={() => setCatOpen(false)}
      />
    </Animated.View>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

/** Primary "Use current location" chip — accent.pressed fill, white spinner busy. */
function UseCurrentChip({ detecting, onPress }: { detecting: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useGapStyles();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={detecting}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.labGap.useCurrentLocation', {
        defaultValue: 'Use current location',
      })}
    >
      <View style={[styles.primaryChip, detecting && { opacity: 0.85 }]}>
        {detecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MapPin size={14} color="#fff" strokeWidth={2.4} />
        )}
        <Text style={styles.primaryChipText}>
          {detecting
            ? t('mobile.labGap.locating', { defaultValue: 'Locating…' })
            : t('mobile.labGap.useCurrentLocation', { defaultValue: 'Use current location' })}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

function PickerRow({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  const styles = useGapStyles();
  const mutedColor = useColor('text.muted');
  return (
    <Pressable onPress={onPress} style={styles.pickerRow} accessibilityRole="button">
      <Text
        numberOfLines={1}
        style={[styles.pickerValue, !value && styles.pickerPlaceholder]}
      >
        {value || placeholder}
      </Text>
      <ChevronDown size={16} color={mutedColor} />
    </Pressable>
  );
}

function ChoicePill({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useGapStyles();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[style, styles.pill, selected && styles.pillSelected]}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );
}

function NextButton({
  label,
  disabled,
  saving,
  onPress,
}: {
  label: string;
  disabled: boolean;
  saving: boolean;
  onPress: () => void;
}) {
  const styles = useGapStyles();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[style, styles.nextBtn, disabled && styles.nextBtnDisabled]}
      onPress={() => {
        if (!disabled) {
          haptics.tap();
          onPress();
        }
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
    >
      {saving ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <ArrowRight size={15} color="#fff" strokeWidth={2.4} />
      )}
      <Text style={styles.nextBtnText}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Primary "Finish required" button for the still-blocked completion state —
 *  re-opens the stepper at the first remaining required field. */
function FinishRequiredButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useGapStyles();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[style, styles.finishBtn]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.labGap.finishRequiredA11y', {
        defaultValue: 'Finish required fields',
      })}
    >
      <ArrowRight size={15} color="#fff" strokeWidth={2.4} />
      <Text style={styles.finishBtnText}>
        {t('mobile.labGap.finishRequired', { defaultValue: 'Finish required' })}
      </Text>
    </AnimatedPressable>
  );
}

/** Flat "Parent › Sub" searchable category sheet (built on the Sheet primitive). */
function CategoryPickerSheet({
  visible,
  options,
  activeId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: { id: string; name: string; label: string }[];
  activeId: string;
  onSelect: (o: { id: string; name: string; label: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useGapStyles();
  const placeholderColor = useColor('text.placeholder');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={t('mobile.labGap.selectCategoryTitle', { defaultValue: 'Select category' })}
      subtitle={t('mobile.labGap.selectCategorySubtitle', {
        defaultValue: 'Search for the category that fits best',
      })}
      maxHeight={480}
    >
      <View style={styles.catSearchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.labGap.search', { defaultValue: 'Search…' })}
          placeholderTextColor={placeholderColor}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.catSearchInput}
        />
      </View>
      {filtered.length === 0 ? (
        <View style={styles.catEmpty}>
          <Text style={styles.catEmptyText}>
            {options.length
              ? t('mobile.labGap.noMatch', { defaultValue: 'No match.' })
              : t('mobile.labGap.loading', { defaultValue: 'Loading…' })}
          </Text>
        </View>
      ) : (
        filtered.map((o) => (
          <Sheet.Option
            key={o.id}
            label={o.label}
            active={o.id === activeId}
            onPress={() => {
              haptics.tap();
              setQuery('');
              onSelect(o);
            }}
          />
        ))
      )}
    </Sheet>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────────── */

const useGapStyles = createThemedStyles((t) => ({
  shell: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.color['status.successBorder'],
    backgroundColor: t.color['status.successSurface'],
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  doneShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.color['status.successBorder'],
    backgroundColor: t.color['status.successSurface'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  doneText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: t.color['accent'] },

  // Still-blocked completion (required field skipped) — honest, non-celebratory.
  blockedShell: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.color['status.successBorder'],
    backgroundColor: t.color['status.successSurface'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  blockedHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  blockedHeadText: { flex: 1, gap: 2 },
  blockedTitle: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19, color: t.color['text.primary'] },
  blockedBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: t.color['accent'] },
  blockedField: { fontFamily: fonts.bold, color: t.color['accent.pressed'] },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 40,
    backgroundColor: t.color['accent.pressed'],
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  finishBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerLead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: t.color['accent.pressed'],
  },
  stepCount: { fontFamily: fonts.semibold, fontSize: 11, color: t.color['text.muted'] },

  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: t.color['border.subtle'],
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: t.color['status.success'] },

  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.color['status.warningBorder'],
    backgroundColor: t.color['status.warningSurface'],
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  bannerText: { flex: 1, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: t.color['status.warningStrong'] },

  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  promptCoin: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: t.color['surface.raised'],
    borderWidth: 1,
    borderColor: t.color['status.successBorder'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19, color: t.color['text.primary'] },
  confirmBadge: {
    backgroundColor: t.color['status.warningSurface'],
    borderWidth: 1,
    borderColor: t.color['status.warningBorder'],
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  confirmBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: t.color['status.warningStrong'],
  },

  gap8: { gap: 8 },

  // Country GPS chip
  primaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    backgroundColor: t.color['accent.pressed'],
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryChipText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  deniedHint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: t.color['status.warningStrong'],
  },

  // Picker row (country / category trigger)
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerValue: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: t.color['text.primary'], marginRight: 8 },
  pickerPlaceholder: { color: t.color['text.placeholder'] },

  // Text / number inputs
  input: {
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: t.color['text.primary'],
    backgroundColor: t.color['surface.raised'],
  },

  // Price
  priceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 12,
    minHeight: 44,
  },
  priceSym: { fontFamily: fonts.bold, fontSize: 14, color: t.color['text.muted'] },
  priceInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: t.color['text.primary'], paddingVertical: 10 },
  estimateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  estimateLabel: { fontFamily: fonts.semibold, fontSize: 11, color: t.color['text.muted'] },
  estimateChip: {
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.sm,
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  estimateChipText: { fontFamily: fonts.semibold, fontSize: 12, color: t.color['text.secondary'] },
  offerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: t.color['status.successBorder'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offerBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: t.color['accent.pressed'] },

  // Chips (condition / operation / grade)
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    minWidth: '47%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pillSelected: { backgroundColor: t.color['accent.pressed'], borderColor: t.color['accent.pressed'] },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, color: t.color['text.secondary'] },
  pillTextSelected: { color: '#fff' },

  // Photo upload
  photoSources: { gap: 8 },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: t.color['status.successBorder'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingVertical: 22,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: 1,
    borderColor: t.color['accent'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingVertical: 10,
  },
  cameraBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: t.color['accent'] },
  uploadTitle: { fontFamily: fonts.bold, fontSize: 13, color: t.color['accent.pressed'] },
  uploadHint: { fontFamily: fonts.regular, fontSize: 11, color: t.color['text.muted'] },

  fieldError: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: t.color['status.danger'], marginTop: 6 },

  // Actions
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: spacing.md },
  manualBtn: { marginRight: 'auto', paddingHorizontal: 4, paddingVertical: 6 },
  manualText: { fontFamily: fonts.semibold, fontSize: 12.5, color: t.color['accent.pressed'] },
  skipBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  skipText: { fontFamily: fonts.semibold, fontSize: 13, color: t.color['text.muted'] },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    backgroundColor: t.color['accent.pressed'],
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  nextBtnDisabled: { backgroundColor: t.color['border.strong'] },
  nextBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },

  // Guest gate
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  guestText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: t.color['accent'] },
  headerCoin: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: t.color['surface.raised'],
    borderWidth: 1,
    borderColor: t.color['status.successBorder'],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category sheet search
  catSearchWrap: { paddingHorizontal: 4, paddingBottom: spacing.sm },
  catSearchInput: {
    borderWidth: 1,
    borderColor: t.color['border.strong'],
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: t.color['text.primary'],
    backgroundColor: t.color['surface.raised'],
  },
  catEmpty: { paddingHorizontal: 4, paddingVertical: spacing.md },
  catEmptyText: { fontFamily: fonts.regular, fontSize: 13, color: t.color['text.muted'] },
}));
