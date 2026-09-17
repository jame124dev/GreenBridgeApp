/**
 * What the sign-in gate says, per reason.
 *
 * Extracted so the shipped prompt (`SignInPrompt`) and the v2 sheet
 * (`features/v2/auth/SignInSheet`) cannot drift apart. There is one gate in
 * this app and it must say one thing; two copies of this table would be two
 * different products the day someone edits one of them.
 *
 * The `t()` keys are `mobile.auth.gate.<reason>.title|body` — these strings are
 * the defaults, and the four locales override them where translated.
 */
import type { GateReason } from './signInPromptStore';

export const GATE_COPY: Record<GateReason, { title: string; body: string }> = {
  message: {
    title: 'Sign in to message sellers',
    body: 'Conversations are tied to your account, so you can pick them up again on any device.',
  },
  want: {
    title: 'Sign in to save what you need',
    body: "We'll match it against equipment as it arrives and let you know.",
  },
  sell: {
    title: 'Sign in to list equipment',
    body: 'Listings belong to a seller account, so we know who to send buyers to.',
  },
  notifications: {
    title: 'Sign in to see your alerts',
    body: 'Matches, offers and messages all arrive here once you have an account.',
  },
  account: {
    title: 'Sign in to your account',
    body: 'Your listings, saved searches and messages live here.',
  },
  draft: {
    title: 'Sign in to save this draft',
    body: 'Drafts are kept against your account so you can finish them later.',
  },
  offer: {
    title: 'Sign in to make an offer',
    body: 'Offers are tied to your account so the seller can reply to you.',
  },
};
