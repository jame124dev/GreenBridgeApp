/**
 * The four Review steps — `photos → details → pricing → location`.
 *
 * t7's brief: *"The single long Review screen is split into four named steps."*
 * The old single screen is `app/scan/grouped-review.tsx`; these four carry a
 * slice each, sharing state through `wizardState.ts`.
 *
 * Two deliberate choices:
 *
 * • **`animation: 'slide_from_right'`** — unlike Home selling↔buying, these
 *   ARE separate pages and should feel like it. Moving forward through a form
 *   should have direction; that is most of what tells someone they are making
 *   progress, alongside the `Timeline` rail each step draws.
 *
 * • **`gestureEnabled`** stays on, so the back-swipe works. A wizard that traps
 *   you is worse than one you can leave — and every step's state is local until
 *   publish, so going back costs nothing.
 *
 * No `V2ThemeProvider` here: `app/v2/_layout.tsx` already wraps the whole group,
 * and a second provider would fork the scheme so the dev toggle stopped
 * reaching these screens.
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function ReviewLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Each step paints its own ground; a default white flash between steps
        // is very visible in dark mode.
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    />
  );
}
