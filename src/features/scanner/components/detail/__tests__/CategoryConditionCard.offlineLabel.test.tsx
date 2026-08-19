import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

/**
 * OFFLINE: the category tree fetch failed, so there is NO tree at all. This is
 * the state screenshot 48/52 were taken in (airplane mode on the review form),
 * and it is the whole point of this file — `CategoryConditionCard.categoryRow.test.tsx`
 * mocks a LOADED tree, so every label there resolves and the offline path was
 * never rendered by any test.
 */
jest.mock('@/features/scanner/useLabCategories', () => {
  const failed = {
    data: undefined,
    isLoading: false,
    isError: true,
    isSuccess: false,
    refetch: () => {},
  };
  return { useLabCategories: () => failed, useEnLabCategories: () => failed };
});

import '@/i18n';

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import type { DetailFormInput } from '@/features/scanner/schema';

import { CategoryConditionCard } from '@/features/scanner/components/detail/CategoryConditionCard';

/**
 * Device pass 2026-08-19 — offline, the collapsed category row LIED.
 *
 * It read "Not set — pick a category" while a category WAS selected, because the
 * label resolved only through the fetched tree (`options.find(...)?.label`) and
 * offline there is no tree. That invites the seller to re-pick and lose their
 * answer, which is why it is worse than a cosmetic gap: the pick is real, it is
 * in the form, and it would have submitted fine.
 *
 * The row now falls back, in order: the tree's flattened label -> the names the
 * DRAFT already carries (`categoryName` / `parentCategoryName`, which the AI
 * patch and every pick write) -> an honest "can't load its name right now". Only
 * a genuinely empty category still says "Not set".
 */
const NOT_SET = 'Not set — pick a category';
const CANT_LOAD = "Category selected — can't load its name right now";

function renderCard(overrides: Partial<DetailFormInput> = {}) {
  function Host() {
    const form = useForm<DetailFormInput>({
      defaultValues: { ...emptyDetailDefaults(), marketplace: '101lab', ...overrides },
    });
    return (
      <FormProvider {...form}>
        <CategoryConditionCard />
      </FormProvider>
    );
  }
  return render(<Host />);
}

describe('offline, the collapsed row never claims nothing is set', () => {
  it('shows the name the draft carries for a nested leaf', () => {
    // What an AI-filled draft actually holds offline: processing.tsx patches
    // categoryId + categoryName together, so the NAME is right there.
    const { getByText, queryByText } = renderCard({
      categoryId: '5578',
      categoryName: 'Centrifugation',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(getByText('Lab Infrastructure & Essentials › Centrifugation')).toBeTruthy();
    expect(queryByText(NOT_SET)).toBeNull();
    expect(queryByText(CANT_LOAD)).toBeNull();
  });

  it('does not print a flat leaf twice', () => {
    // On a flat tree (/machines, /101recycle) the parent IS the leaf, so
    // parentCategoryName === categoryName. Naively joining them would render
    // "Metalworking Equipment › Metalworking Equipment".
    const { getByText } = renderCard({
      categoryId: '2019',
      categoryName: 'Metalworking Equipment',
      parentCategoryId: '2019',
      parentCategoryName: 'Metalworking Equipment',
    });
    expect(getByText('Metalworking Equipment')).toBeTruthy();
  });

  it('shows the leaf name alone when the draft has no parent name', () => {
    const { getByText, queryByText } = renderCard({
      categoryId: '5578',
      categoryName: 'Centrifugation',
    });
    expect(getByText('Centrifugation')).toBeTruthy();
    expect(queryByText(NOT_SET)).toBeNull();
  });

  it('says it cannot load the name rather than "Not set" when only the id survived', () => {
    // A pre-M2 persisted draft, or one whose name was dropped: the id is real,
    // so the honest answer is "I have your pick, I cannot name it".
    const { getByText, queryByText } = renderCard({ categoryId: '5578' });
    expect(getByText(CANT_LOAD)).toBeTruthy();
    expect(queryByText(NOT_SET)).toBeNull();
  });

  it('still shows a parent-only fill from the name the draft carries', () => {
    const { getByText, queryByText } = renderCard({
      categoryId: '',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(getByText('Lab Infrastructure & Essentials › pick a subcategory')).toBeTruthy();
    expect(queryByText(NOT_SET)).toBeNull();
  });

  it('still names the parent alongside Other', () => {
    const { getByText } = renderCard({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
    expect(getByText('Lab Infrastructure & Essentials › Other (type brand)')).toBeTruthy();
  });

  it('offers Change, not Choose, whenever something IS selected', () => {
    const { getByText, queryByText } = renderCard({ categoryId: '5578' });
    expect(getByText('Change')).toBeTruthy();
    expect(queryByText('Choose')).toBeNull();
  });

  // ⛔ The prompt must SURVIVE. A fallback that fires on an empty category would
  // replace "pick a category" with "can't load its name", which is a different
  // lie in the opposite direction.
  it('still prompts when the category really is empty', () => {
    const { getByText, queryByText } = renderCard();
    expect(getByText(NOT_SET)).toBeTruthy();
    expect(queryByText(CANT_LOAD)).toBeNull();
    expect(getByText('Choose')).toBeTruthy();
  });
});
