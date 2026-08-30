/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#11d483',
        'background-dark': '#10221a',
        'card-dark': '#1A2E25',
        'gold-accent': '#D4AF37',
        'surface-dark': '#1a2e25',
        'background-light': '#f6f8f7',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        arabic: ['Amiri', 'serif'],
        quran: ['Public Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        '2xl': '2.5rem',
        full: '9999px',
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(16, 34, 26, 0.5)',
        glow: '0 0 15px rgba(17, 212, 131, 0.2)',
        'inner-glow': 'inset 0 0 20px rgba(17, 212, 131, 0.05)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
