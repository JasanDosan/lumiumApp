/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        canvas:  '#fafafa',   // page background
        ink: {
          DEFAULT: '#111111', // primary text
          mid:     '#6b6b6b', // secondary text
          light:   '#a0a0a0', // muted text
          faint:   '#d4d4d4', // placeholders / disabled
        },
        line: '#e5e5e5',      // borders, dividers
        red: {
          DEFAULT: '#e53e3e', // favorites, remove
          hover:   '#c53030',
          soft:    '#fff5f5', // soft red bg
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
