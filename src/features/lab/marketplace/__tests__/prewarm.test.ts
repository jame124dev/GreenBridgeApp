// Unit tests for the background-prewarm decision + once-per-session guard.
import { beforeEach, describe, expect, it } from '@jest/globals';

import { markWarmed, resetPrewarmForTest, shouldPrewarm } from '../prewarm';

describe('shouldPrewarm', () => {
  beforeEach(() => resetPrewarmForTest());

  it('warms when enabled + authed + not yet warmed', () => {
    expect(shouldPrewarm({ authed: true, enabled: true })).toBe(true);
  });

  it('does not warm when the flag is disabled', () => {
    expect(shouldPrewarm({ authed: true, enabled: false })).toBe(false);
  });

  it('does not warm when the user is not authed', () => {
    expect(shouldPrewarm({ authed: false, enabled: true })).toBe(false);
  });

  it('warms at most once per session (guard set by markWarmed)', () => {
    expect(shouldPrewarm({ authed: true, enabled: true })).toBe(true);
    markWarmed();
    expect(shouldPrewarm({ authed: true, enabled: true })).toBe(false);
  });

  it('resetPrewarmForTest clears the guard', () => {
    markWarmed();
    expect(shouldPrewarm({ authed: true, enabled: true })).toBe(false);
    resetPrewarmForTest();
    expect(shouldPrewarm({ authed: true, enabled: true })).toBe(true);
  });

  it('defaults `enabled` to the build flag when omitted (on by default)', () => {
    // EXPO_PUBLIC_MARKETPLACE_PREWARM is unset in the test env → flag is ON.
    expect(shouldPrewarm({ authed: true })).toBe(true);
  });
});
