import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// The module chain reaches the greenbidz axios client (via fetchCategories),
// which imports MMKV — a native module with no jest binary. Same stub as
// enCategoryFixups.test.ts:6.
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));
// `Sheet` reads the bottom safe-area inset in the primitive. Same stub as
// `app/(lab)/account/__tests__/delete.test.tsx:10-14`.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
// The `@/components/ui` barrel re-exports Button.tsx, which pulls in
// react-native-reanimated; the native Worklets module isn't initialized under
// jest. Same stub as `app/(lab)/account/__tests__/delete.test.tsx:22-32`.
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});

// MMKV is a native module with no jest binary. Same stub as
// `app/(lab)/account/__tests__/delete.test.tsx:18`.
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import type { LabCategory } from '@/services/scanner/fetchCategories';

import { CategoryPickerSheet } from '../CategoryPickerSheet';

// /lab shape: one parent, two children (real ids and names from dev).
const NESTED: LabCategory[] = [
  {
    id: 5375,
    name: 'Lab Infrastructure & Essentials',
    slug: 'lab-infra',
    subcategories: [
      { id: 5573, name: 'Autoclaves and Sterilisation', slug: 'autoclaves' },
      { id: 5578, name: 'Centrifugation', slug: 'centrifugation' },
    ],
  },
];

// Two nested parents — the accordion has to keep exactly one open.
const TWO_PARENTS: LabCategory[] = [
  ...NESTED,
  {
    id: 5373,
    name: 'Testing & Measurement',
    slug: 'testing',
    subcategories: [{ id: 5399, name: 'Calibration & Standards', slug: 'calibration' }],
  },
];

// /101recycle shape after normalizeRecycleCategories: flat parents, no children.
const FLAT: LabCategory[] = [
  { id: 1147, name: 'Material Handling Equipment', slug: 'mhe', subcategories: [] },
  { id: 2019, name: 'Metalworking Equipment', slug: 'metalworking', subcategories: [] },
];

const base = {
  visible: true,
  loading: false,
  error: false,
  onRetry: () => {},
  marketplaceLabel: '101LAB',
  value: '',
  parentId: '',
  onClose: () => {},
};

const SEARCH = 'Search categories…';

describe('CategoryPickerSheet — browse mode is an accordion', () => {
  // OWNER DECISION 6. The in-repo precedent is `LabListingEditSheet.tsx`'s
  // LabCategorySheet (tap a parent, its children appear indented beneath it).
  // Rendering every parent expanded would put 101lab's default state at 70 rows,
  // which contradicts the "Can scrolling be reduced?" rule this sheet exists to
  // answer.
  it('shows parents only until one is tapped', () => {
    const { getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    expect(getByText('Lab Infrastructure & Essentials')).toBeTruthy();
    expect(queryByText('Centrifugation')).toBeNull();

    fireEvent.press(getByText('Lab Infrastructure & Essentials'));
    expect(getByText('Centrifugation')).toBeTruthy();
    expect(getByText('Autoclaves and Sterilisation')).toBeTruthy();
  });

  it('collapses again on a second tap', () => {
    const { getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    fireEvent.press(getByText('Lab Infrastructure & Essentials'));
    expect(getByText('Centrifugation')).toBeTruthy();
    fireEvent.press(getByText('Lab Infrastructure & Essentials'));
    expect(queryByText('Centrifugation')).toBeNull();
  });

  it('keeps exactly one parent open, so the list never grows to every leaf', () => {
    const { getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={TWO_PARENTS} onSelect={() => {}} />,
    );
    fireEvent.press(getByText('Lab Infrastructure & Essentials'));
    expect(getByText('Centrifugation')).toBeTruthy();
    fireEvent.press(getByText('Testing & Measurement'));
    expect(getByText('Calibration & Standards')).toBeTruthy();
    expect(queryByText('Centrifugation')).toBeNull();
  });

  it('opens on the parent that already holds the seller`s pick', () => {
    // Adapts to progress instead of making the seller re-find their own choice —
    // and it is the only way the current pick is reachable without a search.
    const { getByText } = render(
      <CategoryPickerSheet
        {...base}
        categories={TWO_PARENTS}
        value="5578"
        parentId="5375"
        onSelect={() => {}}
      />,
    );
    expect(getByText('Centrifugation')).toBeTruthy();
  });
});

describe('CategoryPickerSheet — what a tap emits', () => {
  it('emits the leaf id AND its parent when a nested subcategory is tapped', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.press(getByText('Lab Infrastructure & Essentials'));
    fireEvent.press(getByText('Centrifugation'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '5578',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
  });

  it('treats a flat parent as the leaf — the /machines and /101recycle case', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategoryPickerSheet
        {...base}
        marketplaceLabel="101RECYCLE"
        categories={FLAT}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByText('Metalworking Equipment'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '2019',
      parentCategoryId: '2019',
      parentCategoryName: 'Metalworking Equipment',
    });
  });

  it('offers "Other (type brand)" only on a nested tree, filed under its parent', () => {
    const onSelect = jest.fn();
    const nested = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.press(nested.getByText('Lab Infrastructure & Essentials'));
    fireEvent.press(nested.getByText('Other (type brand)'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });

    // A flat parent IS the leaf, so there is no "under this parent" to file into.
    const flat = render(<CategoryPickerSheet {...base} categories={FLAT} onSelect={() => {}} />);
    fireEvent.press(flat.getByText('Material Handling Equipment'));
    expect(flat.queryByText('Other (type brand)')).toBeNull();
  });

  it('closes the sheet on a pick, and reopens on browse rather than on the old query', () => {
    const onClose = jest.fn();
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText(SEARCH), 'centrif');
    fireEvent.press(getByText('Centrifugation'));
    expect(onClose).toHaveBeenCalled();
    // Query cleared: a stale "centrif" would hide the whole tree next time.
    expect(queryByText('Centrifugation')).toBeNull();
    expect(getByText('Lab Infrastructure & Essentials')).toBeTruthy();
  });
});

describe('CategoryPickerSheet — search', () => {
  it('narrows to matching leaves and hides the rest', () => {
    const { getByPlaceholderText, getByText, queryByText, getAllByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByPlaceholderText(SEARCH), 'centrif');
    expect(getByText('Centrifugation')).toBeTruthy();
    expect(queryByText('Autoclaves and Sterilisation')).toBeNull();
    // REVIEWER FIX (g): the parent is the row's DESCRIPTION, not a label prefix.
    // `Sheet.Option`'s label is numberOfLines={1} in ~380 px, so a
    // `Parent › Sub` label truncates inside the shared prefix and every search
    // hit renders identical — the headline improvement of this phase, unreadable.
    expect(queryByText('Lab Infrastructure & Essentials › Centrifugation')).toBeNull();
    expect(getAllByText('Lab Infrastructure & Essentials')).toHaveLength(1);
  });

  it('matches on the parent name too, and still emits the child leaf', () => {
    const onSelect = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={onSelect} />,
    );
    fireEvent.changeText(getByPlaceholderText(SEARCH), 'infrastructure');
    fireEvent.press(getByText('Autoclaves and Sterilisation'));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: '5573',
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    });
  });

  it('adds no second line on a flat tree, where the parent IS the leaf', () => {
    const { getByPlaceholderText, getAllByText } = render(
      <CategoryPickerSheet {...base} categories={FLAT} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByPlaceholderText(SEARCH), 'metal');
    // One text node, not a label plus an identical description underneath it.
    expect(getAllByText('Metalworking Equipment')).toHaveLength(1);
  });

  it('offers a way back instead of a dead end when nothing matches', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CategoryPickerSheet {...base} categories={NESTED} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByPlaceholderText(SEARCH), 'zzzzz');
    expect(getByText('No category matches "zzzzz"')).toBeTruthy();
    fireEvent.press(getByText('Clear search to browse all categories'));
    expect(queryByText('No category matches "zzzzz"')).toBeNull();
    expect(getByText('Lab Infrastructure & Essentials')).toBeTruthy();
  });
});

describe('CategoryPickerSheet — loading, failure, and the trap guard', () => {
  it('names the marketplace in the loading copy rather than showing a bare spinner', () => {
    const { getByText } = render(
      <CategoryPickerSheet
        {...base}
        loading
        marketplaceLabel="101MACHINE"
        categories={[]}
        onSelect={() => {}}
      />,
    );
    expect(getByText('Loading 101MACHINE categories…')).toBeTruthy();
  });

  it('a load failure is a tappable retry, not a dead end', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <CategoryPickerSheet {...base} error onRetry={onRetry} categories={[]} onSelect={() => {}} />,
    );
    fireEvent.press(getByText("Couldn't load categories — tap to retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it('never writes the form on mount — the trap guard, as a test', () => {
    // §1 of the phase plan: the only writes this phase adds are inside onSelect,
    // and onSelect is reachable only from a Pressable's onPress. A sheet that
    // emitted on mount would re-open the hydration race the card's :166-169 NOTE
    // is about.
    const onSelect = jest.fn();
    render(
      <CategoryPickerSheet
        {...base}
        categories={NESTED}
        value="5578"
        parentId="5375"
        onSelect={onSelect}
      />,
    );
    expect(onSelect).not.toHaveBeenCalled();
  });
});
