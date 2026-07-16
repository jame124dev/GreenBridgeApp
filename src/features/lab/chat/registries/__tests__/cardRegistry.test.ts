import { describe, it, expect } from '@jest/globals';

import { CardRegistry } from '../cardRegistry';

// PR-9 (A4 §9/§13): adding a card type is a registration, not a switch edit;
// unknown types resolve to undefined (caller renders nothing — never crashes).
type Ctx = { label: string };
const renderer = (name: string) => (c: Ctx) => ({ name, label: c.label }) as never;

describe('CardRegistry', () => {
  it('registers and resolves a type', () => {
    const r = new CardRegistry<Ctx>().register('product', renderer('product'));
    expect(r.has('product')).toBe(true);
    expect(r.resolve('product')).toBeDefined();
  });

  it('resolves an unregistered type to undefined (forward-compat, no throw)', () => {
    const r = new CardRegistry<Ctx>();
    expect(r.has('nope')).toBe(false);
    expect(r.resolve('nope')).toBeUndefined();
  });

  it('registerAll adds many; last registration wins', () => {
    const first = renderer('a');
    const second = renderer('b');
    const r = new CardRegistry<Ctx>().registerAll({ x: first, y: second }).register('x', second);
    expect(r.resolve('x')).toBe(second); // overridden
    expect(r.resolve('y')).toBe(second);
  });

  it('a mock/future type renders with only a registry entry (no dispatcher edit)', () => {
    const r = new CardRegistry<Ctx>();
    expect(r.has('citations')).toBe(false);
    r.register('citations', renderer('citations'));
    expect(r.resolve('citations')).toBeDefined();
  });
});
