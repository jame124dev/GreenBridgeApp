# Mobile AI-Scan: Save-as-Draft + Continue-in-Background — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the two web AI-scan features — **Save as draft** (with a resumable drafts list) and **Continue in background** (a detached recognition job you can leave and reattach to) — to the GreenBridge mobile app, across **both** the seller `(tabs)/scan` flow and the customer `(lab)` flow, built on one shared foundation.

**Architecture:** A shared, flow-agnostic foundation (draft REST client + React Query hooks, a background recognition-job client over SSE, an MMKV job-id store, and a `pending-ai` payload contract) is built once. Each flow then wires a "Save as draft" action, a shared Drafts list surface, a resume/hydrate path, and a "Continue in background" affordance + reattach-on-return effect on top of it. The `pending-ai` draft payload is the join between the two features: a finished background job persists as a `pending-ai` draft that shows up in the same drafts list and resumes into review.

**Tech Stack:** React Native + Expo (expo-router), TypeScript, `@tanstack/react-query@5`, Zustand + MMKV, `react-native-sse` (`RNEventSource`), axios (`greenbidz` client), `i18next`, Jest (`jest-expo`).

## Global Constraints

- **Both backends already exist on prod** — do NOT build server code. Endpoints: `POST/GET/PUT/DELETE /drafts`, `PATCH /drafts/:id/published`, and `POST/GET /recognition-jobs`, `GET /recognition-jobs/:id/stream`. All are under the Node `greenbidz` client base URL (`GREENBIDZ_API_URL`, which already targets the `/api/v1` root).
- **Auth is automatic** on the `greenbidz` axios client: the request interceptor (`src/api/interceptors.ts:13-19`) attaches `Authorization: Bearer <accessToken>` + `x-refresh-token` from SecureStore, and `x-platform` + `x-system-key` are baked into the client. Never hand-roll auth for Node calls — use `greenbidz.*`. (The drafts endpoint accepts a seller Bearer token OR `x-drafts-key`; mobile uses Bearer.)
- **Feature flags, opt-in, default OFF**, following `src/lib/flags.ts` convention (`process.env.EXPO_PUBLIC_* === '1'`): add `EXPO_PUBLIC_DRAFTS` → `DRAFTS_ENABLED` and `EXPO_PUBLIC_BACKGROUND_RECOGNITION` → `BACKGROUND_RECOGNITION_ENABLED`. `EXPO_PUBLIC_*` inlines at bundle time — **restart Metro after changing `.env`** (`CI=1 npx expo start --dev-client`, watcher crashes otherwise).
- **i18n:** every user-facing string is a `t('mobile.<section>.<key>')` key added to ALL SIX locale files — `src/i18n/locales/{en,zh-Hant,zh-Hans,ja,th,vi}.json` — English first (it is the fallback). Scanner strings live under `mobile.detail.*` / `mobile.processing.*`; lab strings under `mobile.labDraft.*`; new drafts strings under a new `mobile.drafts.*` block.
- **Tests:** `npm test` (Jest, `jest-expo`). Tests live in `__tests__/` next to source. Import test globals from `@jest/globals`. Mock MMKV inline per the pattern in `src/stores/__tests__/scanDraftStore.test.ts:23-32`. SSE modules take an injectable `eventSourceFactory` seam so tests feed a fake `EventSource` (see `src/features/scanner/__tests__/smartDetectStream.test.ts`).
- **`pending-ai` payload contract** (shared): a draft with `payload.kind === 'pending-ai'` carries `{ kind:'pending-ai', result: SmartDetectionResponse, imagesOrdered: {url,objectName}[], language, mode }`. Both flows produce and consume this exact shape.
- **Push-tap deep-linking does not exist yet** — only in-app socket toasts route (via `routeForType` in `src/features/lab/notifications/notificationNav.ts`). Task 14 adds the OneSignal notification-click listener; until then, completion surfacing is the in-app socket toast + the drafts list.
- **No `git add -A`** — stage explicit file lists only. Run Metro with `CI=1`.

---

## File Structure

**New — shared foundation (`src/services/drafts/`, `src/services/scanner/`, `src/stores/`):**
- `src/services/drafts/draftApi.ts` — REST functions over `greenbidz` axios; types `DraftSummary`, `DraftDetail`, `CreateDraftReq`, `PendingAiPayload`.
- `src/services/drafts/draftHooks.ts` — React Query hooks (`useListDrafts`, `useGetDraft`, `useCreateDraft`, `useUpdateDraft`, `useDeleteDraft`, `useMarkDraftPublished`) + `draftKeys`.
- `src/services/drafts/draftPayload.ts` — pure builders/hydrators (`buildScanDraftPayload`, `hydrateScanDraftFromPayload`, `buildLabDraftPayload`, `pendingAiPayload`).
- `src/services/scanner/recognitionJobClient.ts` — `createRecognitionJob`, `getRecognitionJobStatus`, `tailRecognitionJob` (SSE, factory seam), modelled on `smartDetectStream.ts`.
- `src/stores/recognitionJobStore.ts` — MMKV-backed stored job-id helpers (`storeJobId`, `getStoredJobId`, `clearStoredJobId`).

**New — UI surfaces:**
- `app/scan/drafts.tsx` — the shared Drafts list route.
- `src/features/scanner/components/drafts/DraftCard.tsx` — one draft row.

**Modified:**
- `src/lib/flags.ts` — two new flags + two accessor functions.
- `src/stores/scanDraftStore.ts` — add `hydrateFromServer(payload)` action.
- `src/features/scanner/components/detail/DetailFooter.tsx` — Save-as-draft button (single-mode branch) + prop.
- `app/scan/detail.tsx` (the detail screen host) — `onSaveDraft` handler.
- `app/scan/processing.tsx` — Continue-in-background affordance + start-job-instead-of-abort + reattach.
- `app/(tabs)/index.tsx` / `app/(tabs)/scan.tsx` — a "Drafts" entry affordance (does NOT `reset()`).
- `app/(lab)/draft.tsx` — Save-as-draft button + handler.
- `app/(lab)/processing.tsx` — sell-mode background + reattach.
- `src/lib/onesignal.ts` + `app/_layout.tsx` — push-click deep-link listener.
- `src/features/lab/notifications/notificationNav.ts` — `recognition_draft_ready` → drafts route.
- `src/i18n/locales/{en,zh-Hant,zh-Hans,ja,th,vi}.json` — new keys.

---

# PHASE 0 — Shared foundation

### Task 1: Feature flags

**Files:**
- Modify: `src/lib/flags.ts`
- Test: `src/lib/__tests__/draftFlags.test.ts`

**Interfaces:**
- Produces: `DRAFTS_ENABLED: boolean`, `BACKGROUND_RECOGNITION_ENABLED: boolean`, `draftsEnabled(): boolean`, `backgroundRecognitionEnabled(): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/draftFlags.test.ts
import { describe, it, expect } from '@jest/globals';
import { draftsEnabled, backgroundRecognitionEnabled } from '@/lib/flags';

describe('draft feature flags', () => {
  it('exposes boolean accessor functions', () => {
    expect(typeof draftsEnabled()).toBe('boolean');
    expect(typeof backgroundRecognitionEnabled()).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- draftFlags`
Expected: FAIL — `draftsEnabled is not a function`.

- [ ] **Step 3: Add the flags**

Append to `src/lib/flags.ts` (follow the opt-in `=== '1'` convention and the `smartDetectV2Enabled()` function-indirection pattern):

```ts
// --- AI-scan drafts + background recognition (opt-in, default OFF) ---
export const DRAFTS_ENABLED = process.env.EXPO_PUBLIC_DRAFTS === '1';
export const BACKGROUND_RECOGNITION_ENABLED =
  process.env.EXPO_PUBLIC_BACKGROUND_RECOGNITION === '1';

/** Function indirection so these can later be remote-config driven. */
export function draftsEnabled(): boolean {
  return DRAFTS_ENABLED;
}
export function backgroundRecognitionEnabled(): boolean {
  return BACKGROUND_RECOGNITION_ENABLED;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- draftFlags`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flags.ts src/lib/__tests__/draftFlags.test.ts
git commit -m "feat(flags): add DRAFTS + BACKGROUND_RECOGNITION flags (default off)"
```

---

### Task 2: Draft REST client + types

**Files:**
- Create: `src/services/drafts/draftApi.ts`
- Test: `src/services/drafts/__tests__/draftApi.test.ts`

**Interfaces:**
- Consumes: `greenbidz` axios (`src/api/greenbidzClient.ts`) — auth is attached by its interceptor.
- Produces:
  - Types `PendingAiPayload = { kind: 'pending-ai'; result: unknown; imagesOrdered: { url: string; objectName: string }[]; language: string; mode: 'single' | 'multi' | 'sell' | 'buy' }`.
  - `FormBlobPayload = { kind?: 'form-blob'; [k: string]: unknown }`; `DraftPayload = PendingAiPayload | FormBlobPayload`.
  - `DraftSummary = { id: string; session_uuid: string; flow: 'ai' | 'manual'; mode: string; title: string; product_count: number; status: 'active' | 'published' | 'discarded'; draft_kind?: 'form-blob' | 'pending-ai'; thumbnail_object?: string | null; updated_at: string }`.
  - `DraftDetail = DraftSummary & { payload: DraftPayload }`.
  - `CreateDraftReq = { session_uuid: string; flow: 'ai' | 'manual'; mode: string; title: string; site_type: string; product_count: number; thumbnail_object?: string | null; payload: DraftPayload }`.
  - `createDraft(req): Promise<DraftDetail>`, `listDrafts(cursor?): Promise<{ drafts: DraftSummary[]; next_cursor: string | null }>`, `getDraft(id): Promise<DraftDetail>`, `updateDraft(id, expectedUpdatedAt, patch): Promise<DraftDetail>`, `deleteDraft(id): Promise<void>`, `markDraftPublished(id, batchIds): Promise<void>`.

> **Pre-check (do this first, not a code step):** open `101recycle-greenbidz-backend/controller/draftController.js` + `routes/draftRoutes.js` and confirm the response envelope. This plan assumes `{ success: true, data: <T> }` and list `{ success, data: { drafts, next_cursor } }`. If the live shape differs, adjust the `.data.data` unwrap below to match — everything downstream reads the return values of these functions, so fixing it here is enough.

- [ ] **Step 1: Write the failing test** (mock the axios client, assert URL/params/unwrap)

```ts
// src/services/drafts/__tests__/draftApi.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const post = jest.fn();
const get = jest.fn();
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { post, get, put: jest.fn(), delete: jest.fn(), patch: jest.fn() } }));

import { createDraft, listDrafts } from '@/services/drafts/draftApi';

beforeEach(() => { post.mockReset(); get.mockReset(); });

describe('draftApi', () => {
  it('createDraft posts to /drafts and unwraps data', async () => {
    post.mockResolvedValue({ data: { success: true, data: { id: 'd1', session_uuid: 's1', flow: 'ai', mode: 'single', title: 'X', product_count: 1, status: 'active', updated_at: 't', payload: { kind: 'form-blob' } } } });
    const out = await createDraft({ session_uuid: 's1', flow: 'ai', mode: 'single', title: 'X', site_type: 'LabGreenbidz', product_count: 1, payload: { kind: 'form-blob' } });
    expect(post).toHaveBeenCalledWith('/drafts', expect.objectContaining({ session_uuid: 's1' }));
    expect(out.id).toBe('d1');
  });

  it('listDrafts passes cursor and unwraps drafts + next_cursor', async () => {
    get.mockResolvedValue({ data: { success: true, data: { drafts: [{ id: 'd1' }], next_cursor: 'c2' } } });
    const out = await listDrafts('c1');
    expect(get).toHaveBeenCalledWith('/drafts', { params: { cursor: 'c1' } });
    expect(out.drafts).toHaveLength(1);
    expect(out.next_cursor).toBe('c2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- draftApi`
Expected: FAIL — cannot resolve `@/services/drafts/draftApi`.

- [ ] **Step 3: Implement the client**

```ts
// src/services/drafts/draftApi.ts
import { greenbidz } from '@/api/greenbidzClient';

export type PendingAiPayload = {
  kind: 'pending-ai';
  result: unknown;
  imagesOrdered: { url: string; objectName: string }[];
  language: string;
  mode: 'single' | 'multi' | 'sell' | 'buy';
};
export type FormBlobPayload = { kind?: 'form-blob'; [k: string]: unknown };
export type DraftPayload = PendingAiPayload | FormBlobPayload;

export interface DraftSummary {
  id: string;
  session_uuid: string;
  flow: 'ai' | 'manual';
  mode: string;
  title: string;
  product_count: number;
  status: 'active' | 'published' | 'discarded';
  draft_kind?: 'form-blob' | 'pending-ai';
  thumbnail_object?: string | null;
  updated_at: string;
}
export type DraftDetail = DraftSummary & { payload: DraftPayload };

export interface CreateDraftReq {
  session_uuid: string;
  flow: 'ai' | 'manual';
  mode: string;
  title: string;
  site_type: string;
  product_count: number;
  thumbnail_object?: string | null;
  payload: DraftPayload;
}

export async function createDraft(req: CreateDraftReq): Promise<DraftDetail> {
  const res = await greenbidz.post('/drafts', req);
  return res.data.data as DraftDetail;
}

export async function listDrafts(cursor?: string): Promise<{ drafts: DraftSummary[]; next_cursor: string | null }> {
  const res = await greenbidz.get('/drafts', { params: { cursor } });
  return res.data.data as { drafts: DraftSummary[]; next_cursor: string | null };
}

export async function getDraft(id: string): Promise<DraftDetail> {
  const res = await greenbidz.get(`/drafts/${id}`);
  return res.data.data as DraftDetail;
}

export async function updateDraft(
  id: string,
  expectedUpdatedAt: string,
  patch: Partial<CreateDraftReq>,
): Promise<DraftDetail> {
  const res = await greenbidz.put(`/drafts/${id}`, { expected_updated_at: expectedUpdatedAt, ...patch });
  return res.data.data as DraftDetail;
}

export async function deleteDraft(id: string): Promise<void> {
  await greenbidz.delete(`/drafts/${id}`);
}

export async function markDraftPublished(id: string, publishedBatchIds: string[]): Promise<void> {
  await greenbidz.patch(`/drafts/${id}/published`, { published_batch_ids: publishedBatchIds });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- draftApi`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/drafts/draftApi.ts src/services/drafts/__tests__/draftApi.test.ts
git commit -m "feat(drafts): mobile draft REST client + types"
```

---

### Task 3: Draft React Query hooks

**Files:**
- Create: `src/services/drafts/draftHooks.ts`
- Test: `src/services/drafts/__tests__/draftHooks.test.tsx`

**Interfaces:**
- Consumes: `draftApi` functions (Task 2), `queryClient` (`src/lib/queryClient.ts`).
- Produces: `draftKeys` (`draftKeys.all = ['drafts'] as const`, `draftKeys.list() = ['drafts','list']`, `draftKeys.detail(id) = ['drafts','detail', id]`); hooks `useListDrafts()`, `useGetDraft(id, enabled)`, `useCreateDraft()`, `useUpdateDraft()`, `useDeleteDraft()`, `useMarkDraftPublished()`. Mutations invalidate `draftKeys.all`.

- [ ] **Step 1: Write the failing test** (render a hook via a QueryClientProvider wrapper)

```tsx
// src/services/drafts/__tests__/draftHooks.test.tsx
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listDrafts = jest.fn();
jest.mock('@/services/drafts/draftApi', () => ({ listDrafts: (...a: unknown[]) => listDrafts(...a) }));

import { useListDrafts, draftKeys } from '@/services/drafts/draftHooks';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => listDrafts.mockReset());

describe('draftHooks', () => {
  it('draftKeys.detail is stable', () => {
    expect(draftKeys.detail('a')).toEqual(['drafts', 'detail', 'a']);
  });

  it('useListDrafts fetches the first page', async () => {
    listDrafts.mockResolvedValue({ drafts: [{ id: 'd1' }], next_cursor: null });
    const { result } = renderHook(() => useListDrafts(), { wrapper });
    await waitFor(() => expect(result.current.data?.drafts).toHaveLength(1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- draftHooks`
Expected: FAIL — cannot resolve `@/services/drafts/draftHooks`.

- [ ] **Step 3: Implement the hooks**

```ts
// src/services/drafts/draftHooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './draftApi';

export const draftKeys = {
  all: ['drafts'] as const,
  list: () => [...draftKeys.all, 'list'] as const,
  detail: (id: string) => [...draftKeys.all, 'detail', id] as const,
};

export function useListDrafts() {
  return useQuery({ queryKey: draftKeys.list(), queryFn: () => api.listDrafts(), staleTime: 15_000 });
}

export function useGetDraft(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: draftKeys.detail(id ?? '_'),
    queryFn: () => api.getDraft(id as string),
    enabled: enabled && !!id,
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: api.CreateDraftReq) => api.createDraft(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; expectedUpdatedAt: string; patch: Partial<api.CreateDraftReq> }) =>
      api.updateDraft(args.id, args.expectedUpdatedAt, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}

export function useMarkDraftPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; batchIds: string[] }) => api.markDraftPublished(args.id, args.batchIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- draftHooks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/drafts/draftHooks.ts src/services/drafts/__tests__/draftHooks.test.tsx
git commit -m "feat(drafts): React Query hooks + query keys"
```

---

### Task 4: Stored recognition-job id (MMKV)

**Files:**
- Create: `src/stores/recognitionJobStore.ts`
- Test: `src/stores/__tests__/recognitionJobStore.test.ts`

**Interfaces:**
- Consumes: `mmkv` (`src/lib/mmkv.ts`).
- Produces: `storeJobId(id: string): void`, `getStoredJobId(): string | null`, `clearStoredJobId(): void`. MMKV key `'scan.recognitionJobId'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/__tests__/recognitionJobStore.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return { mmkv: { set: (k: string, v: string) => store.set(k, v), getString: (k: string) => store.get(k), remove: (k: string) => store.delete(k) } };
});

import { storeJobId, getStoredJobId, clearStoredJobId } from '@/stores/recognitionJobStore';

beforeEach(() => clearStoredJobId());

describe('recognitionJobStore', () => {
  it('round-trips a job id', () => {
    expect(getStoredJobId()).toBeNull();
    storeJobId('job-123');
    expect(getStoredJobId()).toBe('job-123');
    clearStoredJobId();
    expect(getStoredJobId()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- recognitionJobStore`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// src/stores/recognitionJobStore.ts
import { mmkv } from '@/lib/mmkv';

const JOB_KEY = 'scan.recognitionJobId';

export function storeJobId(id: string): void {
  mmkv.set(JOB_KEY, id);
}
export function getStoredJobId(): string | null {
  return mmkv.getString(JOB_KEY) ?? null;
}
export function clearStoredJobId(): void {
  mmkv.remove(JOB_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- recognitionJobStore`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/recognitionJobStore.ts src/stores/__tests__/recognitionJobStore.test.ts
git commit -m "feat(scan): MMKV stored recognition job id"
```

---

### Task 5: Recognition-job client (create + status + SSE tail)

**Files:**
- Create: `src/services/scanner/recognitionJobClient.ts`
- Test: `src/services/scanner/__tests__/recognitionJobClient.test.ts`

**Interfaces:**
- Consumes: `greenbidz` axios (create + status), the `RNEventSource` pattern from `src/services/scanner/smartDetectStream.ts` (named events, `settle()` once, heartbeat watchdog, abort), `mapSmartDetection` (reuse the same mapper `smartDetectStream.ts` uses so the `result` shape matches the sync path byte-for-byte).
- Produces:
  - `createRecognitionJob(input: { image_urls: string[]; document_urls?: string[]; language: string; platform: string }): Promise<{ job_id: string }>`.
  - `getRecognitionJobStatus(jobId: string): Promise<{ status: 'queued' | 'running' | 'draft_ready' | 'failed'; draft_id?: string; error?: string }>`.
  - `tailRecognitionJob(jobId, opts: { afterSeq?: number; signal?: AbortSignal; onEvent?: (name: string, data: unknown) => void; eventSourceFactory?: EventSourceFactory }): Promise<SmartDetectionResult>` where `SmartDetectionResult` is the return type of the existing `mapSmartDetection`.

- [ ] **Step 1: Write the failing test** (inject a fake EventSource, assert `result` resolves and `error` rejects)

```ts
// src/services/scanner/__tests__/recognitionJobClient.test.ts
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { post: jest.fn(), get: jest.fn() } }));
jest.mock('@/services/scanner/smartDetectMapper', () => ({ mapSmartDetection: (raw: unknown) => ({ mapped: true, raw }) }), { virtual: true });

import { tailRecognitionJob } from '@/services/scanner/recognitionJobClient';

// minimal fake matching react-native-sse's addEventListener/removeAllEventListeners/close surface
function makeFakeEs() {
  const handlers: Record<string, ((ev: any) => void)[]> = {};
  return {
    es: {
      addEventListener: (n: string, h: (ev: any) => void) => { (handlers[n] ||= []).push(h); },
      removeAllEventListeners: () => {},
      close: () => {},
    },
    emit: (n: string, ev: any) => (handlers[n] || []).forEach((h) => h(ev)),
  };
}

describe('tailRecognitionJob', () => {
  it('resolves with the mapped result on a result frame', async () => {
    const fake = makeFakeEs();
    const p = tailRecognitionJob('job1', { eventSourceFactory: () => fake.es as any });
    fake.emit('result', { data: JSON.stringify({ products: [] }) });
    await expect(p).resolves.toEqual({ mapped: true, raw: { products: [] } });
  });

  it('rejects on a backend error frame', async () => {
    const fake = makeFakeEs();
    const p = tailRecognitionJob('job1', { eventSourceFactory: () => fake.es as any });
    fake.emit('error', { data: 'boom' });
    await expect(p).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- recognitionJobClient`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement** (mirror `smartDetectStream.ts` structure; `create`/`status` are plain axios)

```ts
// src/services/scanner/recognitionJobClient.ts
import RNEventSource from 'react-native-sse';
import Constants from 'expo-constants';
import { greenbidz } from '@/api/greenbidzClient';
import { getSecureItem } from '@/lib/secureStorage';
import { getGreenbidzApiUrl } from '@/lib/env';
import { mapSmartDetection } from '@/services/scanner/smartDetectMapper';

export type EventSourceFactory = (url: string, init: Record<string, unknown>) => RNEventSource;
type Status = { status: 'queued' | 'running' | 'draft_ready' | 'failed'; draft_id?: string; error?: string };

const NAMED = ['stage', 'detection', 'product', 'pdf_pages', 'result', 'heartbeat'] as const;
const WATCHDOG_MS = 45_000;

export async function createRecognitionJob(input: {
  image_urls: string[]; document_urls?: string[]; language: string; platform: string;
}): Promise<{ job_id: string }> {
  const res = await greenbidz.post('/recognition-jobs', input);
  return { job_id: (res.data.data ?? res.data).job_id };
}

export async function getRecognitionJobStatus(jobId: string): Promise<Status> {
  const res = await greenbidz.get(`/recognition-jobs/${jobId}`);
  return (res.data.data ?? res.data) as Status;
}

async function authHeaders(): Promise<Record<string, string>> {
  const [access, refresh] = await Promise.all([getSecureItem('auth.accessToken'), getSecureItem('auth.refreshToken')]);
  const extra = Constants.expoConfig?.extra ?? {};
  const h: Record<string, string> = {
    Accept: 'text/event-stream',
    'x-platform': (extra.SITE_TYPE as string) ?? 'LabGreenbidz',
  };
  if (extra.X_SYSTEM_KEY) h['x-system-key'] = extra.X_SYSTEM_KEY as string;
  if (access) h.Authorization = `Bearer ${access}`;
  if (refresh) h['x-refresh-token'] = refresh;
  return h;
}

export async function tailRecognitionJob(
  jobId: string,
  opts: {
    afterSeq?: number;
    signal?: AbortSignal;
    onEvent?: (name: string, data: unknown) => void;
    eventSourceFactory?: EventSourceFactory;
  } = {},
): Promise<ReturnType<typeof mapSmartDetection>> {
  const { afterSeq = 0, signal, onEvent, eventSourceFactory } = opts;
  const base = getGreenbidzApiUrl();
  const url = `${base}/recognition-jobs/${jobId}/stream?after_seq=${afterSeq}`;
  const headers = eventSourceFactory ? {} : await authHeaders();

  return new Promise((resolve, reject) => {
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout>;
    const factory: EventSourceFactory = eventSourceFactory ?? ((u, init) => new RNEventSource(u, init as never));
    const es = factory(url, { method: 'GET', headers, pollingInterval: 0 });

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      try { es.removeAllEventListeners(); es.close(); } catch { /* noop */ }
      fn();
    };
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => settle(() => reject(new Error('recognition_stream_timeout'))), WATCHDOG_MS); };

    const onAbort = () => settle(() => reject(Object.assign(new Error('cancelled'), { code: 'cancelled' })));
    if (signal?.aborted) return settle(() => reject(Object.assign(new Error('cancelled'), { code: 'cancelled' })));
    signal?.addEventListener('abort', onAbort);

    es.addEventListener('error', (ev: any) => {
      // backend `event: error` carries a string data; transport errors carry xhrStatus
      if (typeof ev?.data === 'string') settle(() => reject(new Error(ev.data)));
      else settle(() => reject(new Error('recognition_stream_transport_error')));
    });
    for (const name of NAMED) {
      es.addEventListener(name, (ev: any) => {
        if (name === 'heartbeat') return arm();
        if (name === 'result') {
          try { settle(() => resolve(mapSmartDetection(JSON.parse(ev.data)))); }
          catch (e) { settle(() => reject(e as Error)); }
          return;
        }
        try { onEvent?.(name, ev?.data ? JSON.parse(ev.data) : undefined); } catch { onEvent?.(name, ev?.data); }
      });
    }
    arm();
  });
}
```

> If the existing mapper is not at `@/services/scanner/smartDetectMapper`, point the import at whatever module `smartDetectStream.ts` imports `mapSmartDetection` from (grep `mapSmartDetection`). The test mocks it, so the path only matters at runtime.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- recognitionJobClient`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/scanner/recognitionJobClient.ts src/services/scanner/__tests__/recognitionJobClient.test.ts
git commit -m "feat(scan): background recognition-job client (create/status/SSE tail)"
```

---

### Task 6: Payload builders / hydrators (the `pending-ai` contract)

**Files:**
- Create: `src/services/drafts/draftPayload.ts`
- Test: `src/services/drafts/__tests__/draftPayload.test.ts`

**Interfaces:**
- Consumes: `PendingAiPayload` type (Task 2), `PersistedScan`/`DraftItem` types (`src/stores/scanDraftStore.ts`).
- Produces:
  - `pendingAiPayload(args: { result: unknown; imagesOrdered: {url,objectName}[]; language: string; mode: PendingAiPayload['mode'] }): PendingAiPayload`.
  - `buildScanDraftPayload(snapshot: PersistedScan, imagesOrdered: {url,objectName}[]): { title: string; product_count: number; mode: 'single'|'multi'; payload: FormBlobPayload }`.
  - `hydrateScanDraftFromPayload(payload: FormBlobPayload): PersistedScan` (inverse; used by the store's `hydrateFromServer`).
  - `buildLabDraftPayload(draftFrame: unknown, mode: 'sell'|'buy'): { title: string; payload: FormBlobPayload }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/drafts/__tests__/draftPayload.test.ts
import { describe, it, expect } from '@jest/globals';
import { pendingAiPayload, buildScanDraftPayload, hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';

describe('draftPayload', () => {
  it('pendingAiPayload stamps kind + carries fields', () => {
    const p = pendingAiPayload({ result: { products: [] }, imagesOrdered: [{ url: 'u', objectName: 'o' }], language: 'en', mode: 'single' });
    expect(p.kind).toBe('pending-ai');
    expect(p.imagesOrdered).toHaveLength(1);
  });

  it('buildScanDraftPayload -> hydrate round-trips the current item title', () => {
    const snapshot: any = { mode: 'single', queuedItems: [], current: { id: 'i1', title: 'Pump', photos: [], productIds: [] }, sessionVisibility: 'public', networkSellers: [] };
    const built = buildScanDraftPayload(snapshot, []);
    expect(built.title).toBe('Pump');
    expect(built.mode).toBe('single');
    const back = hydrateScanDraftFromPayload(built.payload);
    expect(back.current?.title).toBe('Pump');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- draftPayload`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement** (payload is the serialized `PersistedScan` under `kind: 'form-blob'`; pending-ai is separate)

```ts
// src/services/drafts/draftPayload.ts
import type { PendingAiPayload, FormBlobPayload } from './draftApi';
import type { PersistedScan } from '@/stores/scanDraftStore';

export function pendingAiPayload(args: {
  result: unknown; imagesOrdered: { url: string; objectName: string }[]; language: string; mode: PendingAiPayload['mode'];
}): PendingAiPayload {
  return { kind: 'pending-ai', result: args.result, imagesOrdered: args.imagesOrdered, language: args.language, mode: args.mode };
}

export function buildScanDraftPayload(
  snapshot: PersistedScan,
  imagesOrdered: { url: string; objectName: string }[],
): { title: string; product_count: number; mode: 'single' | 'multi'; payload: FormBlobPayload } {
  const isMulti = snapshot.mode === 'grouped';
  const title = isMulti
    ? (snapshot.queuedItems?.[0]?.title || 'Untitled group')
    : (snapshot.current?.title || 'Untitled listing');
  const product_count = isMulti ? Math.max(1, snapshot.queuedItems?.length ?? 1) : 1;
  return {
    title,
    product_count,
    mode: isMulti ? 'multi' : 'single',
    payload: { kind: 'form-blob', persistedScan: snapshot, imagesOrdered },
  };
}

export function hydrateScanDraftFromPayload(payload: FormBlobPayload): PersistedScan {
  const blob = (payload as { persistedScan?: PersistedScan }).persistedScan;
  if (!blob) throw new Error('draft payload missing persistedScan');
  return blob;
}

export function buildLabDraftPayload(
  draftFrame: unknown,
  mode: 'sell' | 'buy',
): { title: string; payload: FormBlobPayload } {
  const frame = (draftFrame ?? {}) as { title?: string };
  return { title: frame.title || (mode === 'sell' ? 'Untitled listing' : 'Buying request'), payload: { kind: 'form-blob', labDraft: frame, mode } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- draftPayload`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/drafts/draftPayload.ts src/services/drafts/__tests__/draftPayload.test.ts
git commit -m "feat(drafts): pending-ai + form-blob payload builders/hydrators"
```

---

# PHASE 1 — Seller flow

### Task 7: `hydrateFromServer` action on scanDraftStore

**Files:**
- Modify: `src/stores/scanDraftStore.ts`
- Test: `src/stores/__tests__/scanDraftStore.hydrate.test.ts`

**Interfaces:**
- Consumes: `PersistedScan` type + `migrateDraft` (internal, already in the store), `persistSession` (internal).
- Produces: store action `hydrateFromServer(blob: PersistedScan): Promise<void>` — mirrors `hydrate()` (`scanDraftStore.ts:602-612`): runs each item through `migrateDraft`, `set({...})` the live fields, then `persistSession`.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/__tests__/scanDraftStore.hydrate.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
jest.mock('@/services/upload/persistPhotos', () => ({ persistPhotosForDraft: jest.fn(async (p: unknown) => p) }));
jest.mock('@/lib/mmkv', () => { const s = new Map<string,string>(); return { mmkv: { set: (k:string,v:string)=>s.set(k,v), getString:(k:string)=>s.get(k), remove:(k:string)=>s.delete(k) } }; });
import { useScanDraft } from '@/stores/scanDraftStore';

beforeEach(() => useScanDraft.getState().reset());

describe('hydrateFromServer', () => {
  it('loads a persisted single-item draft into live state', async () => {
    const blob: any = { mode: 'single', queuedItems: [], current: { id: 'i1', title: 'Centrifuge', photos: [], productIds: [] }, sessionVisibility: 'public', networkSellers: [] };
    await useScanDraft.getState().hydrateFromServer(blob);
    expect(useScanDraft.getState().current?.title).toBe('Centrifuge');
    expect(useScanDraft.getState().mode).toBe('single');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scanDraftStore.hydrate`
Expected: FAIL — `hydrateFromServer is not a function`.

- [ ] **Step 3: Implement** — add to the store object (next to `hydrate`), reusing the existing `migrateDraft` + `persistSession` helpers:

```ts
// inside create<ScanDraftState>((set, get) => ({ ... }))
hydrateFromServer: async (blob: PersistedScan) => {
  const migratedCurrent = blob.current ? migrateDraft(blob.current) : null;
  const migratedQueued = (blob.queuedItems ?? []).map(migrateDraft);
  set({
    mode: blob.mode ?? 'single',
    current: migratedCurrent,
    queuedItems: migratedQueued,
    sessionVisibility: blob.sessionVisibility ?? 'public',
    networkSellers: blob.networkSellers ?? [],
    mergedSingle: blob.mergedSingle,
    detectionSummary: blob.detectionSummary,
    detectionConfidence: blob.detectionConfidence,
    gcs: blob.gcs,
    pendingPhotos: [],
    pendingDetection: null,
    hydrated: true,
  });
  persistSession(get());
},
```

Also add `hydrateFromServer: (blob: PersistedScan) => Promise<void>;` to the `ScanDraftState` interface (near the other action signatures, ~`:590`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scanDraftStore.hydrate`
Expected: PASS. Also run the existing store test to confirm no regression: `npm test -- scanDraftStore`.

- [ ] **Step 5: Commit**

```bash
git add src/stores/scanDraftStore.ts src/stores/__tests__/scanDraftStore.hydrate.test.ts
git commit -m "feat(scan): hydrateFromServer action to resume a server draft"
```

---

### Task 8: "Save as draft" button on the scanner detail footer

**Files:**
- Modify: `src/features/scanner/components/detail/DetailFooter.tsx`
- Modify: `app/scan/detail.tsx` (the screen that renders `DetailFooter`)
- Test: `src/features/scanner/components/detail/__tests__/DetailFooter.saveDraft.test.tsx`

**Interfaces:**
- Consumes: `FooterButton`, `useCreateDraft`/`useUpdateDraft` (Task 3), `buildScanDraftPayload` (Task 6), `useScanDraft` snapshot + `flushPendingPatch`, `draftsEnabled()` (Task 1), `SITE_TYPE` extra.
- Produces: `DetailFooter` gains optional props `onSaveDraft?: () => void` and `savingDraft?: boolean`; when `draftsEnabled()` and `onSaveDraft` provided, the single-mode branch renders a "Save as draft" outline button left of Submit.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/scanner/components/detail/__tests__/DetailFooter.saveDraft.test.tsx
import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
jest.mock('@/lib/flags', () => ({ draftsEnabled: () => true, SMART_DETECT_ENABLED: true }));
import DetailFooter from '@/features/scanner/components/detail/DetailFooter';

it('fires onSaveDraft when the save button is pressed', () => {
  const onSaveDraft = jest.fn();
  const { getByText } = render(
    <DetailFooter isGrouped={false} editingGroupedItem={false} queuedCount={0} allRequired
      submitting={false} onSubmitSingle={() => {}} onAddAnother={() => {}} onReviewGroup={() => {}}
      onSaveAndReturnToReview={() => {}} onSaveDraft={onSaveDraft} savingDraft={false} />,
  );
  fireEvent.press(getByText(/save as draft/i));
  expect(onSaveDraft).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DetailFooter.saveDraft`
Expected: FAIL — no "save as draft" text found (button not rendered).

- [ ] **Step 3: Implement** — add props and the button in the single-mode branch (`DetailFooter.tsx:77-101`):

```tsx
// add to Props (DetailFooter.tsx:6-16)
onSaveDraft?: () => void;
savingDraft?: boolean;

// add near the top of the component body
import { draftsEnabled } from '@/lib/flags';

// single-mode branch (replace the return at :77-101)
return (
  <View className={footerCls}>
    {draftsEnabled() && onSaveDraft ? (
      <FooterButton
        label={t('mobile.detail.saveDraft', { defaultValue: 'Save as draft' })}
        onPress={onSaveDraft}
        loading={!!savingDraft}
        disabled={!!submitting}
        flex={1}
      />
    ) : (
      <FooterButton label={t('mobile.detail.preview', { defaultValue: 'Preview' })} onPress={() => Alert.alert(t('mobile.detail.previewSoon', { defaultValue: 'Preview coming soon' }))} flex={1} />
    )}
    <FooterButton label={t('mobile.detail.submitListing')} onPress={onSubmitSingle} disabled={!allRequired} loading={submitting} primary icon="arrow-forward" flex={2} />
  </View>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DetailFooter.saveDraft`
Expected: PASS.

- [ ] **Step 5: Wire the handler in `app/scan/detail.tsx`** — add the save handler and pass it down. Locate where `<DetailFooter .../>` is rendered and add:

```tsx
import Constants from 'expo-constants';
import { useCreateDraft, useUpdateDraft } from '@/services/drafts/draftHooks';
import { buildScanDraftPayload } from '@/services/drafts/draftPayload';
import { useScanDraft } from '@/stores/scanDraftStore';
import { toast } from 'sonner-native';
import { useTranslation } from 'react-i18next';

// inside the component:
const createDraft = useCreateDraft();
const [savingDraft, setSavingDraft] = useState(false);
const [serverDraftId, setServerDraftId] = useState<string | null>(null);
const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
const updateDraft = useUpdateDraft();

const handleSaveDraft = useCallback(async () => {
  const store = useScanDraft.getState();
  store.flushPendingPatch?.();                       // ensure debounced patches are written
  const snapshot = (store as any).snapshotForServer?.() ?? buildSnapshot(store); // see note
  const gcs = store.gcs;
  const imagesOrdered = gcs
    ? Object.entries(gcs.objectNameByPhotoUri).map(([uri, objectName]) => ({ url: uri, objectName }))
    : [];
  const built = buildScanDraftPayload(snapshot, imagesOrdered);
  const siteType = (Constants.expoConfig?.extra?.SITE_TYPE as string) ?? 'LabGreenbidz';
  const sessionUuid = serverDraftId ?? snapshot.current?.id ?? `temp-${snapshot.mode}-${snapshot.current?.id ?? 'x'}`;
  try {
    setSavingDraft(true);
    if (serverDraftId && serverUpdatedAt) {
      const res = await updateDraft.mutateAsync({ id: serverDraftId, expectedUpdatedAt: serverUpdatedAt, patch: { title: built.title, product_count: built.product_count, payload: built.payload } });
      setServerUpdatedAt(res.updated_at);
    } else {
      const res = await createDraft.mutateAsync({ session_uuid: sessionUuid, flow: 'ai', mode: built.mode, title: built.title, site_type: siteType, product_count: built.product_count, payload: built.payload });
      setServerDraftId(res.id);
      setServerUpdatedAt(res.updated_at);
    }
    toast.success(t('mobile.drafts.saved', { defaultValue: 'Draft saved' }));
  } catch {
    toast.error(t('mobile.drafts.saveFailed', { defaultValue: 'Could not save draft' }));
  } finally {
    setSavingDraft(false);
  }
}, [serverDraftId, serverUpdatedAt, createDraft, updateDraft, t]);

// pass to footer:
<DetailFooter /* existing props */ onSaveDraft={handleSaveDraft} savingDraft={savingDraft} />
```

> **Note on `snapshotForServer`:** the store's `snapshot(get)` is internal (`scanDraftStore.ts:500-513`). Export a thin public getter `snapshotForServer(): PersistedScan` on the store (one line: `snapshotForServer: () => snapshot(get)`) in this same task, and add its signature to `ScanDraftState`. Use it instead of the `buildSnapshot` placeholder above.

- [ ] **Step 6: Verify on emulator** (UI wiring has no unit test — smoke it)

Run the app (`CI=1 npx expo start --dev-client`, `.env` with `EXPO_PUBLIC_DRAFTS=1`), sign in as a seller, scan an item to the detail screen, tap **Save as draft** → expect the "Draft saved" toast and no crash. Confirm a row is created (Task 9 will show it).

- [ ] **Step 7: Commit**

```bash
git add src/features/scanner/components/detail/DetailFooter.tsx app/scan/detail.tsx src/stores/scanDraftStore.ts src/features/scanner/components/detail/__tests__/DetailFooter.saveDraft.test.tsx
git commit -m "feat(scan): Save as draft on seller detail footer"
```

---

### Task 9: Drafts list screen + DraftCard + resume

**Files:**
- Create: `app/scan/drafts.tsx`
- Create: `src/features/scanner/components/drafts/DraftCard.tsx`
- Modify: `app/(tabs)/index.tsx` (add a "Drafts" entry that navigates without `reset()`)
- Test: `src/features/scanner/components/drafts/__tests__/DraftCard.test.tsx`

**Interfaces:**
- Consumes: `useListDrafts`, `useGetDraft`, `useDeleteDraft` (Task 3), `getScanResumeRoute` (`src/lib/scanResume.ts`), `hydrateFromServer` (Task 7), `hydrateScanDraftFromPayload` (Task 6).
- Produces: route `/scan/drafts`; `DraftCard` component with props `{ draft: DraftSummary; onResume: () => void; onDelete: () => void }`.

- [ ] **Step 1: Write the failing test** (DraftCard renders title + fires callbacks)

```tsx
// src/features/scanner/components/drafts/__tests__/DraftCard.test.tsx
import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DraftCard from '@/features/scanner/components/drafts/DraftCard';

const draft: any = { id: 'd1', title: 'Vacuum Pump', flow: 'ai', mode: 'single', product_count: 1, status: 'active', updated_at: new Date(0).toISOString() };

it('renders the title and fires onResume', () => {
  const onResume = jest.fn();
  const { getByText } = render(<DraftCard draft={draft} onResume={onResume} onDelete={() => {}} />);
  expect(getByText('Vacuum Pump')).toBeTruthy();
  fireEvent.press(getByText(/continue/i));
  expect(onResume).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DraftCard`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `DraftCard.tsx`**

```tsx
// src/features/scanner/components/drafts/DraftCard.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DraftSummary } from '@/services/drafts/draftApi';

export default function DraftCard({ draft, onResume, onDelete }: { draft: DraftSummary; onResume: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="rounded-xl border border-brand-border p-md gap-2 bg-brand-surface">
      <Text className="text-base font-semibold text-brand-text" numberOfLines={1}>{draft.title}</Text>
      <Text className="text-xs text-brand-text-muted">
        {draft.flow === 'ai' ? '🤖 AI' : '✏️ Manual'} · {t('mobile.drafts.itemCount', { count: draft.product_count, defaultValue: '{{count}} item' })}
      </Text>
      <View className="flex-row gap-sm">
        <Pressable onPress={onResume} accessibilityRole="button"><Text className="text-brand-primary font-semibold">{t('mobile.drafts.continue', { defaultValue: 'Continue' })}</Text></Pressable>
        <Pressable onPress={onDelete} accessibilityRole="button"><Text className="text-red-500">{t('mobile.drafts.delete', { defaultValue: 'Delete' })}</Text></Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DraftCard`
Expected: PASS.

- [ ] **Step 5: Implement the `app/scan/drafts.tsx` screen** (list + resume that hydrates then routes)

```tsx
// app/scan/drafts.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useListDrafts, useDeleteDraft } from '@/services/drafts/draftHooks';
import { getDraft } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { useScanDraft } from '@/stores/scanDraftStore';
import { getScanResumeRoute } from '@/lib/scanResume';
import DraftCard from '@/features/scanner/components/drafts/DraftCard';

export default function DraftsScreen() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useListDrafts();
  const del = useDeleteDraft();
  const [resuming, setResuming] = useState(false);

  const onResume = useCallback(async (id: string) => {
    setResuming(true);
    try {
      const detail = await getDraft(id);
      if (detail.payload && (detail.payload as { kind?: string }).kind !== 'pending-ai') {
        const blob = hydrateScanDraftFromPayload(detail.payload as never);
        await useScanDraft.getState().hydrateFromServer(blob);
      } else {
        // pending-ai: apply the raw AI result via the store's applySmartDetection
        // (Task 12 wires the same mapping for background; reuse it here).
        await useScanDraft.getState().hydrateFromServer((detail.payload as any).persistedScan ?? { mode: 'single', queuedItems: [], current: null, sessionVisibility: 'public', networkSellers: [] } as never);
      }
      const route = getScanResumeRoute(useScanDraft.getState());
      router.push((route ?? '/scan/detail') as never);
    } finally {
      setResuming(false);
    }
  }, []);

  if (isLoading || resuming) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  if (isError) return <View className="flex-1 items-center justify-center"><Text>{t('mobile.drafts.loadError', { defaultValue: 'Could not load drafts' })}</Text></View>;

  const drafts = data?.drafts ?? [];
  return (
    <FlatList
      contentContainerClassName="p-lg gap-md"
      data={drafts}
      keyExtractor={(d) => d.id}
      onRefresh={refetch}
      refreshing={false}
      ListEmptyComponent={<Text className="text-center text-brand-text-muted mt-10">{t('mobile.drafts.empty', { defaultValue: 'No saved drafts yet' })}</Text>}
      renderItem={({ item }) => (
        <DraftCard draft={item} onResume={() => onResume(item.id)} onDelete={() => del.mutate(item.id)} />
      )}
    />
  );
}
```

> `getScanResumeRoute` currently takes the store state and returns a route for `processing|review|detail`. Confirm its signature in `src/lib/scanResume.ts`; if it expects a specific arg shape, pass `useScanDraft.getState()` fields it reads. The `pending-ai` branch is finished in Task 12 (it shares the background result→store mapping).

- [ ] **Step 6: Add the Drafts entry point** in `app/(tabs)/index.tsx` — a button that navigates WITHOUT calling `reset()` (unlike `startScan`). Gate on `draftsEnabled()`:

```tsx
import { draftsEnabled } from '@/lib/flags';
// in the Home render, near the scan CTAs:
{draftsEnabled() && (
  <Pressable onPress={() => router.push('/scan/drafts')} accessibilityRole="button">
    <Text className="text-brand-primary font-semibold">{t('mobile.drafts.yourDrafts', { defaultValue: 'Your drafts' })}</Text>
  </Pressable>
)}
```

Register the route header if the app uses static screen options (check `app/scan/_layout.tsx`); add a `Stack.Screen name="drafts"` entry with a title if the layout enumerates screens explicitly.

- [ ] **Step 7: Verify on emulator** — with `EXPO_PUBLIC_DRAFTS=1`: save a draft (Task 8), open **Your drafts** from Home, see the card, tap **Continue** → lands back on the detail/review screen with the item restored; **Delete** removes it.

- [ ] **Step 8: Commit**

```bash
git add app/scan/drafts.tsx src/features/scanner/components/drafts/DraftCard.tsx app/\(tabs\)/index.tsx src/features/scanner/components/drafts/__tests__/DraftCard.test.tsx
git commit -m "feat(scan): drafts list surface + resume (seller)"
```

---

### Task 10: Continue-in-background on the seller processing screen

**Files:**
- Modify: `app/scan/processing.tsx`
- Modify: `src/features/scanner/useSmartDetect.ts` (extract the GCS-upload step so the background path can reuse it — only if not already callable standalone)
- Test: `src/features/scanner/__tests__/backgroundStart.test.ts`

**Interfaces:**
- Consumes: `createRecognitionJob` + `tailRecognitionJob` (Task 5), `storeJobId`/`clearStoredJobId` (Task 4), `backgroundRecognitionEnabled()` (Task 1), the existing GCS uploader used by `useSmartDetect`.
- Produces: on the processing screen, when `backgroundRecognitionEnabled()`, a "Continue in background" button; pressing it stores the job id and navigates Home **without aborting** the job.

> **Design:** today `processing.tsx` runs `useSmartDetect` under an `AbortController` aborted on unmount (`:494-497`). For the background path, the recognition must be a **server job**: upload photos to GCS (reuse the exact uploader `useSmartDetect` uses), `createRecognitionJob({ image_urls, ... })`, `storeJobId(job_id)`, then `tailRecognitionJob(...)` to drive the same on-screen step indicator. "Continue in background" simply stops tailing and navigates away, leaving the stored id for reattach (Task 11). Keep the synchronous path unchanged when the flag is OFF.

- [ ] **Step 1: Write the failing test** (the start-background helper mints + stores a job id)

```ts
// src/features/scanner/__tests__/backgroundStart.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
const create = jest.fn(); const store = jest.fn();
jest.mock('@/services/scanner/recognitionJobClient', () => ({ createRecognitionJob: (...a: unknown[]) => create(...a), tailRecognitionJob: jest.fn() }));
jest.mock('@/stores/recognitionJobStore', () => ({ storeJobId: (...a: unknown[]) => store(...a), clearStoredJobId: jest.fn() }));
import { startBackgroundRecognition } from '@/features/scanner/backgroundRecognition';

beforeEach(() => { create.mockReset(); store.mockReset(); });

it('creates a job and persists its id', async () => {
  create.mockResolvedValue({ job_id: 'job-9' });
  const id = await startBackgroundRecognition({ image_urls: ['u1'], document_urls: [], language: 'en', platform: 'LabGreenbidz' });
  expect(create).toHaveBeenCalled();
  expect(store).toHaveBeenCalledWith('job-9');
  expect(id).toBe('job-9');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- backgroundStart`
Expected: FAIL — cannot resolve `@/features/scanner/backgroundRecognition`.

- [ ] **Step 3: Implement the helper** `src/features/scanner/backgroundRecognition.ts`

```ts
// src/features/scanner/backgroundRecognition.ts
import { createRecognitionJob } from '@/services/scanner/recognitionJobClient';
import { storeJobId } from '@/stores/recognitionJobStore';

export async function startBackgroundRecognition(input: {
  image_urls: string[]; document_urls: string[]; language: string; platform: string;
}): Promise<string> {
  const { job_id } = await createRecognitionJob(input);
  storeJobId(job_id);
  return job_id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- backgroundStart`
Expected: PASS.

- [ ] **Step 5: Wire the processing screen** — in `app/scan/processing.tsx`, when `backgroundRecognitionEnabled()`, after the GCS upload completes, call `startBackgroundRecognition(...)` and `tailRecognitionJob(jobId, { onEvent: handleScanEvent, signal })` instead of the direct `smartDetectStream`. Render the affordance:

```tsx
import { backgroundRecognitionEnabled } from '@/lib/flags';
import { clearStoredJobId } from '@/stores/recognitionJobStore';
import { toast } from 'sonner-native';

// inside the render, below the step checklist:
{backgroundRecognitionEnabled() && (
  <Pressable
    accessibilityRole="button"
    onPress={() => { toast.success(t('mobile.processing.leftToast', { defaultValue: "We'll notify you when it's ready" })); router.replace('/(tabs)'); }}
  >
    <Text className="text-brand-primary font-semibold text-center mt-6">{t('mobile.processing.continueInBackground', { defaultValue: 'Continue in background' })}</Text>
  </Pressable>
)}
```

Crucially: the unmount cleanup must **not** abort when the user chose background. Track a ref `leftInBackgroundRef`; set it `true` in the button handler; in the cleanup (`:494-497`) only call `controller.abort()` when `!leftInBackgroundRef.current`. On genuine success clear the stored id (`clearStoredJobId()`); on a real tail failure clear it too.

- [ ] **Step 6: Verify on emulator** — with `EXPO_PUBLIC_BACKGROUND_RECOGNITION=1`: scan → on the processing screen tap **Continue in background** → toast + returns Home; the job id is stored (Task 11 proves reattach).

- [ ] **Step 7: Commit**

```bash
git add src/features/scanner/backgroundRecognition.ts app/scan/processing.tsx src/features/scanner/__tests__/backgroundStart.test.ts
git commit -m "feat(scan): continue-in-background on seller processing"
```

---

### Task 11: Reattach-on-return (seller) → land finished job as a pending-ai draft

**Files:**
- Create: `src/features/scanner/reattachRecognition.ts`
- Modify: `app/(tabs)/index.tsx` (run reattach on focus) or `app/scan/_layout.tsx`
- Test: `src/features/scanner/__tests__/reattach.test.ts`

**Interfaces:**
- Consumes: `getStoredJobId`/`clearStoredJobId` (Task 4), `getRecognitionJobStatus`/`tailRecognitionJob` (Task 5), `useScanDraft.applySmartDetection`, `createDraft` + `pendingAiPayload` (Tasks 2/6).
- Produces: `reattachRecognition(deps): Promise<'none' | 'ready' | 'running' | 'failed'>` — reads the stored id; on `draft_ready` clears the id and returns `'ready'` (the draft already exists server-side, from the completed job); on `running/queued` re-tails then applies the result; on `failed` clears + returns `'failed'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/scanner/__tests__/reattach.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
const getStored = jest.fn(); const clear = jest.fn(); const status = jest.fn();
jest.mock('@/stores/recognitionJobStore', () => ({ getStoredJobId: () => getStored(), clearStoredJobId: () => clear() }));
jest.mock('@/services/scanner/recognitionJobClient', () => ({ getRecognitionJobStatus: (...a: unknown[]) => status(...a), tailRecognitionJob: jest.fn() }));
import { reattachRecognition } from '@/features/scanner/reattachRecognition';

beforeEach(() => { getStored.mockReset(); clear.mockReset(); status.mockReset(); });

it('returns none when no job stored', async () => {
  getStored.mockReturnValue(null);
  expect(await reattachRecognition({})).toBe('none');
});

it('clears + returns ready when the job produced a draft', async () => {
  getStored.mockReturnValue('job-1');
  status.mockResolvedValue({ status: 'draft_ready', draft_id: 'd9' });
  expect(await reattachRecognition({})).toBe('ready');
  expect(clear).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reattach`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// src/features/scanner/reattachRecognition.ts
import { getStoredJobId, clearStoredJobId } from '@/stores/recognitionJobStore';
import { getRecognitionJobStatus, tailRecognitionJob } from '@/services/scanner/recognitionJobClient';

export async function reattachRecognition(deps: {
  onEvent?: (name: string, data: unknown) => void;
  onResult?: (result: unknown) => void;
}): Promise<'none' | 'ready' | 'running' | 'failed'> {
  const jobId = getStoredJobId();
  if (!jobId) return 'none';
  const st = await getRecognitionJobStatus(jobId);
  if (st.status === 'draft_ready') { clearStoredJobId(); return 'ready'; }
  if (st.status === 'failed') { clearStoredJobId(); return 'failed'; }
  // queued | running → re-tail to completion, then hand the result up
  try {
    const result = await tailRecognitionJob(jobId, { afterSeq: 0, onEvent: deps.onEvent });
    clearStoredJobId();
    deps.onResult?.(result);
    return 'running';
  } catch {
    return 'running'; // keep id; a later focus retries
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reattach`
Expected: PASS.

- [ ] **Step 5: Wire reattach on Home focus** — in `app/(tabs)/index.tsx`, when `backgroundRecognitionEnabled()`, run `reattachRecognition` inside a `useFocusEffect`. On `'ready'` toast + refetch the drafts list (`queryClient.invalidateQueries({ queryKey: draftKeys.all })`) and highlight the newest draft when the user opens the list. On `'running'`, when `onResult` fires, apply the result via `useScanDraft.getState().applySmartDetection(mapped, sourcePhotos)` and route into review; on `'failed'` toast an error.

```tsx
import { useFocusEffect } from 'expo-router';
import { reattachRecognition } from '@/features/scanner/reattachRecognition';
import { queryClient } from '@/lib/queryClient';
import { draftKeys } from '@/services/drafts/draftHooks';
import { backgroundRecognitionEnabled } from '@/lib/flags';

useFocusEffect(
  useCallback(() => {
    if (!backgroundRecognitionEnabled()) return;
    let cancelled = false;
    (async () => {
      const outcome = await reattachRecognition({
        onResult: (result) => { if (!cancelled) { /* map + applySmartDetection + route to review */ } },
      });
      if (cancelled) return;
      if (outcome === 'ready') { queryClient.invalidateQueries({ queryKey: draftKeys.all }); toast.success(t('mobile.drafts.readyToast', { defaultValue: 'Your draft is ready' })); }
      if (outcome === 'failed') toast.error(t('mobile.processing.failed', { defaultValue: 'Recognition failed — try again' }));
    })();
    return () => { cancelled = true; };
  }, []),
);
```

- [ ] **Step 6: Verify on emulator** — start a scan, Continue in background, return Home; when the server job finishes you get the "ready" toast and the finished draft appears in **Your drafts**.

- [ ] **Step 7: Commit**

```bash
git add src/features/scanner/reattachRecognition.ts app/\(tabs\)/index.tsx src/features/scanner/__tests__/reattach.test.ts
git commit -m "feat(scan): reattach finished background job on return (seller)"
```

---

# PHASE 2 — Lab (customer) flow

### Task 12: "Save as draft" on the lab draft screen

**Files:**
- Modify: `app/(lab)/draft.tsx`
- Test: `src/features/lab/__tests__/labSaveDraft.test.ts`

**Interfaces:**
- Consumes: `useCreateDraft` (Task 3), `buildLabDraftPayload` (Task 6), `useComposer((s)=>s.mode)`, the live draft frame (`useThread((s)=>s.turn.draft)`), `draftsEnabled()`.
- Produces: on the lab draft screen, when `draftsEnabled()`, a "Save as draft" secondary action that persists the current lab draft frame as an `ai`/`<mode>` draft via `createDraft`.

- [ ] **Step 1: Write the failing test** (the lab payload builder maps a frame)

```ts
// src/features/lab/__tests__/labSaveDraft.test.ts
import { describe, it, expect } from '@jest/globals';
import { buildLabDraftPayload } from '@/services/drafts/draftPayload';

it('builds a lab draft payload with title + mode', () => {
  const out = buildLabDraftPayload({ title: 'HPLC System' }, 'sell');
  expect(out.title).toBe('HPLC System');
  expect((out.payload as any).mode).toBe('sell');
});
```

- [ ] **Step 2: Run test to verify it fails / passes**

Run: `npm test -- labSaveDraft`
Expected: PASS if Task 6 landed (this asserts the shared builder). If Task 6 is present it will already pass — that is fine; this test locks the lab contract. (If you are doing strict red-green, temporarily assert a not-yet-existing field, watch it fail, then correct.)

- [ ] **Step 3: Wire the lab screen** — in `app/(lab)/draft.tsx`, add a Save action. The screen already has a bespoke footer (`:439-479`) with Publish + the stubbed Edit button. Replace the Edit stub's `onPress` OR add a third button:

```tsx
import { useCreateDraft } from '@/services/drafts/draftHooks';
import { buildLabDraftPayload } from '@/services/drafts/draftPayload';
import { draftsEnabled } from '@/lib/flags';
import Constants from 'expo-constants';
import { toast } from 'sonner-native';

const createDraft = useCreateDraft();
const [savingDraft, setSavingDraft] = useState(false);

const onSaveDraft = useCallback(async () => {
  const built = buildLabDraftPayload(liveDraftFrame, mode);
  const siteType = (Constants.expoConfig?.extra?.SITE_TYPE as string) ?? 'LabGreenbidz';
  try {
    setSavingDraft(true);
    await createDraft.mutateAsync({
      session_uuid: `lab-${mode}-${Date.now()}`,   // Date.now ok in app code (only workflow scripts forbid it)
      flow: 'ai', mode, title: built.title, site_type: siteType, product_count: 1, payload: built.payload,
    });
    toast.success(t('mobile.drafts.saved', { defaultValue: 'Draft saved' }));
  } catch {
    toast.error(t('mobile.drafts.saveFailed', { defaultValue: 'Could not save draft' }));
  } finally { setSavingDraft(false); }
}, [liveDraftFrame, mode, createDraft, t]);

// in the footer, render when draftsEnabled():
{draftsEnabled() && (
  <Button title={t('mobile.drafts.saveDraft', { defaultValue: 'Save as draft' })} loading={savingDraft} onPress={onSaveDraft} />
)}
```

- [ ] **Step 4: Verify on emulator** (customer fork: `EXPO_PUBLIC_USER_TYPE=customer`, `EXPO_PUBLIC_LAB_CHAT=1`, `EXPO_PUBLIC_DRAFTS=1`): Home → Sell → photograph → draft screen → **Save as draft** → "Draft saved" toast.

- [ ] **Step 5: Commit**

```bash
git add app/\(lab\)/draft.tsx src/features/lab/__tests__/labSaveDraft.test.ts
git commit -m "feat(lab): save AI draft from the lab draft screen"
```

---

### Task 13: Shared drafts list serves the lab flow + lab sell-mode background

**Files:**
- Modify: `app/scan/drafts.tsx` (route lab drafts back to the lab screen on resume)
- Modify: `app/(lab)/(tabs)/home.tsx` or `app/(lab)/(tabs)/account.tsx` (add a "Your drafts" entry for the customer fork)
- Modify: `app/(lab)/processing.tsx` (sell-mode background start + reattach)
- Test: `src/features/lab/__tests__/labResumeRoute.test.ts`

**Interfaces:**
- Consumes: `IS_CUSTOMER` (`src/lib/flags.ts`), `DraftSummary` (Task 2), the reattach + background helpers (Tasks 10/11).
- Produces: `labResumeRoute(draft: DraftSummary): string` — returns `/(lab)/draft` for lab drafts (`flow:'ai'` + a lab payload) so resume lands on the lab screen; `resolveDraftResumeRoute(draft)` used by the shared list to branch seller vs lab.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/lab/__tests__/labResumeRoute.test.ts
import { describe, it, expect } from '@jest/globals';
import { labResumeRoute } from '@/features/lab/labResumeRoute';

it('routes a lab draft to the lab draft screen', () => {
  expect(labResumeRoute({ mode: 'sell' } as any)).toBe('/(lab)/draft');
  expect(labResumeRoute({ mode: 'buy' } as any)).toBe('/(lab)/draft');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- labResumeRoute`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/features/lab/labResumeRoute.ts`**

```ts
// src/features/lab/labResumeRoute.ts
import type { DraftSummary } from '@/services/drafts/draftApi';

export function isLabDraft(d: Pick<DraftSummary, 'mode'>): boolean {
  return d.mode === 'sell' || d.mode === 'buy';
}
export function labResumeRoute(_d: Pick<DraftSummary, 'mode'>): string {
  return '/(lab)/draft';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- labResumeRoute`
Expected: PASS.

- [ ] **Step 5: Branch resume in the shared list** — in `app/scan/drafts.tsx` `onResume`, before the seller hydrate, branch:

```tsx
import { isLabDraft, labResumeRoute } from '@/features/lab/labResumeRoute';
// at the top of onResume, after `const detail = await getDraft(id)`:
if (isLabDraft(detail)) {
  // rehydrate the lab draft frame into the lab store here (set composer.mode + thread turn.draft
  // from detail.payload.labDraft), then:
  router.push(labResumeRoute(detail) as never);
  setResuming(false);
  return;
}
```

Add a "Your drafts" entry to the customer fork (`app/(lab)/(tabs)/account.tsx` is the least intrusive home for it, matching "mobile stays lean" — no new tab) gated on `draftsEnabled()`, navigating to `/scan/drafts`.

- [ ] **Step 6: Lab sell-mode background** — in `app/(lab)/processing.tsx`, when `backgroundRecognitionEnabled()` **and** `mode === 'sell'` **and** the turn is image-driven, route the recognition through the SAME `startBackgroundRecognition` (Task 10) + `reattachRecognition` (Task 11) instead of the abort-on-unmount chat stream. Render the same "Continue in background" affordance. **Buy-mode chat is explicitly out of scope** — leave its abort-on-unmount behavior unchanged, and do NOT show the affordance for buy mode.

```tsx
import { backgroundRecognitionEnabled } from '@/lib/flags';
const canBackground = backgroundRecognitionEnabled() && mode === 'sell';
{canBackground && (
  <Pressable onPress={/* same handler as Task 10 */}>
    <Text>{t('mobile.processing.continueInBackground', { defaultValue: 'Continue in background' })}</Text>
  </Pressable>
)}
```

- [ ] **Step 7: Verify on emulator** (customer fork): save a lab draft, open **Your drafts** from Account, Continue → lands on the lab draft screen restored. In Sell mode, Continue-in-background works; in Buy mode the affordance is absent.

- [ ] **Step 8: Commit**

```bash
git add app/scan/drafts.tsx app/\(lab\)/\(tabs\)/account.tsx app/\(lab\)/processing.tsx src/features/lab/labResumeRoute.ts src/features/lab/__tests__/labResumeRoute.test.ts
git commit -m "feat(lab): shared drafts list + sell-mode background recognition"
```

---

# PHASE 3 — Cross-cutting

### Task 14: Push-tap deep-link → drafts

**Files:**
- Modify: `src/lib/onesignal.ts` (add a notification-click listener)
- Modify: `src/features/lab/notifications/notificationNav.ts` (map `recognition_draft_ready`)
- Test: `src/features/lab/notifications/__tests__/notificationNav.test.ts`

**Interfaces:**
- Consumes: `routeForType` (existing), `router` (expo-router).
- Produces: `routeForType('recognition_draft_ready')` → `/scan/drafts`; a OneSignal `click` listener that reads `notification.additionalData.type` and `router.push(routeForType(type))`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/lab/notifications/__tests__/notificationNav.test.ts
import { describe, it, expect } from '@jest/globals';
import { routeForType } from '@/features/lab/notifications/notificationNav';

it('maps recognition_draft_ready to the drafts screen', () => {
  expect(routeForType('recognition_draft_ready')).toBe('/scan/drafts');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- notificationNav`
Expected: FAIL — returns `null` for the new type.

- [ ] **Step 3: Add the mapping** in `src/features/lab/notifications/notificationNav.ts`:

```ts
if (type === 'recognition_draft_ready') return '/scan/drafts';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- notificationNav`
Expected: PASS.

- [ ] **Step 5: Wire the OneSignal click listener** in `src/lib/onesignal.ts` `initOneSignal()` (native-guarded, following the existing lazy-require pattern):

```ts
import { router } from 'expo-router';
import { routeForType } from '@/features/lab/notifications/notificationNav';
// inside initOneSignal(), after init:
OneSignal.Notifications.addEventListener('click', (event: any) => {
  const type = event?.notification?.additionalData?.type;
  const route = typeof type === 'string' ? routeForType(type) : null;
  if (route) router.push(route as never);
});
```

- [ ] **Step 6: Verify on emulator** (best-effort — requires a real push; at minimum confirm the listener registers without crashing and the unit test passes). Manual push testing is staging-only per the notifications setup.

- [ ] **Step 7: Commit**

```bash
git add src/lib/onesignal.ts src/features/lab/notifications/notificationNav.ts src/features/lab/notifications/__tests__/notificationNav.test.ts
git commit -m "feat(notifications): push-tap deep-link to drafts (recognition_draft_ready)"
```

---

### Task 15: i18n keys across all six locales

**Files:**
- Modify: `src/i18n/locales/en.json`, `zh-Hant.json`, `zh-Hans.json`, `ja.json`, `th.json`, `vi.json`
- Test: `src/i18n/__tests__/draftKeys.test.ts`

**Interfaces:**
- Produces: a `mobile.drafts` block and new `mobile.detail.saveDraft` / `mobile.processing.continueInBackground` / `mobile.processing.leftToast` / `mobile.processing.failed` keys in every locale.

- [ ] **Step 1: Write the failing test** (every locale has the new keys)

```ts
// src/i18n/__tests__/draftKeys.test.ts
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

const REQUIRED = ['saved', 'saveFailed', 'saveDraft', 'continue', 'delete', 'empty', 'yourDrafts', 'readyToast', 'itemCount', 'loadError'];

describe('drafts i18n', () => {
  for (const [name, dict] of Object.entries({ en, zhHant, zhHans, ja, th, vi })) {
    it(`${name} has all mobile.drafts keys`, () => {
      const drafts = (dict as any).mobile?.drafts ?? {};
      for (const k of REQUIRED) expect(drafts[k]).toBeTruthy();
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- draftKeys`
Expected: FAIL — `mobile.drafts` missing.

- [ ] **Step 3: Add the keys.** In `en.json`, add under `mobile`:

```json
"drafts": {
  "saved": "Draft saved",
  "saveFailed": "Could not save draft",
  "saveDraft": "Save as draft",
  "continue": "Continue",
  "delete": "Delete",
  "empty": "No saved drafts yet",
  "yourDrafts": "Your drafts",
  "readyToast": "Your draft is ready",
  "itemCount_one": "{{count}} item",
  "itemCount_other": "{{count}} items",
  "loadError": "Could not load drafts"
}
```

Add `"saveDraft": "Save as draft"` to `mobile.detail`, and `"continueInBackground": "Continue in background"`, `"leftToast": "We'll notify you when it's ready"`, `"failed": "Recognition failed — try again"` to `mobile.processing`. Then add the **translated** equivalents to the other five files (use the app's existing translations for tone; do not leave English in non-English files — Chinese must be real zh-Hant/zh-Hans, etc.). Adjust the test's `REQUIRED` if you keep `itemCount_one/_other` instead of a bare `itemCount`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- draftKeys`
Expected: PASS for all six locales.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/zh-Hant.json src/i18n/locales/zh-Hans.json src/i18n/locales/ja.json src/i18n/locales/th.json src/i18n/locales/vi.json src/i18n/__tests__/draftKeys.test.ts
git commit -m "i18n(drafts): drafts + background keys across all locales"
```

---

### Task 16: Full-suite green + typecheck + emulator smoke + rollout

**Files:** none (verification + `.env`)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS (all new + existing suites).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in the new/modified files.

- [ ] **Step 3: Emulator smoke — seller fork** (`.env`: `EXPO_PUBLIC_USER_TYPE` unset/seller, `EXPO_PUBLIC_DRAFTS=1`, `EXPO_PUBLIC_BACKGROUND_RECOGNITION=1`; `CI=1 npx expo start --dev-client`, restart Metro after `.env` edits). Verify: Save as draft → drafts list → Continue restores; Continue-in-background → return → ready toast + draft in list.

- [ ] **Step 4: Emulator smoke — customer/lab fork** (`.env`: `EXPO_PUBLIC_USER_TYPE=customer`, `EXPO_PUBLIC_LAB_CHAT=1`, `EXPO_PUBLIC_DRAFTS=1`, `EXPO_PUBLIC_BACKGROUND_RECOGNITION=1`). Verify: Sell → Save as draft → Your drafts (from Account) → Continue restores the lab draft; Sell-mode background works, Buy-mode has no background affordance.

- [ ] **Step 5: Rollout order** (staged; both backends already live):
  1. Merge with **both flags OFF** (no behavior change; the sync paths are untouched).
  2. Flip `EXPO_PUBLIC_DRAFTS=1` in the build first (Save-as-draft + list). Confirm on device.
  3. Then flip `EXPO_PUBLIC_BACKGROUND_RECOGNITION=1`. Confirm reattach on device.
  A dev-client rebuild (`npx expo run:android -PreactNativeArchitectures=x86_64` for the emulator, or the arm64 tester build for physical devices) is required to pick up new native deps if any were added — none are added by this plan, so an OTA/Metro reload is sufficient for the flag flips.

- [ ] **Step 6: Commit any `.env.example` documentation**

```bash
git add .env.example
git commit -m "docs(env): document DRAFTS + BACKGROUND_RECOGNITION flags"
```

---

## Self-Review

**1. Spec coverage** — the two web features map to tasks: Save-as-draft → Tasks 2,3,6,7,8,12; drafts list/resume → Tasks 7,9,13; Continue-in-background → Tasks 4,5,10,11,13; both flows covered (seller Phase 1, lab Phase 2); cross-cutting (push, i18n, rollout) Phase 3. The shared `pending-ai` contract (Task 6) ties a finished background job to the drafts list, satisfying "tightly interleaved."

**2. Placeholder scan** — two soft spots are called out explicitly rather than hidden: (a) the draft response envelope (`res.data.data`) has a pre-check against the Node controller in Task 2; (b) the `pending-ai` resume branch in Task 9 is completed by the shared mapping in Task 11/12. The `buildSnapshot` placeholder in Task 8 is resolved by exporting `snapshotForServer` in the same task. No `TODO`/`handle edge cases` left.

**3. Type consistency** — `DraftSummary`/`DraftDetail`/`CreateDraftReq`/`PendingAiPayload`/`FormBlobPayload` are defined once in `draftApi.ts` (Task 2) and reused verbatim in Tasks 3, 6, 9, 13. `draftKeys` (Task 3) is used in Tasks 9, 11. `hydrateFromServer` (Task 7) is consumed in Task 9. `startBackgroundRecognition`/`reattachRecognition`/`storeJobId`/`getStoredJobId`/`clearStoredJobId` names are consistent across Tasks 4, 10, 11, 13. `routeForType` extended in Task 14 matches the existing signature.

**Known dependency to flag for the executor:** lab **sell-mode** background (Task 13 §6) assumes lab sell recognition can be expressed as an image → `recognition-jobs` job (same pipeline as seller). If the lab sell flow is chat-only (no discrete image job), that step degrades to "not supported for lab" — leave lab background to seller-parity and ship lab Save-as-draft + list only. Confirm against the lab sell turn shape before implementing Task 13 §6.
