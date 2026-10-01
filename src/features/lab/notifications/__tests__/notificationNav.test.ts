import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

/**
 * The regression this guards: every route here used to be a `(lab)` route, so
 * tapping a notification on a v2 build dropped the user into the PREVIOUS UI.
 * Found on the device 2026-10-01 — a chat notification opened the old deals
 * screen, complete with the old tab bar.
 *
 * `V2_UI_ENABLED` is read from the environment at module load, so each case
 * sets the flag and re-imports with a reset registry. Setting it afterwards
 * would have no effect and the test would silently assert one branch twice.
 */
function loadWithV2(enabled: boolean) {
  jest.resetModules();
  process.env.EXPO_PUBLIC_V2_UI = enabled ? '1' : '0';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/features/lab/notifications/notificationNav')
    .routeForType as (type: string) => string | null;
}

const original = process.env.EXPO_PUBLIC_V2_UI;
beforeEach(() => {
  jest.resetModules();
});
afterEach(() => {
  process.env.EXPO_PUBLIC_V2_UI = original;
});

describe('routeForType — v2 build', () => {
  it('sends every known type to a v2 screen, never into (lab)', () => {
    const routeForType = loadWithV2(true);
    const types = [
      'chat',
      'recognition_draft_ready',
      'Bid Accepted',
      'Offer Accepted',
      'Listing Approved',
      'Auction Group Approved',
      'payment_received',
      'order_created',
      'order_status_updated',
    ];
    for (const t of types) {
      const route = routeForType(t);
      expect(route).toBeTruthy();
      // The actual bug: a legacy path reachable from the new UI.
      expect(route).not.toMatch(/^\/\(lab\)/);
      expect(route).toMatch(/^\/v2\//);
    }
  });

  it('keeps each destination meaning the same as before', () => {
    const routeForType = loadWithV2(true);
    expect(routeForType('chat')).toBe('/v2/messages');
    expect(routeForType('recognition_draft_ready')).toBe('/v2/drafts');
    expect(routeForType('Bid Accepted')).toBe('/v2/matches');
    expect(routeForType('Listing Approved')).toBe('/v2/listings');
  });

  it('still returns null for an unknown type', () => {
    expect(loadWithV2(true)('something_else')).toBeNull();
  });
});

describe('routeForType — legacy build', () => {
  it('keeps the old routes when v2 is off', () => {
    const routeForType = loadWithV2(false);
    expect(routeForType('chat')).toBe('/(lab)/(tabs)/deals');
    expect(routeForType('recognition_draft_ready')).toBe('/scan/drafts');
    expect(routeForType('Bid Accepted')).toBe('/(lab)/(tabs)/matches');
    expect(routeForType('Listing Approved')).toBe('/(lab)/(tabs)/listings');
  });
});
