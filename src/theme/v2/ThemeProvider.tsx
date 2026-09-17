/**
 * v2 theme context — scheme resolution for `app/v2/`.
 *
 * ⚠️ WHY THIS DOES NOT JUST CALL `useColorScheme()` AND STOP
 *
 * `app.config.ts:37` sets `userInterfaceStyle: 'light'`. On iOS that writes
 * `UIUserInterfaceStyle = Light` into Info.plist and forces the app's trait
 * collection; on Android it pins the appearance in styles.xml. Either way RN's
 * `useColorScheme()` returns `'light'` forever, whatever the phone is set to.
 *
 * That lock is deliberate and must stay for now: flipping it to `'automatic'`
 * would take the WHOLE binary dark, including the old UI, which is hardcoded
 * light on every screen. A dark-device user would get a correct v2 and a
 * broken everything-else for the entire coexistence period.
 *
 * So v2 carries its own scheme state:
 *   • `override` — explicit, wins. Drives the dev toggle, and drives every
 *     dark-mode test and screenshot until the global flips.
 *   • device scheme — correct the moment `app.config.ts` goes `'automatic'`,
 *     which should happen in the same release that deletes the old UI.
 *
 * Nothing else needs to change on that day. That is the point of the layer.
 * See docs/V2_UI_SKILLS.md § "Dark mode".
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type PaletteRoles, type SchemeName } from './palette';

type SchemePreference = SchemeName | 'system';

type V2ThemeContextValue = {
  /** The palette to render with. */
  colors: PaletteRoles;
  /** The scheme actually in effect. */
  scheme: SchemeName;
  /** What was asked for — `'system'` defers to the device. */
  preference: SchemePreference;
  /** Whether `scheme` came from the device or from an override. */
  isOverridden: boolean;
  setPreference: (next: SchemePreference) => void;
  /** Convenience for a dev toggle: system → dark → light → system. */
  cyclePreference: () => void;
};

const V2ThemeContext = createContext<V2ThemeContextValue | null>(null);

export function V2ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  /** Tests and screenshot runs pass `'dark'` here to reach dark while the global lock is on. */
  initialPreference?: SchemePreference;
}) {
  const [preference, setPreference] = useState<SchemePreference>(initialPreference);
  // Returns 'light' unconditionally while app.config.ts pins userInterfaceStyle.
  const deviceScheme = useColorScheme();

  const cyclePreference = useCallback(() => {
    setPreference((p) => (p === 'system' ? 'dark' : p === 'dark' ? 'light' : 'system'));
  }, []);

  const value = useMemo<V2ThemeContextValue>(() => {
    const scheme: SchemeName =
      preference === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : preference;
    return {
      colors: palettes[scheme],
      scheme,
      preference,
      isOverridden: preference !== 'system',
      setPreference,
      cyclePreference,
    };
  }, [preference, deviceScheme, cyclePreference]);

  return <V2ThemeContext.Provider value={value}>{children}</V2ThemeContext.Provider>;
}

function useV2ThemeContext(): V2ThemeContextValue {
  const ctx = useContext(V2ThemeContext);
  if (!ctx) {
    throw new Error(
      'useV2Theme must be used inside <V2ThemeProvider>. Wrap the v2 route group in app/v2/_layout.tsx.',
    );
  }
  return ctx;
}

/**
 * The colour palette for the current scheme.
 *
 * Read colours here, from context — never `import { lightPalette }`. A module
 * import does not re-render when the scheme changes, so the screen would keep
 * its old colours until something else happened to re-render it. That is the
 * single most common way a dark mode ends up half-applied.
 */
export function useV2Colors(): PaletteRoles {
  return useV2ThemeContext().colors;
}

/** Full theme context — for the dev toggle and for code that branches on scheme. */
export function useV2Theme(): V2ThemeContextValue {
  return useV2ThemeContext();
}
