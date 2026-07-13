import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // AutoTest design tokens
        // Dark neutral base
        surface: {
          DEFAULT: 'hsl(220 20% 8%)',
          '1': 'hsl(220 18% 12%)',
          '2': 'hsl(220 16% 16%)',
          '3': 'hsl(220 14% 20%)',
        },
        // Brand accent — electric violet
        brand: {
          DEFAULT: 'hsl(262 83% 66%)',
          light: 'hsl(262 90% 78%)',
          dark: 'hsl(262 70% 50%)',
        },
        // Status colours
        pass: 'hsl(145 63% 45%)',
        fail: 'hsl(0 72% 55%)',
        crash: 'hsl(30 95% 52%)',
        skip: 'hsl(220 14% 50%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-brand': 'pulseBrand 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseBrand: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
