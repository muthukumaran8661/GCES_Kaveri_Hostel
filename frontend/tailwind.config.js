/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FBF6EC',
        card: '#FFFFFF',
        ink: '#2A2140',
        'ink-soft': '#7A7290',
        maroon: '#9E1B32',
        'maroon-dark': '#711425',
        gold: '#D9A441',
        'gold-soft': '#F3DCA6',
        teal: '#127A6E',
        blue: '#2F6FED',
        green: '#2E8B57',
        danger: '#C1392B',
        line: '#EAD9BE',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['"Roboto Slab"', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
