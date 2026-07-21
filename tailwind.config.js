/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0f172a',
          900: '#111c33',
          800: '#1e293b',
          700: '#27364d',
        },
        cyan: {
          DEFAULT: '#38bdf8',
          glow: '#7dd3fc',
        },
        gold: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          deep: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(56, 189, 248, 0.35)',
        gold: '0 0 24px rgba(245, 158, 11, 0.35)',
        card: '0 10px 40px -10px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'gold-sheen': 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #b45309 100%)',
        'cyan-sheen': 'linear-gradient(135deg, #38bdf8 0%, #7dd3fc 50%, #0ea5e9 100%)',
        'vip-card': 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        fadeIn: 'fadeIn 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
