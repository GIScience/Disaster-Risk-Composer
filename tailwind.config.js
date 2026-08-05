/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx,md}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        heigit: {
          50: "#f9d5b6",
          100: "#ffd156",
          200: "#f6a44d",
          300: "#e86b3e",
          400: "#cc0130",
          red: "#cc0130",
          "red-dark": "#a81d2a",
          "red-light": "#f9d5b6",
        },
        dirc:{
           "text": "#515161",
        }
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "Archivo", "sans-serif"],
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
