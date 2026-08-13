/**
 * Device-reproduced bug, 2026-08-13: sending a photo with no caption from the
 * Home composer in BUY mode opened the chat completely blank — no image, no user
 * bubble, just a spinner. Root cause: the seed was keyed on `?q=` text only, so an
 * image-only send (empty `q`) seeded nothing.
 */
import { describe, it, expect } from '@jest/globals';

import { buildSeedMessages } from '../seedMessages';

const IMG = { uri: 'file:///tmp/a.jpg', isImage: true, name: 'a.jpg' };
const DOC = { uri: 'file:///tmp/spec.pdf', isImage: false, name: 'spec.pdf' };

describe('buildSeedMessages', () => {
  it('seeds the image-only send that used to vanish (THE BUG)', () => {
    const msgs = buildSeedMessages('', [IMG], 111);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].attachments).toEqual([IMG]);
  });

  it('still seeds a text-only send exactly as before', () => {
    const msgs = buildSeedMessages('centrifuge under 5000', [], 111);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toEqual([{ kind: 'text', text: 'centrifuge under 5000' }]);
    // Shape must match the in-chat path: absent, not an empty array.
    expect(msgs[0].attachments).toBeUndefined();
  });

  it('seeds text AND attachments together', () => {
    const msgs = buildSeedMessages('what is this?', [IMG, DOC], 111);
    expect(msgs[0].content).toEqual([{ kind: 'text', text: 'what is this?' }]);
    expect(msgs[0].attachments).toEqual([IMG, DOC]);
  });

  it('seeds a document-only send', () => {
    expect(buildSeedMessages('', [DOC], 111)[0].attachments).toEqual([DOC]);
  });

  it('seeds nothing for a cold open (no text, no attachments)', () => {
    expect(buildSeedMessages('', [], 111)).toEqual([]);
  });

  it('does not alias the caller’s array', () => {
    const atts = [IMG];
    const msgs = buildSeedMessages('', atts, 111);
    atts.push(DOC);
    expect(msgs[0].attachments).toHaveLength(1);
  });
});
