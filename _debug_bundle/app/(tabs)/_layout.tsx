import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { Home, ScanLine, History, User } from 'lucide-react-native';

import { colors } from '@/theme/colors';

export default function TabsLayout() {
  // Respect the Android system nav (gesture pill / 3-button bar) so the tab
  // bar doesn't merge into it. iOS home-indicator inset is also covered.
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f1f5f9',
          height: 68 + bottomInset,
          paddingBottom: 6 + bottomInset,
          paddingTop: 6,
          ...Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.05,
              shadowRadius: 5,
            },
            android: {
              elevation: 8,
            },
            web: {
              boxShadow: '0 -3px 10px rgba(0,0,0,0.03)',
            },
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={styles.activeCapsule}>
                <Home color="#ffffff" size={20} />
                <Text style={styles.activeText}>Home</Text>
              </View>
            ) : (
              <View style={styles.inactiveTab}>
                <Home color="#64748b" size={20} />
                <Text style={styles.inactiveText}>Home</Text>
              </View>
            )
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={styles.activeCapsule}>
                <ScanLine color="#ffffff" size={20} />
                <Text style={styles.activeText}>Scan</Text>
              </View>
            ) : (
              <View style={styles.inactiveTab}>
                <ScanLine color="#64748b" size={20} />
                <Text style={styles.inactiveText}>Scan</Text>
              </View>
            )
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={styles.activeCapsule}>
                <History color="#ffffff" size={20} />
                <Text style={styles.activeText}>History</Text>
              </View>
            ) : (
              <View style={styles.inactiveTab}>
                <History color="#64748b" size={20} />
                <Text style={styles.inactiveText}>History</Text>
              </View>
            )
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={styles.activeCapsule}>
                <User color="#ffffff" size={20} />
                <Text style={styles.activeText}>Me</Text>
              </View>
            ) : (
              <View style={styles.inactiveTab}>
                <User color="#64748b" size={20} />
                <Text style={styles.inactiveText}>Me</Text>
              </View>
            )
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeCapsule: {
    width: 68,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: `0 2px 5px rgba(10, 74, 47, 0.15)`,
      },
    }),
  },
  activeText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: fonts.semibold,
    fontWeight: '600',
  },
  inactiveTab: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    width: 68,
    height: 52,
  },
  inactiveText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
});
