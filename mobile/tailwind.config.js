/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        spotify: "#1DB954",
        surface: {
          DEFAULT: "#121212",
          card: "#1e1e1e",
          elevated: "#2a2a2a",
        },
        muted: {
          DEFAULT: "#888",
          light: "#aaa",
          dark: "#666",
          border: "#444",
        },
        danger: {
          DEFAULT: "#d32f2f",
          light: "#ff6b6b",
        },
        chat: {
          mine: "#1a3a2a",
        },
      },
    },
  },
  plugins: [],
};
