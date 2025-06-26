/** @type {import('tailwindcss').Config} */
export default {
  // Configure files to scan for Tailwind classes
  content: [
    "./index.html", // Include the main HTML file
    "./src/**/*.{js,ts,jsx,tsx}", // Include all JavaScript, TypeScript, and React files in src
  ],
  // Enable dark mode based on the presence of a 'dark' class in the HTML element
  darkMode: "class", // 🌙 Enable dark mode via class
  theme: {
    // Extend the default Tailwind CSS theme
    extend: {
      // Define custom color palette
      colors: {
        primary: "#1d4ed8",   // A shade of blue (e.g., for primary buttons, links)
        secondary: "#9333ea", // A shade of purple (e.g., for accents or secondary actions)
      },
      fontFamily: { // Define custom font family
        inter: ['Inter', 'sans-serif'], // Add 'Inter' font, matching the Google Fonts import
      },
    },
  },
  // Add any Tailwind CSS plugins here
  plugins: [],
};
