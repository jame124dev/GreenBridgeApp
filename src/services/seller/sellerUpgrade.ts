// Seller upgrade — the buyer→seller application a pending buyer submits before
// they may list anything.
//
//   POST /seller-upgrade/request    multipart, `protect`
//   GET  /seller-upgrade/my-status  `protect`
//
// Both routes derive WHO is applying from the JWT (`req.user.id`), never from
// the body — a previous version trusted a body/query `user_id` and was an
// impersonation/IDOR hole (see the comment block in
// `routes/sellerUpgradeRoute.js`). So there is no user id to send from here.
// `protect` validates the token and loads the user; it never reads
// `pw_user_status`, which is why a *pending* session can submit this at all.
//
// ⚠️ THE WIRE IS snake_case. `submitRequestController` destructures
// `{ company_name, company_tax_id, business_type, reason, phone, country }` off
// `req.body` and picks files out of `req.files.doc_business_reg_cert` /
// `req.files.doc_waste_disposal_permit` (multer `upload1.fields`). Sending a
// camelCase key does NOT fail — the column is written NULL and an admin reviews
// a blank application. The app side stays camelCase; the mapping below is the
// single place the two spellings meet, and `__tests__/useSellerUpgrade.test.ts`
// asserts every name literally.
import { Platform } from 'react-native';

import { greenbidz } from '@/api/greenbidzClient';

const IS_WEB = Platform.OS === 'web';

/** App-side (camelCase) application values — what the form collects. */
export type SellerApplicationInput = {
  companyName: string;
  taxId: string;
  businessType: string;
  phone: string;
  country: string;
  reason: string;
};

/** A picked file, in the shape React Native's FormData accepts directly
 *  (`expo-document-picker` assets provide `uri`/`name`/`mimeType`). */
export type SellerDocument = { uri: string; name: string; type: string };

/** Both documents are OPTIONAL — the server stores null when they are absent. */
export type SellerDocs = {
  businessRegCert?: SellerDocument;
  wasteDisposalPermit?: SellerDocument;
};

export type SellerUpgradeStatusValue = 'pending' | 'approved' | 'rejected';

/** The subset of the request row the app reads. `status` is the sell gate. */
export type SellerUpgradeStatus = {
  status: SellerUpgradeStatusValue;
  company_name: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
};

export type SellerUpgradeErrorCode =
  /** "You already have a pending seller upgrade request." */
  | 'DUPLICATE_PENDING'
  /** "Your seller upgrade has already been approved." */
  | 'ALREADY_APPROVED'
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN';

export class SellerUpgradeError extends Error {
  constructor(
    public code: SellerUpgradeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SellerUpgradeError';
  }
}

/** camelCase (app) → snake_case (wire). Order matches the controller's destructure. */
const TEXT_FIELDS: [keyof SellerApplicationInput, string][] = [
  ['companyName', 'company_name'],
  ['taxId', 'company_tax_id'],
  ['businessType', 'business_type'],
  ['reason', 'reason'],
  ['phone', 'phone'],
  ['country', 'country'],
];

/** The two multer field names declared in `upload1.fields([...])`. */
const DOC_FIELDS: [keyof SellerDocs, string][] = [
  ['businessRegCert', 'doc_business_reg_cert'],
  ['wasteDisposalPermit', 'doc_waste_disposal_permit'],
];

async function appendDocument(fd: FormData, field: string, doc: SellerDocument) {
  if (IS_WEB) {
    // Browser FormData needs a real Blob, not the { uri, name, type } shape RN
    // uses — same split as `services/scanner/buildFormData.ts`.
    const blob = await fetch(doc.uri).then((r) => r.blob());
    fd.append(field, blob, doc.name);
    return;
  }
  fd.append(field, {
    uri: doc.uri,
    name: doc.name,
    type: doc.type || 'application/octet-stream',
  } as unknown as Blob);
}

function messageOf(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

/** Map an axios failure onto a code the screen can switch on. The two duplicate
 *  cases are matched on the server's message because the controller answers both
 *  with a bare 400 + `message` (`sellerUpgradeService.js` throws plain Errors) —
 *  there is no machine code to key off. Substring-matched, so re-wording the
 *  sentence around the phrase does not break the mapping. */
function toSellerUpgradeError(err: unknown): SellerUpgradeError {
  if (err instanceof SellerUpgradeError) return err;

  const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
  if (!axiosErr.response) {
    return new SellerUpgradeError('NETWORK', 'Network error — check your connection');
  }

  const message = messageOf(err) ?? 'Could not submit your application';
  const lower = message.toLowerCase();
  if (lower.includes('already have a pending')) {
    return new SellerUpgradeError('DUPLICATE_PENDING', message);
  }
  if (lower.includes('already been approved')) {
    return new SellerUpgradeError('ALREADY_APPROVED', message);
  }
  if (axiosErr.response.status === 400) {
    return new SellerUpgradeError('VALIDATION', message);
  }
  return new SellerUpgradeError('UNKNOWN', message);
}

/** Submit the buyer→seller application. Resolves on 201; every failure throws a
 *  `SellerUpgradeError` so the UI can show the server's own sentence. */
export async function submitSellerUpgrade(
  values: SellerApplicationInput,
  files?: SellerDocs,
): Promise<void> {
  const fd = new FormData();
  for (const [appKey, wireKey] of TEXT_FIELDS) {
    fd.append(wireKey, values[appKey] ?? '');
  }
  for (const [appKey, wireKey] of DOC_FIELDS) {
    const doc = files?.[appKey];
    // Skip rather than append an empty value: multer would otherwise see a
    // text part where it expects a file.
    if (doc) await appendDocument(fd, wireKey, doc);
  }

  let res;
  try {
    // Two safeguards for multipart on React Native, copied from
    // `services/scanner/analyzeImages.ts`: `transformRequest` pass-through stops
    // axios JSON-stringifying the FormData, and the explicit Content-Type lets
    // RN's networking layer fill in the boundary.
    res = await greenbidz.post('/seller-upgrade/request', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
  } catch (err) {
    throw toSellerUpgradeError(err);
  }

  // The controller answers 201 `{ success: true }`. A 2xx with `success: false`
  // means it failed anyway — do not let that read as a submitted application.
  if (res?.data?.success === false) {
    throw new SellerUpgradeError(
      'UNKNOWN',
      (res.data.message as string) ?? 'Could not submit your application',
    );
  }
}

/** `null` = never applied. Anything else is the most recent request row. */
export async function getSellerUpgradeStatus(): Promise<SellerUpgradeStatus | null> {
  let res;
  try {
    res = await greenbidz.get('/seller-upgrade/my-status');
  } catch (err) {
    throw toSellerUpgradeError(err);
  }

  const row = res?.data?.data as Record<string, unknown> | null | undefined;
  if (!row) return null;

  const status = row.status;
  // Unknown status → treat as "no application". Never guess `approved`: this
  // value is the sell gate, so an unrecognised string must fail CLOSED.
  if (status !== 'pending' && status !== 'approved' && status !== 'rejected') return null;

  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
  return {
    status,
    company_name: str(row.company_name),
    admin_notes: str(row.admin_notes),
    reviewed_at: str(row.reviewed_at),
  };
}
