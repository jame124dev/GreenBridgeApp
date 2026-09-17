/**
 * Guideline 5.1.1(v) guard — features that must stay open to guests.
 *
 * App Review, 2026-08-24, rejecting build 1.0.3(21):
 *
 *   "The app requires users to register or log in to access features that are
 *    not account based… Registration can only be required for account-based
 *    features like adding to cart or checking out."
 *
 * `src/features/auth/signInPromptStore.ts` records the consequence: **browsing,
 * searching and the AI assistant are open to everyone.** Only genuinely
 * account-based actions may ask for an identity.
 *
 * This objection has already cost one review cycle, and the mistake is easy to
 * repeat: `requireAuth` is the right call on most buttons, so reaching for it
 * on a composer feels consistent rather than wrong. It happened again while
 * building the v2 assistant screen — the instruction to gate Send was mine.
 *
 * So the boundary is asserted, not remembered.
 *
 * ⚠️ `requireAuth('message', …)` is CORRECT on buyer↔seller messaging — that is
 * account-based, a seller has to know who is writing. It is WRONG on the AI
 * assistant. The distinction is the screen, not the reason code, which is why
 * this test names files rather than scanning for a pattern globally.
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/** Screens whose PRIMARY action must work without an account. */
const OPEN_SCREENS = [
  // The AI assistant. Shipped `app/(lab)/chat.tsx` does not gate sending; the
  // v2 port must not either.
  'app/v2/chat.tsx',
  'app/(lab)/chat.tsx',
];

function source(rel: string): string | null {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Strip comments — this file's own warnings mention the forbidden call. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Guideline 5.1.1(v) — non-account features stay open to guests', () => {
  it.each(OPEN_SCREENS)('%s does not gate the assistant behind an account', (rel) => {
    const src = source(rel);
    if (src === null) {
      // The screen has been renamed or removed. Update OPEN_SCREENS rather than
      // letting the guard silently pass on a file that no longer exists.
      throw new Error(
        `${rel} not found. If the assistant screen moved, update OPEN_SCREENS in this test.`,
      );
    }
    const hits = code(src)
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /requireAuth\(\s*['"]message['"]/.test(line))
      .map(({ line, n }) => `${rel}:${n}  ${line}`);

    expect(hits).toEqual([]);
  });

  it('the rule is still written down where the code can be audited against it', () => {
    // If this note is deleted, the reason for guest mode is lost and the gate
    // grows back. It is load-bearing documentation.
    const store = source('src/features/auth/signInPromptStore.ts');
    expect(store).not.toBeNull();
    expect(store).toContain('5.1.1(v)');
    expect(store).toMatch(/assistant are open to everyone/);
  });
});
