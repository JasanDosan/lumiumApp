/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // ── Dark editorial base ────────────────────────────────────────────
        canvas:          '#0d0d0d',    // page background
        surface:         '#141420',    // card / panel background
        'surface-high':  '#1e1e2e',    // elevated surface, hover states
        'zone-deep':     '#080808',    // deepest background zone
        ink: {
          DEFAULT: '#ffffff',          // primary text — pure white
          mid:     '#c8c8c8',          // secondary text
          light:   '#888888',          // muted text
          faint:   '#444444',          // placeholders / disabled
        },
        line:    'rgba(255,255,255,0.10)', // borders, dividers
        subtle:  'rgba(255,255,255,0.06)', // subtle card borders
        // ── Accent (coral) ─────────────────────────────────────────────────
        accent: {
          DEFAULT: '#e8503a',
          hover:   '#d44030',
          light:   '#f07a68',
          soft:    '#2a1008',
        },
        // ── Gold — reserved for .display / .headline-xl only ──────────────
        gold: {
          DEFAULT: '#e8c23a',
          soft:    '#2a1e08',
        },
        // ── Semantic ──────────────────────────────────────────────────────
        red: {
          DEFAULT: '#e8503a',
          hover:   '#c53030',
          soft:    '#2a1010',
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
