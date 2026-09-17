/**
 * `/v2/buying` — kept as a URL, no longer a screen.
 *
 * Selling and Buying became two panes of one swipeable screen (`app/v2/index`),
 * so the mode is a param rather than a route. This redirect keeps every
 * existing entry point working: the tab bar's `also: ['/v2/buying']` mapping,
 * any deep link, and anything already pointing here.
 *
 * `Redirect` rather than a `router.replace` in an effect — it resolves during
 * render, so there is no frame where an empty screen is mounted.
 */
import React from 'react';
import { Redirect } from 'expo-router';

export default function V2BuyingRedirect() {
  return <Redirect href="/v2?mode=buying" />;
}
