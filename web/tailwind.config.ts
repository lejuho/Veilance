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
        accent: { DEFAULT: '#3ddc97', dim: '#2bb87c', faint: 'rgba(61,220,151,0.12)' },
        amber: { DEFAULT: '#f2b544', faint: 'rgba(242,181,68,0.14)' },
        red: { DEFAULT: '#f0625d', faint: 'rgba(240,98,93,0.14)' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        soft: { '0%,100%': { boxShadow: '0 0 0 0 rgba(242,181,68,0)' }, '50%': { boxShadow: '0 0 0 6px rgba(242,181,68,0.25)' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(2px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        soft: 'soft 1.8s ease-in-out infinite',
        blink: 'blink 1.4s ease-in-out infinite',
        fadeIn: 'fadeIn 140ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
