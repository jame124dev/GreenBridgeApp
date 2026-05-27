import { requireOptionalNativeModule } from 'expo-modules-core';

export type ResolvedLocation = {
  /** Full pickup line (street · district · city · region · postcode). */
  address: string;
  country: string;
  /** Short city/area label for compact display (e.g. the home header). */
  label: string;
};

export type LocationResult =
  | { ok: true; location: ResolvedLocation }
  | { ok: false; reason: 'denied' | 'unavailable' };

// expo-location is a NATIVE module. If the installed dev client / build doesn't
// include it yet (e.g. added after the last `expo run:android`), loading it
// throws "Cannot find native module 'ExpoLocation'" at module-eval time. A
// try/catch around require() *does* swallow that throw, but Metro's
// guardedLoadModule reports the failed module load to LogBox *before* rethrowing
// — so a red error screen still flashes on every launch in dev. To avoid even
// attempting the load when the native side is absent, we probe the native
// registry first via `requireOptionalNativeModule` (returns null instead of
// throwing — no LogBox), and only require expo-location when it's actually
// present. Result cached so every caller degrades gracefully and silently.
type LocationModule = typeof import('expo-location');
let cachedModule: LocationModule | null | undefined;

function loadLocationModule(): LocationModule | null {
  if (cachedModule !== undefined) return cachedModule;
  // Native module missing → don't require() the JS package (that's what trips
  // LogBox). Degrade silently.
  if (!requireOptionalNativeModule('ExpoLocation')) {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-location') as LocationModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/** True if foreground location permission is already granted (no prompt).
 *  False if the native module is unavailable so callers never throw. */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const Location = loadLocationModule();
    if (!Location) return false;
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

function dedupeJoin(parts: (string | null | undefined)[]): string {
  const clean = parts.filter((p): p is string => Boolean(p && p.trim()));
  return Array.from(new Set(clean)).join(', ');
}

/** Native reverse geocode. Returns null if it throws — notably the SDK-49
 *  "Geocoding API has been removed" error on Android ROMs without a geocoder
 *  backend (many MIUI/HyperOS builds) — so we can fall back to HTTP. */
async function nativeReverseGeocode(
  Location: LocationModule,
  latitude: number,
  longitude: number,
): Promise<ResolvedLocation | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return null;
    const streetLine = [place.streetNumber, place.street].filter(Boolean).join(' ');
    const address = dedupeJoin([
      place.name && place.name !== place.street ? place.name : null,
      streetLine || null,
      place.district,
      place.city,
      place.region,
      place.postalCode,
    ]);
    if (!address && !place.country) return null;
    const label = place.city || place.subregion || place.region || place.country || '';
    return { address, country: place.country ?? '', label };
  } catch {
    return null;
  }
}

/** HTTP fallback via OpenStreetMap Nominatim — free, no API key. */
async function osmReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ResolvedLocation | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/reverse' +
      `?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GreenBridgeApp/0.1 (listing pickup geocode)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address ?? {};
    const houseStreet = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || a.county;
    const address =
      dedupeJoin([houseStreet || null, a.suburb, city, a.state, a.postcode]) ||
      data.display_name ||
      '';
    const country = a.country ?? '';
    if (!address && !country) return null;
    const label = city || a.suburb || a.state || country || '';
    return { address, country, label };
  } catch {
    return null;
  }
}

/**
 * Request (if needed) location permission, read the current position, and turn
 * it into a human address + country. Native geocoder first, Nominatim HTTP
 * fallback. Returns 'unavailable' if the native module is missing (dev client
 * not yet rebuilt with expo-location).
 */
export async function getDeviceLocation(): Promise<LocationResult> {
  const Location = loadLocationModule();
  if (!Location) return { ok: false, reason: 'unavailable' };

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = pos.coords;

    const resolved =
      (await nativeReverseGeocode(Location, latitude, longitude)) ??
      (await osmReverseGeocode(latitude, longitude));

    if (!resolved) return { ok: false, reason: 'unavailable' };
    return { ok: true, location: resolved };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
