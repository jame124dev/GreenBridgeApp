// CardRegistry (A4 §9) — the extension seam for chat response cards. A new card
// type is a `register(type, renderer)` call, never an edit to a `switch`. The
// dispatcher (`renderCard` in cards.tsx) resolves a renderer by wire `type`;
// unknown types resolve to `undefined` so the caller renders the dev-only
// fallback (A3 §10.4 open union — unknown cards are ignorable, never fatal).
//
// Generic over the render-context type so the registry has no dependency on the
// concrete card props/components (they register INTO it) — keeps the module
// acyclic and reusable.
import type React from 'react';

export type CardRenderer<Ctx> = (props: Ctx) => React.ReactElement | null;

export class CardRegistry<Ctx> {
  private readonly renderers = new Map<string, CardRenderer<Ctx>>();

  /** Register a renderer for a wire `type`. Chainable. Last registration wins. */
  register(type: string, renderer: CardRenderer<Ctx>): this {
    this.renderers.set(type, renderer);
    return this;
  }

  /** Register many at once (object form) — chainable. */
  registerAll(entries: Record<string, CardRenderer<Ctx>>): this {
    for (const [type, renderer] of Object.entries(entries)) this.renderers.set(type, renderer);
    return this;
  }

  /** Resolve a renderer, or `undefined` for an unknown/forward-compat type. */
  resolve(type: string): CardRenderer<Ctx> | undefined {
    return this.renderers.get(type);
  }

  /** True if a renderer is registered for `type`. */
  has(type: string): boolean {
    return this.renderers.has(type);
  }
}
