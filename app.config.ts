import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'GreenBidz Seller',
  slug: 'greenbridge',
  scheme: 'greenbridge',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.greenbidz.bridge',
    supportsTablet: false,
  },
  android: {
    package: 'com.greenbidz.bridge',
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-image-picker',
    'expo-secure-store',
    'expo-notifications',
    'expo-localization',
    'expo-image',
    'expo-web-browser',
    [
      'expo-location',
      {
        // Foreground only — used to auto-fill the listing's pickup address.
        locationAlwaysAndWhenInUsePermission:
          'Allow GreenBridge to use your location to auto-fill the pickup address of a listing.',
        locationWhenInUsePermission:
          'Allow GreenBridge to use your location to auto-fill the pickup address of a listing.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#002855',
        image: './assets/images/greenbidz_logo.png',
        imageWidth: 220,
        resizeMode: 'contain',
      },
    ],
    [
      'onesignal-expo-plugin',
      {
        // iOS APNs environment for the built app. 'development' for dev-client /
        // TestFlight sandbox; switch to 'production' for App Store builds.
        mode: 'development',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '57cd3db7-90b1-4b57-a723-679bfe81ef69',
    },
    GREENBIDZ_API_URL: process.env.GREENBIDZ_API_URL,
    // ASSISTANT (Python FastAPI) base URL — chat/detect stream, WTB, handoff.
    // Distinct from GREENBIDZ_API_URL (NODE). Default prod; override with
    // AI_BASE_URL in .env (e.g. https://dev-ai.greenbidz.com for the dev stack).
    AI_BASE_URL: process.env.AI_BASE_URL ?? 'https://ai.greenbidz.com',
    QUIPPY_API_URL: process.env.QUIPPY_API_URL,
    X_SYSTEM_KEY: process.env.X_SYSTEM_KEY,
    SITE_TYPE: process.env.SITE_TYPE ?? 'LabGreenbidz',
    WEB_APP_URL: process.env.WEB_APP_URL,
    // 101 Lab marketplace web origin for the Browse-tab WebView. Default prod
    // (https://101lab.co) applied in getMarketplaceUrl(); override here.
    MARKETPLACE_URL: process.env.EXPO_PUBLIC_MARKETPLACE_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
  },
});
