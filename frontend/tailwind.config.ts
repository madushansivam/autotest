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
        // Brand accent — dusty muted plum (was electric violet).
        // Same hue family, desaturated + warmed for a quieter, less
        // generic-SaaS look. Only used for chrome/decoration (nav,
        // buttons, headings, focus rings) — never for status meaning.
        brand: {
          DEFAULT: 'hsl(280 28% 52%)',
          light: 'hsl(280 30% 68%)',
          dark: 'hsl(280 25% 38%)',
        },
        // Status colours — deliberately left untouched. These carry
        // functional meaning (pass/fail/crash/skip) and must stay
        // clearly distinguishable regardless of the brand palette.
        pass: 'hsl(145 63% 45%)',
        fail: 'hsl(0 72% 55%)',
        crash: 'hsl(30 95% 52%)',
        skip: 'hsl(220 14% 50%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        display: ['Syncopate', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['clamp(0.72rem, 0.68rem + 0.2vw, 0.85rem)', { lineHeight: '1.4' }],
        sm: ['clamp(0.82rem, 0.77rem + 0.25vw, 0.98rem)', { lineHeight: '1.45' }],
        base: ['clamp(0.95rem, 0.89rem + 0.3vw, 1.125rem)', { lineHeight: '1.55' }],
        lg: ['clamp(1.05rem, 0.98rem + 0.35vw, 1.3rem)', { lineHeight: '1.5' }],
        xl: ['clamp(1.15rem, 1.05rem + 0.5vw, 1.5rem)', { lineHeight: '1.45' }],
        '2xl': ['clamp(1.3rem, 1.15rem + 0.75vw, 1.8rem)', { lineHeight: '1.35' }],
        '3xl': ['clamp(1.55rem, 1.3rem + 1.2vw, 2.3rem)', { lineHeight: '1.25' }],
        '4xl': ['clamp(1.9rem, 1.5rem + 2vw, 3rem)', { lineHeight: '1.15' }],
        '5xl': ['clamp(2.3rem, 1.7rem + 3vw, 4rem)', { lineHeight: '1.1' }],
        '8xl': ['clamp(4rem, 2.5rem + 7vw, 8rem)', { lineHeight: '1' }],
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