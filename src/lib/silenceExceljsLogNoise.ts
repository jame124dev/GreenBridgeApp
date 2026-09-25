/**
 * Permanent, targeted `console.error`/`.warn` filter for one exact, known-benign
 * third-party noise signature — NOT a general log suppressor.
 *
 * Found 2026-09-25 exporting a grouped-review draft to `.xlsx`
 * (`exportGroupedReviewXlsx.ts`): `exceljs`'s pure-JS zip-write pipeline
 * schedules a DETACHED internal `console.warn`/`.error` call in a microtask
 * that outlives `workbook.xlsx.writeBuffer()`'s own returned promise. RN's
 * default unhandled-rejection tracking (`promiseRejectionTrackingOptions.js`)
 * routes that call through `console.error`, and LogBox's own serializer
 * overflows trying to print whatever argument exceljs passed — surfacing as
 * `RangeError: Maximum call stack size exceeded (native stack depth)`.
 *
 * ⚠️ A time-boxed suppression window around `writeBuffer()` was tried first
 * and confirmed insufficient on-device: the delay between `writeBuffer()`
 * resolving and this call actually firing is UNBOUNDED — it depends on
 * remaining CPU work in exceljs's own zip pipeline plus however long the
 * share sheet stays open afterward (observed >90s end-to-end on a 10-item,
 * several-remote-photo draft). No fixed timeout can cover that. Filtering at
 * the `console.error`/`.warn` level itself, permanently, is the only shape
 * of fix that doesn't depend on guessing a duration.
 *
 * Scoped to the EXACT error text, not a broad pattern — every other
 * console.error/.warn in the app (including this file's own future ones)
 * still reaches LogBox untouched.
 */
const EXCELJS_NOISE_SIGNATURE = 'Maximum call stack size exceeded (native stack depth)';

function isExceljsNoise(args: unknown[]): boolean {
  return args.some(
    (arg) => typeof arg === 'string' && arg.includes(EXCELJS_NOISE_SIGNATURE),
  ) || args.some(
    (arg) => arg instanceof Error && arg.message.includes(EXCELJS_NOISE_SIGNATURE),
  );
}

export function silenceExceljsLogNoise(): void {
  const realError = console.error;
  const realWarn = console.warn;

  console.error = (...args: unknown[]) => {
    if (isExceljsNoise(args)) return;
    realError(...args);
  };

  console.warn = (...args: unknown[]) => {
    if (isExceljsNoise(args)) return;
    realWarn(...args);
  };
}
