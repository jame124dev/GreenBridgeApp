import { describe, it, expect } from '@jest/globals';

import { buildGuestGuardJS } from '../webAuthBridge';

/**
 * Tests the JS that is INJECTED INTO THE WEBVIEW, by running it against a stub
 * DOM. Nothing else covers it, and on-device verification kept being ambiguous:
 * the marketplace page is still lazy-loading images while the screenshot is
 * taken, so a scripted tap lands on a different control than the one that was
 * under those coordinates a second earlier. Twice that made the prompt say
 * "message sellers" when the intent was "Make Offer", and twice I could not tell
 * whether the interceptor had matched the wrong rule or simply been missed.
 *
 * This pins the mapping directly: given a control with this label, the guard must
 * post this action. No emulator, no timing.
 */
type Posted = { type: string; action?: string };

function runGuard(label: string, tagName = 'BUTTON') {
  const posted: Posted[] = [];
  const listeners: Record<string, ((ev: unknown) => void)[]> = {};

  const el = {
    tagName,
    innerText: label,
    textContent: label,
    getAttribute: () => null,
    closest: () => el,
    parentElement: null,
    style: {} as Record<string, string>,
  };

  let prevented = false;
  const ev = {
    target: el,
    preventDefault: () => { prevented = true; },
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
  };

  const sandbox = {
    window: {
      __gbGuestGuard: undefined as unknown,
      ReactNativeWebView: {
        postMessage: (s: string) => posted.push(JSON.parse(s) as Posted),
      },
      getComputedStyle: () => ({ position: 'static' }),
    },
    document: {
      addEventListener: (t: string, fn: (e: unknown) => void) => {
        (listeners[t] ||= []).push(fn);
      },
      querySelectorAll: () => [] as unknown[],
      body: null,
    },
    MutationObserver: class {
      observe() {}
    },
    setTimeout: () => 0,
    history: { back: () => {} },
  };

  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'document', 'MutationObserver', 'setTimeout', 'history',
    buildGuestGuardJS());
  fn(sandbox.window, sandbox.document, sandbox.MutationObserver, sandbox.setTimeout, sandbox.history);

  // The guard must intercept the EARLIEST pointer event: the site opens its
  // dialog from a pointerdown handler, so a click-only capture is too late.
  expect(Object.keys(listeners)).toContain('pointerdown');
  listeners.pointerdown.forEach((l) => l(ev));

  return { posted, prevented };
}

describe('guest guard: gated control -> native prompt reason', () => {
  it.each([
    ['Message Seller', 'message'],
    ['Make Offer', 'offer'],
    ['Buy Now', 'offer'],
    ['Place Bid', 'offer'],
    ['Add to Favourites', 'want'],
  ])('%s maps to "%s"', (label, action) => {
    const { posted, prevented } = runGuard(label);
    expect(posted).toEqual([{ type: 'auth-required', action }]);
    // The site's own handler must never run, or its "Company Email" modal opens.
    expect(prevented).toBe(true);
  });

  it('leaves ungated controls alone', () => {
    const { posted, prevented } = runGuard('View all photos');
    expect(posted).toEqual([]);
    expect(prevented).toBe(false);
  });

  it('reads whitespace-collapsed text, as the DOM renders it', () => {
    // "Message\n  Seller" is how the real button wraps on a narrow screen.
    const { posted } = runGuard('Message\n  Seller');
    expect(posted).toEqual([{ type: 'auth-required', action: 'message' }]);
  });
});
