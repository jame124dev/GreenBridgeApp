// Chat theme provider (D2 §3). Publishes the active, frozen `Theme` to the chat
// subtree via context. Pure: no side effects, no platform calls (StatusBar / nav
// bar are X4's concern). The default value is the frozen `chatLightTheme`
// singleton, so an unconsumed / re-rendered provider produces NO consumer
// re-renders (D2 §9) — the render-neutrality PR-2 must preserve.
import { createContext, useContext, type ReactNode } from 'react';

import { chatLightTheme } from './lightTheme';
import type { Theme } from './types';

const ThemeContext = createContext<Theme>(chatLightTheme);

export function ChatThemeProvider({
  children,
  theme = chatLightTheme,
}: {
  children: ReactNode;
  /** Defaults to the frozen light singleton. Phase 2 passes the dark theme here
   *  (behind CHAT_UI_V2); switching is a stable-reference swap. */
  theme?: Theme;
}) {
  // `theme` is a frozen module singleton by default → referentially stable →
  // consumers only re-render on an actual theme switch (none in Phase 1).
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): Theme {
  return useContext(ThemeContext);
}

export { ThemeContext };
