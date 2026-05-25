/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0a4a2f', light: '#1d6647', dark: '#053823', foreground: '#ffffff' },
        accent: { DEFAULT: '#0a4a2f', foreground: '#ffffff' },
        background: '#f7f9fb',
        foreground: '#13171f',
        card: '#ffffff',
        muted: { DEFAULT: '#f1f4f7', foreground: '#6b7280' },
        border: '#e1e5ec',
        destructive: { DEFAULT: '#dc3737', foreground: '#ffffff' },
        warning: { DEFAULT: '#f59e0b', foreground: '#ffffff' },
        info: { DEFAULT: '#3b82f6', foreground: '#ffffff' },
        brand: { DEFAULT: '#10b981', glow: '#4edea3', deep: '#003824' },
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        mono: ['JetBrainsMono_400Regular'],
      },
      borderRadius: {
        DEFAULT: '4px',
        card: '16px',
      },
    },
  },
};
