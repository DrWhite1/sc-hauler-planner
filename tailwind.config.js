/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#08090b',
        elevated: '#12151a',
        accent: '#c5cbd3',
        sage: '#6f9e86',
        gold: '#d4a017',
      },
    },
  },
  plugins: [],
};