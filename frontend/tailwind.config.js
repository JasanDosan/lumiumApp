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
        surface:  '#111118',       // card / panel background — slightly lifted
        'surface-high': '#1a1a28', // elevated surface, hover states
        'zone-deep': '#08080c',    // deepest background zone
        ink: {
          DEFAULT: '#f2f2f5',      // primary text — off-white for refined feel
          mid:     '#9898b0',      // secondary text
          light:   '#5a5a70',      // muted text
          faint:   '#333345',      // placeholders / disabled
        },
        line:     '#18182a',       // borders, dividers — slightly more visible
        subtle:   'rgba(255,255,255,0.06)', // subtle card borders
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
        slideUp: {
          from: { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
          to:   { opacity: 1, transform: 'translateY(0)   scale(1)'    },
        },
      },
      animation: {
        shimmer:    'shimmer 1.6s infinite linear',
        'fade-in':  'fadeIn  0.2s  ease-out forwards',
        'fade-up':  'fadeUp  0.25s ease-out forwards',
        'slide-up': 'slideUp 0.22s ease-out forwards',
      },
    },
  },
  plugins: [],
};
