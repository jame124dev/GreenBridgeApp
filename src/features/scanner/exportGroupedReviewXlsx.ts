/**
 * Export the grouped-review queue to a `.xlsx` file with an embedded photo
 * per row, then hand it to the OS share sheet.
 *
 * Owner: "export opiton can we add so user can user as xlex... imge should be
 * clear and pricing" (2026-09-25) — a bulk take-away of what the scan found,
 * shaped like the product-list exports other marketplaces ship.
 *
 * ── Why `exceljs`, and why the image is EMBEDDED not linked ──
 *
 * `exceljs` is already proven in this codebase family for exactly this task —
 * `101recycle-greenbidz-backend/services/officeImages.js` uses it to read
 * images back OUT of an uploaded xlsx via `worksheet.getImages()`; this is
 * the write-side mirror, `workbook.addImage()` + `worksheet.addImage()`. The
 * backend's OWN xlsx exporters (`exportController.js`, `DownownloadReport.js`)
 * only ever put an image URL in a text column — asked, and the owner chose
 * a real embedded thumbnail over that lighter, already-proven path, so this
 * is the one write path in the whole workspace that does it.
 *
 * ⚠️ NOT `Buffer` as a global. Hermes has no `Buffer`; importing it from the
 * `buffer` package (already a transitive dependency of several RN libs here,
 * added as a direct one for this file) sidesteps relying on a global that may
 * or may not have been polyfilled elsewhere.
 *
 * ⚠️ NOT `expo-file-system`'s default export. `persistPhotos.ts` already
 * established `expo-file-system/legacy` as this app's import path for the
 * classic (non-`File`/`Directory`-class) API this function also uses.
 *
 * ⚠️ `exceljs` AND `expo-sharing` ARE BOTH LOADED LAZILY, inside the
 * function, not as top-level imports. Metro bundles the whole dev graph
 * eagerly regardless of which route is open, so a static `import` of either
 * ran at APP BOOT — before this screen, or this button, was ever reached.
 * `exceljs` threw `RangeError: Maximum call stack size exceeded (native
 * stack depth)`; `expo-sharing` throws `Cannot find native module
 * 'ExpoSharing'` on any dev client build from before this feature was added
 * (its native side needs `npx expo run:android`/`run:ios`, a JS-only reload
 * cannot link it in). Both errors surfaced on the HOME screen, nowhere near
 * this file's own button. Deferring the import defers the cost to the one
 * moment this feature is actually used, and after the native rebuild lands,
 * `expo-sharing` resolves the same way either way — this is not a permanent
 * workaround, just the difference between "the whole app breaks" and "this
 * one button doesn't work yet" in the meantime.
 *
 * ⚠️ THUMBNAILS ARE RESIZED BEFORE EMBEDDING, NEVER THE FULL PHOTO.
 * `photos[0].uri` is whatever `compressPhoto` in `persistPhotos.ts` left on
 * disk for the SCAN flow — full listing-quality, multi-megabyte JPEGs. Fetch
 * + base64-encode + exceljs's own pure-JS zip step all scale with that size,
 * and on a 10-product export the first version of this file spent minutes
 * doing it on-device with no error and no visible progress, which reads as
 * "hung" even though it is not (own device test, 2026-09-25). Reusing
 * `expo-image-manipulator` (already vendored for exactly this purpose in
 * `compress.ts`) to resize down to the cell's own display size first cuts
 * the bytes moving through every later step by roughly two orders of
 * magnitude, and it accepts BOTH local `file://` and remote `https://`
 * source URIs, so the separate fetch-vs-file branch this file used to need
 * is gone with it.
 *
 * ⚠️ RESIZED IN PARALLEL, THEN EMBEDDED IN ORDER. The resize/read step per
 * photo is I/O, not CPU, so awaiting it one row at a time (the original
 * shape of this loop) serializes N network/disk round-trips for no reason;
 * `Promise.all` runs them concurrently and the (fast, synchronous) embedding
 * loop after it puts each result at the row it belongs to either way.
 *
 * ⚠️ THUMBNAILS ARE CACHED IN MMKV, KEYED BY SOURCE URI + TARGET PIXEL SIZE.
 * A re-export of the same draft (retry after a failure, or exporting twice)
 * redid all N image round-trips from scratch — on a remote-photo draft that
 * is the single biggest cost in the whole function, repeated for no reason,
 * since the same URI resizes to the same bytes every time. Reuses the app's
 * one shared MMKV instance (`src/lib/mmkv.ts`, already used by auth/drafts/
 * other stores) rather than introducing a second storage mechanism. The key
 * includes `THUMBNAIL_PIXEL_SIZE` so a future change to that constant can't
 * silently serve a stale, wrong-sized cached thumbnail.
 *
 * ⚠️ PROGRESS IS REPORTED PER-PHOTO, NOT LEFT AS A STATIC LABEL. The button
 * previously said "Preparing spreadsheet…" for the ENTIRE duration — 60-90s
 * on a 10-item remote-photo draft — with nothing to distinguish real,
 * in-progress work from a hang (own device test, 2026-09-25; see also the
 * `THUMBNAIL_TIMEOUT_MS` note above, added for the same underlying problem).
 * `onProgress(done, total)` fires as each thumbnail resolves (cache hit or
 * real fetch), so the caller can render "Preparing 6 of 10…" instead.
 *
 * ⚠️ NAME IS COLUMN A, EVERY PHOTO GETS ITS OWN COLUMN. Owner (2026-09-25):
 * "first order should [be] name of product then image one image two" — a
 * multi-photo item (this codebase's own multi-item drafts run up to 8-19
 * photos per product, see `KS Orbital Shaking Incubator OSI 500` in the
 * grouped-review screen this exports from) used to only ever embed
 * `photos[0]`, silently dropping every other angle. The column count is
 * derived from the WIDEST item in this specific export
 * (`Math.max(...items.map(i => i.photos.length))`) — items with fewer
 * photos just leave their later Image N cells blank, there is no separate
 * per-item column count to track. Progress is counted per PHOTO now, not
 * per item, since that is the actual unit of I/O work happening underneath.
 */
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { mmkv } from '@/lib/mmkv';
import type { DraftItem } from '@/stores/scanDraftStore';

/** Cell width the thumbnail column measures against (px, Excel's own unit). */
const IMAGE_CELL_SIZE = 72;
/** exceljs wants points; ~0.75pt per px is Excel's own row-height convention. */
const IMAGE_ROW_HEIGHT_PT = IMAGE_CELL_SIZE * 0.75;
/**
 * Resized to 2x the display size for a crisp thumbnail on a high-DPI
 * screen, not to the raw multi-megapixel original — this is the whole fix.
 */
const THUMBNAIL_PIXEL_SIZE = IMAGE_CELL_SIZE * 2;

/**
 * A remote thumbnail (a document-extracted item's `thumbnail_object`, served
 * off GCS) can be slow or simply never resolve — `ImageManipulator` gives no
 * way to bound how long its own download+resize takes, and a single stalled
 * photo previously stuck the WHOLE export on "Preparing spreadsheet…"
 * forever, with the CPU still busy (so it never looked crashed, only stuck).
 * A local `file://` capture has never shown this; it is specifically a
 * remote-fetch risk, which the earlier (local-photo-only) test of this
 * feature never exercised.
 */
const THUMBNAIL_TIMEOUT_MS = 10_000;

/** MMKV key prefix for a cached resized thumbnail. Includes the target pixel
 *  size so a future change to `THUMBNAIL_PIXEL_SIZE` can't serve a stale,
 *  wrong-sized cached entry under the same key. */
const THUMBNAIL_CACHE_PREFIX = `export-thumb-v${THUMBNAIL_PIXEL_SIZE}:`;

function timeout<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms));
}

/** `null` when the item has no photo, or the resize/read step failed OR ran
 *  past `THUMBNAIL_TIMEOUT_MS` — the row still exports, just without a
 *  thumbnail, rather than blocking every other row behind it. Checks the
 *  MMKV cache first, keyed by the source URI, so re-exporting the same
 *  draft skips the fetch+resize+encode round-trip entirely on every photo
 *  it already processed once. */
async function thumbnailBase64(uri: string | undefined): Promise<string | null> {
  if (!uri) return null;
  const cacheKey = THUMBNAIL_CACHE_PREFIX + uri;
  const cached = mmkv.getString(cacheKey);
  if (cached) return cached;
  try {
    const base64 = await Promise.race([
      (async () => {
        const resized = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: THUMBNAIL_PIXEL_SIZE } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        return FileSystem.readAsStringAsync(resized.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      })(),
      timeout<string>(THUMBNAIL_TIMEOUT_MS),
    ]);
    mmkv.set(cacheKey, base64);
    return base64;
  } catch {
    return null;
  }
}

function priceLabel(item: DraftItem): string {
  if (!item.pricePerUnit) return '';
  const formatted = `${item.priceCurrency} ${item.pricePerUnit}`;
  return item.priceFormat === 'offer' ? `${formatted} (offers)` : formatted;
}

export type ExportGroupedReviewResult = { fileUri: string; shared: boolean };

/** `done` counts a thumbnail as soon as it SETTLES — cache hit, real
 *  fetch+resize, failure, or timeout all advance it — so the counter always
 *  reaches `total` and the caller can render "Preparing N of total…". */
export type ExportProgress = { done: number; total: number };

/**
 * Builds the workbook and shares it. Never throws for a single item's photo
 * failing to embed — that row just ships without a thumbnail rather than
 * failing the whole export, since a partial spreadsheet is still useful and
 * a photo fetch is the one step here with real network dependence.
 */
export async function exportGroupedReviewToXlsx(
  items: DraftItem[],
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportGroupedReviewResult> {
  const [{ default: ExcelJS }, Sharing] = await Promise.all([
    import('exceljs'),
    import('expo-sharing'),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GreenBidz';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Products');

  // Column count is driven by the item with the MOST photos in this export,
  // never a fixed number — see the header note. At least 1 so a photo-less
  // export still has an Image 1 column to leave blank rather than none.
  const maxPhotos = Math.max(1, ...items.map((item) => item.photos.length));
  const imageColumns = Array.from({ length: maxPhotos }, (_, i) => ({
    header: `Image ${i + 1}`,
    key: `image${i + 1}`,
    width: IMAGE_CELL_SIZE / 7,
  }));
  sheet.columns = [
    { header: 'Name', key: 'name', width: 42 },
    ...imageColumns,
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Condition', key: 'condition', width: 20 },
    { header: 'Grade', key: 'grade', width: 10 },
    { header: 'Price', key: 'price', width: 20 },
    { header: 'Marketplace', key: 'marketplace', width: 16 },
    { header: 'Quantity', key: 'quantity', width: 10 },
  ];
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };

  // All I/O up front, concurrently — see the header note on why this isn't
  // one `await` per row/photo. Progress is counted per PHOTO (the real unit
  // of I/O), not per item — a multi-photo item reports several ticks, an
  // item with no photos reports none. Each item's own thumbnail array keeps
  // its original photo order, so `perItemThumbnails[i][p]` always lands in
  // "Image p+1" for item i regardless of how many photos other items have.
  let settled = 0;
  const totalPhotos = items.reduce((sum, item) => sum + item.photos.length, 0);
  const perItemThumbnails = await Promise.all(
    items.map((item) =>
      Promise.all(
        item.photos.map(async (photo) => {
          const result = await thumbnailBase64(photo.uri);
          settled += 1;
          onProgress?.({ done: settled, total: totalPhotos });
          return result;
        }),
      ),
    ),
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = sheet.addRow({
      name: item.title || `Product ${i + 1}`,
      category: item.categoryName ?? '',
      condition: item.condition.join(', '),
      grade: item.grade ?? '',
      price: priceLabel(item),
      marketplace: item.marketplace,
      quantity: item.quantity,
    });
    row.height = IMAGE_ROW_HEIGHT_PT;
    row.alignment = { vertical: 'middle' };

    const thumbnails = perItemThumbnails[i];
    for (let p = 0; p < thumbnails.length; p++) {
      const base64 = thumbnails[p];
      if (!base64) continue;

      // Always JPEG — `thumbnailBase64` re-encodes every photo through
      // `ImageManipulator`'s `SaveFormat.JPEG`, so there is no original
      // extension left to sniff.
      const imageId = workbook.addImage({ base64, extension: 'jpeg' });
      // 0-based row/col — `row.number - 1` because exceljs's `addImage`
      // anchor and the 1-based `Row.number` it came from don't share an
      // origin. Col 0 is Name, so photo p (0-based) lands in col `p + 1`.
      sheet.addImage(imageId, {
        tl: { col: p + 1, row: row.number - 1 },
        ext: { width: IMAGE_CELL_SIZE, height: IMAGE_CELL_SIZE },
        editAs: 'oneCell',
      });
    }
  }

  // ⚠️ NOT console-silenced here. A time-boxed suppression window around this
  // call was tried first and confirmed insufficient on-device: the delayed
  // `console.warn`/`.error` call exceljs's zip pipeline schedules (see
  // `silenceExceljsLogNoise.ts` for the full root-cause writeup) can fire
  // well over 90s after `writeBuffer()` resolves — no fixed timeout covers
  // that. The permanent, unbounded fix is `silenceExceljsLogNoise()`, wired
  // once at app boot in `app/_layout.tsx`, filtering the exact noise
  // signature at the `console.error`/`.warn` level itself regardless of when
  // it fires.
  const buffer = await workbook.xlsx.writeBuffer();
  const base64Workbook = Buffer.from(buffer).toString('base64');
  const fileUri = `${FileSystem.cacheDirectory}greenbidz-products-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64Workbook, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export products',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }

  return { fileUri, shared: canShare };
}
