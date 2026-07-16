// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // Chat architecture guardrails (Docs/chat). ERROR (flipped from WARN in
  // Phase 2 / R2) now that the color-token migration (PR-3 semantic tokens,
  // controller boundary) is complete — violations break the build.
  {
    files: ["src/features/lab/chat/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/constants/theme",
            importNames: [
              "brand", "lab", "buyBlue", "buyBlueDim", "buyBlueSurface",
              "greenDarkest", "greenDark", "greenMedium", "greenLight",
              "warnAmber", "navIdle", "navBorder", "badgeOrange",
            ],
            message:
              "D1/D2 (PR-3): consume color via the theme provider (useColor), not raw theme.ts color tokens.",
          },
        ],
        patterns: [
          {
            group: [
              "@/features/lab/streaming/*",
              "**/labStream",
              "**/labStreamTypes",
            ],
            message:
              "A4 §12.2: presentational chat components must not import the streaming transport/protocol; go through the controller.",
          },
        ],
      }],
    },
  },
  // The guardrail targets PRESENTATIONAL chat components only. The theme layer
  // (which DEFINES tokens from raw colors), the controller/types layer (which
  // owns the streaming protocol), and tests legitimately touch raw colors / the
  // transport — so they are exempt (per the R2 plan: exempt theme/controllers/
  // types/__tests__). This block comes AFTER the guardrail so it wins for these paths.
  {
    files: [
      "src/features/lab/chat/theme/**/*.{ts,tsx}",
      "src/features/lab/chat/controllers/**/*.{ts,tsx}",
      "src/features/lab/chat/types/**/*.{ts,tsx}",
      "src/features/lab/chat/**/__tests__/**/*.{ts,tsx}",
      "src/features/lab/chat/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);
