/**
 * Validation rules for the seller onboarding mock.
 *
 * These rules were copied rule-for-rule from the web flow (`SellerOnboarding.tsx`)
 * so that two clients writing the same columns agree on what they accept. Nothing
 * in the app re-derives them, so the only thing stopping a silent drift — someone
 * "tidying" a length, a regex, or a message — is this file. The boundaries are
 * asserted on BOTH sides (7/8, 72/73, 1/2, 100/101, 2/3, 10/11) because an
 * off-by-one here is invisible in the UI until a real user is blocked with no
 * explanation.
 *
 * Messages are asserted verbatim, not just truthiness: the web's copy is the
 * contract, and `''` is the sentinel for "valid".
 *
 * ── THE VALIDATORS NOW RETURN A KEY, AND THESE ASSERTIONS STILL READ AS COPY ──
 *
 * `validateField` / `validateAccountField` return `{ key, params } | null` so
 * that a module function with no `t` cannot freeze an English sentence into
 * all six languages. Asserting raw keys here would have thrown away what this
 * file is actually for — it guards the WORDING, which is the contract shared
 * with web, not the key names.
 *
 * So the two wrappers below resolve each result through **`en.json` itself**,
 * with the same `{{param}}` interpolation i18next does. Every assertion below
 * is unchanged, and each one now proves three things at once: the rule fires,
 * the key EXISTS in the English bundle, and its copy is still the web's. A
 * renamed or deleted key fails loudly instead of silently rendering blank.
 */
import { describe, expect, it } from '@jest/globals';

import en from '@/i18n/locales/en.json';

import {
  ACCOUNT_FIELDS,
  BUSINESS_FIELDS,
  LOCATION_FIELDS,
  REQUIRED_FIELDS,
  VOLUME_OPTIONS,
  CALIBRATION_OPTIONS,
  MOCK_CATEGORIES,
  type ValidationMessage,
  validateAccountField as validateAccountFieldKeyed,
  validateField as validateFieldKeyed,
} from '../mockState';

/** Walk a dotted key through the English bundle. Throws if it is not there. */
function enText(key: string): string {
  const hit = key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    en,
  );
  if (typeof hit !== 'string') throw new Error(`missing en.json key: ${key}`);
  return hit;
}

/** `{{name}}` interpolation, the subset i18next applies to these messages. */
function render(m: ValidationMessage | null): string {
  if (!m) return '';
  let out = enText(m.key);
  for (const [k, v] of Object.entries(m.params ?? {})) {
    out = out.split(`{{${k}}}`).join(String(v));
  }
  return out;
}

const validateField = (id: string, raw: string, isReseller: boolean): string =>
  render(validateFieldKeyed(id, raw, isReseller));

const validateAccountField = (id: string, raw: string, password: string): string =>
  render(validateAccountFieldKeyed(id, raw, password));

/** Every message is `''` when the value is acceptable. */
const ok = '';

describe('validateAccountField — email', () => {
  it('requires a value', () => {
    expect(validateAccountField('email', '', '')).toBe('Email address is required');
    expect(validateAccountField('email', '   ', '')).toBe('Email address is required');
  });

  it('accepts an ordinary address', () => {
    expect(validateAccountField('email', 'name@company.com', '')).toBe(ok);
  });

  it('trims before validating', () => {
    expect(validateAccountField('email', '  name@company.com  ', '')).toBe(ok);
  });

  it.each([
    ['no at sign', 'namecompany.com'],
    ['no domain dot', 'name@company'],
    ['one-letter tld', 'name@company.c'],
    ['inner space', 'na me@company.com'],
  ])('rejects %s', (_label, value) => {
    expect(validateAccountField('email', value, '')).toBe(
      'Enter a valid email address, e.g. name@company.com',
    );
  });

  it('rejects an address over 254 characters even when well-formed', () => {
    const local = 'a'.repeat(250); // 250 + '@b.co' = 255
    const long = `${local}@b.co`;
    expect(long.length).toBe(255);
    expect(validateAccountField('email', long, '')).toBe(
      'Enter a valid email address, e.g. name@company.com',
    );
    // …and accepts the same shape one character shorter.
    const atLimit = `${'a'.repeat(249)}@b.co`;
    expect(atLimit.length).toBe(254);
    expect(validateAccountField('email', atLimit, '')).toBe(ok);
  });
});

describe('validateAccountField — fullName boundaries', () => {
  it('requires a value', () => {
    expect(validateAccountField('fullName', '', '')).toBe('Full name is required');
  });

  it('rejects 1 character and accepts 2', () => {
    expect(validateAccountField('fullName', 'a', '')).toBe('Enter your full name');
    expect(validateAccountField('fullName', 'ab', '')).toBe(ok);
  });

  it('accepts 100 characters and rejects 101', () => {
    expect(validateAccountField('fullName', 'a'.repeat(100), '')).toBe(ok);
    expect(validateAccountField('fullName', 'a'.repeat(101), '')).toBe(
      'Must be 100 characters or fewer',
    );
  });

  it('accepts accents, apostrophes and hyphens', () => {
    expect(validateAccountField('fullName', "Zoë O'Brien-Smith", '')).toBe(ok);
    expect(validateAccountField('fullName', 'José Núñez', '')).toBe(ok);
  });

  it('rejects digits and a leading separator', () => {
    const msg = 'Name can only contain letters, spaces, apostrophes and hyphens';
    expect(validateAccountField('fullName', 'Agent 47', '')).toBe(msg);
    expect(validateAccountField('fullName', "-Smith", '')).toBe(msg);
  });
});

describe('validateAccountField — phone', () => {
  it('requires a value', () => {
    expect(validateAccountField('phone', '', '')).toBe('Phone number is required');
  });

  it('accepts plus, digits, spaces, dashes and brackets', () => {
    expect(validateAccountField('phone', '+66 2 123 4567', '')).toBe(ok);
    expect(validateAccountField('phone', '(020) 7946-0018', '')).toBe(ok);
  });

  it('rejects fewer than 7 and more than 20 characters', () => {
    expect(validateAccountField('phone', '123456', '')).toBe('Enter a valid phone number');
    expect(validateAccountField('phone', '1234567', '')).toBe(ok);
    expect(validateAccountField('phone', '1'.repeat(20), '')).toBe(ok);
    expect(validateAccountField('phone', '1'.repeat(21), '')).toBe('Enter a valid phone number');
  });

  it('rejects letters', () => {
    expect(validateAccountField('phone', 'call me ok', '')).toBe('Enter a valid phone number');
  });
});

describe('validateAccountField — password boundaries', () => {
  it('requires a value', () => {
    expect(validateAccountField('password', '', '')).toBe('Password is required');
  });

  it('rejects 7 characters and accepts 8', () => {
    expect(validateAccountField('password', 'abcdef1', '')).toBe(
      'Password must be at least 8 characters',
    );
    expect(validateAccountField('password', 'abcdefg1', '')).toBe(ok);
  });

  it('accepts 72 characters and rejects 73', () => {
    const at72 = `a1${'x'.repeat(70)}`;
    const at73 = `a1${'x'.repeat(71)}`;
    expect(at72).toHaveLength(72);
    expect(at73).toHaveLength(73);
    expect(validateAccountField('password', at72, '')).toBe(ok);
    expect(validateAccountField('password', at73, '')).toBe(
      'Password must be 72 characters or fewer',
    );
  });

  it('needs at least one letter and one digit', () => {
    const msg = 'Use at least one letter and one number';
    expect(validateAccountField('password', 'abcdefgh', '')).toBe(msg);
    expect(validateAccountField('password', '12345678', '')).toBe(msg);
    expect(validateAccountField('password', 'abcdefg1', '')).toBe(ok);
  });

  it('measures the RAW value, not the trimmed one', () => {
    // A password is allowed to end in a space, and that space counts toward the
    // length. Trimming here would let a 73-char password through, or reject a
    // legitimate 8-char one.
    expect(validateAccountField('password', 'abcdefg1 ', '')).toBe(ok);
    expect(validateAccountField('password', ' '.repeat(9), '')).toBe(
      'Use at least one letter and one number',
    );
  });
});

describe('validateAccountField — confirmPassword', () => {
  it('requires a value', () => {
    expect(validateAccountField('confirmPassword', '', 'abcdefg1')).toBe(
      'Please confirm your password',
    );
  });

  it('must match exactly, including case and spaces', () => {
    expect(validateAccountField('confirmPassword', 'abcdefg1', 'abcdefg1')).toBe(ok);
    expect(validateAccountField('confirmPassword', 'Abcdefg1', 'abcdefg1')).toBe(
      'Passwords do not match',
    );
    expect(validateAccountField('confirmPassword', 'abcdefg1 ', 'abcdefg1')).toBe(
      'Passwords do not match',
    );
  });
});

describe('validateAccountField — unknown id', () => {
  it('is permissive, so an unlisted field never blocks the screen', () => {
    expect(validateAccountField('nickname', '', '')).toBe(ok);
  });
});

describe('validateField — bizName', () => {
  it('names the field differently for a reseller and a company', () => {
    expect(validateField('bizName', '', true)).toBe('Business name is required');
    expect(validateField('bizName', '', false)).toBe('Company name is required');
  });

  it('rejects 1 character and accepts 2', () => {
    expect(validateField('bizName', 'A', false)).toBe('Must be at least 2 characters');
    expect(validateField('bizName', 'AB', false)).toBe(ok);
  });

  it('accepts 120 characters and rejects 121', () => {
    expect(validateField('bizName', 'a'.repeat(120), false)).toBe(ok);
    expect(validateField('bizName', 'a'.repeat(121), false)).toBe(
      'Must be 120 characters or fewer',
    );
  });

  it('needs at least one letter or digit', () => {
    expect(validateField('bizName', '--', false)).toBe('Enter a valid name');
    expect(validateField('bizName', '& Co', false)).toBe(ok);
  });
});

describe('validateField — website', () => {
  it('is optional', () => {
    expect(validateField('website', '', false)).toBe(ok);
    expect(validateField('website', '   ', false)).toBe(ok);
  });

  it('accepts a bare host and a full url', () => {
    expect(validateField('website', 'www.example.com', false)).toBe(ok);
    expect(validateField('website', 'https://example.co.uk/path', false)).toBe(ok);
  });

  it.each([
    ['no dot', 'notaurl'],
    ['contains a space', 'exa mple.com'],
    ['wrong scheme', 'ftp://example.com'],
    ['one-letter tld', 'example.c'],
  ])('rejects %s', (_label, value) => {
    expect(validateField('website', value, false)).toBe(
      'Enter a valid website, e.g. www.example.com',
    );
  });
});

describe('validateField — taxId', () => {
  it('requires a value', () => {
    expect(validateField('taxId', '', false)).toBe('VAT / tax ID is required');
  });

  const msg = 'Use 3–30 letters, numbers, spaces, dots, dashes or slashes';

  it('rejects 2 characters and accepts 3', () => {
    expect(validateField('taxId', 'AB', false)).toBe(msg);
    expect(validateField('taxId', 'AB1', false)).toBe(ok);
  });

  it('accepts 30 characters and rejects 31', () => {
    expect(validateField('taxId', 'A'.repeat(30), false)).toBe(ok);
    expect(validateField('taxId', 'A'.repeat(31), false)).toBe(msg);
  });

  it('must start alphanumeric but may contain separators', () => {
    expect(validateField('taxId', 'GB-123 456/78.9', false)).toBe(ok);
    expect(validateField('taxId', '-123456', false)).toBe(msg);
  });
});

describe('validateField — bizRole forks on sellerType', () => {
  it('is optional for both', () => {
    expect(validateField('bizRole', '', true)).toBe(ok);
    expect(validateField('bizRole', '', false)).toBe(ok);
  });

  it('asks a reseller for whole years, 1–2 digits', () => {
    expect(validateField('bizRole', '5', true)).toBe(ok);
    expect(validateField('bizRole', '12', true)).toBe(ok);
    expect(validateField('bizRole', '123', true)).toBe('Enter whole years, e.g. 5');
    expect(validateField('bizRole', 'five', true)).toBe('Enter whole years, e.g. 5');
  });

  it('asks a company for a job title', () => {
    expect(validateField('bizRole', 'Head of Lab Operations', false)).toBe(ok);
    expect(validateField('bizRole', '@@@', false)).toBe('Enter a valid job title');
    expect(validateField('bizRole', 'a'.repeat(81), false)).toBe('Must be 80 characters or fewer');
    expect(validateField('bizRole', 'a'.repeat(80), false)).toBe(ok);
  });

  it('means two different things for the same input — the same string passes one and fails the other', () => {
    // '7' is a valid reseller answer (years) and a valid company answer (title
    // chars). 'Head of Lab' is valid for a company and invalid for a reseller.
    expect(validateField('bizRole', 'Head of Lab', false)).toBe(ok);
    expect(validateField('bizRole', 'Head of Lab', true)).toBe('Enter whole years, e.g. 5');
  });
});

describe('validateField — street', () => {
  it('requires a value', () => {
    expect(validateField('street', '', false)).toBe('Street address is required');
  });

  it('rejects 4 characters and accepts 5', () => {
    expect(validateField('street', '1 Rd', false)).toBe('Enter the full street address');
    expect(validateField('street', '12 Rd', false)).toBe(ok);
  });

  it('accepts 150 characters and rejects 151', () => {
    expect(validateField('street', 'a'.repeat(150), false)).toBe(ok);
    expect(validateField('street', 'a'.repeat(151), false)).toBe(
      'Must be 150 characters or fewer',
    );
  });

  it('needs at least one letter or digit', () => {
    expect(validateField('street', '-----', false)).toBe('Enter a valid street address');
  });
});

describe('validateField — city', () => {
  it('requires a value', () => {
    expect(validateField('city', '', false)).toBe('City is required');
  });

  it('bounds the length at 2 and 80', () => {
    const msg = 'Enter a city between 2 and 80 characters';
    expect(validateField('city', 'A', false)).toBe(msg);
    expect(validateField('city', 'AB', false)).toBe(ok);
    expect(validateField('city', 'a'.repeat(80), false)).toBe(ok);
    expect(validateField('city', 'a'.repeat(81), false)).toBe(msg);
  });

  it('accepts accented and punctuated place names, rejects digits', () => {
    expect(validateField('city', 'São Paulo', false)).toBe(ok);
    expect(validateField('city', "Stoke-on-Trent", false)).toBe(ok);
    expect(validateField('city', 'City1', false)).toBe('City can only contain letters');
  });
});

describe('validateField — postal boundaries', () => {
  const msg = 'Enter a valid postal code (3–10 letters, numbers, spaces or dashes)';

  it('requires a value', () => {
    expect(validateField('postal', '', false)).toBe('Postal code is required');
  });

  it('rejects 2 characters and accepts 3', () => {
    expect(validateField('postal', 'AB', false)).toBe(msg);
    expect(validateField('postal', 'AB1', false)).toBe(ok);
  });

  it('accepts 10 characters and rejects 11', () => {
    expect(validateField('postal', '1'.repeat(10), false)).toBe(ok);
    expect(validateField('postal', '1'.repeat(11), false)).toBe(msg);
  });

  it('allows an inner space or dash but not a leading or trailing one', () => {
    expect(validateField('postal', 'SW1A 1AA', false)).toBe(ok);
    expect(validateField('postal', '123-456', false)).toBe(ok);
    // Trimmed first, so a surrounding space is fine…
    expect(validateField('postal', '  SW1A 1AA  ', false)).toBe(ok);
    // …but an inner edge separator is not.
    expect(validateField('postal', '-12345', false)).toBe(msg);
    expect(validateField('postal', '12345-', false)).toBe(msg);
  });
});

describe('validateField — region', () => {
  it('requires a value and bounds it at 2 and 80', () => {
    const msg = 'Enter a state / region between 2 and 80 characters';
    expect(validateField('region', '', false)).toBe('State / region is required');
    expect(validateField('region', 'A', false)).toBe(msg);
    expect(validateField('region', 'AB', false)).toBe(ok);
    expect(validateField('region', 'a'.repeat(80), false)).toBe(ok);
    expect(validateField('region', 'a'.repeat(81), false)).toBe(msg);
    expect(validateField('region', 'Region 9', false)).toBe(
      'State / region can only contain letters',
    );
  });
});

describe('validateField — country and unknown ids', () => {
  it('only needs a country to be chosen', () => {
    expect(validateField('country', '', false)).toBe('Select your country');
    expect(validateField('country', 'TH', false)).toBe(ok);
  });

  it('is permissive for a field it does not know, e.g. the optional bizPhone', () => {
    expect(validateField('bizPhone', '', false)).toBe(ok);
    expect(validateField('bizPhone', 'anything at all', false)).toBe(ok);
  });
});

describe('field groups stay in step with the validator', () => {
  it('validates every account field it lists', () => {
    // If a field is added to the screen but not to the switch, it can never
    // block — which is how a required field silently becomes optional.
    for (const id of ACCOUNT_FIELDS) {
      expect(validateAccountField(id, '', '')).not.toBe(ok);
    }
  });

  it('keeps REQUIRED_FIELDS a subset of the two field steps, and each one actually required', () => {
    const declared = [...BUSINESS_FIELDS, ...LOCATION_FIELDS] as string[];
    for (const id of REQUIRED_FIELDS) {
      expect(declared).toContain(id);
      expect(validateField(id, '', false)).not.toBe(ok);
    }
  });

  it('treats the fields NOT in REQUIRED_FIELDS as genuinely optional', () => {
    const optional = [...BUSINESS_FIELDS, ...LOCATION_FIELDS].filter(
      (id) => !REQUIRED_FIELDS.includes(id),
    );
    expect(optional).toEqual(['website', 'bizRole', 'bizPhone']);
    for (const id of optional) {
      expect(validateField(id, '', false)).toBe(ok);
      expect(validateField(id, '', true)).toBe(ok);
    }
  });
});

describe('VOLUME_OPTIONS — the stored value is opaque without sellerType', () => {
  it('forks the question on sellerType', () => {
    // The options carry KEYS now, for the same freeze-at-import reason as the
    // validators — so resolve each one through en.json and assert the copy.
    expect(VOLUME_OPTIONS.reseller.map((o) => enText(o.titleKey))).toEqual([
      'Under 25 items',
      '25–100 items',
      '100+ items',
    ]);
    expect(VOLUME_OPTIONS.company.map((o) => enText(o.titleKey))).toEqual([
      'Just a few items',
      'A lab clear-out',
      'Ongoing surplus',
    ]);
  });

  it('stores the SAME a/b/c for both forks — so the value means nothing alone', () => {
    expect(VOLUME_OPTIONS.reseller.map((o) => o.value)).toEqual(['a', 'b', 'c']);
    expect(VOLUME_OPTIONS.company.map((o) => o.value)).toEqual(['a', 'b', 'c']);
  });

  it('gives each value two different meanings, which is the whole hazard', () => {
    const meaning = (seller: 'reseller' | 'company', value: string) => {
      const key = VOLUME_OPTIONS[seller].find((o) => o.value === value)?.titleKey;
      return key ? enText(key) : undefined;
    };
    // Same stored 'b', two unrelated answers. Anything reading `volume` must
    // read `sellerType` in the same breath.
    expect(meaning('reseller', 'b')).toBe('25–100 items');
    expect(meaning('company', 'b')).toBe('A lab clear-out');
    expect(meaning('reseller', 'b')).not.toBe(meaning('company', 'b'));
  });

  it('offers the same number of choices either way, so the UI cannot tell them apart', () => {
    expect(VOLUME_OPTIONS.reseller).toHaveLength(VOLUME_OPTIONS.company.length);
  });
});

describe('CALIBRATION_OPTIONS and MOCK_CATEGORIES', () => {
  it('offers exactly the three calibration answers', () => {
    expect(CALIBRATION_OPTIONS.map((o) => o.value)).toEqual(['most', 'some', 'none']);
  });

  it('keeps category slugs unique — a duplicate would make toggle ambiguous', () => {
    const slugs = MOCK_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
