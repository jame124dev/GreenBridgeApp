/**
 * 6a / 6b — Home. ONE screen, two modes.
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [G] GREENBIDZ                            EN   bell•    │  ← fixed
 *   │  Selling   Buying                                       │  ← fixed
 *   ├─────────────────────────────────────────────────────────┤
 *   │  What are you selling today?                            │  ┐
 *   │  ( Scan it )        or type the details                 │  │ swipes
 *   ╰──────────────────────────────────────────╯ 34pt curve   │  │
 *      assistant row · banner · drafts · listings             │  ┘
 *
 * This file is the HOST. It owns only what both modes share — the brand bar,
 * the tab row, the language sheet, and which mode is showing. The content of
 * each mode lives in `SellingPane` / `BuyingPane`.
 *
 * ── Why the sheet is split in two ──
 *
 * The brand bar is identical in both modes. If it swiped with the content, the
 * logo would slide out while a matching one slid in — the tell of a pager
 * pretending to be tabs. The tabs hold still for the same reason: they are the
 * control, not the content. So the fixed half is drawn with `headerFlush` (no
 * bottom corners) and each pane carries the curved bottom of the same wash.
 *
 * ── `?mode=buying` ──
 *
 * `app/v2/buying.tsx` redirects here with that param, so the old URL, the tab
 * bar's `also` mapping and any existing link all keep working. Deep-linking to
 * a mode is a param, not a route, because these are two views of one screen.
 *
 * ── Moved from `app/v2/index.tsx` (2026-09-25) ──
 *
 * This screen is now mounted as ONE PANE of `RootTabsPager` rather than as its
 * own stack route — see that file's header for why all five root tabs became
 * one swiping pager. `hideOwnTabBar`: the pager renders one shared bar below
 * all five panes, driven by its own index; this screen rendering its own bar
 * underneath would stack a second, dead one behind it.
 *
 * `useLocalSearchParams` still reads `mode` correctly here even though this is
 * no longer its own route: it is rendered inside `RootTabsPager`, which is
 * itself rendered by the `/v2` route, so the local params are still `/v2`'s.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BrandBar, Screen, Tabs, HOME_MODE_TABS, type HomeMode } from '@/features/v2/ui';
import { space } from '@/theme/v2';
import { LanguageSheet } from '@/components/ui';
import { languageBadge } from '@/i18n';
import { requireAuth } from '@/features/auth/requireAuth';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { SellingPane } from '@/features/v2/home/SellingPane';
import { BuyingPane } from '@/features/v2/home/BuyingPane';
import { HomePager } from '@/features/v2/home/HomePager';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';

const MODES: readonly HomeMode[] = ['selling', 'buying'];

/**
 * Built once at module scope, not inside the render.
 *
 * Both panes are memoised, but an inline `[<SellingPane />, <BuyingPane />]`
 * creates fresh elements on every host render, which defeats the memo. Hoisting
 * the array keeps the element identities stable, so a page change re-renders
 * the tab row and nothing else.
 */
const PANES = [<SellingPane key="selling" />, <BuyingPane key="buying" />];

export function HomeScreen() {
  const { i18n } = useTranslation();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const { unreadCount } = useLabNotifications();

  const [page, setPage] = useState(modeParam === 'buying' ? 1 : 0);
  const [langOpen, setLangOpen] = useState(false);

  const onBell = () => {
    haptics.tap();
    requireAuth('notifications', () => router.push(routes.labNotifications));
  };

  const onLanguage = () => {
    haptics.tap();
    // TODO(v2-nav): the shipped language sheet until a v2 one is drawn.
    setLangOpen(true);
  };

  const header = (
    <>
      <BrandBar
        language={languageBadge(i18n.language)}
        unread={unreadCount}
        onNotifications={onBell}
        onLanguage={onLanguage}
      />

      <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Selling or buying">
        <Tabs
          items={HOME_MODE_TABS}
          value={MODES[page]}
          onChange={(next) => {
            haptics.tap();
            setPage(MODES.indexOf(next));
          }}
        />
      </View>
    </>
  );

  return (
    <Screen header={header} headerFlush scroll={false} hideOwnTabBar testID="v2-home">
      <HomePager page={page} onPageChange={setPage}>
        {PANES}
      </HomePager>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: space['6xl'] },
});
