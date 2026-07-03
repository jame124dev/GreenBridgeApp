// Lightweight bridge registry so the auth/logout flow can clear the marketplace
// WebView's injected web session — the WebView itself lives in the Browse tab
// (app/(lab)/(tabs)/browse.tsx), which registers a clear callback while mounted.
// Keeping this in lib/ (not the marketplace feature) lets services/auth/logout
// call it without a service→feature import dependency.
type ClearFn = () => void;

let clearFn: ClearFn | null = null;

/** Browse tab registers (on mount) / unregisters (null, on unmount) its clear fn. */
export function registerMarketplaceAuthClear(fn: ClearFn | null): void {
  clearFn = fn;
}

/** Clear the marketplace WebView's web session, if the Browse tab is mounted. */
export function clearMarketplaceWebAuth(): void {
  try {
    clearFn?.();
  } catch {
    // WebView may be gone / not ready — the next login's before-content inject
    // overwrites the stale token regardless, so a miss here is harmless.
  }
}
