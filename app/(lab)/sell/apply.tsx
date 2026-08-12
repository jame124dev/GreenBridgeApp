/**
 * Seller application + application status — the destination of the sell gate.
 *
 * `launchSellerScan()` sends anyone who is not an APPROVED seller here instead
 * of opening the camera, from all five sell entry points (lab home ×2, lab chat
 * ×2, chat controller). So this one screen has to answer four situations, and it
 * decides between them from `useSellerUpgradeStatus()` alone:
 *
 *   no application (null) → the form, "tell us about your business"
 *   pending               → "with our team" + a way back into the app
 *   rejected              → the reviewer's reason ABOVE a prefilled form
 *   approved              → "you can list now" + straight into the scan flow
 *
 * UX_DESIGN_RULES.md decisions worth stating, since they look like style but are
 * not:
 *
 *  - **One dominant CTA, sticky.** The form is longer than a phone screen, so
 *    Submit lives in a pinned footer with the completion count next to it — the
 *    user never scrolls to find the action or to learn what is still missing.
 *    Every other control on the screen is ghost/secondary weight.
 *  - **Rejected is not a dead end.** The reason and the prefilled form are on
 *    the same screen; resubmitting is one tap, not a support email. The server
 *    allows repeat submissions once a request is no longer pending.
 *  - **The server's own sentence is shown verbatim.** `DUPLICATE_PENDING` /
 *    `ALREADY_APPROVED` mean our cached status was stale, so the message is
 *    displayed AND the status refetched — the screen corrects itself into the
 *    right state instead of arguing with the backend.
 *  - **Adaptive to progress.** Optional documents are labelled optional and
 *    collapse to a filename row once picked; the loader says what it is checking.
 *
 * Strings are `t(key, { defaultValue })` — Phase 4 owns `src/i18n/locales/*`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, FileText, Paperclip, RefreshCw, X } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import { SellerStatusCard } from '@/features/seller/SellerStatusCard';
import { sellerApplicationSchema, type SellerApplicationValues } from '@/features/seller/schema';
import {
  SELLER_UPGRADE_KEY,
  useSellerUpgradeStatus,
  useSubmitSellerUpgrade,
} from '@/features/seller/useSellerUpgrade';
import type { SellerDocs, SellerDocument } from '@/services/seller/sellerUpgrade';
import { brand, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

/** Chip presets. "Other" is not in the list — it is the escape hatch that reveals
 *  a free-text input, so the stored value is always something an admin can read. */
const BUSINESS_TYPES = ['Dealer', 'Recycler', 'Manufacturer', 'Trader', 'Broker'];
const COUNTRIES = ['Thailand', 'Japan', 'China', 'Taiwan', 'Vietnam', 'India', 'Singapore'];

const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

type DocKey = keyof SellerDocs;

/**
 * Per-field English fallbacks for the schema's i18n keys. Without these every
 * field would read a generic "Required", which tells the user a field is empty
 * but not what belongs in it — and `src/i18n/locales/*` is Phase 4's to edit.
 */
const ERROR_DEFAULTS: Record<keyof SellerApplicationValues, string> = {
  companyName: 'Enter your registered company name',
  taxId: 'Enter your tax or business registration number',
  businessType: 'Pick the closest business type, or type your own',
  phone: 'Add a phone number our team can reach you on',
  country: 'Pick your country, or type it',
  reason: 'A sentence about what you plan to sell',
};

// ── small pieces ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="tertiary" className="font-bold uppercase tracking-widest mt-xl">
      {children}
    </Text>
  );
}

/**
 * Chip row + "Other" escape hatch. Tapping a chip WRITES the field, so there is
 * exactly one control per value — no chip that merely "suggests" text the user
 * then has to type (that would be the duplicate-control failure).
 */
function ChipChoice({
  options,
  value,
  onChange,
  otherLabel,
  otherPlaceholder,
  accessibilityLabel,
  error,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  otherLabel: string;
  otherPlaceholder: string;
  accessibilityLabel: string;
  error?: string;
}) {
  // "Other" is active when there is a value that is not one of the presets, or
  // when the user explicitly asked for it and has not typed yet.
  const [otherOpen, setOtherOpen] = useState(
    () => !!value && !options.includes(value),
  );
  const showOther = otherOpen || (!!value && !options.includes(value));

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((option) => {
          const active = value === option && !otherOpen;
          return (
            <Pressable
              key={option}
              onPress={() => {
                haptics.tap();
                setOtherOpen(false);
                onChange(option);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="rounded-full px-lg items-center justify-center"
              style={{
                minHeight: 40,
                backgroundColor: active ? brand.primarySurface : brand.surface,
                borderWidth: 1.5,
                borderColor: active ? brand.primary : brand.border,
              }}
            >
              <Text variant="bodySm" className="font-semi" style={{ color: active ? brand.primary : brand.textMuted }}>
                {option}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            haptics.tap();
            setOtherOpen(true);
            if (options.includes(value)) onChange('');
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: showOther }}
          className="rounded-full px-lg items-center justify-center"
          style={{
            minHeight: 40,
            backgroundColor: showOther ? brand.primarySurface : brand.surface,
            borderWidth: 1.5,
            borderColor: showOther ? brand.primary : brand.border,
          }}
        >
          <Text variant="bodySm" className="font-semi" style={{ color: showOther ? brand.primary : brand.textMuted }}>
            {otherLabel}
          </Text>
        </Pressable>
      </View>

      {showOther ? (
        <TextInput
          value={options.includes(value) ? '' : value}
          onChangeText={onChange}
          placeholder={otherPlaceholder}
          placeholderTextColor={brand.placeholder}
          accessibilityLabel={accessibilityLabel}
          autoFocus={otherOpen}
          className="rounded-xl px-md"
          style={{
            borderWidth: 1,
            borderColor: error ? brand.destructiveStrong : brand.border,
            height: 48,
            color: brand.foreground,
            backgroundColor: brand.surface,
          }}
        />
      ) : null}
      {error ? (
        <Text tone="danger" variant="caption">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  hint,
  multiline,
  keyboardType,
  autoCapitalize,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  testID?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="tertiary" className="font-bold uppercase tracking-widest">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={brand.placeholder}
        accessibilityLabel={label}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        multiline={multiline}
        testID={testID}
        className="rounded-xl px-md"
        style={{
          borderWidth: 1,
          borderColor: error ? brand.destructiveStrong : brand.border,
          minHeight: multiline ? 96 : 48,
          paddingTop: multiline ? 12 : 0,
          textAlignVertical: multiline ? 'top' : 'center',
          color: brand.foreground,
          backgroundColor: brand.surface,
        }}
      />
      {error ? (
        <Text tone="danger" variant="caption">
          {error}
        </Text>
      ) : hint ? (
        <Text tone="tertiary" variant="caption">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** One optional document row: attach → filename + remove. */
function DocRow({
  label,
  doc,
  onPick,
  onClear,
  attachLabel,
}: {
  label: string;
  doc?: SellerDocument;
  onPick: () => void;
  onClear: () => void;
  attachLabel: string;
}) {
  return (
    <View
      className="rounded-xl p-md flex-row items-center"
      style={{ gap: 10, borderWidth: 1, borderColor: brand.border, backgroundColor: brand.surface }}
    >
      <FileText size={18} color={doc ? brand.primary : brand.placeholder} strokeWidth={2} />
      <View className="flex-1">
        <Text variant="bodySm" className="font-semi" numberOfLines={1}>
          {label}
        </Text>
        {doc ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {doc.name}
          </Text>
        ) : null}
      </View>
      {doc ? (
        <Pressable
          onPress={onClear}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          className="w-[36px] h-[36px] items-center justify-center"
        >
          <X size={18} color={brand.textMuted} strokeWidth={2.2} />
        </Pressable>
      ) : (
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          className="rounded-full px-md items-center justify-center flex-row"
          style={{ minHeight: 36, gap: 6, borderWidth: 1.5, borderColor: brand.primaryBorder }}
        >
          <Paperclip size={14} color={brand.primary} strokeWidth={2.2} />
          <Text variant="caption" className="font-bold" style={{ color: brand.primary }}>
            {attachLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────

export default function SellerApplyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const statusQ = useSellerUpgradeStatus();
  const submitMut = useSubmitSellerUpgrade();

  const [docs, setDocs] = useState<SellerDocs>({});
  /** The server's own sentence for a failed submission. */
  const [serverError, setServerError] = useState<string | null>(null);
  /** How many required details are still missing, after a rejected submit. */
  const [missingCount, setMissingCount] = useState(0);

  const status = statusQ.data ?? null;
  const isRejected = status?.status === 'rejected';

  const { control, handleSubmit, reset, formState } = useForm<SellerApplicationValues>({
    resolver: zodResolver(sellerApplicationSchema),
    defaultValues: {
      companyName: '',
      taxId: '',
      businessType: '',
      phone: '',
      country: '',
      reason: '',
    },
  });

  // Prefill what a rejected application already told us, so a correction is an
  // edit rather than a retype. `defaultValues` cannot do this: the status arrives
  // after the first render, and a reset on every render would fight the user's
  // typing — hence the once-only ref.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !isRejected || !status?.company_name) return;
    prefilled.current = true;
    reset({
      companyName: status.company_name,
      taxId: '',
      businessType: '',
      phone: '',
      country: '',
      reason: '',
    });
  }, [isRejected, status, reset]);

  // `useWatch`, not `watch()`: the subscription form is what keeps the sticky
  // footer's completion count live without opting the whole screen out of React
  // Compiler memoization (`watch` returns a fresh function every render).
  const values = useWatch({ control });
  const filled = useMemo(
    () => Object.values(values).filter((v) => typeof v === 'string' && v.trim() !== '').length,
    [values],
  );
  const totalFields = 6;

  const pickDoc = useCallback(async (key: DocKey) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: DOC_MIME,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset) return;
    haptics.tap();
    setDocs((prev) => ({
      ...prev,
      [key]: {
        uri: asset.uri,
        name: asset.name || 'document',
        type: asset.mimeType || 'application/octet-stream',
      },
    }));
  }, []);

  const clearDoc = useCallback((key: DocKey) => {
    setDocs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const onValid = (v: SellerApplicationValues) => {
    setServerError(null);
    setMissingCount(0);
    haptics.impact();
    submitMut.mutate(
      { values: v, files: Object.keys(docs).length ? docs : undefined },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(
            t('mobile.seller.apply.submitted', { defaultValue: 'Application sent for review' }),
          );
          // Switch to the "with our team" state immediately rather than flashing
          // a loader: the hook has already invalidated the query, so the server's
          // own row replaces this as soon as the refetch lands.
          qc.setQueryData(SELLER_UPGRADE_KEY, {
            status: 'pending',
            company_name: v.companyName,
            admin_notes: null,
            reviewed_at: null,
          });
        },
        onError: (err) => {
          haptics.error();
          // Verbatim — "You already have a pending seller upgrade request." is
          // more useful than any wording we could invent.
          setServerError(err.message);
          if (err.code === 'DUPLICATE_PENDING' || err.code === 'ALREADY_APPROVED') {
            // Our cached status was stale; let the screen re-render as whatever
            // the server says it actually is.
            void qc.invalidateQueries({ queryKey: SELLER_UPGRADE_KEY });
          }
        },
      },
    );
  };

  const onInvalid = () => {
    haptics.error();
    setServerError(null);
    setMissingCount(totalFields - filled);
  };

  const err = (key: keyof SellerApplicationValues): string | undefined => {
    const message = formState.errors[key]?.message;
    // Schema messages are i18n KEYS; the per-field English fallback keeps the
    // error actionable until Phase 4 lands the locale entries.
    return message ? t(message, { defaultValue: ERROR_DEFAULTS[key] }) : undefined;
  };

  // ── State 1: checking. An explaining line, never a bare spinner. ──────────
  if (statusQ.isLoading) {
    return (
      <Screen edges={['top']}>
        <View className="flex-1 items-center justify-center" style={{ gap: 12 }}>
          <ActivityIndicator color={brand.primary} />
          <Text tone="secondary">
            {t('mobile.seller.apply.checking', {
              defaultValue: 'Checking whether you can list yet…',
            })}
          </Text>
        </View>
      </Screen>
    );
  }

  // ── State 2: we could not find out. Recoverable, with a way onwards. ──────
  if (statusQ.isError) {
    return (
      <Screen edges={['top']}>
        <View className="flex-1 justify-center" style={{ gap: 16 }}>
          <Text variant="title">
            {t('mobile.seller.apply.errorTitle', { defaultValue: 'We could not check your status' })}
          </Text>
          <Text tone="secondary">
            {statusQ.error?.message ??
              t('mobile.seller.apply.errorBody', {
                defaultValue: 'The connection dropped before we heard back.',
              })}
          </Text>
          <Button
            label={t('mobile.seller.apply.retry', { defaultValue: 'Try again' })}
            onPress={() => void statusQ.refetch()}
            loading={statusQ.isFetching}
            leftIcon={<RefreshCw size={17} color="#fff" strokeWidth={2.4} />}
            fullWidth
          />
          <Button
            label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  // ── State 3: approved — the only state with a door into the scan flow. ────
  if (status?.status === 'approved') {
    return (
      <Screen edges={['top']}>
        <View style={{ gap: 16, paddingTop: spacing.lg }}>
          <SellerStatusCard status={status}>
            <Button
              label={t('mobile.seller.apply.startListing', { defaultValue: 'Start a listing' })}
              onPress={launchSellerScan}
              leftIcon={<Camera size={18} color="#fff" strokeWidth={2.3} />}
              fullWidth
            />
          </SellerStatusCard>
          <Button
            label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  // ── State 4: pending — no form, because a second submission is a 400. ─────
  if (status?.status === 'pending') {
    return (
      <Screen edges={['top']}>
        <View style={{ gap: 16, paddingTop: spacing.lg }}>
          <SellerStatusCard status={status}>
            <Button
              label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
              onPress={() => router.back()}
              fullWidth
            />
          </SellerStatusCard>
          <Pressable
            onPress={() => void statusQ.refetch()}
            disabled={statusQ.isFetching}
            accessibilityRole="button"
            className="flex-row items-center justify-center py-md"
            style={{ gap: 8 }}
          >
            <RefreshCw size={15} color={brand.textMuted} strokeWidth={2.2} />
            <Text variant="bodySm" tone="secondary" className="font-semi">
              {statusQ.isFetching
                ? t('mobile.seller.apply.refreshing', { defaultValue: 'Checking…' })
                : t('mobile.seller.apply.refresh', { defaultValue: 'Check for an update' })}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── State 5: the form (first application, or correcting a rejected one) ───
  const ctaLabel = submitMut.isPending
    ? t('mobile.seller.apply.submitting', { defaultValue: 'Sending your application…' })
    : isRejected
      ? t('mobile.seller.apply.resubmitCta', { defaultValue: 'Resend application' })
      : t('mobile.seller.apply.submitCta', { defaultValue: 'Submit application' });

  return (
    <Screen scroll={false} padded={false} edges={['top']} keyboardAware>
      <ScrollView
        className="flex-1 px-lg"
        contentContainerStyle={{ paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* "Where am I / what is this for / what happens after" — answered before
            the first input is asked for. */}
        <Text variant="title" className="mt-lg">
          {isRejected
            ? t('mobile.seller.apply.titleFix', { defaultValue: 'Update your application' })
            : t('mobile.seller.apply.title', { defaultValue: 'Apply to sell equipment' })}
        </Text>
        <Text variant="bodySm" tone="secondary" className="mt-xs">
          {t('mobile.seller.apply.subtitle', {
            defaultValue:
              'Listings come from verified businesses, so we need a few company details. Our team reviews them — usually within one business day — and emails you the result. You can keep browsing and messaging in the meantime.',
          })}
        </Text>

        {/* The reviewer's reason sits ABOVE the fields it refers to. */}
        {status && isRejected ? (
          <View className="mt-lg">
            <SellerStatusCard status={status} />
          </View>
        ) : null}

        <SectionLabel>
          {t('mobile.seller.apply.sectionBusiness', { defaultValue: 'Your business' })}
        </SectionLabel>
        <View className="mt-md" style={{ gap: 16 }}>
          <Controller
            control={control}
            name="companyName"
            render={({ field }) => (
              <TextField
                label={t('mobile.seller.apply.companyLabel', { defaultValue: 'Company name' })}
                placeholder={t('mobile.seller.apply.companyPlaceholder', {
                  defaultValue: 'Acme Recycling Co., Ltd.',
                })}
                value={field.value}
                onChange={field.onChange}
                error={err('companyName')}
                autoCapitalize="words"
                testID="apply-company"
              />
            )}
          />
          <Controller
            control={control}
            name="taxId"
            render={({ field }) => (
              <TextField
                label={t('mobile.seller.apply.taxIdLabel', {
                  defaultValue: 'Tax / registration number',
                })}
                hint={t('mobile.seller.apply.taxIdHint', {
                  defaultValue: 'As printed on your business registration.',
                })}
                value={field.value}
                onChange={field.onChange}
                error={err('taxId')}
                autoCapitalize="characters"
                testID="apply-tax-id"
              />
            )}
          />
          <View style={{ gap: 6 }}>
            <Text variant="caption" tone="tertiary" className="font-bold uppercase tracking-widest">
              {t('mobile.seller.apply.businessTypeLabel', { defaultValue: 'Business type' })}
            </Text>
            <Controller
              control={control}
              name="businessType"
              render={({ field }) => (
                <ChipChoice
                  options={BUSINESS_TYPES}
                  value={field.value}
                  onChange={field.onChange}
                  otherLabel={t('mobile.seller.apply.other', { defaultValue: 'Other' })}
                  otherPlaceholder={t('mobile.seller.apply.businessTypeOther', {
                    defaultValue: 'e.g. Scrap yard',
                  })}
                  accessibilityLabel={t('mobile.seller.apply.businessTypeLabel', {
                    defaultValue: 'Business type',
                  })}
                  error={err('businessType')}
                />
              )}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text variant="caption" tone="tertiary" className="font-bold uppercase tracking-widest">
              {t('mobile.seller.apply.countryLabel', { defaultValue: 'Country' })}
            </Text>
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <ChipChoice
                  options={COUNTRIES}
                  value={field.value}
                  onChange={field.onChange}
                  otherLabel={t('mobile.seller.apply.other', { defaultValue: 'Other' })}
                  otherPlaceholder={t('mobile.seller.apply.countryOther', {
                    defaultValue: 'Type your country',
                  })}
                  accessibilityLabel={t('mobile.seller.apply.countryLabel', {
                    defaultValue: 'Country',
                  })}
                  error={err('country')}
                />
              )}
            />
          </View>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextField
                label={t('mobile.seller.apply.phoneLabel', { defaultValue: 'Contact phone' })}
                placeholder="+66 12 345 6789"
                value={field.value}
                onChange={field.onChange}
                error={err('phone')}
                keyboardType="phone-pad"
                testID="apply-phone"
              />
            )}
          />
        </View>

        <SectionLabel>
          {t('mobile.seller.apply.sectionReason', { defaultValue: 'What you plan to sell' })}
        </SectionLabel>
        <View className="mt-md">
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <TextField
                label={t('mobile.seller.apply.reasonLabel', { defaultValue: 'In your words' })}
                hint={t('mobile.seller.apply.reasonHint', {
                  defaultValue: 'One or two sentences is plenty — it speeds up the review.',
                })}
                placeholder={t('mobile.seller.apply.reasonPlaceholder', {
                  defaultValue: 'We resell used CNC machines and press brakes from factory closures.',
                })}
                value={field.value}
                onChange={field.onChange}
                error={err('reason')}
                multiline
                testID="apply-reason"
              />
            )}
          />
        </View>

        {/* Optional, and it says so twice: in the section label and in the
            line underneath. Nothing here can block the submission. */}
        <SectionLabel>
          {t('mobile.seller.apply.sectionDocs', {
            defaultValue: 'Documents · optional',
          })}
        </SectionLabel>
        <Text variant="caption" tone="tertiary" className="mt-xs mb-md">
          {t('mobile.seller.apply.docsHint', {
            defaultValue:
              'Attaching these usually gets you approved faster, but you can submit without them and send them later.',
          })}
        </Text>
        <View style={{ gap: 10 }}>
          <DocRow
            label={t('mobile.seller.apply.docBusinessReg', {
              defaultValue: 'Business registration certificate',
            })}
            doc={docs.businessRegCert}
            onPick={() => void pickDoc('businessRegCert')}
            onClear={() => clearDoc('businessRegCert')}
            attachLabel={t('mobile.seller.apply.attach', { defaultValue: 'Attach' })}
          />
          <DocRow
            label={t('mobile.seller.apply.docWastePermit', {
              defaultValue: 'Waste disposal permit',
            })}
            doc={docs.wasteDisposalPermit}
            onPick={() => void pickDoc('wasteDisposalPermit')}
            onClear={() => clearDoc('wasteDisposalPermit')}
            attachLabel={t('mobile.seller.apply.attach', { defaultValue: 'Attach' })}
          />
        </View>
      </ScrollView>

      {/* Sticky footer: progress + the ONE dominant action + the recoverable
          error. Never behind a scroll on a form this long. */}
      <View
        className="px-lg pt-md"
        style={{
          borderTopWidth: 1,
          borderTopColor: brand.border,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: brand.surface,
        }}
      >
        {serverError ? (
          <Card variant="outlined" className="mb-md" testID="apply-server-error">
            <View className="p-md" style={{ backgroundColor: brand.destructiveBg, gap: 4 }}>
              <Text variant="bodySm" tone="danger" className="font-semi">
                {serverError}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('mobile.seller.apply.errorRecover', {
                  defaultValue:
                    'Nothing was lost — fix what it mentions and tap the button again.',
                })}
              </Text>
            </View>
          </Card>
        ) : null}

        {missingCount > 0 ? (
          <Text variant="caption" tone="danger" className="mb-xs" testID="apply-missing">
            {t('mobile.seller.apply.missing', {
              defaultValue: `${missingCount} detail(s) still needed — they are marked above.`,
              count: missingCount,
            })}
          </Text>
        ) : (
          <Text variant="caption" tone="tertiary" className="mb-xs">
            {t('mobile.seller.apply.progress', {
              defaultValue: `${filled} of ${totalFields} details complete`,
              filled,
              total: totalFields,
            })}
          </Text>
        )}

        <Button
          label={ctaLabel}
          onPress={handleSubmit(onValid, onInvalid)}
          loading={submitMut.isPending}
          fullWidth
          testID="apply-submit"
        />
        <Button
          label={t('mobile.seller.apply.notNow', { defaultValue: 'Not now' })}
          onPress={() => router.back()}
          variant="ghost"
          disabled={submitMut.isPending}
          fullWidth
        />
      </View>
    </Screen>
  );
}
