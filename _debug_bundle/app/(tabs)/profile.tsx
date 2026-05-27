import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Globe, LogOut, MapPin, Save, Shield, User as UserIcon, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  Field,
  Input,
  Screen,
  SectionLabel as _SectionLabel,
  SelectButton,
  Sheet,
} from '@/components/ui';
import { useLogout } from '@/features/auth/useLogout';
import { useUpdateUserSettings, useUserProfile } from '@/features/auth/useUserProfile';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/authStore';
import { colors, fonts, fontSize, gradients, letterSpacing, radius, spacing } from '@/theme';
import type { UpdateUserSettingsPayload } from '@/services/auth/userProfile';

// `_SectionLabel` is intentionally unused here — re-exported for screens that
// adopt the same label pattern. Silence the unused-import lint.
void _SectionLabel;

// Mirrors 101lab-2/src/pages/dashboard/Settings.tsx INDUSTRY_OPTIONS.
const INDUSTRY_OPTIONS = [
  'Academic / University',
  'Research Institute',
  'Biotechnology',
  'Pharmaceutical',
  'Healthcare / Hospital',
  'Clinical Diagnostics Lab',
  'Environmental Testing',
  'Food & Beverage Testing',
  'Chemical Industry',
  'Agriculture / AgriTech',
  'Oil & Gas / Energy',
  'Semiconductor / Electronics',
  'Contract Research Organization (CRO)',
  'Government / Regulatory',
  'Manufacturing / Industrial Lab',
  'Distributor / Reseller',
  'Startup / Small Business',
  'Other',
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'th', label: 'ภาษาไทย' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Taipei', label: '台北 (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: '香港 (GMT+8)' },
  { value: 'Asia/Shanghai', label: '上海 (GMT+8)' },
  { value: 'Asia/Tokyo', label: '東京 (GMT+9)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'UTC', label: 'UTC' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'TWD', label: 'TWD (NT$)' },
  { value: 'HKD', label: 'HKD (HK$)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'THB', label: 'THB (฿)' },
];

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type SheetKey = 'industry' | 'language' | 'timezone' | 'currency' | 'interests' | null;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const profileQuery = useUserProfile();
  const update = useUpdateUserSettings();
  const logoutMut = useLogout();

  // ── Personal info ────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [industryOther, setIndustryOther] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  // ── Address ──────────────────────────────────────────────────────────────
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  // ── Security ─────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Language/Region ──────────────────────────────────────────────────────
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Taipei');
  const [currency, setCurrency] = useState('USD');

  // ── Sheet state ──────────────────────────────────────────────────────────
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
  const closeSheet = () => setActiveSheet(null);

  // ── Hydrate local state from the profile query ───────────────────────────
  // Syncing the React Query result into editable form state on first load is
  // the intended use case for an effect (we're synchronizing state with an
  // external system). The React Compiler lint rule is conservative — the
  // alternative (memoized derived values) would block editing the form.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    const raw = p.personalInfo.industry || '';
    if (raw.startsWith('Other: ')) {
      setIndustry('Other');
      setIndustryOther(raw.slice('Other: '.length));
    } else {
      setIndustry(raw);
      setIndustryOther('');
    }
    setFirstName(p.personalInfo.firstName || p.displayName || '');
    setPhone(p.personalInfo.phone || '');
    setCompany(p.personalInfo.company || '');
    setInterests(p.personalInfo.interests || []);
    if (p.personalInfo.address) {
      setStreet(p.personalInfo.address.street);
      setCity(p.personalInfo.address.city);
      setDistrict(p.personalInfo.address.district);
      setPostalCode(p.personalInfo.address.postalCode);
      setCountry(p.personalInfo.address.country);
    }
    setLanguage(p.languageRegion.language || 'en');
    setTimezone(p.languageRegion.timezone || 'Asia/Taipei');
    setCurrency(p.languageRegion.currency || 'USD');
  }, [profileQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Save handlers ────────────────────────────────────────────────────────
  const savePayload = (payload: UpdateUserSettingsPayload, sectionLabel: string) => {
    haptics.impact();
    update.mutate(payload, {
      onSuccess: () => {
        haptics.success();
        Alert.alert(sectionLabel, t('mobile.settings.savedToast'));
      },
      onError: (err) => {
        haptics.error();
        Alert.alert(t('mobile.settings.saveFailedTitle'), (err as Error).message ?? '');
      },
    });
  };

  const saveProfileInfo = () => {
    const industryToSend =
      industry === 'Other' ? `Other: ${industryOther.trim()}` : industry;
    savePayload(
      { firstName, phone, company, industry: industryToSend, interests },
      t('mobile.settings.profileInformation'),
    );
  };

  const saveAddress = () =>
    savePayload(
      { address: { street, city, district, postalCode, country } },
      t('mobile.settings.addressInformation'),
    );

  const saveSecurity = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('mobile.settings.saveFailedTitle'), t('mobile.settings.passwordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('mobile.settings.saveFailedTitle'), t('mobile.settings.passwordMismatch'));
      return;
    }
    update.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          Alert.alert(
            t('mobile.settings.securitySettings'),
            t('mobile.settings.savedToast'),
          );
        },
        onError: (err) =>
          Alert.alert(t('mobile.settings.saveFailedTitle'), (err as Error).message ?? ''),
      },
    );
  };

  const saveLanguageRegion = () =>
    savePayload({ language, timezone, currency }, t('mobile.settings.languageRegion'));

  const handleSignOut = () => {
    haptics.warning();
    logoutMut.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const initials = useMemo(
    () => getInitials(firstName || profile?.name || ''),
    [firstName, profile?.name],
  );
  const roleLabel = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : '—';

  return (
    <Screen padded={false} scroll edges={['top']} contentContainerStyle={styles.scroll}>
      {/* Hero */}
      <LinearGradient colors={[...gradients.hero]} style={styles.hero}>
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>{initials}</Text>
        </View>
        <Text style={styles.heroName} numberOfLines={1}>
          {firstName || profile?.name || '—'}
        </Text>
        <Text style={styles.heroEmail} numberOfLines={1}>
          {profileQuery.data?.email || profile?.email || ''}
        </Text>
        <View style={styles.heroRolePill}>
          <Text style={styles.heroRolePillText}>{roleLabel}</Text>
        </View>
      </LinearGradient>

      {profileQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['8xl'] }} />
      ) : (
        <>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t('mobile.settings.title')}</Text>
            <Text style={styles.subtitle}>{t('mobile.settings.subtitle')}</Text>
          </View>

          {/* Profile Information */}
          <View style={styles.cardWrap}>
            <Card>
              <Card.Header
                icon={<UserIcon color={colors.primary} size={18} />}
                iconBg={colors.primarySurface}
                title={t('mobile.settings.profileInformation')}
                description={t('mobile.settings.profileDesc')}
              />
              <Card.Body>
                <Field label={t('mobile.settings.firstName')}>
                  <Input
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder={t('mobile.settings.firstNamePlaceholder')}
                  />
                </Field>

                <Field
                  label={t('mobile.settings.email')}
                  hint={t('mobile.settings.readOnlyHint')}
                >
                  <Input
                    value={profileQuery.data?.email ?? profile?.email ?? ''}
                    readOnly
                  />
                </Field>

                <Field label={t('mobile.settings.phone')}>
                  <Input
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={t('mobile.settings.phonePlaceholder')}
                    keyboardType="phone-pad"
                  />
                </Field>

                <Field label={t('mobile.settings.company')}>
                  <Input
                    value={company}
                    onChangeText={setCompany}
                    placeholder={t('mobile.settings.companyPlaceholder')}
                  />
                </Field>

                <Field
                  label={t('mobile.settings.companyTaxId')}
                  hint={t('mobile.settings.readOnlyHint')}
                >
                  <Input
                    value={profileQuery.data?.personalInfo.companyTaxIdNumber ?? ''}
                    readOnly
                  />
                </Field>

                <Field label={t('mobile.settings.industry')}>
                  <SelectButton
                    value={industry || t('mobile.settings.industryPlaceholder')}
                    placeholder={!industry}
                    onPress={() => setActiveSheet('industry')}
                  />
                  {industry === 'Other' ? (
                    <View style={{ marginTop: spacing.md }}>
                      <Input
                        value={industryOther}
                        onChangeText={setIndustryOther}
                        placeholder={t('mobile.settings.industryOtherPlaceholder')}
                      />
                    </View>
                  ) : null}
                </Field>

                <Field
                  label={t('mobile.settings.interests')}
                  hint={t('mobile.settings.interestsOptional')}
                >
                  <SelectButton
                    value={
                      interests.length === 0
                        ? t('mobile.settings.interestsPlaceholder')
                        : t('mobile.settings.interestsCount', { count: interests.length })
                    }
                    placeholder={interests.length === 0}
                    onPress={() => setActiveSheet('interests')}
                  />
                  {interests.length > 0 ? (
                    <InterestChips
                      selected={interests}
                      onRemove={(slug) =>
                        setInterests((prev) => prev.filter((s) => s !== slug))
                      }
                    />
                  ) : null}
                </Field>

                <Button
                  label={
                    update.isPending
                      ? t('mobile.settings.saving')
                      : t('mobile.settings.save')
                  }
                  onPress={saveProfileInfo}
                  loading={update.isPending}
                  leftIcon={<Save color={colors.white} size={16} />}
                  fullWidth
                />
              </Card.Body>
            </Card>
          </View>

          {/* Address */}
          <View style={styles.cardWrap}>
            <Card>
              <Card.Header
                icon={<MapPin color={colors.primary} size={18} />}
                iconBg={colors.primarySurface}
                title={t('mobile.settings.addressInformation')}
                description={t('mobile.settings.addressDesc')}
              />
              <Card.Body>
                <Field label={t('mobile.settings.street')}>
                  <Input
                    value={street}
                    onChangeText={setStreet}
                    placeholder={t('mobile.settings.streetPlaceholder')}
                  />
                </Field>
                <View style={styles.row}>
                  <Field label={t('mobile.settings.city')} flex>
                    <Input
                      value={city}
                      onChangeText={setCity}
                      placeholder={t('mobile.settings.cityPlaceholder')}
                    />
                  </Field>
                  <Field label={t('mobile.settings.district')} flex>
                    <Input
                      value={district}
                      onChangeText={setDistrict}
                      placeholder={t('mobile.settings.districtPlaceholder')}
                    />
                  </Field>
                </View>
                <View style={styles.row}>
                  <Field label={t('mobile.settings.postalCode')} flex>
                    <Input
                      value={postalCode}
                      onChangeText={setPostalCode}
                      placeholder={t('mobile.settings.postalCodePlaceholder')}
                    />
                  </Field>
                  <Field label={t('mobile.settings.country')} flex>
                    <Input
                      value={country}
                      onChangeText={setCountry}
                      placeholder={t('mobile.settings.countryPlaceholder')}
                    />
                  </Field>
                </View>
                <Button
                  label={
                    update.isPending
                      ? t('mobile.settings.saving')
                      : t('mobile.settings.save')
                  }
                  onPress={saveAddress}
                  loading={update.isPending}
                  leftIcon={<Save color={colors.white} size={16} />}
                  fullWidth
                />
              </Card.Body>
            </Card>
          </View>

          {/* Security */}
          <View style={styles.cardWrap}>
            <Card>
              <Card.Header
                icon={<Shield color={colors.destructiveStrong} size={18} />}
                iconBg={colors.destructiveBg}
                title={t('mobile.settings.securitySettings')}
                description={t('mobile.settings.securityDesc')}
              />
              <Card.Body>
                <Field label={t('mobile.settings.currentPassword')}>
                  <Input
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="••••••••"
                    secureTextEntry
                  />
                </Field>
                <Field label={t('mobile.settings.newPassword')}>
                  <Input
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="••••••••"
                    secureTextEntry
                  />
                </Field>
                <Field label={t('mobile.settings.confirmPassword')}>
                  <Input
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    secureTextEntry
                  />
                </Field>
                <Button
                  label={
                    update.isPending
                      ? t('mobile.settings.saving')
                      : t('mobile.settings.updatePassword')
                  }
                  onPress={saveSecurity}
                  loading={update.isPending}
                  leftIcon={<Save color={colors.white} size={16} />}
                  fullWidth
                />
              </Card.Body>
            </Card>
          </View>

          {/* Language & Region */}
          <View style={styles.cardWrap}>
            <Card>
              <Card.Header
                icon={<Globe color={colors.infoText} size={18} />}
                iconBg={colors.infoBg}
                title={t('mobile.settings.languageRegion')}
                description={t('mobile.settings.languageRegionDesc')}
              />
              <Card.Body>
                <Field label={t('mobile.settings.language')}>
                  <SelectButton
                    value={
                      LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language
                    }
                    onPress={() => setActiveSheet('language')}
                  />
                </Field>
                <Field label={t('mobile.settings.timezone')}>
                  <SelectButton
                    value={
                      TIMEZONE_OPTIONS.find((o) => o.value === timezone)?.label ?? timezone
                    }
                    onPress={() => setActiveSheet('timezone')}
                  />
                </Field>
                <Field label={t('mobile.settings.currency')}>
                  <SelectButton
                    value={
                      CURRENCY_OPTIONS.find((o) => o.value === currency)?.label ?? currency
                    }
                    onPress={() => setActiveSheet('currency')}
                  />
                </Field>
                <Button
                  label={
                    update.isPending
                      ? t('mobile.settings.saving')
                      : t('mobile.settings.save')
                  }
                  onPress={saveLanguageRegion}
                  loading={update.isPending}
                  leftIcon={<Save color={colors.white} size={16} />}
                  fullWidth
                />
              </Card.Body>
            </Card>
          </View>

          {/* Sign out */}
          <View style={styles.cardWrap}>
            <Button
              label={
                logoutMut.isPending
                  ? t('mobile.profile.signingOut')
                  : t('mobile.profile.signOut')
              }
              onPress={handleSignOut}
              variant="danger"
              loading={logoutMut.isPending}
              leftIcon={<LogOut color={colors.destructiveStrong} size={18} />}
              fullWidth
            />
          </View>
        </>
      )}

      {/* Sheets */}
      <Sheet
        visible={activeSheet === 'industry'}
        onClose={closeSheet}
        title={t('mobile.settings.industry')}
      >
        {INDUSTRY_OPTIONS.map((opt) => (
          <Sheet.Option
            key={opt}
            label={opt}
            active={opt === industry}
            onPress={() => {
              setIndustry(opt);
              if (opt !== 'Other') setIndustryOther('');
              closeSheet();
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={activeSheet === 'language'}
        onClose={closeSheet}
        title={t('mobile.settings.language')}
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <Sheet.Option
            key={opt.value}
            label={opt.label}
            active={opt.value === language}
            onPress={() => {
              setLanguage(opt.value);
              closeSheet();
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={activeSheet === 'timezone'}
        onClose={closeSheet}
        title={t('mobile.settings.timezone')}
      >
        {TIMEZONE_OPTIONS.map((opt) => (
          <Sheet.Option
            key={opt.value}
            label={opt.label}
            active={opt.value === timezone}
            onPress={() => {
              setTimezone(opt.value);
              closeSheet();
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={activeSheet === 'currency'}
        onClose={closeSheet}
        title={t('mobile.settings.currency')}
      >
        {CURRENCY_OPTIONS.map((opt) => (
          <Sheet.Option
            key={opt.value}
            label={opt.label}
            active={opt.value === currency}
            onPress={() => {
              setCurrency(opt.value);
              closeSheet();
            }}
          />
        ))}
      </Sheet>

      <InterestsSheet
        visible={activeSheet === 'interests'}
        selected={interests}
        onToggle={(slug) =>
          setInterests((prev) =>
            prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
          )
        }
        onClose={closeSheet}
      />
    </Screen>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function InterestChips({
  selected,
  onRemove,
}: {
  selected: string[];
  onRemove: (slug: string) => void;
}) {
  const { data } = useLabCategories();
  const labelFor = (slug: string) => {
    for (const cat of data?.categories ?? []) {
      if (cat.slug === slug) return cat.name;
      for (const sub of cat.subcategories ?? []) {
        if (sub.slug === slug) return sub.name;
      }
    }
    return slug;
  };
  return (
    <View style={styles.chipWrap}>
      {selected.map((slug) => (
        <View key={slug} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {labelFor(slug)}
          </Text>
          <Pressable onPress={() => onRemove(slug)} hitSlop={6}>
            <X color={colors.primary} size={12} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function InterestsSheet({
  visible,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  selected: string[];
  onToggle: (slug: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useLabCategories();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.settings.interests')}
      maxHeight={460}
    >
      {(data?.categories ?? []).map((cat) => (
        <View key={cat.slug}>
          <Sheet.Option
            label={cat.name}
            active={selected.includes(cat.slug)}
            onPress={() => onToggle(cat.slug)}
          />
          {(cat.subcategories ?? []).map((sub) => (
            <Sheet.Option
              key={sub.slug}
              label={sub.name}
              active={selected.includes(sub.slug)}
              onPress={() => onToggle(sub.slug)}
              indent
            />
          ))}
        </View>
      ))}
    </Sheet>
  );
}

// ─── Styles (page-only) ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing['9xl'] },

  // Hero
  hero: {
    paddingTop: spacing['6xl'],
    paddingBottom: spacing['7xl'],
    paddingHorizontal: spacing['5xl'],
    alignItems: 'center',
    borderBottomLeftRadius: radius['4xl'] + 8,
    borderBottomRightRadius: radius['4xl'] + 8,
  },
  heroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.whiteFaint,
    borderWidth: 2,
    borderColor: colors.whiteBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroAvatarText: { fontFamily: fonts.bold, fontSize: fontSize['6xl'], color: colors.white },
  heroName: { fontFamily: fonts.bold, fontSize: fontSize['4xl'], color: colors.white },
  heroEmail: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.whiteText,
    marginTop: spacing.xs,
  },
  heroRolePill: {
    backgroundColor: colors.whiteFaint,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
  },
  heroRolePillText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: colors.white,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase',
  },

  titleBlock: { paddingHorizontal: spacing['5xl'], paddingTop: spacing['5xl'], paddingBottom: 4 },
  title: { fontFamily: fonts.heading, fontSize: fontSize['5xl'], color: colors.inkSlate },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  cardWrap: { marginHorizontal: spacing['3xl'], marginTop: spacing['2xl'] },

  row: { flexDirection: 'row', gap: spacing.xl },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    maxWidth: '100%',
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.md,
    color: colors.primary,
    maxWidth: 180,
  },
});
