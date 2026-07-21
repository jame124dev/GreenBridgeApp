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
