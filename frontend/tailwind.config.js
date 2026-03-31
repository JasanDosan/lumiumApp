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
        canvas:   '#111114',       // page background
        surface:  '#1a1a1e',       // card / panel background
        'surface-high': '#242428', // elevated surface, hover states
        ink: {
          DEFAULT: '#ebebeb',      // primary text
          mid:     '#8b8b8e',      // secondary text
          light:   '#55555a',      // muted text
          faint:   '#2e2e32',      // placeholders / disabled
        },
        line:     '#272729',       // borders, dividers
        // ── Accent (interactive blue) ──────────────────────────────────────
        accent: {
          DEFAULT: '#5b8dee',
          hover:   '#4a7de0',
          soft:    '#151d35',
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
