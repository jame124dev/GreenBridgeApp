/**
 * The DERIVED STEP SPINE and the per-step gate.
 *
 * The rail reads `steps.length`. The design system forbids a padded count —
 * "Never 'Step 4 of 4' when the draft does not have four steps" — so the count
 * must come from the array, and the array must come from the answers. The
 * failure this guards against is someone replacing the derivation with a
 * literal `6` (or a `5`, after a step is removed): the UI would still look
 * right for a seller and would show a rail to a BUYER, who renders no wizard at
 * all. So the assertions below are deliberately about the length CHANGING with
 * role, not just about its value for one role.
 *
 * `renderHook` comes from `@testing-library/react-native` (v13, in
 * devDependencies) — the repo has no `@testing-library/react-hooks`.
 */
import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import en from '@/i18n/locales/en.json';

import { useOnboardingMock, type StepKey, type ValidationMessage } from '../mockState';

/**
 * `errorFor` / `accountErrorFor` hand back `{ key, params }` rather than a
 * sentence — a module-level validator has no `t`, and an English string built
 * there would survive into all six languages. These assertions are about the
 * COPY a user reads, so resolve the key through the English bundle: the
 * expectation stays readable AND a renamed or deleted key fails here.
 */
function copy(m: ValidationMessage | undefined): string | undefined {
  if (!m) return undefined;
  const hit = m.key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    en,
  );
  if (typeof hit !== 'string') throw new Error(`missing en.json key: ${m.key}`);
  let out = hit;
  for (const [k, v] of Object.entries(m.params ?? {})) out = out.split(`{{${k}}}`).join(String(v));
  return out;
}

type Hook = ReturnType<typeof useOnboardingMock>;

const SELLER_SPINE: StepKey[] = [
  'sellerType',
  'business',
  'location',
  'categories',
  'volume',
  'calibration',
];

/** Fills a step's fields with values the validator accepts. */
const VALID_BUSINESS: Record<string, string> = {
  bizName: 'Acme Instruments',
  taxId: 'GB-123456789',
};
const VALID_LOCATION: Record<string, string> = {
  street: '12 Example Road',
  city: 'Bangkok',
  postal: '10110',
  region: 'Bangkok',
  country: 'TH',
};

/**
 * `act` insists its callback return `undefined`; an arrow whose body is the
 * setter call returns the setter's value and warns. This swallows it.
 */
const run = (fn: () => unknown) => {
  act(() => {
    fn();
  });
};

const fill = (
  result: { current: Hook },
  values: Record<string, string>,
) => {
  act(() => {
    for (const [id, v] of Object.entries(values)) result.current.setValue(id, v);
  });
};

/** Drives the wizard to `target`, filling whatever each earlier step demands. */
function advanceTo(result: { current: Hook }, target: StepKey) {
  act(() => {
    result.current.setRole('seller');
  });
  while (result.current.current !== target) {
    const step = result.current.current;
    expect(step).not.toBeNull(); // ran off the end — the spine changed
    switch (step) {
      case 'sellerType':
        run(() => result.current.setSellerType('company'));
        break;
      case 'business':
        fill(result, VALID_BUSINESS);
        break;
      case 'location':
        fill(result, VALID_LOCATION);
        break;
      case 'categories':
        run(() => result.current.toggleCategory('spectroscopy'));
        break;
      case 'volume':
        run(() => result.current.setVolume('b'));
        break;
      default:
        throw new Error(`cannot advance past ${String(step)}`);
    }
    expect(result.current.canAdvance).toBe(true);
    run(() => result.current.next());
  }
}

describe('useOnboardingMock — the spine is derived, never hardcoded', () => {
  it('starts with no role and therefore no steps at all', () => {
    const { result } = renderHook(() => useOnboardingMock());
    expect(result.current.role).toBeNull();
    expect(result.current.steps).toEqual([]);
    expect(result.current.steps).toHaveLength(0);
    expect(result.current.current).toBeNull();
  });

  it('gives a BUYER an empty spine — no rail, no wizard', () => {
    const { result } = renderHook(() => useOnboardingMock());
    run(() => result.current.setRole('buyer'));
    expect(result.current.steps).toHaveLength(0);
    expect(result.current.current).toBeNull();
    // And nothing can be advanced past, because there is nothing to advance.
    expect(result.current.canAdvance).toBe(false);
  });

  it('gives a SELLER exactly the six seller steps, in order', () => {
    const { result } = renderHook(() => useOnboardingMock());
    run(() => result.current.setRole('seller'));
    expect([...result.current.steps]).toEqual(SELLER_SPINE);
    expect(result.current.steps).toHaveLength(6);
    expect(result.current.current).toBe('sellerType');
  });

  it('changes steps.length when the role changes — the count is not a constant', () => {
    const { result } = renderHook(() => useOnboardingMock());

    run(() => result.current.setRole('buyer'));
    const asBuyer = result.current.steps.length;

    run(() => result.current.setRole('seller'));
    const asSeller = result.current.steps.length;

    run(() => result.current.setRole('buyer'));
    const backToBuyer = result.current.steps.length;

    expect(asBuyer).toBe(0);
    expect(asSeller).toBe(6);
    expect(backToBuyer).toBe(0);
    expect(asSeller).not.toBe(asBuyer);
  });

  it('does not grow the spine when a seller answers — the six are the six', () => {
    const { result } = renderHook(() => useOnboardingMock());
    run(() => result.current.setRole('seller'));
    run(() => result.current.setSellerType('reseller'));
    run(() => result.current.toggleCategory('microscopy'));
    expect(result.current.steps).toHaveLength(6);
    run(() => result.current.setSellerType('company'));
    expect(result.current.steps).toHaveLength(6);
  });

  it('keeps roleConfirmed independent of the spine (the on-device bug)', () => {
    // Selecting "seller" fills `steps`, but the wizard must not open until
    // Continue is pressed. Keying the guard off steps.length is what broke it.
    const { result } = renderHook(() => useOnboardingMock());
    run(() => result.current.setRole('seller'));
    expect(result.current.steps.length).toBeGreaterThan(0);
    expect(result.current.roleConfirmed).toBe(false);
    run(() => result.current.confirmRole());
    expect(result.current.roleConfirmed).toBe(true);
  });
});

describe('useOnboardingMock — canAdvance per step', () => {
  it('sellerType: needs a choice', () => {
    const { result } = renderHook(() => useOnboardingMock());
    run(() => result.current.setRole('seller'));
    expect(result.current.current).toBe('sellerType');
    expect(result.current.canAdvance).toBe(false);
    run(() => result.current.setSellerType('reseller'));
    expect(result.current.canAdvance).toBe(true);
  });

  it('business: needs every required field on the step to validate', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'business');
    expect(result.current.canAdvance).toBe(false);

    fill(result, { bizName: 'Acme Instruments' });
    expect(result.current.canAdvance).toBe(false); // taxId still missing

    fill(result, { taxId: 'GB-123456789' });
    expect(result.current.canAdvance).toBe(true);

    // An INVALID optional field blocks too — optional means "may be empty",
    // not "may be wrong".
    fill(result, { website: 'not a url' });
    expect(result.current.canAdvance).toBe(false);
    fill(result, { website: '' });
    expect(result.current.canAdvance).toBe(true);
  });

  it('location: needs all five, and country is one of them', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'location');
    expect(result.current.canAdvance).toBe(false);

    const { country, ...withoutCountry } = VALID_LOCATION;
    fill(result, withoutCountry);
    expect(result.current.canAdvance).toBe(false);

    fill(result, { country });
    expect(result.current.canAdvance).toBe(true);
  });

  it('categories: needs at least one, and a toggle off blocks again', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'categories');
    expect(result.current.canAdvance).toBe(false);

    run(() => result.current.toggleCategory('spectroscopy'));
    expect(result.current.categories).toEqual(['spectroscopy']);
    expect(result.current.canAdvance).toBe(true);

    run(() => result.current.toggleCategory('microscopy'));
    expect(result.current.categories).toEqual(['spectroscopy', 'microscopy']);

    run(() => result.current.toggleCategory('spectroscopy'));
    run(() => result.current.toggleCategory('microscopy'));
    expect(result.current.categories).toEqual([]);
    expect(result.current.canAdvance).toBe(false);
  });

  it('volume: needs a choice, and stores the opaque letter', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'volume');
    expect(result.current.canAdvance).toBe(false);
    run(() => result.current.setVolume('c'));
    expect(result.current.volume).toBe('c');
    expect(result.current.canAdvance).toBe(true);
  });

  it('calibration: needs BOTH an answer and accepted terms', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'calibration');
    expect(result.current.canAdvance).toBe(false);

    // Answer alone is not enough.
    run(() => result.current.setCalibration('some'));
    expect(result.current.termsAccepted).toBe(false);
    expect(result.current.canAdvance).toBe(false);

    // Terms alone are not enough either.
    run(() => result.current.setCalibration(null));
    run(() => result.current.acceptTerms());
    expect(result.current.canAdvance).toBe(false);

    // Both.
    run(() => result.current.setCalibration('none'));
    expect(result.current.canAdvance).toBe(true);

    // Un-ticking the terms re-blocks the submit.
    run(() => result.current.toggleTerms());
    expect(result.current.termsAccepted).toBe(false);
    expect(result.current.canAdvance).toBe(false);
  });
});

describe('useOnboardingMock — next/back/done', () => {
  it('refuses to advance and reveals the errors when the step is incomplete', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'business');
    run(() => result.current.next());
    expect(result.current.current).toBe('business');
    // Errors now show without the field having been touched.
    expect(copy(result.current.errorFor('bizName'))).toBe('Company name is required');
  });

  it('shows a field error only after the field is left, until a failed Continue', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'business');
    expect(result.current.errorFor('bizName')).toBeUndefined();
    run(() => result.current.touch('bizName'));
    expect(copy(result.current.errorFor('bizName'))).toBe('Company name is required');
  });

  it('walks all six steps and only then sets done', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'calibration');
    expect(result.current.index).toBe(5);
    expect(result.current.done).toBe(false);

    run(() => result.current.setCalibration('most'));
    run(() => result.current.acceptTerms());
    run(() => result.current.next());
    expect(result.current.done).toBe(true);
  });

  it('back() walks the index down and returns false at the first step', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'location');
    expect(result.current.index).toBe(2);

    let moved: boolean | undefined;
    act(() => {
      moved = result.current.back();
    });
    expect(moved).toBe(true);
    expect(result.current.current).toBe('business');

    act(() => {
      result.current.back();
    });
    expect(result.current.index).toBe(0);

    act(() => {
      moved = result.current.back();
    });
    // Nowhere further back — the caller leaves the flow.
    expect(moved).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it('reset() returns every answer to its initial value', () => {
    const { result } = renderHook(() => useOnboardingMock());
    advanceTo(result, 'calibration');
    run(() => result.current.setCalibration('most'));
    run(() => result.current.acceptTerms());

    run(() => result.current.reset());

    expect(result.current.role).toBeNull();
    expect(result.current.roleConfirmed).toBe(false);
    expect(result.current.sellerType).toBeNull();
    expect(result.current.categories).toEqual([]);
    expect(result.current.values).toEqual({});
    expect(result.current.volume).toBeNull();
    expect(result.current.calibration).toBeNull();
    expect(result.current.termsAccepted).toBe(false);
    expect(result.current.index).toBe(0);
    expect(result.current.done).toBe(false);
    expect(result.current.steps).toHaveLength(0);
  });
});

describe('useOnboardingMock — isReseller forks the business rules', () => {
  it('validates bizRole as years for a reseller and as a title for a company', () => {
    const { result } = renderHook(() => useOnboardingMock());

    run(() => result.current.setRole('seller'));
    run(() => result.current.setSellerType('reseller'));
    run(() => result.current.next());
    expect(result.current.current).toBe('business');
    expect(result.current.isReseller).toBe(true);

    fill(result, { ...VALID_BUSINESS, bizRole: 'Head of Lab' });
    run(() => result.current.touch('bizRole'));
    expect(copy(result.current.errorFor('bizRole'))).toBe('Enter whole years, e.g. 5');
    expect(result.current.canAdvance).toBe(false);

    // The same value is fine the moment the seller type changes.
    run(() => result.current.setSellerType('company'));
    expect(result.current.isReseller).toBe(false);
    expect(result.current.errorFor('bizRole')).toBeUndefined();
    expect(result.current.canAdvance).toBe(true);
  });
});

describe('useOnboardingMock — account screen', () => {
  it('is invalid until all five fields are filled, then valid', () => {
    const { result } = renderHook(() => useOnboardingMock());
    expect(result.current.accountValid).toBe(false);

    fill(result, {
      email: 'name@company.com',
      fullName: 'Jane Doe',
      phone: '+66 2 123 4567',
      password: 'abcdefg1',
      confirmPassword: 'abcdefg1',
    });
    expect(result.current.accountValid).toBe(true);
  });

  it('re-blocks when the confirmation stops matching', () => {
    const { result } = renderHook(() => useOnboardingMock());
    fill(result, {
      email: 'name@company.com',
      fullName: 'Jane Doe',
      phone: '+66 2 123 4567',
      password: 'abcdefg1',
      confirmPassword: 'abcdefg1',
    });
    fill(result, { password: 'abcdefg12' });
    expect(result.current.accountValid).toBe(false);
    run(() => result.current.touch('confirmPassword'));
    expect(copy(result.current.accountErrorFor('confirmPassword'))).toBe('Passwords do not match');
  });

  it('hides account errors until touched, and revealErrors shows them all', () => {
    const { result } = renderHook(() => useOnboardingMock());
    expect(result.current.accountErrorFor('email')).toBeUndefined();
    run(() => result.current.revealErrors());
    expect(copy(result.current.accountErrorFor('email'))).toBe('Email address is required');
    expect(copy(result.current.accountErrorFor('password'))).toBe('Password is required');
  });
});
