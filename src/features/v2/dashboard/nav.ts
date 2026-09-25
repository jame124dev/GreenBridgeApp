/**
 * The dashboard's own navigation map — one list, used by the side menu and by
 * nothing else.
 *
 * Declared here rather than inside the drawer so that the menu and the routes
 * cannot drift: adding a page means adding a row here and a file under
 * `app/v2/dashboard/`, and a `built: false` row is visibly unfinished in the
 * menu instead of being a link that goes nowhere.
 *
 * The groups and their order come from `Docs/Dashboard/` — buyer first
 * because that is the half being built first, and within each group the build
 * order from the side README.
 */
import type { Href } from 'expo-router';

export type DashboardItem = {
  key: string;
  label: string;
  /** `undefined` while the page does not exist — the row renders disabled. */
  href?: Href;
  /** Shown beside the label on an unbuilt row. */
  note?: string;
};

export type DashboardGroup = {
  key: 'buying' | 'selling';
  title: string;
  items: DashboardItem[];
};

export const DASHBOARD_GROUPS: readonly DashboardGroup[] = [
  {
    key: 'buying',
    title: 'Buyer dashboard',
    items: [
      { key: 'bids', label: 'My bids', href: '/v2/dashboard/bids' as Href, note: 'Sample data' },
      {
        key: 'requests',
        label: 'Orders & requests',
        href: '/v2/dashboard/requests' as Href,
        note: 'Sample data',
      },
      {
        key: 'inspections',
        label: 'Inspections',
        href: '/v2/dashboard/inspections' as Href,
        note: 'Sample data',
      },
      {
        key: 'watchlist',
        label: 'Watchlist',
        href: '/v2/dashboard/watchlist' as Href,
        note: 'Sample data',
      },
    ],
  },
  {
    key: 'selling',
    title: 'Seller dashboard',
    items: [
      {
        key: 'seller-bids',
        label: 'Bids on my listings',
        href: '/v2/dashboard/seller-bids' as Href,
        note: 'Sample data',
      },
      {
        key: 'seller-offers',
        label: 'Offers received',
        href: '/v2/dashboard/seller-offers' as Href,
        note: 'Sample data',
      },
      {
        key: 'seller-orders',
        label: 'Orders',
        href: '/v2/dashboard/seller-orders' as Href,
        note: 'Sample data',
      },
      { key: 'shipments', label: 'Shipments', note: 'Soon' },
    ],
  },
];

/**
 * ⚠️ UNUSED since 2026-09-24 — `app/v2/dashboard/index.tsx` stopped
 * redirecting here once it became the real Buying home screen. Left in
 * rather than deleted blind; confirm still unused (`grep -rn DASHBOARD_HOME`)
 * before removing.
 */
export const DASHBOARD_HOME: Href = '/v2/dashboard/bids' as Href;
