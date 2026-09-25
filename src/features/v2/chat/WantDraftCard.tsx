/**
 * `wtb_draft` — the save-a-want card, in v2 chrome.
 *
 * ── WHY THIS EXISTS ──
 *
 * `CHATBOT_RULES.md` §2 makes it mandatory: *a no-match must LEAD with the
 * save-a-want offer*. Until now v2's card dispatcher handled only
 * `product_list` / `product`, so a `wtb_draft` frame fell to the default and
 * the buyer was shown a sentence written for a developer — "This answer
 * included a 'wtb_draft' card, which v2 does not draw yet." The one moment the
 * rules say to make an offer was the moment v2 admitted it could not.
 *
 * ── WHAT IS BORROWED, AND WHAT IS NOT ──
 *
 * The BEHAVIOUR is `LabWtbDraftCard`'s (`features/lab/chat/cards.tsx`), which
 * is live and has been through review: same seeds, same edits, same request
 * shape, same post-save pending state. Nothing about what a want IS was
 * re-derived here.
 *
 * The CHROME is v2's kit — `SoftPanel`, `PillButton`, `Field`, `Stepper`,
 * `PrimaryAction`. Routing the shipped card into a v2 thread would have dropped
 * old chrome into the middle of a v2 conversation, which is the complaint
 * already recorded against the promo banner.
 *
 * The budget maths is neither copied nor re-derived: both cards import
 * `features/lab/chat/wantBudget`.
 *
 * ── THE TRAP THIS CARD MUST NOT FALL INTO ──
 *
 * ⚠️ Do NOT build a want out of the user's search string. This card is driven
 * by a STRUCTURED draft the assistant emits (`data.draft`). A want invented
 * from free text arrives with no category and no condition, and the WTB
 * data-quality review found exactly that shape unusable (n=392: only
 * site_type / name / description / category were worth anything). If there is
 * no `draft`, render nothing and let the prose stand.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Bell, Bookmark, Check, ChevronRight, Mail, Sparkles } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { requireAuth } from '@/features/auth/requireAuth';
import { condLabel } from '@/features/lab/chat/cardKit';
import {
  WTB_CONDITION_CODES,
  budgetQuickChips,
  fmtBudget,
} from '@/features/lab/chat/wantBudget';
// Same source `ChatCards.tsx` already pulls it from — `toProductRow` normalises
// the several producty payload shapes the assistant emits.
import { toProductRow } from '@/features/lab/chat/cards';
import { useWantMutations } from '@/features/lab/hooks/useWantMutations';
import type { WtbRequestData } from '@/features/lab/data/wtbApi';
import { haptics } from '@/lib/haptics';
import { icon, space, useV2Colors } from '@/theme/v2';
import {
  Chip,
  Field,
  Hairline,
  PillButton,
  PrimaryAction,
  Row,
  SectionNote,
  SoftPanel,
  Stepper,
  Text,
} from '../ui';

/**
 * The label above a field inside this panel.
 *
 * It matches what `Field` draws for its own `label` prop — same variant, same
 * colour — so Condition, Budget and Quantity read as one set. `SectionHeader`
 * is the screen-level equivalent and carries the page gutter, which indents it
 * inside a panel.
 */
function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="eyebrow" color="inkSubtle">
      {children}
    </Text>
  );
}

/** The payload is server JSON: narrow it, never trust its shape. */
function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function WantDraftCard({ data }: { data: unknown }) {
  const { t } = useTranslation();
  const c = useV2Colors();
  const { createWant, isCreating } = useWantMutations();

  const o = asObj(data);
  const f = asObj(o.draft);
  const keywords = asArr(f.keywords).filter((k): k is string => typeof k === 'string');
  const preview = asArr(o.preview_matches ?? o.immediate_matches);

  // Seeded from whatever the assistant recognised, then the buyer's edits win.
  // An EMPTY condition set means "Any" — it is not a fourth code.
  const [conditions, setConditions] = useState<string[]>(() =>
    asArr(f.condition_wanted).filter((x): x is string => typeof x === 'string'),
  );
  const [maxPrice, setMaxPrice] = useState(f.max_price != null ? String(f.max_price) : '');
  const [qty, setQty] = useState<number>(typeof f.quantity === 'number' ? f.quantity : 1);
  const [result, setResult] = useState<WtbRequestData | null>(null);

  // Computed plainly, NOT memoised. `preview` comes out of `asArr(...)`, which
  // builds a new array every render, so a `useMemo` keyed on it would recompute
  // every render anyway while looking like it did not — the lint rule that
  // caught this is right. The work is a filter and a max over a handful of
  // numbers.
  const budgetChips = budgetQuickChips(
    preview.map((m) => {
      const row = toProductRow(m);
      return typeof row.price === 'number' ? row.price : Number(row.price);
    }),
  );

  // Nothing structured to save — see the trap note in the header.
  if (Object.keys(f).length === 0) return null;

  const toggleCond = (code: string) =>
    setConditions((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );

  const save = async () => {
    // Spread the whole draft, then overlay the buyer's edits. `site_type` must
    // NEVER go in the body — the create schema is `extra='forbid'` and it
    // travels as a header.
    const draft = { ...f } as Record<string, unknown>;
    delete draft.site_type;
    try {
      const created = await createWant({
        ...draft,
        title: typeof f.title === 'string' ? f.title : '',
        condition_wanted: conditions.length ? conditions : undefined,
        max_price: maxPrice.trim() === '' ? undefined : Number(maxPrice),
        quantity: qty,
      });
      haptics.success();
      setResult(created);
    } catch {
      haptics.error();
      toast.error(t('mobile.labCards.wtbEdit.saveError'));
    }
  };

  /**
   * ⚠️ THE GATE, AND WHY IT IS HERE RATHER THAN NOWHERE.
   *
   * `POST /wtb` needs an account. Without this, a guest could fill in condition,
   * budget and quantity, press the one green button on the card, and get
   * "Couldn't save that want — please try again" — which is both untrue and
   * unactionable, because trying again cannot work. Observed on device
   * 2026-09-21 before this gate existed.
   *
   * That is the "gated too LATE" half of App Review 5.1.1(v): not blocking a
   * guest at the door, but letting them do the work and refusing at the end.
   * `requireAuth` is v2's answer everywhere else — it raises the sign-in sheet
   * naming the reason, and runs the action afterwards, so the save the person
   * asked for still happens.
   *
   * The gate goes around the WRITE, never around the card: a guest must still
   * see the offer, read what was understood and edit it. Only saving needs a
   * name to save it under.
   */
  const onSave = () => {
    if (isCreating || result) return;
    haptics.tap();
    requireAuth('want', () => void save());
  };

  /* ── Saved. A want is PAUSED until an admin publishes it, so saying "we are
        watching the market" would be a lie for the first hours of its life. ── */
  if (result) {
    const req = result.request;
    const title = req.title || t('mobile.labCards.yourWant');
    const matches = result.matches.map(toProductRow);
    const status = (req.status ?? '').toLowerCase();
    const pending = status === 'paused' || status === 'pending';

    return (
      <SoftPanel style={styles.block}>
        <View style={styles.headRow}>
          <Check size={icon.md} color={c.accent} strokeWidth={2.4} />
          <Text variant="h3" style={styles.headText}>
            {pending
              ? t('mobile.labCards.wtbEdit.sentForApproval', { title })
              : t('mobile.labCards.savedAlertAbout', { title })}
          </Text>
        </View>

        <Text variant="body" color="inkSubtle">
          {pending
            ? t('mobile.labCards.wtbEdit.pendingBody')
            : matches.length > 0
              ? matches.length === 1
                ? t('mobile.labCards.matchesNowOne', { count: matches.length })
                : t('mobile.labCards.matchesNowOther', { count: matches.length })
              : t('mobile.labCards.noMatchesYetNotify')}
        </Text>

        <View style={styles.headRow}>
          <Mail size={icon.sm} color={c.accent} strokeWidth={2} />
          <Text variant="micro" color="inkSubtle" style={styles.headText}>
            {pending
              ? t('mobile.labCards.wtbEdit.pendingEmail')
              : t('mobile.labCards.wtbEdit.activeEmail')}
          </Text>
        </View>

        <Hairline />
        <Row
          title={t('mobile.labCards.wtbEdit.viewInMyWants')}
          titleVariant="row"
          onPress={() => {
            haptics.tap();
            // v2's own Matches tab, NOT `/(lab)/(tabs)/matches` — the shipped
            // card goes there, and following it out of a v2 thread is how a
            // seller ends up in the old tab group with no way back.
            router.push('/v2/matches');
          }}
          trailing={<ChevronRight size={icon.lg} color={c.inkMuted} strokeWidth={2} />}
          accessibilityLabel={t('mobile.labCards.wtbEdit.viewInMyWantsA11y')}
          testID="v2-want-view-mine"
        />
      </SoftPanel>
    );
  }

  /* ── The offer: what we understood, and the three things worth correcting ── */
  const title = typeof f.title === 'string' && f.title ? f.title : t('mobile.labCards.untitledWant');

  return (
    <SoftPanel style={styles.block}>
      <View style={styles.headRow}>
        <Bookmark size={icon.sm} color={c.accent} strokeWidth={2} />
        <Text variant="eyebrow" color="accent" style={styles.headText}>
          {t('mobile.labCards.wantToBuy')}
        </Text>
      </View>

      <Text variant="h3">{title}</Text>

      {f.category_name || keywords.length > 0 ? (
        <View style={styles.chips}>
          {f.category_name ? <Chip label={String(f.category_name)} tone="accent" /> : null}
          {keywords.map((k) => (
            <Chip key={k} label={k} />
          ))}
        </View>
      ) : null}

      {/* Condition — multi-select, plus an "Any" that clears rather than adds. */}
      <View style={styles.field}>
        {/* A plain eyebrow, NOT `SectionHeader`: that carries the screen gutter,
            so inside this panel it sat indented from the Budget label right
            beneath it. Three field labels, one left edge. */}
        <FieldLabel>{t('mobile.labCards.wtbEdit.conditionLabel')}</FieldLabel>
        <View style={styles.chips}>
          {WTB_CONDITION_CODES.map((code) => (
            <PillButton
              key={code}
              label={condLabel(code)}
              role="checkbox"
              selected={conditions.includes(code)}
              onPress={() => toggleCond(code)}
              testID={`v2-want-cond-${code}`}
            />
          ))}
          <PillButton
            label={t('mobile.labCards.wtbEdit.conditionAny')}
            role="checkbox"
            selected={conditions.length === 0}
            onPress={() => setConditions([])}
            testID="v2-want-cond-any"
          />
        </View>
      </View>

      {/* Budget — a free figure, with tiers sized to what is actually on offer. */}
      <View style={styles.field}>
        <Field
          label={t('mobile.labCards.wtbEdit.budgetLabel')}
          value={maxPrice}
          onChangeText={(txt) => setMaxPrice(txt.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder={t('mobile.labCards.wtbEdit.anyPlaceholder')}
          accessibilityLabel={t('mobile.labCards.wtbEdit.budgetFieldA11y')}
          testID="v2-want-budget"
        />
        <View style={styles.chips}>
          {budgetChips.map((v) => (
            <PillButton
              key={v}
              label={t('mobile.labCards.wtbEdit.budgetChip', { value: fmtBudget(v) })}
              selected={maxPrice !== '' && Number(maxPrice) === v}
              onPress={() => setMaxPrice(String(v))}
              testID={`v2-want-budget-${v}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        {/* ⚠️ `Stepper`'s own `label` is the ACCESSIBILITY label and is never
            drawn, so passing it alone left a sighted buyer with a bare "− 1 +"
            under a labelled Budget field — observed on device. The visible
            label has to be its own element; the prop still carries the
            announcement for a screen reader. */}
        <FieldLabel>{t('mobile.labCards.wtbEdit.quantityLabel')}</FieldLabel>
        <Stepper
          label={t('mobile.labCards.wtbEdit.quantityLabel')}
          value={qty}
          onChange={setQty}
          testID="v2-want-qty"
        />
      </View>

      <View style={styles.headRow}>
        <Sparkles size={icon.sm} color={c.accent} strokeWidth={2} />
        <Text variant="micro" color="inkSubtle" style={styles.headText}>
          {preview.length > 0
            ? preview.length === 1
              ? t('mobile.labCards.wtbTeaserMatchesOne', { count: preview.length })
              : t('mobile.labCards.wtbTeaserMatchesOther', { count: preview.length })
            : t('mobile.labCards.wtbNoMatchesYet')}
        </Text>
      </View>

      <PrimaryAction
        label={
          isCreating
            ? t('mobile.labCards.wtbEdit.saving')
            : t('mobile.labCards.saveAlertMe')
        }
        icon={<Bell size={icon.xl} color={c.onAccent} strokeWidth={2} />}
        loading={isCreating}
        onPress={() => void onSave()}
        testID="v2-want-save"
      />
    </SoftPanel>
  );
}

/**
 * The no-match copy, one place.
 *
 * `CHATBOT_RULES` §2 again: lead with the offer. When the assistant sends a
 * structured draft this is never seen — `WantDraftCard` is. It is the fallback
 * for an empty result set with no draft attached, and it deliberately points at
 * the composer rather than inventing a want from the query.
 */
export function NoMatchOffer() {
  return (
    <SectionNote>
      Nothing matched that yet. Describe it in the box below and we can watch the market for it.
    </SectionNote>
  );
}

const styles = StyleSheet.create({
  /** `width: '100%'` for the reason `ChatCards.styles` records: the thread row
   *  is `alignItems: 'flex-start'`, so a child shrink-wraps without it. */
  block: { width: '100%', gap: space['2xl'] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  headText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  field: { gap: space.lg },
});
