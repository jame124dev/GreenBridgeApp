// Navigation policy for the marketplace WebView.
//
// Regression cover for the iOS "listing opens Google Maps by itself" bug: the
// 101 Lab listing page embeds a `maps.google.com` map <iframe> for the item's
// location, iOS asks the host app to approve subframe navigations too, and the
// old policy handed anything non-marketplace to `Linking.openURL` — so simply
// opening a listing with a location launched the Maps app.
import { describe, expect, it } from '@jest/globals';

import { isInternalUrl, marketplaceNavDecision } from '../navPolicy';

describe('marketplaceNavDecision — subframes (iframes)', () => {
  it('renders the listing page map iframe in place instead of launching Maps', () => {
    expect(
      marketplaceNavDecision({
        // An iframe navigation: not the top frame, but it HAS a target frame.
        url: 'https://maps.google.com/maps?q=Tokyo%2C%20Japan&z=14&output=embed',
        isTopFrame: false,
        hasTargetFrame: true,
      }),
    ).toEqual({ allow: true, openExternally: null });
  });

  it('still opens a target="_blank" tap externally (no target frame)', () => {
    // The listing's own "Open in Maps" button is `<a target="_blank">`. iOS can
    // report it with isTopFrame:false, but targetFrame is nil — it is a user
    // action, not page content, so it must reach the OS.
    expect(
      marketplaceNavDecision({
        url: 'https://www.google.com/maps/search/?api=1&query=Tokyo',
        isTopFrame: false,
        hasTargetFrame: false,
      }),
    ).toEqual({
      allow: false,
      openExternally: 'https://www.google.com/maps/search/?api=1&query=Tokyo',
    });
  });

  it('defaults to the safe subframe rule when hasTargetFrame is absent', () => {
    expect(
      marketplaceNavDecision({ url: 'https://maps.google.com/maps?output=embed', isTopFrame: false }),
    ).toEqual({ allow: true, openExternally: null });
  });

  it('never escalates a subframe to the OS, whatever the host', () => {
    for (const url of [
      'https://www.google.com/maps/embed?pb=abc',
      'https://www.youtube.com/embed/xyz',
      'https://www.googletagmanager.com/ns.html?id=GTM-X',
      'about:blank',
      'data:text/html,<p>hi</p>',
      'blob:https://101lab.co/1234',
    ]) {
      expect(
        marketplaceNavDecision({ url, isTopFrame: false, hasTargetFrame: true }).openExternally,
      ).toBeNull();
    }
  });

  it('refuses an app-launching scheme in a subframe without opening it', () => {
    for (const url of [
      'maps://?q=Tokyo',
      'comgooglemaps://?q=Tokyo',
      'geo:35.6,139.7',
      'tel:+81312345678',
      'itms-apps://apple.com/app/id123',
    ]) {
      expect(marketplaceNavDecision({ url, isTopFrame: false, hasTargetFrame: true })).toEqual({
        allow: false,
        openExternally: null,
      });
    }
  });
});

describe('marketplaceNavDecision — top-level navigation', () => {
  it('keeps the marketplace itself in the WebView', () => {
    for (const url of [
      'https://101lab.co/buyer-marketplace?app=1',
      'https://101lab.co/buyer-marketplace/1234?app=1',
      'https://staging-lab.greenbidz.com/buyer-marketplace',
      'about:blank',
    ]) {
      expect(marketplaceNavDecision({ url, isTopFrame: true })).toEqual({
        allow: true,
        openExternally: null,
      });
    }
  });

  it('still hands a tapped external link to the OS', () => {
    expect(
      marketplaceNavDecision({
        url: 'https://www.google.com/maps/search/?api=1&query=Tokyo',
        isTopFrame: true,
      }),
    ).toEqual({
      allow: false,
      openExternally: 'https://www.google.com/maps/search/?api=1&query=Tokyo',
    });

    expect(marketplaceNavDecision({ url: 'mailto:a@b.co', isTopFrame: true }).openExternally).toBe(
      'mailto:a@b.co',
    );
  });

  it('treats a missing isTopFrame as top-level (Android never sends the field)', () => {
    // Android's RNCWebViewClient.createWebViewEvent omits `isTopFrame` and only
    // reports main-frame navigations, so Android must keep its old behaviour.
    expect(marketplaceNavDecision({ url: 'https://101lab.co/buyer-marketplace' })).toEqual({
      allow: true,
      openExternally: null,
    });
    expect(marketplaceNavDecision({ url: 'https://linkedin.com/x' })).toEqual({
      allow: false,
      openExternally: 'https://linkedin.com/x',
    });
  });
});

describe('isInternalUrl', () => {
  it('accepts the marketplace hosts and rejects everyone else', () => {
    expect(isInternalUrl('https://101lab.co/x')).toBe(true);
    expect(isInternalUrl('https://www.101lab.co/x')).toBe(true);
    expect(isInternalUrl('https://greenbidz.com/x')).toBe(true);
    expect(isInternalUrl('https://testapi.greenbidz.com/x')).toBe(true);
    expect(isInternalUrl('https://maps.google.com/maps')).toBe(false);
    expect(isInternalUrl('tel:+123')).toBe(false);
  });
});
