/**
 * Does the AI badge on a field tell the truth?
 *
 * ── THE PROBLEM IT FIXES ───────────────────────────────────────────────────
 *
 * `FieldLabel`'s `ai` prop was passed as a literal — `<FieldLabel text=… ai />`
 * — so the badge was decoration, not a statement. On a device it sat beside an
 * EMPTY Year and an EMPTY Description, claiming AI authorship of a blank
 * field, and it stayed put after the seller rewrote the title by hand.
 *
 * A badge that is always on carries no information. This makes it mean one
 * specific thing: **this is still exactly what the AI wrote.** It disappears
 * when the field is empty (the AI wrote nothing) and when the seller edits it
 * (it is now their words, not the model's) — which is also the useful signal,
 * because an untouched AI value is the one worth a second look before listing.
 *
 * ── WHY `current` ──────────────────────────────────────────────────────────
 *
 * `useScanDraft(s => s.current)` is the item under edit in BOTH modes — the
 * single-item flow and grouped edit, which loads the chosen item into
 * `current` before opening this screen. It is the same selector
 * `app/scan/detail.tsx:72` uses, so the badge cannot disagree with the form
 * about which item is on screen.
 *
 * ── WHAT IT DELIBERATELY DOES NOT COVER ────────────────────────────────────
 *
 * CATEGORY and GRADE also render an AI badge. `AiResult` has `grade` but no
 * category field at all, so on mobile there is nothing to compare a category
 * against — the web payload's `aiCategoryHint` has no counterpart here. Those
 * two are left as they are rather than guessed at; fixing them means deciding
 * where an AI category would come from, which is a data question, not a label
 * one.
 */
import { useScanDraft } from '@/stores/scanDraftStore';

/** The `AiResult` fields that map 1:1 onto a text input on this screen. */
export type AiTextField = 'name' | 'description' | 'brand' | 'model' | 'year';

/**
 * Returns a predicate: `aiFilled('name', value)` is true when the AI produced
 * something for that field and `value` is still, character for character, that
 * text. Trimmed on both sides so trailing whitespace alone does not count as
 * an edit.
 */
export function useAiFilled(): (field: AiTextField, value: unknown) => boolean {
  const ai = useScanDraft((s) => s.current?.ai ?? null);

  return (field, value) => {
    const written = String(ai?.[field] ?? '').trim();
    if (!written) return false;
    return String(value ?? '').trim() === written;
  };
}
