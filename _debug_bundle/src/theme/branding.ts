import Constants from 'expo-constants';
import type { ImageSourcePropType } from 'react-native';

export type SiteType = 'labgreenbidz' | '101it' | '101machine';

const rawSiteType = Constants.expoConfig?.extra?.SITE_TYPE as string | undefined;
const siteType = (rawSiteType?.toLowerCase() as SiteType | undefined) ?? 'labgreenbidz';

const logos = {
  greenbidz: require('../../assets/images/greenbidz_logo.png') as ImageSourcePropType,
  lab: require('../../assets/images/lablogo.png') as ImageSourcePropType,
};

const brandingBySite: Record<
  SiteType,
  { appName: string; logoLabel: string; logo: ImageSourcePropType; logoWidth: number; logoHeight: number }
> = {
  labgreenbidz: {
    appName: 'GreenBridge',
    logoLabel: 'GreenBidz',
    logo: logos.greenbidz,
    logoWidth: 168,
    logoHeight: 44,
  },
  '101it': {
    appName: 'GreenBridge',
    logoLabel: '101 IT',
    logo: logos.lab,
    logoWidth: 120,
    logoHeight: 48,
  },
  '101machine': {
    appName: 'GreenBridge',
    logoLabel: '101 Machine',
    logo: logos.lab,
    logoWidth: 120,
    logoHeight: 48,
  },
};

export function getBranding() {
  return brandingBySite[siteType] ?? brandingBySite.labgreenbidz;
}
