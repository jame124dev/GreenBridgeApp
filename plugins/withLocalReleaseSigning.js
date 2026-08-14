/**
 * Make a LOCAL Gradle release build possible without hand-patching the
 * generated project every time.
 *
 * WHY THIS EXISTS: `android/` is gitignored and is regenerated wholesale by
 * `expo prebuild --clean`. The release signingConfig used to live as a manual
 * edit inside android/app/build.gradle + android/gradle.properties, so every
 * prebuild silently threw it away and the next release build fell back to the
 * DEBUG key. This plugin re-applies it as part of prebuild instead.
 *
 * It is deliberately a no-op unless BOTH the keystore and its credentials file
 * are present on disk. Both live under `credentials/` which is gitignored, so
 * on EAS (and any other clean checkout) this plugin does nothing and EAS's own
 * managed signing is used, exactly as before.
 *
 * ⚠️ The local keystore is NOT the EAS upload key:
 *      local  SHA1 DB:31:AC:CE:C6:46:06:2F:23:4C:07:72:4F:B1:A8:E6:2D:97:69:DB
 *      EAS    SHA1 26:F4:BF:37:72:CF:30:42:CF:AA:90:A2:7B:7E:B0:BB:A4:43:B0:7F
 * Google Play pins the upload certificate on the FIRST upload, so a locally
 * signed .aab and an EAS-built .aab are not interchangeable for that app.
 * Locally signed APKs for direct install/testers are unaffected.
 */
const fs = require('fs');
const path = require('path');

const {
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
} = require('expo/config-plugins');

const CREDS = 'credentials/android-signing.json';
const PROPS = {
  storeFile: 'GREENBIDZ_RELEASE_STORE_FILE',
  storePassword: 'GREENBIDZ_RELEASE_STORE_PASSWORD',
  keyAlias: 'GREENBIDZ_RELEASE_KEY_ALIAS',
  keyPassword: 'GREENBIDZ_RELEASE_KEY_PASSWORD',
};

/** Read the gitignored credentials, or null when this is not a local build. */
function readSigning(projectRoot) {
  const credsPath = path.join(projectRoot, CREDS);
  if (!fs.existsSync(credsPath)) return null;

  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  const keystore = path.join(projectRoot, creds.keystorePath);
  if (!fs.existsSync(keystore)) {
    console.warn(`[local-release-signing] ${CREDS} points at a missing keystore: ${keystore}`);
    return null;
  }
  for (const field of ['keyAlias', 'storePassword', 'keyPassword']) {
    if (!creds[field]) {
      console.warn(`[local-release-signing] ${CREDS} is missing "${field}" — skipping.`);
      return null;
    }
  }
  return { ...creds, keystore };
}

/** Copy the keystore next to build.gradle, where the signingConfig expects it. */
const withKeystoreCopied = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const signing = readSigning(cfg.modRequest.projectRoot);
      if (signing) {
        fs.copyFileSync(
          signing.keystore,
          path.join(cfg.modRequest.platformProjectRoot, 'app', 'release.keystore'),
        );
      }
      return cfg;
    },
  ]);

const withSigningProperties = (config) =>
  withGradleProperties(config, (cfg) => {
    const signing = readSigning(cfg.modRequest.projectRoot);
    if (!signing) return cfg;

    const values = {
      [PROPS.storeFile]: 'release.keystore',
      [PROPS.storePassword]: signing.storePassword,
      [PROPS.keyAlias]: signing.keyAlias,
      [PROPS.keyPassword]: signing.keyPassword,
    };
    // Replace rather than append, so repeated prebuilds don't stack duplicates.
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key in values),
    );
    for (const [key, value] of Object.entries(values)) {
      cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });

const withReleaseSigningConfig = (config) =>
  withAppBuildGradle(config, (cfg) => {
    const signing = readSigning(cfg.modRequest.projectRoot);
    if (!signing) return cfg;
    if (cfg.modResults.contents.includes('// local-release-signing')) return cfg;

    // 1. Declare the release keystore alongside the template's debug one.
    const anchor = /signingConfigs\s*\{/;
    if (!anchor.test(cfg.modResults.contents)) {
      throw new Error('[local-release-signing] no signingConfigs block in app/build.gradle');
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      anchor,
      `signingConfigs {
        // local-release-signing (plugins/withLocalReleaseSigning.js)
        release {
            storeFile file(${PROPS.storeFile})
            storePassword ${PROPS.storePassword}
            keyAlias ${PROPS.keyAlias}
            keyPassword ${PROPS.keyPassword}
        }`,
    );

    // 2. Point the release buildType at it. The template hardcodes the debug
    //    config here, which is what silently produced debug-signed releases.
    const before = cfg.modResults.contents;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    if (cfg.modResults.contents === before) {
      throw new Error(
        '[local-release-signing] could not repoint the release buildType — the ' +
          'Expo template changed shape; update this plugin rather than editing ' +
          'android/ by hand (prebuild would discard that).',
      );
    }
    return cfg;
  });

module.exports = (config) =>
  withReleaseSigningConfig(withSigningProperties(withKeystoreCopied(config)));
