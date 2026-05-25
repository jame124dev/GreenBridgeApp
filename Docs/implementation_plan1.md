# Implementation Plan - Scanner Home & Tabs Redesign

We will redesign the Scanner Home screen and the Bottom Tab Navigation to match the premium Industrial Field System layouts from the Stitch specifications, adjusted for the GreenBridge branding, data models, and offline-first capabilities.

---

## Open Decisions (Resolved)

1.  **Location Card:**
    *   **Decision:** **Option A — Drop the location card for v1.** The app does not currently track or require warehouse sectors or geofenced permissions, keeping the Jerry demo focused on core scanner actions.
2.  **Header Title:**
    *   **Decision:** Use the brand name dynamically from `getBranding().appName` (which resolves to "GreenBridge" or "101 IT" depending on the binary's `SITE_TYPE`).
3.  **Hamburger Icon:**
    *   **Decision:** **Drop it.** We use bottom navigation tabs instead of a sidebar drawer. The app bar header will only contain the brand title on the left, and the notification bell and profile initials avatar on the right.
4.  **Bento Submitted Card:**
    *   **Decision:** Change the label to **"Recent Batches"** (instead of "THIS MONTH") and display `data?.length` dynamically from `useRecentSubmissions()`, matching the local batch query context.
5.  **Tab Consolidation:**
    *   **Decision:** Move the dashboard ([scan.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/scan.tsx)) to replace the generic placeholder [index.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/index.tsx). The consolidated bottom tabs will be:
        1.  `index` (Dashboard - Home icon / "Home")
        2.  `inbox` (Inbox - Inbox icon / "Inbox")
        3.  `profile` (Profile - User icon / "Profile")
6.  **"System Active" Status Dot:**
    *   **Decision:** Wire it directly to `NetInfo`.
        *   **Online:** Display a pulsing green dot with the text "Online".
        *   **Offline:** Display an amber dot with the text "Offline Mode" (stating that drafts will save locally).

---

## Proposed Changes

### 1. Bottom Tab Navigation Layout
#### [MODIFY] [_layout.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/_layout.tsx)
*   Rename tabs layout to point to the consolidated routes: `index`, `inbox`, `profile`. Remove the `scan` tab.
*   Set `tabBarShowLabel: false` to hide standard tab bar text.
*   Design a custom `tabBarIcon` wrapper that renders:
    *   **Focused:** A rounded horizontal pill container (`backgroundColor: '#0a4a2f'`, `paddingHorizontal: 12`, `paddingVertical: 8`) containing the white icon and a small white text label next to it.
    *   **Unfocused:** Just the gray icon (`#6b7280`) without a background.

#### [DELETE] [index.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/index.tsx)
*   Delete the current placeholder Home screen.

#### [NEW] [index.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/index.tsx)
*   Create the redesigned Scanner Home Dashboard here (migrated and upgraded from the old `scan.tsx`).

#### [DELETE] [scan.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/scan.tsx)
*   Delete the old scanner home file as it is replaced by the new root `index.tsx`.

---

### 2. Scanner Home Dashboard Component Detail
#### [NEW] [index.tsx](file:///c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/app/%28tabs%29/index.tsx)
*   **Header Section:**
    *   Read the top inset dynamically via `useSafeAreaInsets().top` to avoid overlapping status bars.
    *   Render the title dynamically from `getBranding().appName`.
    *   **Initials Avatar:** Compute uppercase initials from `profile.name` (e.g. "John Doe" $\rightarrow$ "JD") and display inside a circular green background container.
*   **Welcome Section:**
    *   Greeting computed by time of day: `< 12` = "Good Morning", `< 18` = "Good Afternoon", else "Good Evening".
*   **Massive Pulsing Scan Button:**
    *   Giant circular button (`width: 200`, `height: 200`) in brand primary color.
    *   Add a camera icon (`photo_camera` / `camera` from lucide), text "Scan Items", and the `NetInfo`-driven connection status dot.
    *   Implement concentric animated rings using `Animated.loop` to expand and fade an absolute ring.
    *   **Accessibility:** Set `accessibilityRole="button"`, `accessibilityLabel="Scan equipment"`, and hide the decorative background rings using `accessibilityElementsHidden={true}`.
*   **Bento Grid Section:**
    *   **Left Card (Saved Drafts):**
        *   Displays icon, title "Saved Drafts", counter showing `queuedItems.length + (current ? 1 : 0)`, and sub-badge "PENDING".
        *   **Tap Behavior:** If drafts exist, run `verifyScanSessionFiles()` first. If intact, skip dialogs and go directly to `getScanResumeRoute(...)`. If missing, notify user and reset.
    *   **Right Card (Recent Batches):**
        *   Displays cloud icon, title "Recent Batches", counter showing `data?.length` submitted batches from `useRecentSubmissions()`, and sub-badge "SUBMITTED".
*   **Recent Submissions List:**
    *   Render the structured recent batches feed at the bottom of the ScrollView.

---

## Verification Plan

### Manual Verification
1.  **Tab Layout:** Verify that selecting tabs shifts the active pill container with white text and icon.
2.  **Home Dashboard Layout:** Check layout margins, safe-area top padding, initials avatar, and time-of-day greeting.
3.  **Pulsing Button:** Verify that the radar ring animates continuously and that tapping navigates to `/scan/camera`.
4.  **Connection Dot:** Toggle Airplane mode to verify that the amber "Offline Mode" dot and green "Online" dot switch dynamically based on NetInfo.
5.  **Bento Drafts Card:** Create a draft, exit, and verify that the bento drafts count increases. Tap it to check that it resumes the draft directly without warnings unless files are deleted.
6.  **Batches Card:** Confirm the submissions count aligns with the list below.
7.  **Quality Checks:** Run `npx tsc --noEmit` and `npm run lint`.
