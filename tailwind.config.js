/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // VSCode-style / featuredraw surfaces (light theme defaults).
        surface: "#f6f7f9", // app body background
        panel: "#f3f4f6", // side / right panels
        tabbar: "#eceef2", // editor tab strip
        accent: "#2b6cff", // active / selected
      },
    },
  },
  plugins: [],
};
