import { describe, it, expect } from '@jest/globals';
import { draftsEnabled, backgroundRecognitionEnabled } from '@/lib/flags';

describe('draft feature flags', () => {
  it('exposes boolean accessor functions', () => {
    expect(typeof draftsEnabled()).toBe('boolean');
    expect(typeof backgroundRecognitionEnabled()).toBe('boolean');
  });
});
