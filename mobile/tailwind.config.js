/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Air Max 97 red/white palette
        surface: '#1a0a0a',
        'surface-elevated': '#2a1215',
        'surface-card': 'rgba(255, 255, 255, 0.08)',
        'surface-card-solid': '#2d1418',
        'surface-glass': 'rgba(255, 255, 255, 0.12)',
        'surface-glass-heavy': 'rgba(255, 255, 255, 0.18)',

        // Reds
        'am-red': '#DC2626',
        'am-red-light': '#EF4444',
        'am-red-dark': '#991B1B',
        'am-crimson': '#B91C1C',
        'am-rose': '#F43F5E',

        // Whites
        'am-white': '#FFFFFF',
        'am-white-soft': 'rgba(255, 255, 255, 0.9)',
        'am-white-muted': 'rgba(255, 255, 255, 0.6)',
        'am-white-dim': 'rgba(255, 255, 255, 0.35)',

        // Accents
        spotify: '#1DB954',
        'spotify-dim': '#17a348',
        accent: '#DC2626',
        muted: 'rgba(255, 255, 255, 0.6)',
        'muted-light': 'rgba(255, 255, 255, 0.8)',
        'muted-dark': 'rgba(255, 255, 255, 0.35)',
        'muted-border': 'rgba(255, 255, 255, 0.1)',
        danger: '#ef4444',
        'danger-light': '#f87171',
        'chat-mine': 'rgba(220, 38, 38, 0.2)',
      },
    },
  },
  plugins: [],
};
