import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

// MMKV is a native module with no jest binary; `@/api/greenbidzClient` (reached
// through fetchCategories) and `@/i18n` both pull it in.
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));
// `Sheet` reads the bottom safe-area inset in the primitive.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

// The tree lives INSIDE the factory: babel-plugin-jest-hoist lifts jest.mock above
// every import, so a module-scope const would still be undefined when it runs.
// One nested parent (/lab shape) and one flat parent (/machines, /101recycle
// shape) in the same tree, so both branches of the collapsed row are exercised
// against one stub. Real ids and names from dev. `flattenCategoryOptions` is the
// REAL implementation, so the labels asserted below are the shipped ones.
jest.mock('@/features/scanner/useLabCategories', () => {
  const { flattenCategoryOptions } = require('@/services/scanner/fetchCategories');
  const TREE = [
    {
      id: 5375,
      name: 'Lab Infrastructure & Essentials',
      slug: 'lab-infra',
      subcategories: [
        { id: 5573, name: 'Autoclaves and Sterilisation', slug: 'autoclaves' },
        { id: 5578, name: 'Centrifugation', slug: 'centrifugation' },
      ],
    },
    { id: 2019, name: 'Metalworking Equipment', slug: 'metalworking', subcategories: [] },
  ];
  const settled = { isLoading: false, isError: false, isSuccess: true, refetch: () => {} };
  return {
    useLabCategories: () => ({
      ...settled,
      data: { categories: TREE, options: flattenCategoryOptions(TREE) },
    }),
    useEnLabCategories: () => ({ ...settled, data: TREE }),
  };
});

// Real en resources so the assertions read the SHIPPED copy.
import '@/i18n';

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import type { DetailFormInput } from '@/features/scanner/schema';

import { CategoryConditionCard } from '@/features/scanner/components/detail/CategoryConditionCard';

/**
 * M-2 step M2.3 — the category card is ONE row that opens the sheet.
 *
 * The sheet's own behaviour is covered in `CategoryPickerSheet.test.tsx`. This
 * file covers the half that only exists on the CARD, and that a source assertion
 * could not prove: what the collapsed row SAYS in each of its four states, and
 * what `applyPick` actually writes onto the form. Both are load-bearing —
 * `parentCategoryId` / `parentCategoryName` are what "Other" files under, and a
 * stale `customSubcategory` left behind by a real-leaf pick would still ship as
 * `suggested_subcategory`.
 *
 * The sheet's loading/error branches are NOT re-tested here (they are the sheet's
 * own tests); the seam that passes them down is a source assertion in
 * `src/features/scanner/__tests__/categoryPickerWiring.test.ts`.
 */
type Held = { form: UseFormReturn<DetailFormInput> | null };

function renderCard(overrides: Partial<DetailFormInput> = {}) {
  const held: Held = { form: null };
  function Host() {
    const form = useForm<DetailFormInput>({
      defaultValues: { ...emptyDetailDefaults(), marketplace: '101lab', ...overrides },
    });
    held.form = form;
    return (
      <FormProvider {...form}>
        <CategoryConditionCard />
      </FormProvider>
    );
  }
  const utils = render(<Host />);
  return { ...utils, held };
}

const NOT_SET = 'Not set — pick a category';
const SEARCH = 'Search categories…';

describe('the collapsed category row says what is currently picked', () => {
  it('prompts when nothing is set, and offers Choose rather than Change', () => {
    const { getByText } = renderCard();
    expect(getByText(NOT_SET)).toBeTruthy();
    expect(getByText('Choose')).toBeTruthy();
  });

  it('shows the flattened `Parent › Sub` label for a nested leaf', () => {
    const { getByText, queryByText } = renderCard({
      categoryId: '5578',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(getByText('Lab Infrastructure & Essentials › Centrifugation')).toBeTruthy();
    expect(getByText('Change')).toBeTruthy();
    expect(queryByText(NOT_SET)).toBeNull();
  });

  it('shows the parent`s own name for a flat leaf (/machines, /101recycle)', () => {
    const { getByText } = renderCard({
      categoryId: '2019',
      parentCategoryId: '2019',
      parentCategoryName: 'Metalworking Equipment',
    });
    expect(getByText('Metalworking Equipment')).toBeTruthy();
  });

  it('shows what the AI DID resolve when only the parent came back', () => {
    // The empty leaf still blocks Submit (schema.ts:23). Discarding the parent as
    // well would throw away the only thing the AI got right.
    const { getByText } = renderCard({
      categoryId: '',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(getByText('Lab Infrastructure & Essentials › pick a subcategory')).toBeTruthy();
  });

  it('names the parent alongside Other, and puts the brand input on the CARD', () => {
    const { getByText, getByPlaceholderText } = renderCard({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(getByText('Lab Infrastructure & Essentials › Other (type brand)')).toBeTruthy();
    // Not inside the sheet: the seller has to see and edit it after it closes.
    expect(getByPlaceholderText('Enter brand name')).toBeTruthy();
  });

  it('hides the brand input when the pick is a real leaf', () => {
    const { queryByPlaceholderText } = renderCard({
      categoryId: '5578',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(queryByPlaceholderText('Enter brand name')).toBeNull();
  });
});

/**
 * Press, then let react-hook-form settle.
 *
 * `applyPick` calls `setValue(..., { shouldValidate: true })`, and RHF's
 * zodResolver validation is ASYNC — it resolves on a microtask AFTER the
 * synchronous `fireEvent.press` returns, so React commits that state update
 * outside `act()` and warns. The assertions passed anyway (they read
 * `getValues`, not rendered output), which is why the warnings survived Phase 3.
 * Flushing here removes SIX of the eight warnings and makes the tests assert a
 * SETTLED form rather than one mid-validation. The two that remain come from
 * `@expo/vector-icons`' `Icon`, which setStates when its font finishes loading —
 * a third-party async, not this card's, and the same two appear in
 * `CategoryConditionCard.aiBadge.test.tsx`. Silencing those means stubbing the
 * icon set in every render suite in the repo, which is wider than a sweep.
 */
const press = async (node: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(node);
  });
};

const type = async (node: Parameters<typeof fireEvent.changeText>[0], text: string) => {
  await act(async () => {
    fireEvent.changeText(node, text);
  });
};

describe('the row opens the sheet, and a pick writes the form', () => {
  it('is closed until the row is tapped', async () => {
    const { getByText, queryByPlaceholderText } = renderCard();
    expect(queryByPlaceholderText(SEARCH)).toBeNull();
    await press(getByText(NOT_SET));
    expect(queryByPlaceholderText(SEARCH)).not.toBeNull();
  });

  it('writes categoryId + BOTH parent fields, and drops a stale typed brand', async () => {
    const { getByText, getByPlaceholderText, held } = renderCard({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
      customSubcategory: 'Eppendorf',
    });
    await press(getByText('Lab Infrastructure & Essentials › Other (type brand)'));
    await type(getByPlaceholderText(SEARCH), 'centrif');
    await press(getByText('Centrifugation'));

    expect(held.form!.getValues('categoryId')).toBe('5578');
    expect(held.form!.getValues('parentCategoryId')).toBe('5375');
    expect(held.form!.getValues('parentCategoryName')).toBe('Lab Infrastructure & Essentials');
    // A real leaf leaves "Other" behind; the brand would otherwise ship as
    // suggested_subcategory on a listing not filed under Other at all.
    expect(held.form!.getValues('customSubcategory')).toBe('');
  });

  it('keeps the typed brand when the pick IS Other', async () => {
    const { getByText, held } = renderCard({
      categoryId: '5578',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
      customSubcategory: 'Eppendorf',
    });
    await press(getByText('Lab Infrastructure & Essentials › Centrifugation'));
    // Accordion: the parent holding the pick is already open, so Other is reachable.
    await press(getByText('Other (type brand)'));

    expect(held.form!.getValues('categoryId')).toBe(OTHER_SUBCATEGORY_ID);
    expect(held.form!.getValues('parentCategoryId')).toBe('5375');
    expect(held.form!.getValues('customSubcategory')).toBe('Eppendorf');
  });

  it('commits a flat parent as its own leaf AND its own parent', async () => {
    const { getByText, held } = renderCard();
    await press(getByText(NOT_SET));
    await press(getByText('Metalworking Equipment'));

    expect(held.form!.getValues('categoryId')).toBe('2019');
    expect(held.form!.getValues('parentCategoryId')).toBe('2019');
    expect(held.form!.getValues('parentCategoryName')).toBe('Metalworking Equipment');
  });

  it('closes the sheet after a pick', async () => {
    const { getByText, queryByPlaceholderText } = renderCard();
    await press(getByText(NOT_SET));
    await press(getByText('Metalworking Equipment'));
    expect(queryByPlaceholderText(SEARCH)).toBeNull();
  });
});

describe('the card does not re-open the hydration race (§1 of the phase plan)', () => {
  it('writes nothing to the form on mount, with an AI-filled category present', () => {
    // The trap: a marketplace-keyed effect that "tidies" the clearing logic wipes
    // the AI's auto-filled category during hydration. The only writes this card
    // adds are inside `applyPick`, reachable only from the sheet's Pressables.
    const { held } = renderCard({
      categoryId: '5578',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(held.form!.getValues('categoryId')).toBe('5578');
    expect(held.form!.getValues('parentCategoryId')).toBe('5375');
  });

  it('keeps a parent-only AI fill instead of clearing it', () => {
    const { held } = renderCard({ categoryId: '', parentCategoryId: '5375' });
    expect(held.form!.getValues('parentCategoryId')).toBe('5375');
  });

  it('keeps the Other sentinel, which is deliberately not in the tree', () => {
    const { held } = renderCard({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5375',
    });
    expect(held.form!.getValues('categoryId')).toBe(OTHER_SUBCATEGORY_ID);
  });
});
