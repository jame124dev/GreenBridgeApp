import { describe, it, expect, jest } from '@jest/globals';

// applyEnCategoryFixups is pure, but its module imports the greenbidz axios
// client which transitively pulls in the mmkv (native) chain — stub it so the
// jest env can load the module.
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));

import { applyEnCategoryFixups, type LabCategory } from '@/services/scanner/fetchCategories';

// Backend EN tree returns term 5373's parent name as its untranslated Chinese
// source ("測試與測量") while siblings + its children are proper English.
const EN_TREE: LabCategory[] = [
  { id: 5375, name: 'Lab Infrastructure & Essentials', slug: 'lab-infra', subcategories: [] },
  {
    id: 5373,
    name: '測試與測量',
    slug: 'testing-measurement',
    subcategories: [{ id: 5399, name: 'Calibration & Standards', slug: 'calibration' }],
  },
];

describe('applyEnCategoryFixups', () => {
  it('renames the untranslated EN parent (id 5373) to "Testing & Measurement"', () => {
    const fixed = applyEnCategoryFixups(EN_TREE);
    expect(fixed.find((c) => c.id === 5373)?.name).toBe('Testing & Measurement');
  });

  it('leaves other categories and all subcategories untouched', () => {
    const fixed = applyEnCategoryFixups(EN_TREE);
    expect(fixed.find((c) => c.id === 5375)?.name).toBe('Lab Infrastructure & Essentials');
    expect(fixed.find((c) => c.id === 5373)?.subcategories[0].name).toBe('Calibration & Standards');
  });

  it('does not mutate the input tree', () => {
    applyEnCategoryFixups(EN_TREE);
    expect(EN_TREE.find((c) => c.id === 5373)?.name).toBe('測試與測量');
  });
});
