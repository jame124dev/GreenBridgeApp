import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/lib/flags', () => ({ draftsEnabled: () => false, SMART_DETECT_ENABLED: true }));
// Same seam as DetailFooter.saveDraft.test.tsx: the real hook reaches the axios
// client, which imports MMKV (a Nitro module with no jest binary). Approved
// seller here, so `canPublish` is never the reason a button is enabled.
jest.mock('@/features/seller/useSellerUpgrade', () => ({ useCanSell: () => true }));
jest.mock('@/features/seller/components/SellerApprovalNotice', () => ({
  useSubmitCtaLabel: (fallback: string) => fallback,
  SellerApprovalNotice: () => null,
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { V2ThemeProvider } from '@/theme/v2';
import { DetailFooter } from '@/features/scanner/components/detail/DetailFooter';

/** A 3-button navigation bar's inset — the case this footer was never tested in. */
const NAV_BAR_INSET = 48;
import type { RequiredStatus } from '@/features/scanner/requiredStatus';

/**
 * M-8 (the footer says what is missing) and M-9 (Submit answers instead of
 * greying out) were both wired in `DetailFooter`, and both were revertible with a
 * fully green suite before this file existed. The two assertions that matter:
 *
 *   - the single-mode Submit is PRESSABLE while required fields are missing.
 *     Reverting to `disabled={!allRequired}` reinstates the dead grey button
 *     (FooterButton.tsx:41 `#d4d8df`) with no explanation — the exact dead end
 *     Phase 5 exists to remove. `handleSubmit` + the zero-photos guard in
 *     `useDetailController` are what keep an invalid listing off the wire
 *     (covered by useDetailController.submit.test.tsx).
 *   - the strip is actually RENDERED when the screen passes `required` +
 *     `onPressRow`. `RequiredProgressStrip.test.tsx` proves the component works;
 *     this proves the footer mounts it.
 */
const rows = (missing: (keyof RequiredStatus['rows'])[] = []): RequiredStatus['rows'] => {
  const all: RequiredStatus['rows'] = {
    photos: true,
    title: true,
    description: true,
    category: true,
    condition: true,
    price: true,
    location: true,
  };
  for (const k of missing) all[k] = false;
  return all;
};

const incomplete: RequiredStatus = {
  rows: rows(['title', 'price']),
  doneCount: 5,
  total: 7,
  allComplete: false,
};

function renderFooter(overrides: Partial<React.ComponentProps<typeof DetailFooter>> = {}) {
  const props: React.ComponentProps<typeof DetailFooter> = {
    isGrouped: false,
    editingGroupedItem: false,
    queuedCount: 0,
    allRequired: false,
    submitting: false,
    onSubmitSingle: jest.fn(),
    onAddAnother: jest.fn(),
    onReviewGroup: jest.fn(),
    onSaveAndReturnToReview: jest.fn(),
    ...overrides,
  };
  /*
    ⚠️ `V2ThemeProvider` IS REQUIRED. The footer's buttons are the kit's
    `PrimaryAction` now, and every v2 primitive reads the theme through
    `useV2Theme`, which THROWS rather than falling back when no provider is
    mounted ("must be used inside <V2ThemeProvider>"). Rendering the component
    bare therefore fails at render, not at assert, and the error names the
    theme rather than the footer.

    `initialPreference="light"` pins the scheme so a colour assertion cannot
    depend on the host's dark-mode setting. Same wrapper the `app/(auth)` v2
    suites use.
  */
  return {
    /*
      `SafeAreaProvider` with EXPLICIT metrics, not the real one. The footer
      reads `useSafeAreaInsets()` to clear the Android navigation bar, and that
      hook THROWS without a provider ("No safe area value available"). Pinning
      `bottom: NAV_BAR_INSET` also makes the reserve assertable instead of
      whatever the host happens to report.
    */
    ...render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 400, height: 800 },
          insets: { top: 24, left: 0, right: 0, bottom: NAV_BAR_INSET },
        }}
      >
        <V2ThemeProvider initialPreference="light">
          <DetailFooter {...props} />
        </V2ThemeProvider>
      </SafeAreaProvider>,
    ),
    props,
  };
}

/** The CTA's label is `t('mobile.detail.submitListing')`; react-i18next is
 *  uninitialised under Jest, so a key with no defaultValue comes back as itself. */
const SUBMIT = /submitListing/;

describe('DetailFooter — M-9: Submit answers instead of greying out', () => {
  it('single-mode Submit is enabled and fires while required fields are missing', () => {
    const { getByLabelText, props } = renderFooter({ allRequired: false });
    const submit = getByLabelText(SUBMIT);
    expect(submit.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(submit);
    expect(props.onSubmitSingle).toHaveBeenCalled();
  });

  it('single-mode Submit is disabled ONLY while submitting', () => {
    const { getByLabelText, props } = renderFooter({ allRequired: true, submitting: true });
    const submit = getByLabelText(SUBMIT);
    expect(submit.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit);
    expect(props.onSubmitSingle).not.toHaveBeenCalled();
  });

  // §5.6: the grouped-mode buttons deliberately KEEP their disabled state — the
  // strip above them now names what is missing. Guards against over-correcting.
  it('grouped-mode buttons still require every row', () => {
    const { getByLabelText } = renderFooter({ isGrouped: true, allRequired: false });
    expect(getByLabelText(/addAnother/).props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText(/reviewGroup/).props.accessibilityState.disabled).toBe(true);
  });
});

describe('DetailFooter — M-8: the footer mounts the required-progress strip', () => {
  it('renders a chip per missing row and reports the tapped one', () => {
    const onPressRow = jest.fn();
    const { getByText } = renderFooter({ required: incomplete, onPressRow });
    // Labels come from `useRequiredRowLabel`'s English defaultValues.
    expect(getByText('Title')).toBeTruthy();
    fireEvent.press(getByText('Price'));
    expect(onPressRow).toHaveBeenCalledWith('price');
  });

  it('renders no strip when the screen passes no required status (grouped-edit footer)', () => {
    const { queryByText } = renderFooter({ required: undefined, onPressRow: undefined });
    expect(queryByText('Title')).toBeNull();
  });

  it('renders no chips once every row passes', () => {
    const { queryByText } = renderFooter({
      required: { rows: rows(), doneCount: 7, total: 7, allComplete: true },
      onPressRow: jest.fn(),
      allRequired: true,
    });
    expect(queryByText('Title')).toBeNull();
    expect(queryByText('Price')).toBeNull();
  });

  /*
    ── THE ANDROID NAVIGATION BAR ────────────────────────────────────────────

    This footer is the last thing on `app/scan/detail.tsx`, and that screen
    passes `scroll={false}` with no `footer` prop — so `Screen`'s own
    `bottomReserve` never reaches it (it is applied only to the footer PROP,
    the scroll content and the scroll indicators: `Screen.tsx:244,290,295`).
    The footer therefore has to reserve the inset itself.

    The app is edge-to-edge, which Android enforces from targetSdk 35, so the
    buttons draw BEHIND the system bar unless something insets them. Before
    this, the row had a flat `space.sm` (6dp): ~18dp into the gesture inset,
    ~42dp behind a 3-button bar.

    Asserted as "at least the inset", not an exact number, so the test pins the
    BEHAVIOUR and not the current spacing token.
  */
  it('reserves the navigation-bar inset so the buttons are not behind it', () => {
    const { toJSON } = renderFooter({ allRequired: true });

    /*
      Walk the rendered tree for ANY node reserving at least the inset, rather
      than locating the submit button by its label: this suite runs without
      i18n resources, so the button renders the raw key. The assertion is about
      layout, so it should not depend on copy at all.
    */
    const paddings: number[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { props?: { style?: unknown }; children?: unknown[] };
      const style = StyleSheet.flatten(n.props?.style) as { paddingBottom?: number } | undefined;
      if (typeof style?.paddingBottom === 'number') paddings.push(style.paddingBottom);
      (n.children ?? []).forEach(walk);
    };
    walk(toJSON());

    expect(Math.max(0, ...paddings)).toBeGreaterThanOrEqual(NAV_BAR_INSET);
  });
});
