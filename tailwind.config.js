/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#f8fafc',
          900: '#ffffff',
          800: '#f1f5f9',
          700: '#e2e8f0',
        },
        cyan: {
          DEFAULT: '#0ea5e9',
          glow: '#38bdf8',
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
        gothic: ['Noto Sans KR', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(14, 165, 233, 0.25)',
        gold: '0 0 24px rgba(245, 158, 11, 0.25)',
        card: '0 4px 24px -8px rgba(0,0,0,0.1)',
      },
      backgroundImage: {
        'gold-sheen': 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #b45309 100%)',
        'cyan-sheen': 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #0284c7 100%)',
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
