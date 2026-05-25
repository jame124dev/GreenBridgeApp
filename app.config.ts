import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'GreenBridge',
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
      backgroundColor: '#0a4a2f',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
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
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0a4a2f',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
  ],
  projectId: '57cd3db7-90b1-4b57-a723-679bfe81ef69',
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '57cd3db7-90b1-4b57-a723-679bfe81ef69',
    },
    GREENBIDZ_API_URL: process.env.GREENBIDZ_API_URL,
    QUIPPY_API_URL: process.env.QUIPPY_API_URL,
    X_SYSTEM_KEY: process.env.X_SYSTEM_KEY,
    SITE_TYPE: process.env.SITE_TYPE ?? 'LabGreenbidz',
    WEB_APP_URL: process.env.WEB_APP_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
  },
});
