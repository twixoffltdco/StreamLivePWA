/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Палитра "Zoomer 2026"
        base: '#000000',
        surface: '#0b0b0f',
        elevated: '#15151c',
        accent: {
          cyan: '#00f2ea',
          pink: '#fe2c55',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(0, 242, 234, 0.45)',
        'glow-pink': '0 0 24px rgba(254, 44, 85, 0.45)',
      },
      keyframes: {
        pulseLive: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        live: 'pulseLive 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
