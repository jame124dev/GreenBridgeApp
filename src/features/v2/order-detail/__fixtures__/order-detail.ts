/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * `CHECKOUT_FIXTURE` covers every real case seen live for buyer 574 plus the
 * stages that buyer's data never reached. `SHIPMENT_FIXTURE` is a lookup by
 * `checkout_id`, since `GET /shipment/order/:id` is auth-gated and could not
 * be curled — every shipment shape here is invented from the DECLARED type
 * (`shipmentApiSlice.ts`), not from a live response. Said plainly in the
 * screen's own docblock too; do not read this fixture as proof of the real
 * shipment shape, only of the declared one.
 *
 * | # | Checkout status | Shipment | The case it covers |
 * |---|---|---|---|
 * | 1 | `pending` | none, `canBook: false` | the REAL live shape for buyer 574 — no seller action yet, nothing to book |
 * | 2 | `confirmed` | none, `canBook: true`, one blocker | "why can't I book a label" has an answer, even though booking itself is the seller's control, out of scope here |
 * | 3 | `shipped` | present, 4 events, in progress | the working case — carrier, tracking number, a real event history |
 * | 4 | `delivered` | present, 5 events, terminal | the events list ends in `delivered`, matching the checkout's own status |
 * | 5 | `cancelled` | none | **no progression rail at all** — `CHECKOUT_STAGES` excludes `cancelled` on purpose |
 * | 6 | `pending`, `created_at: null`, no `batch` join | none | the REAL live shape again — null date, no title, no photo |
 * | 7 | `completed`, **112-char title** | present, 1 event | truncation at the header, and a shipment with only its FIRST event so far |
 */
import type { Checkout, ShipmentForOrder } from '../types';

const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const CHECKOUT_FIXTURE: readonly Checkout[] = [
  {
    checkout_id: 4,
    batch_id: 484,
    quantity: 1,
    total_price: 345,
    currency: 'USD',
    shipping_address: '',
    status: 'pending',
    payment_status: 'pending',
    created_at: null,
    batch: { batch_number: 465, products: [{ title: 'T 1200 Tested Private', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 88,
    batch_id: 5044,
    quantity: 1,
    total_price: 30667,
    currency: 'USD',
    shipping_address: '221B Industrial Way, Austin, TX',
    status: 'confirmed',
    payment_status: 'success',
    created_at: '2026-09-18T09:00:00Z',
    batch: { batch_number: 5044, products: [{ title: 'N9952A Handheld Spectrum Analyzer', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 91,
    batch_id: 4188,
    quantity: 1,
    total_price: 532,
    currency: 'USD',
    shipping_address: '9 Harbour Rd, Kaohsiung',
    status: 'shipped',
    payment_status: 'success',
    created_at: '2026-09-10T09:00:00Z',
    batch: { batch_number: 4188, products: [{ title: '34902A 6-Channel Multiplexer Module', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 93,
    batch_id: 3990,
    quantity: 2,
    total_price: 1500,
    currency: 'USD',
    shipping_address: '77 Dock St, Newark, NJ',
    status: 'delivered',
    payment_status: 'success',
    created_at: '2026-08-20T09:00:00Z',
    batch: { batch_number: 3990, products: [{ title: 'Waters ACQUITY UPLC Column Kit', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 95,
    batch_id: 3801,
    quantity: 1,
    total_price: 210,
    currency: 'USD',
    shipping_address: '',
    status: 'cancelled',
    payment_status: 'failed',
    created_at: '2026-08-01T09:00:00Z',
    batch: { batch_number: 3801, products: [{ title: 'Rigol DP832 Power Supply', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 10,
    batch_id: 484,
    quantity: 1,
    total_price: 345,
    currency: 'USD',
    shipping_address: '',
    status: 'pending',
    payment_status: 'pending',
    created_at: null,
    // No `batch` at all — the live response can omit the join entirely.
  },
  {
    checkout_id: 97,
    batch_id: 4870,
    quantity: 1,
    total_price: 8950,
    currency: 'USD',
    shipping_address: '4 Riverside Ave, Cork, Ireland',
    status: 'completed',
    payment_status: 'success',
    created_at: '2026-07-15T09:00:00Z',
    batch: {
      batch_number: 4870,
      products: [
        {
          title:
            'Thermo Scientific Sorvall RC-6 Plus Superspeed Centrifuge with F21S-8x50y Fixed Angle Rotor Set and Accessory Kit',
          image1: LOADABLE_IMAGE,
        },
      ],
    },
  },
];

/** Keyed by `checkout_id` — `GET /shipment/order/:id` is one order at a time. */
export const SHIPMENT_FIXTURE: Readonly<Record<number, ShipmentForOrder>> = {
  4: { shipment: null, canBook: false, blockers: ['Waiting for the seller to confirm this order.'] },
  88: {
    shipment: null,
    canBook: true,
    blockers: ['The seller has not booked a shipping label yet.'],
  },
  91: {
    shipment: {
      shipment_id: 501,
      carrier_name: 'DHL Express',
      tracking_number: '1Z999AA10123456784',
      status: 'in_transit',
      ship_to_city: 'Kaohsiung',
      ship_to_country: 'Taiwan',
      estimated_delivery: '2026-09-19T00:00:00Z',
      events: [
        { event_id: 1, status: 'label_created', description: 'Shipping label created', location: 'Taipei, TW', occurred_at: '2026-09-11T10:00:00Z' },
        { event_id: 2, status: 'picked_up', description: 'Picked up by carrier', location: 'Taipei, TW', occurred_at: '2026-09-12T14:30:00Z' },
        { event_id: 3, status: 'in_transit', description: 'Departed sort facility', location: 'Taoyuan, TW', occurred_at: '2026-09-13T06:15:00Z' },
        { event_id: 4, status: 'in_transit', description: 'Arrived at destination hub', location: 'Kaohsiung, TW', occurred_at: '2026-09-14T22:00:00Z' },
      ],
    },
    canBook: false,
    blockers: [],
  },
  93: {
    shipment: {
      shipment_id: 480,
      carrier_name: 'DHL Express',
      tracking_number: '1Z999AA10987654321',
      status: 'delivered',
      ship_to_city: 'Newark',
      ship_to_country: 'United States',
      estimated_delivery: '2026-08-24T00:00:00Z',
      events: [
        { event_id: 10, status: 'label_created', description: 'Shipping label created', location: 'Los Angeles, US', occurred_at: '2026-08-21T09:00:00Z' },
        { event_id: 11, status: 'picked_up', description: 'Picked up by carrier', location: 'Los Angeles, US', occurred_at: '2026-08-21T17:00:00Z' },
        { event_id: 12, status: 'in_transit', description: 'In transit', location: 'Chicago, US', occurred_at: '2026-08-22T11:00:00Z' },
        { event_id: 13, status: 'out_for_delivery', description: 'Out for delivery', location: 'Newark, US', occurred_at: '2026-08-24T07:30:00Z' },
        { event_id: 14, status: 'delivered', description: 'Delivered — signed by J. Ruiz', location: 'Newark, US', occurred_at: '2026-08-24T13:45:00Z' },
      ],
    },
    canBook: false,
    blockers: [],
  },
  97: {
    shipment: {
      shipment_id: 610,
      carrier_name: 'DHL Express',
      tracking_number: null,
      status: 'label_created',
      ship_to_city: 'Cork',
      ship_to_country: 'Ireland',
      estimated_delivery: null,
      events: [
        { event_id: 20, status: 'label_created', description: 'Shipping label created', location: null, occurred_at: '2026-07-16T09:00:00Z' },
      ],
    },
    canBook: false,
    blockers: [],
  },
};
