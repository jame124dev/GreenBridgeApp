import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

// The card's own data sources reach axios/MMKV; the badge is pure presentation,
// so both category hooks are stubbed at the module seam.
// The card reads `i18n.language` for the AI-pick locale bridge, and
// react-i18next has no instance under Jest (its `i18n` stub has no `language`).
// This mock keeps the SAME `t` semantics as the uninitialised default — a key
// with no defaultValue returns the key — so the assertions below read the same
// strings the rest of the suite does.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (typeof opts === 'string') return opts;
      const dv = (opts as { defaultValue?: string } | undefined)?.defaultValue;
      return dv ?? key;
    },
    i18n: { language: 'en' },
  }),
}));
// `fetchCategories` pulls in the axios client -> MMKV (a Nitro module with no
// jest binary). Only `bridgeCategoryId` is used, and only for AI-pick locale
// bridging, which no assertion here touches.
jest.mock('@/services/scanner/fetchCategories', () => ({ bridgeCategoryId: () => null }));
jest.mock('@/features/scanner/useLabCategories', () => ({
  useLabCategories: () => ({ isLoading: false, isError: false, data: { options: [] } }),
  useEnLabCategories: () => ({ isLoading: false, isError: false, data: { options: [] } }),
}));

import { CategoryConditionCard } from '@/features/scanner/components/detail/CategoryConditionCard';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import type { DetailFormInput } from '@/features/scanner/schema';

/**
 * M-10 — the category label carries the AI badge. Nine other labels in the editor
 * already do (§5.7: in this codebase the badge means "AI-assisted field", not
 * "this exact value came from the AI"), and category was the one AI-filled field
 * that did not say so.
 *
 * Asserted on the CATEGORY label specifically, not by counting badges: the card
 * also renders one on GRADE (CategoryConditionCard.tsx:436), so a count would
 * pass with the two swapped.
 */
function Harness() {
  const form = useForm<DetailFormInput>({ defaultValues: emptyDetailDefaults() });
  return (
    <FormProvider {...form}>
      <CategoryConditionCard />
    </FormProvider>
  );
}

/** Every string rendered anywhere under `node`, concatenated. */
function textOf(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  const children = (node as { children?: unknown[] }).children ?? [];
  return children.map(textOf).join('');
}

/** Ancestor chain (root first) down to the first node matching `pred`. */
function pathTo(node: unknown, pred: (n: unknown) => boolean, acc: unknown[] = []): unknown[] | null {
  if (node == null || typeof node !== 'object') return null;
  const chain = [...acc, node];
  if (pred(node)) return chain;
  for (const child of (node as { children?: unknown[] }).children ?? []) {
    const found = pathTo(child, pred, chain);
    if (found) return found;
  }
  return null;
}

/**
 * The rendered `FieldLabel` row that owns `labelText` — i.e. the parent of the
 * label `Text`, which is where FieldLabel puts the AI badge.
 */
function labelRow(tree: unknown, labelText: string): unknown {
  const chain = pathTo(tree, (n) => textOf(n) === labelText);
  expect(chain).not.toBeNull();
  const parent = chain![chain!.length - 2];
  expect(parent).toBeTruthy();
  return parent;
}

describe('CategoryConditionCard — category label AI badge (M-10)', () => {
  it('the category label row contains the AI badge', () => {
    const { toJSON } = render(<Harness />);
    // react-i18next has no instance under Jest: a key with no defaultValue comes
    // back as itself, and FieldLabel appends ' *' for `required`.
    expect(textOf(labelRow(toJSON(), 'mobile.detail.sectionCategory *'))).toContain('AI');
  });

  it('the condition label — required, NOT AI-assisted — has no badge', () => {
    const { toJSON } = render(<Harness />);
    expect(textOf(labelRow(toJSON(), 'mobile.detail.sectionCondition *'))).not.toContain('AI');
  });
});
