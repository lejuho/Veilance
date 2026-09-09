import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07090c',
          900: '#0b0e12',
          850: '#0f1318',
          800: '#141a21',
          700: '#1c242d',
          600: '#2a3541',
          500: '#3c4a58',
          400: '#5b6b7a',
          300: '#8494a3',
          200: '#b3bfc9',
          100: '#dde3e8',
        },
        accent: {
          DEFAULT: '#6ee7d8',
          dim: '#3fb9aa',
          faint: 'rgba(110,231,216,0.12)',
        },
        danger: {
          DEFAULT: '#ff6b6b',
          faint: 'rgba(255,107,107,0.12)',
        },
        warn: {
          DEFAULT: '#f5c451',
          faint: 'rgba(245,196,81,0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(2px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        fadeIn: 'fadeIn 160ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
