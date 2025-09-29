import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#b6d5ff',
          300: '#84b7ff',
          400: '#4f92ff',
          500: '#2a6dff',
          600: '#164fe6',
          700: '#123eb4',
          800: '#12348c',
          900: '#122e73',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
