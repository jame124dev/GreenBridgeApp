# Local Android release build (no EAS)

Produces a **signed release APK** on this machine, for direct install and tester
distribution, without queueing an EAS build.

```bash
npx expo prebuild -p android --clean --no-install     # regenerate android/ from app.config.ts
cd android && ./gradlew assembleRelease               # ~10-25 min cold, ~2-4 min warm
# -> android/app/build/outputs/apk/release/app-release.apk
```

For an `.aab` instead, use `./gradlew bundleRelease` — but read the signing
warning below first; it is not interchangeable with the EAS bundle.

## Prerequisites (all already present on this machine)

| | |
|---|---|
| JDK | Temurin **17.0.13** (Gradle 8 needs 17+) |
| Android SDK | `ANDROID_HOME=C:\Users\Pc\AppData\Local\Android\Sdk`, platforms **android-36** |
| Signing | `credentials/greenbidz-release.keystore` + `credentials/android-signing.json` |

## Signing survives prebuild — do not hand-patch `android/`

`android/` is **gitignored and disposable**: `prebuild --clean` deletes and
regenerates it. The release signingConfig therefore cannot live as a manual edit
inside `android/app/build.gradle` — that is how earlier release builds silently
came out **debug-signed**. It is applied by
[`plugins/withLocalReleaseSigning.js`](../plugins/withLocalReleaseSigning.js) as
part of prebuild:

1. copies the keystore to `android/app/release.keystore`
2. writes the four `GREENBIDZ_RELEASE_*` values into `android/gradle.properties`
3. declares `signingConfigs.release` and repoints the `release` buildType at it

The plugin **no-ops unless `credentials/` exists**, and `credentials/` is
gitignored — so EAS builds are unaffected and keep EAS-managed signing.

If the Expo template ever changes shape, the plugin throws with a clear message
rather than falling back to the debug key. Fix the plugin, never `android/`.

## ⚠️ This is NOT the EAS upload key

```
local keystore   SHA1 DB:31:AC:CE:C6:46:06:2F:23:4C:07:72:4F:B1:A8:E6:2D:97:69:DB
EAS upload key   SHA1 26:F4:BF:37:72:CF:30:42:CF:AA:90:A2:7B:7E:B0:BB:A4:43:B0:7F
```

Google Play pins the **upload certificate on the first upload** of an app. So:

- **APKs for testers / direct install** — either key is fine. Use this flow freely.
- **Uploading to Play** — pick one key and stay on it forever. Nothing has been
  uploaded yet, so the choice is still open:
  - **Recommended: upload the EAS-built `.aab`** and keep Play on the EAS key.
    EAS holds the only copy of that key — back it up with
    `eas credentials -p android`. Local `.aab`s then cannot be uploaded.
  - Alternatively standardise on this local key, in which case `eas submit`
    output would be rejected instead.
- Mixing the two produces Play's *"upload certificate does not match"* rejection.
  Recoverable only via a Google upload-key reset request, since Play App Signing
  is enabled.

## Two things to know about the output

- **`versionCode` is 1 locally.** EAS owns version numbers remotely
  (`appVersionSource: remote`, currently at 4); a local build does not consult
  it. Fine for installing on a phone; a local `.aab` intended for Play would need
  the code bumped past whatever Play has already seen.
- **It builds against PRODUCTION.** `.env` supplies `GREENBIDZ_API_URL` and
  `X_SYSTEM_KEY` at bundle time and points at the live backend, exactly like the
  EAS profiles. Anything done in a locally built APK writes real production data.

## Installing it

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`INSTALL_FAILED_UPDATE_INCOMPATIBLE` means a differently-signed
`com.greenbidz.bridge` is already on the device (an EAS build, or the debug
build) — `adb uninstall com.greenbidz.bridge` first.

Before testing on the emulator, keep the two standing traps in mind: boot with
`-gpu swiftshader_indirect -memory 4096 -dns-server 8.8.8.8`, and run
`adb shell settings put secure autofill_service null` so Autofill cannot drop a
real saved production account into the login form.

## Troubleshooting: "Gradle build daemon disappeared unexpectedly"

Hit on the first run here. The daemon did not hang — its JVM **crashed out of
memory** part way through Metro bundling, leaving `android/hs_err_pid*.log`:

```
# There is insufficient memory for the Java Runtime Environment to continue.
# Native memory allocation (malloc) failed to allocate 2299216 bytes
```

It is not a RAM shortage in the usual sense — this machine has 32 GB and ~8 GB
was free. It is **Windows commit charge**: 23.9 GB committed against a 35.9 GB
limit (32 GB RAM + a 4 GB page file), because **five stale Gradle daemons from
earlier sessions were already resident** before the build even started, and the
release build then adds Metro plus a Kotlin daemon on top.

```bash
cd android && ./gradlew --stop        # always do this first if a build died
./gradlew assembleRelease --console=plain --max-workers=2 \
  -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g" \
  -Dkotlin.compiler.execution.strategy=in-process
```

`in-process` keeps Kotlin compilation inside the Gradle daemon instead of
forking a second JVM. Do not put these in `android/gradle.properties` — prebuild
regenerates that file; keep them on the command line (or add them to the plugin).

## Verify the artifact, not the config

The config is not evidence — `android/` was stale for a month while
`app.config.ts` moved on. After building:

```bash
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump badging app-release.apk | head
apksigner verify --print-certs app-release.apk      # expect the local SHA1 above
```
