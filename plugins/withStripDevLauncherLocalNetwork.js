const { withInfoPlist } = require('expo/config-plugins');

/**
 * Strip expo-dev-launcher's local-network keys from the built Info.plist.
 *
 * expo-dev-launcher adds:
 *   NSBonjourServices              = ['_expo._tcp']
 *   NSLocalNetworkUsageDescription = "Expo Dev Launcher uses the local network
 *                                     to discover and connect to development
 *                                     servers running on your computer."
 *
 * It also installs a Release build phase meant to remove both when
 * CONFIGURATION != Debug. That phase did NOT work: build 6's shipped IPA
 * (Payload/GreenBidz.app/Info.plist) still contained both keys verbatim, so the
 * store binary was advertising a developer-tooling permission with
 * developer-tooling wording.
 *
 * The app does no local networking of its own — every backend is a public
 * HTTPS host — so removing these loses nothing and stops iOS from ever showing
 * a "find and connect to devices on your local network" prompt.
 *
 * Registered LAST in the `plugins` array so this mod runs after the one that
 * adds the keys; verify with `npx expo config --type introspect` (both keys
 * must be absent from the ios.infoPlist output).
 */
module.exports = function withStripDevLauncherLocalNetwork(config) {
  return withInfoPlist(config, (cfg) => {
    delete cfg.modResults.NSBonjourServices;
    delete cfg.modResults.NSLocalNetworkUsageDescription;
    return cfg;
  });
};
