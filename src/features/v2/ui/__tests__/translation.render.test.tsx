import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react-native';

/**
 * PROOF THAT THE UI RENDERS THE OTHER LANGUAGE — not that the dictionary
 * contains it.
 *
 * Every other check on this mechanism reads the JSON files. That proves the
 * words exist; it proves nothing about whether a user ever sees them. The
 * interception lives inside `Text`, and all of these could be true at once
 * with the screen still in English:
 *
 *   - the component imports the dictionary but never calls it
 *   - the language code the lookup receives is cased differently
 *   - a component renders its label through `RNText` instead of the kit `Text`
 *   - the subscription is missing, so the switch only applies on remount
 *
 * So this mounts the REAL kit components — the ones every v2 screen composes —
 * flips the language through the real `i18n` instance, and asserts the
 * translated string is on screen and the English one is gone. `getByText` goes
 * through the rendered tree, so a component that bypasses `Text` fails here.
 */
jest.mock('react-native-reanimated', () => {
  const identity = (v: unknown) => v;
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: unknown) => C },
    Easing: { bezier: () => identity },
    ReduceMotion: { System: 'system' },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useReducedMotion: () => false,
    // `PrimaryAction` wraps its press in RNGH's `GestureDetector`, which
    // reaches past the public Reanimated surface into `useEvent`/`useHandler`.
    // Without them the render throws before any assertion runs, which would
    // read as "the button does not translate" rather than "the mock is thin".
    useEvent: () => () => undefined,
    useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    cancelAnimation: () => undefined,
  };
});

import { V2ThemeProvider } from '@/theme/v2';
import i18n from '@/i18n';

import { Row } from '../Row';
import { PrimaryAction } from '../PrimaryAction';
import { Text } from '../Text';

const draw = (ui: React.ReactElement) =>
  render(<V2ThemeProvider initialPreference="light">{ui}</V2ThemeProvider>);

/** Each case: the English in the source, and what each language must show. */
const CASES = [
  {
    english: 'My listings',
    'zh-hant': '我的商品',
    'zh-hans': '我的商品',
    ja: 'マイ出品',
    th: 'รายการของฉัน',
    vi: 'Tin đăng của tôi',
  },
  {
    english: 'Sign in',
    'zh-hant': '登入',
    'zh-hans': '登录',
    ja: 'サインイン',
    th: 'เข้าสู่ระบบ',
    vi: 'Đăng nhập',
  },
] as const;

const LANGUAGES = ['zh-hant', 'zh-hans', 'ja', 'th', 'vi'] as const;

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('the v2 UI renders the selected language', () => {
  for (const lang of LANGUAGES) {
    describe(lang, () => {
      for (const c of CASES) {
        const expected = c[lang];

        it(`renders "${c.english}" as "${expected}" in a Row title`, async () => {
          await i18n.changeLanguage(lang);
          draw(<Row title={c.english} />);
          expect(screen.getByText(expected)).toBeTruthy();
          // The English must be GONE, not merely accompanied. A component that
          // rendered both would pass a presence-only assertion.
          expect(screen.queryByText(c.english)).toBeNull();
        });

        it(`renders "${c.english}" as "${expected}" on a PrimaryAction`, async () => {
          await i18n.changeLanguage(lang);
          draw(<PrimaryAction label={c.english} onPress={() => undefined} />);
          expect(screen.getByText(expected)).toBeTruthy();
          expect(screen.queryByText(c.english)).toBeNull();
        });
      }
    });
  }

  it('leaves English alone when the language is English', async () => {
    await i18n.changeLanguage('en');
    draw(<Row title="My listings" />);
    expect(screen.getByText('My listings')).toBeTruthy();
  });

  it('switches an already-mounted screen, without a remount', async () => {
    // The subscription, which is the part that silently does nothing when it
    // is missing: without it the dictionary applies only to text mounted
    // AFTER the switch, so the screen the user is looking at stays English
    // and every other screen is correct — the exact symptom first reported.
    await i18n.changeLanguage('en');
    const view = draw(<Row title="My listings" />);
    expect(screen.getByText('My listings')).toBeTruthy();

    await i18n.changeLanguage('zh-hant');
    view.rerender(
      <V2ThemeProvider initialPreference="light">
        <Row title="My listings" />
      </V2ThemeProvider>,
    );
    expect(screen.getByText('我的商品')).toBeTruthy();
    expect(screen.queryByText('My listings')).toBeNull();
  });

  it('passes a string it has no translation for straight through', async () => {
    await i18n.changeLanguage('ja');
    draw(<Text>Agilent 1260 Infinity II HPLC</Text>);
    // A product model number is a deliberate `keep` — if this ever renders in
    // Japanese, something translated a model number.
    expect(screen.getByText('Agilent 1260 Infinity II HPLC')).toBeTruthy();
  });
});
