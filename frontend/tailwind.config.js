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
  safelist: [
    // Accent (coral) — used via dynamic color prop in FilterChips, BrowseSection eyebrows
    'bg-accent', 'text-accent', 'border-accent',
    'bg-accent/15', 'border-accent/40', 'shadow-accent/20',
    'focus:ring-accent/8', 'ring-accent', 'text-accent-light',
    // Amber — Movies eyebrow / filter chips
    'bg-amber-500', 'text-amber-500', 'border-amber-500',
    'text-amber-400', 'shadow-amber-500/20',
    // Violet — Series eyebrow / filter chips
    'bg-violet-500', 'text-violet-500', 'border-violet-500',
    'text-violet-400', 'shadow-violet-500/20',
    // Gold — display typography
    'text-gold', 'bg-gold', 'bg-gold-soft',
  ],
  plugins: [],
};
