/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Chess board colors
        'board-light': '#F0D9B5',
        'board-dark': '#B58863',
        // Brand
        'brand-primary': '#1a56db',
        'brand-secondary': '#7e3af2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
