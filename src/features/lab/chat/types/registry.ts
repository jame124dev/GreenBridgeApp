// Chat domain type — A4 §9/§11. Extension-point contracts: new content-part
// kinds and card types are added by REGISTERING a renderer, never by editing a
// component switch. Scoped to the chat feature.
//
// The render context (`ctx`) is intentionally `unknown` here; its concrete shape
// (`RenderCtx`/`CardCtx`) is defined alongside the components that own it
// (PR-8/PR-9) rather than invented now.
//
// UNUSED by production until PR-9 (cards) / later (content parts).
import type { ReactNode } from 'react';

import type { ContentPart } from './message';

export interface ContentPartRenderer<
  K extends ContentPart['kind'] = ContentPart['kind'],
> {
  kind: K;
  render(part: Extract<ContentPart, { kind: K }>, ctx: unknown): ReactNode;
}

export interface CardRendererEntry {
  /** A3 §10.4 open union — unknown types render nothing rather than crash. */
  type: string;
  render(data: unknown, ctx: unknown): ReactNode;
}
