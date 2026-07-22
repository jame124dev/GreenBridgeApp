import type { ApprovalState } from '@/stores/authStore';

/**
 * Turns the backend's raw approval facts (ApprovalState) into the visible
 * "Awaiting approval" checklist — which step is done, needs action, is still
 * waiting, or is under review — plus the overall screen mood. Pure + unit
 * tested; the screen only maps keys/states → icons + copy.
 */
export type StepState = 'done' | 'review' | 'action' | 'wait';
export type StepKey = 'account' | 'email' | 'documents' | 'review';
export type Overall = 'approved' | 'action' | 'review';

export interface ChecklistStep {
  key: StepKey;
  state: StepState;
}
export interface ApprovalChecklist {
  overall: Overall;
  steps: ChecklistStep[];
  doneCount: number;
  totalCount: number;
}

export function deriveApprovalChecklist(a: ApprovalState | null): ApprovalChecklist {
  const approved = a?.status === 'approved';
  // Email gate is disabled server-side; default to verified when unknown so we
  // never nag about a step that isn't enforced.
  const emailOk = a ? a.email_verified : true;
  // Only sellers submit documents for approval; buyers/admins don't.
  const docsRequired = a?.role === 'seller';
  const docsOk = !docsRequired || !!a?.documents?.business_registration;

  const steps: ChecklistStep[] = [
    { key: 'account', state: 'done' },
    { key: 'email', state: approved || emailOk ? 'done' : 'action' },
  ];
  if (docsRequired) {
    steps.push({ key: 'documents', state: approved || docsOk ? 'done' : 'action' });
  }

  const prereqsMet = emailOk && docsOk;
  // Admin review is the final gate: done when approved, actively "in review"
  // once the prerequisites are in, else locked ("waiting") until they are.
  const reviewState: StepState = approved ? 'done' : prereqsMet ? 'review' : 'wait';
  steps.push({ key: 'review', state: reviewState });

  const overall: Overall = approved ? 'approved' : prereqsMet ? 'review' : 'action';
  const doneCount = steps.filter((s) => s.state === 'done').length;

  return { overall, steps, doneCount, totalCount: steps.length };
}
