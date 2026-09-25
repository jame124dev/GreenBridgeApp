/**
 * `/v2` — the root of the swiping five-tab experience.
 *
 * This used to BE the Home screen (6a/6b). Home's own content moved to
 * `src/features/v2/home/HomeScreen.tsx` unchanged (2026-09-25) so it could
 * become one pane of `RootTabsPager` alongside Browse, Matches, Messages and
 * Account — see that file's header for the whole feature. This file is now
 * just the mount point Expo Router resolves `/v2` to.
 */
import React from 'react';

import { RootTabsPager } from '@/features/v2/root/RootTabsPager';

export default function V2Root() {
  return <RootTabsPager />;
}
