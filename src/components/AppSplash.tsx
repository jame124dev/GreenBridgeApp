import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Leaf } from 'lucide-react-native';

import i18n from '@/i18n';
import { IS_CUSTOMER } from '@/lib/flags';

const logo = require('../../assets/images/greenbidz_logo.png');

// Forest brand (matches the rest of the shipping app), not the old seller navy.
const FOREST_DEEP = '#0c2f20';
const FOREST = '#14452f';
const LEAF = '#34d399';
const TEXT = '#FFFFFF';
const TEXT_MUTED = 'rgba(255,255,255,0.66)';
const RULE = 'rgba(255,255,255,0.18)';

// The customer bundle is "101LAB"; the seller bundle keeps its name.
const APP_NAME = IS_CUSTOMER ? '101LAB' : 'GreenBidz Seller';

export function AppSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fade, rise, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

  return (
    <View style={styles.root}>
      {/* Dark forest ground → light status-bar icons. */}
      <StatusBar style="light" />
      <LinearGradient
        colors={[FOREST_DEEP, FOREST, FOREST_DEEP]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.center,
          { opacity: fade, transform: [{ translateY: rise }] },
        ]}
      >
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.halo,
              { opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>{APP_NAME}</Text>

        <View style={styles.tagline}>
          <Leaf size={12} color={LEAF} strokeWidth={2.2} />
          <Text style={styles.taglineText}>
            {i18n.t('mobile.splash.tagline', { defaultValue: 'THE CIRCULAR ECONOMY LEADER' })}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fade }]}>
        <View style={styles.footerPill} />
        <Text style={styles.footerHint}>{i18n.t('mobile.splash.from', { defaultValue: 'FROM' })}</Text>
        <Text style={styles.footerBrand}>GreenBidz</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FOREST,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    width: 240,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  halo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: LEAF,
    opacity: 0.3,
  },
  logo: {
    width: 220,
    height: 88,
  },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 34,
    color: TEXT,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RULE,
    paddingHorizontal: 8,
  },
  taglineText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: TEXT_MUTED,
    letterSpacing: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
    gap: 6,
  },
  footerPill: {
    width: 32,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: RULE,
    marginBottom: 4,
  },
  footerHint: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.8,
    color: TEXT_MUTED,
  },
  footerBrand: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    letterSpacing: 0.6,
    color: TEXT,
  },
});

export default AppSplash;
