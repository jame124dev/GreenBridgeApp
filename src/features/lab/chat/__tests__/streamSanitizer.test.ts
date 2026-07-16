import { describe, it, expect, jest } from '@jest/globals';

// Property/behavioral tests for the streaming-frame text safety module (D1/D2/
// D4). Three machine-checkable guarantees:
//   IDENTITY    — closed final text passes through sanitizeStreamTail untouched;
//   PREFIX      — for EVERY character prefix of a realistic answer, no streaming
//                 frame ever shows raw markdown syntax or a field-dump bullet;
//   CONVERGENCE — the settled frame is byte-identical to the committed render.
//
// parseBlocks is imported from ChatMessage (the real renderer's fence walk), so
// its module graph needs the same environment stubs the characterization test
// uses — we never render anything here.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const makeChain = () => {
    const fn = () => makeChain();
    return new Proxy(fn, { get: () => makeChain() });
  };
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: (c: unknown) => c },
    FadeIn: makeChain(),
    useReducedMotion: () => false,
  };
});
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});
jest.mock('@/animations/recipes', () => ({ usePop: () => undefined }));
jest.mock('@/features/lab/chat/ThinkingDots', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return { ThinkingDots: () => React_.createElement(View, { testID: 'thinking-dots' }) };
});
jest.mock('@/features/lab/chat/cardKit', () => ({ toolLabel: (n: string) => n }));
jest.mock('@/features/lab/chat/cards', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return { GhostButton: () => null, renderCard: (type: string) => React_.createElement(View, { testID: `card-${type}` }) };
});
jest.mock('@/components/ui', () => {
  const React_ = require('react');
  const { Image } = require('react-native');
  return { AppImage: (props: object) => React_.createElement(Image, props) };
});

import { resolveBotText, sanitizeStreamTail, streamSafeText } from '../streamSanitizer';
import { parseBlocks } from '../ChatMessage';

type Card = { type: string };

/** Realistic CLOSED final answers (each with the cards its turn carries). Kept
 *  free of trailing lone '*'/'!' — those single chars are deliberately held as
 *  ambiguous ("could open ** / !["), which is a streaming-only concern (the
 *  settled path bypasses the sanitizer entirely). */
const CORPUS: { name: string; text: string; cards?: Card[] }[] = [
  {
    name: 'bold prose',
    text: 'This is **bold** and another **strong** word.',
  },
  {
    name: 'link',
    text: 'See [the docs](https://greenbidz.com/docs) for details on shipping.',
  },
  {
    name: 'image with long GCS URL',
    text: 'Photo: ![unit](https://storage.googleapis.com/greenbidz-images/sellers/pump-1234-front.jpg) uploaded.',
  },
  {
    name: 'inline code',
    text: 'Run `pm2 restart` then check `pm2 status` for the result.',
  },
  {
    name: 'headings',
    text: '# Results\n## Top pick\n### Details\nAll three match your spec.',
  },
  {
    name: 'block quote',
    text: '> Trusted supplier since 2019\nQuoted from the seller profile.',
  },
  {
    name: 'bullets',
    text: '- first item\n- second item\n* third item',
  },
  {
    name: 'numbered list',
    text: '1. one thing\n2. two things\n10. ten things',
  },
  {
    name: 'code fence',
    text: 'Set it up like this:\n```python\nimport pandas as pd\nprint("ok")\n```\nThen run it.',
  },
  {
    name: 'draft field-dump + save prompt',
    text: "Your WTB draft is ready — here's the details:\n- **Item:** HPLC Pump\n- **Budget:** 1200 USD\nWould you like to save it?",
    cards: [{ type: 'wtb_draft' }],
  },
  {
    name: 'info-card bold bullets',
    text: 'I found two options:\n- **Nikon SMZ800N** in great shape\n- **Leica M80** refurbished\nBoth ship from the US.',
    cards: [{ type: 'product_list' }],
  },
  {
    name: 'plain prose',
    text: 'I found three matching centrifuges on the marketplace.',
  },
];

const FIELD_BULLET_RE = /^\s*[-*]\s+\*\*[^*]+:\*\*/; // mirrors the committed strip's shape
/** Complete link/image tokens — removed before scanning a line for leaks. */
const CLOSED_LINK_RE = /!?\[[^\]]*\]\([^)]*\)/g;

/** The machine-checkable form of "no frame ever shows raw syntax". */
function assertFrameClean(out: string, entry: { cards?: Card[] }) {
  const lines = out.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue; // code bodies stream verbatim by design
    // No unpaired bold marker on any painted line.
    expect((line.split('**').length - 1) % 2).toBe(0);
    // No unpaired inline-code backtick outside a fence.
    expect((line.split('`').length - 1) % 2).toBe(0);
    // No link/image token caught mid-close ("](…" without its ")") and no image
    // opener at all outside a completed token (raw GCS URLs must never leak).
    const residual = line.replace(CLOSED_LINK_RE, '');
    expect(residual).not.toMatch(/!?\[[^\]]*\]\(/);
    expect(residual).not.toMatch(/!\[/);
    // With a draft card, the field-dump shape must never paint (D4)…
    if (entry.cards?.some((c) => c.type === 'wtb_draft' || c.type === 'listing_draft')) {
      expect(FIELD_BULLET_RE.test(line)).toBe(false);
      // …nor the save prompt the committed strip removes.
      expect(line).not.toMatch(/would you like to/i);
    }
  }
}

describe('streamSanitizer — identity (closed text passes through untouched)', () => {
  it.each(CORPUS)('$name', ({ text }) => {
    expect(sanitizeStreamTail(text)).toBe(text);
  });
});

describe('streamSanitizer — prefix property (every frame is clean)', () => {
  it.each(CORPUS)('$name', (entry) => {
    for (let i = 1; i <= entry.text.length; i++) {
      const out = streamSafeText(entry.text.slice(0, i), entry.cards);
      assertFrameClean(out, entry);
    }
  });
});

describe('streamSanitizer — convergence (settled frame ≡ committed render)', () => {
  it.each(CORPUS)('$name', ({ text, cards }) => {
    expect(streamSafeText(text, cards, true)).toBe(resolveBotText(text, cards));
  });
});

describe('streamSanitizer — parseBlocks interaction (D2)', () => {
  it.each(CORPUS)('$name: no code block before its opener line is newline-complete; language never partial', (entry) => {
    for (let i = 1; i <= entry.text.length; i++) {
      const prefix = entry.text.slice(0, i);
      const blocks = parseBlocks(streamSafeText(prefix, entry.cards));
      for (const b of blocks) {
        if (b.type !== 'code') continue;
        // A code block may exist only once the raw prefix carries the full,
        // newline-terminated opener — and then with the FINAL language exactly
        // (never a growing 'p' → 'py' → 'python' label).
        expect(prefix).toContain('```python\n');
        expect(b.language).toBe('python');
      }
    }
  });
});

describe('streamSanitizer — targeted holds', () => {
  it('holds a fence opener until its newline arrives', () => {
    expect(sanitizeStreamTail('Intro\n`')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n``')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n```')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n```py')).toBe('Intro');
    // The newline releases it — the block (empty body) may mount now.
    expect(sanitizeStreamTail('Intro\n```py\n')).toBe('Intro\n```py\n');
  });

  it('drops a forming closing fence inside a code body, streams the body verbatim', () => {
    expect(sanitizeStreamTail('```py\ncode\n`')).toBe('```py\ncode');
    expect(sanitizeStreamTail('```py\ncode\n``')).toBe('```py\ncode');
    // A full closing fence is NOT a partial — it closes the block.
    expect(sanitizeStreamTail('```py\ncode\n```')).toBe('```py\ncode\n```');
    // Bodies are never held (odd backticks inside a fence are code, not tokens).
    expect(sanitizeStreamTail('```py\nconst x = `tpl')).toBe('```py\nconst x = `tpl');
  });

  it('holds "[sic]"-style plain brackets one frame, releases when no "(" follows', () => {
    expect(sanitizeStreamTail('It was [sic]')).toBe('It was ');
    expect(sanitizeStreamTail('It was [sic] w')).toBe('It was [sic] w');
  });

  it('holds bare list/heading/quote markers until content arrives', () => {
    expect(sanitizeStreamTail('Intro\n- ')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n1. ')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n> ')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n##')).toBe('Intro');
    expect(sanitizeStreamTail('Intro\n- f')).toBe('Intro\n- f');
  });

  it('save-prompt hold releases when the sentence ends in "." (matching committed)', () => {
    const cards = [{ type: 'wtb_draft' }];
    // In flight → held.
    expect(streamSafeText('Draft ready. Do you want to proc', cards)).toBe('Draft ready. ');
    // "." lands → the committed strip keeps it (only "?" prompts are stripped),
    // so the streaming frame paints it too.
    const done = 'Draft ready. Do you want to proceed.';
    expect(streamSafeText(done, cards)).toBe(done);
    expect(streamSafeText(done, cards, true)).toBe(resolveBotText(done, cards));
  });

  it('a lead-in-merged bullet marker never dangles after the prose (draft cards)', () => {
    const cards = [{ type: 'wtb_draft' }];
    // The lead-in replace merges "\n-" onto the prose line; the fragment is held.
    expect(streamSafeText("Your draft is ready — here's the details:\n-", cards)).toBe(
      'Your draft is ready —',
    );
    expect(streamSafeText("Your draft is ready — here's the details:\n- **It", cards)).toBe(
      'Your draft is ready —',
    );
    // Once the label closes, the whole bullet line is filtered — it never painted.
    expect(streamSafeText("Your draft is ready — here's the details:\n- **Item:** HPLC", cards)).toBe(
      'Your draft is ready —',
    );
  });
});

describe('streamSanitizer — review regressions (wf verify pass)', () => {
  it('holds a spaced fence opener ("``` pyt") instead of painting a raw "``" (MINOR-1)', () => {
    expect(sanitizeStreamTail('code:\n``` pyt')).toBe('code:');
    expect(sanitizeStreamTail('code:\n````')).toBe('code:');
  });
  it('holds the in-flight "Want t…" save-prompt with a draft card (MINOR-2a)', () => {
    const cards = [{ type: 'wtb_draft' }];
    expect(streamSafeText('Draft ready. Want t', cards).trimEnd()).toBe('Draft ready.');
  });
  it('holds the partial "here are the updated deta…" lead-in with a draft card (MINOR-2b)', () => {
    const cards = [{ type: 'wtb_draft' }];
    expect(streamSafeText('Done — here are the updated deta', cards).trimEnd()).toBe('Done —');
  });
  it('settle with a LAGGING reveal still sanitizes (MAJOR-1 contract: settled only when caught up)', () => {
    // StreamingMessage passes settled=false while revealed !== turn.text; this
    // locks the sanitizer side of that contract — unsettled partials stay held.
    expect(streamSafeText('and **bol', undefined, false).trimEnd()).toBe('and');
  });
});

describe('streamSanitizer — gap collapse (device nit: stacked gap Views)', () => {
  it('drops image-only lines so blank lines collapse to ONE paragraph gap', () => {
    // Exact prod payload shape: lead-in, numbered bold items with indented
    // sub-bullets and standalone image lines, then a closing sentence.
    const prod = [
      'Here are some HPLC systems currently available:',
      '',
      '1. **QuikScale GA 630 Chromatography Column System**',
      '   - **Condition:** Working',
      '   - **Country:** Taiwan',
      '   ![Image](https://greenbidz.com/wp-content/uploads/x.jpg)',
      '',
      '2. **GE BPG 200/950 Column System**',
      '   - **Condition:** Working',
      '   ![Image](https://greenbidz.com/wp-content/uploads/y.jpg)',
      '',
      "If you're interested in any of these, let me know!",
    ].join('\n');
    const cards = [{ type: 'product_list' }];
    expect(streamSafeText(prod, cards, true)).toBe(
      "Here are some HPLC systems currently available:\n\nIf you're interested in any of these, let me know!",
    );
  });
});
