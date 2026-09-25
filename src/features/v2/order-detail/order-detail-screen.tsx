/**
 * Order detail & tracking — "Where is my equipment and what happens next?"
 *
 * Composed directly from kit primitives, the same way `app/v2/listing/[id].tsx`
 * is — this is a detail composition, not a list, so there is no template list
 * screen to copy from. See `./types.ts` for the full audit of why the plan's
 * named source (`BuyerOrder.tsx`) was NOT trusted for field names, and what
 * was verified live instead.
 *
 * ── ONE PROGRESSION SHOWN, NOT TWO ──
 *
 * A checkout has a coarse status (`CheckoutStatus`, 6 stages) AND, once a
 * shipment exists, a finer real-time status (`ShipmentStatus`, 10 values,
 * with a genuine per-event history). Showing both as separate progress rails
 * risks them visibly disagreeing — a checkout reading "Shipped" while a
 * shipment rail still shows "Preparing" is chrome contradicting itself
 * (`v2-screen` skill § Coherence). So: the CHECKOUT status is the one
 * `Timeline` on screen (it is what "Take these" in the plan actually asked
 * for — "the checkout status progression"), and the shipment section below
 * it is a plain chronological list of real events (`Row`, not `Timeline`) —
 * `Timeline`'s model is a FIXED set of steps with one current index, and an
 * event history is neither fixed-length nor guaranteed to have hit every
 * intermediate stage. Forcing it into `Timeline` would either drop real
 * events or fabricate "pending" stages that were actually skipped.
 *
 * ⚠️ `cancelled` GETS NO PROGRESSION RAIL AT ALL. `CHECKOUT_STAGES` excludes
 * it on purpose — a 6-step "on its way to delivery" bar over an order that
 * will never be delivered is exactly the kind of chrome-outside-its-state
 * bug the skill warns about. A cancelled checkout gets its status chip and
 * nothing else in that slot.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Chip,
  Row,
  RowThumb,
  SectionHeader,
  SectionNote,
  Text,
  Timeline,
  type TimelineStep,
} from '@/features/v2/ui';
import { GUTTER, space } from '@/theme/v2';

import { CHECKOUT_FIXTURE, SHIPMENT_FIXTURE } from './__fixtures__/order-detail';
import {
  CHECKOUT_STAGES,
  checkoutStageIndex,
  checkoutStatusLabel,
  checkoutTone,
  formatOrderDate,
  money,
  shipmentStatusLabel,
  type Checkout,
} from './types';

export function OrderDetailScreen({ checkoutId }: { checkoutId: number }) {
  // PHASE 1: fixture lookup. Phase 2 is `useGetCheckoutById(checkoutId)` +
  // `useGetShipmentByOrder(checkoutId)` — see the route file.
  const checkout: Checkout | undefined = CHECKOUT_FIXTURE.find((c) => c.checkout_id === checkoutId);
  const shipmentInfo = SHIPMENT_FIXTURE[checkoutId];

  if (!checkout) {
    return (
      <View style={styles.pad}>
        <SectionNote tone="danger">
          That order did not load. Go back to Orders & requests and open it again.
        </SectionNote>
      </View>
    );
  }

  const product = checkout.batch?.products?.[0];
  const isCancelled = checkout.status === 'cancelled';
  const stageIndex = checkoutStageIndex(checkout.status);

  const checkoutSteps: readonly TimelineStep[] = CHECKOUT_STAGES.map((s) => ({ label: s.label }));

  return (
    <View style={styles.pad}>
      {/* Header — item identity + the money/date facts, same register as request-card.tsx. */}
      <View style={styles.header}>
        <RowThumb uri={product?.image1 ?? undefined}>
          {!product?.image1 ? (
            <Text variant="micro" color="inkSubtle">
              No photo
            </Text>
          ) : null}
        </RowThumb>
        <View style={styles.headerText}>
          <Text variant="rowTitle" numberOfLines={2}>
            {product?.title || `Batch #${checkout.batch_id}`}
          </Text>
          <Text variant="caption" color="inkSubtle">
            Order #{checkout.checkout_id} · Batch #{checkout.batch_id}
          </Text>
        </View>
        <Chip label={checkoutStatusLabel(checkout.status)} tone={checkoutTone(checkout.status)} />
      </View>

      <Row
        title="Total"
        trailing={<Text variant="rowTitle">{money(checkout.total_price, checkout.currency)}</Text>}
      />
      <Row title="Quantity" trailing={<Text variant="row">{checkout.quantity}</Text>} />
      <Row title="Placed" trailing={<Text variant="row">{formatOrderDate(checkout.created_at)}</Text>} />
      {checkout.shipping_address ? (
        <Row title="Ship to" subtitle={checkout.shipping_address} titleLines={1} />
      ) : null}

      {/*
        The progression rail — only while there IS one. `current={stageIndex}`
        clamped to the last stage for `completed` (index 5, the final entry);
        `checkoutStageIndex` returns -1 only for `cancelled`, guarded above.
      */}
      {!isCancelled ? (
        <View style={styles.section}>
          <SectionHeader title="Order status" />
          <Timeline steps={checkoutSteps} current={Math.max(0, stageIndex)} live={false} />
        </View>
      ) : (
        <View style={styles.section}>
          <SectionHeader title="Order status" />
          <SectionNote tone="danger">This order was cancelled.</SectionNote>
        </View>
      )}

      {/* Shipment — absence is a first-class answer, per shipmentApiSlice.ts's own docblock. */}
      <View style={styles.section}>
        <SectionHeader title="Shipment" />
        {shipmentInfo?.shipment ? (
          <>
            <Row
              title={shipmentInfo.shipment.carrier_name || 'Carrier'}
              subtitle={
                shipmentInfo.shipment.tracking_number
                  ? `Tracking ${shipmentInfo.shipment.tracking_number}`
                  : undefined
              }
              trailing={<Chip label={shipmentStatusLabel(shipmentInfo.shipment.status)} tone="accent" />}
            />
            {(shipmentInfo.shipment.ship_to_city || shipmentInfo.shipment.ship_to_country) && (
              <Row
                title="Destination"
                trailing={
                  <Text variant="row">
                    {[shipmentInfo.shipment.ship_to_city, shipmentInfo.shipment.ship_to_country]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                }
              />
            )}
            {/*
              The real event history — a plain chronological list, newest
              first, because it is not a fixed set of steps. See the
              docblock's "ONE PROGRESSION SHOWN" note for why this is NOT a
              second Timeline.
            */}
            {[...(shipmentInfo.shipment.events ?? [])]
              .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
              .map((ev) => (
                <Row
                  key={ev.event_id}
                  title={shipmentStatusLabel(ev.status)}
                  subtitle={ev.description ?? undefined}
                  meta={ev.location ?? undefined}
                  stamp={formatOrderDate(ev.occurred_at)}
                />
              ))}
          </>
        ) : (
          <>
            <SectionNote>
              {shipmentInfo?.canBook
                ? 'Not shipped yet — the seller can book a label.'
                : 'Not shipped yet.'}
            </SectionNote>
            {(shipmentInfo?.blockers ?? []).map((b, i) => (
              <Text key={i} variant="caption" color="inkSubtle" style={styles.blocker}>
                {b}
              </Text>
            ))}
          </>
        )}
      </View>

      {/*
        No "book shipment" / "cancel" control — those are the seller's,
        `phase-1-ui.md` § "Leave these". No manual "Back" control either: this
        is a PUSHED route, so the native back gesture/button already returns
        to Orders & requests, and `DashboardBar`'s Home button is the
        section's one required exit — a third way out would be the duplicate
        control this codebase keeps flagging (`request-card.tsx`'s note on
        "View details").
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER, paddingBottom: space['8xl'] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg, marginBottom: space.md },
  headerText: { flex: 1, minWidth: 0, gap: space.xxs },
  section: { marginTop: space.xl },
  blocker: { marginTop: space.xxs, marginHorizontal: GUTTER },
});
