const { colors, spacing, radius } = require('./src/constants/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger:  colors.danger,
        info:    colors.info,
        bg:      colors.light.background,
        surface: colors.light.surface,
        border:  colors.light.border,
      },
      spacing,
      borderRadius: radius,
      fontFamily: {
        sans:   ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semi:   ['Inter_600SemiBold'],
        bold:   ['Inter_700Bold'],
        'sans-medium': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        mono:   ['JetBrainsMono_400Regular'],
      },
    },
  },
};
