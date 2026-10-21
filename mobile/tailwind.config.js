/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        'mono-light': ['PaperMono-Light'],
        mono: ['PaperMono-Regular'],
        'mono-medium': ['PaperMono-Medium'],
        'mono-semibold': ['PaperMono-SemiBold'],
      },
      colors: {
        // Sky palette — see docs/design/222-reference.md
        night: '#051F33',
        ground: '#082F49',
        'ground-lift': '#0C4A6E',
        card: 'rgba(240, 249, 255, 0.06)',
        rule: 'rgba(240, 249, 255, 0.15)',
        primary: '#075985',
        ink: '#F0F9FF',
        'ink-muted': 'rgba(224, 242, 254, 0.65)',
        'ink-dim': 'rgba(186, 230, 253, 0.45)',
        live: '#38BDF8',
      },
    },
  },
  plugins: [],
};
