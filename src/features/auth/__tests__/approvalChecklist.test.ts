import { describe, it, expect } from '@jest/globals';
import { deriveApprovalChecklist } from '@/features/auth/approvalChecklist';
import type { ApprovalState } from '@/stores/authStore';

const seller = (over: Partial<ApprovalState> = {}): ApprovalState => ({
  status: 'pending',
  role: 'seller',
  email_verified: true,
  documents: { business_registration: true, waste_disposal: true },
  ...over,
});

describe('deriveApprovalChecklist', () => {
  it('seller, everything submitted → under review (3 of 4 done)', () => {
    const c = deriveApprovalChecklist(seller());
    expect(c.overall).toBe('review');
    expect(c.totalCount).toBe(4);
    expect(c.doneCount).toBe(3);
    expect(c.steps.find((s) => s.key === 'review')?.state).toBe('review');
  });

  it('seller missing docs + unverified email → action needed, review locked', () => {
    const c = deriveApprovalChecklist(
      seller({ status: 'profile_incomplete', email_verified: false, documents: { business_registration: false, waste_disposal: false } }),
    );
    expect(c.overall).toBe('action');
    expect(c.steps.find((s) => s.key === 'email')?.state).toBe('action');
    expect(c.steps.find((s) => s.key === 'documents')?.state).toBe('action');
    expect(c.steps.find((s) => s.key === 'review')?.state).toBe('wait');
    expect(c.doneCount).toBe(1); // only "account"
  });

  it('approved → every step done', () => {
    const c = deriveApprovalChecklist(seller({ status: 'approved' }));
    expect(c.overall).toBe('approved');
    expect(c.doneCount).toBe(4);
    expect(c.steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('buyer has no documents step', () => {
    const c = deriveApprovalChecklist({
      status: 'pending',
      role: 'buyer',
      email_verified: true,
      documents: { business_registration: false, waste_disposal: false },
    });
    expect(c.steps.some((s) => s.key === 'documents')).toBe(false);
    expect(c.totalCount).toBe(3);
    expect(c.overall).toBe('review');
  });

  it('null approval → safe under-review default (no false nags)', () => {
    const c = deriveApprovalChecklist(null);
    expect(c.overall).toBe('review');
    expect(c.steps.find((s) => s.key === 'email')?.state).toBe('done');
  });
});
