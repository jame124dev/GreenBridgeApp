import {
  createRecognitionJob,
  type CreateRecognitionJobInput,
} from '@/services/scanner/recognitionJobClient';
import { storeJobId } from '@/stores/recognitionJobStore';

/**
 * Continue-in-background (Task 10) — kicks off a server-side recognition job
 * for already-uploaded GCS image/document URLs and persists its id so the
 * seller can leave the processing screen without losing the run (Task 11
 * reattaches to the stored id).
 *
 * Pure orchestration, no upload/tail logic here: `processing.tsx` uploads
 * (reusing the same `uploadGcsPhotos`/`uploadGcsDocuments` + `gcsUrlForAnalyze`
 * helpers `useSmartDetect` uses internally) and builds `image_urls`/
 * `document_urls` BEFORE calling this; the caller separately calls
 * `tailRecognitionJob(job_id, ...)` to keep driving the on-screen step
 * indicator while the job runs.
 */
export async function startBackgroundRecognition(
  input: CreateRecognitionJobInput,
): Promise<string> {
  const { job_id } = await createRecognitionJob(input);
  storeJobId(job_id);
  return job_id;
}
