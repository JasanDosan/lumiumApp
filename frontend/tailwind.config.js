/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // ── Dark mode base ─────────────────────────────────────────────────
        canvas:   '#0b0b0f',       // page background
        surface:  '#151520',       // card / panel background
        'surface-high': '#1f1f2e', // elevated surface, hover states
        ink: {
          DEFAULT: '#ffffff',      // primary text
          mid:     '#b3b3c6',      // secondary text
          light:   '#6b7280',      // muted text
          faint:   '#3f3f46',      // placeholders / disabled
        },
        line:     '#1e1e2a',       // borders, dividers
        subtle:   'rgba(255,255,255,0.08)', // subtle card borders
        // ── Accent (purple) ────────────────────────────────────────────────
        accent: {
          DEFAULT: '#8b5cf6',
          hover:   '#a78bfa',
          light:   '#c4b5fd',      // light purple for text/icons
          soft:    '#1e1732',
        },
        // ── Semantic ──────────────────────────────────────────────────────
        red: {
          DEFAULT: '#e53e3e',
          hover:   '#c53030',
          soft:    '#2a1515',
        },
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer:   'shimmer 1.6s infinite linear',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'fade-up': 'fadeUp 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};
