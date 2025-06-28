/** @type {import('tailwindcss').Config} */
export default {
  // Configure files to scan for Tailwind classes.
  // These paths tell Tailwind CSS where to look for class names
  // to generate the final CSS bundle, optimizing its size.
  content: [
    "./index.html", // Include the main HTML file where global classes might be used.
    "./src/**/*.{js,ts,jsx,tsx}", // Include all JavaScript, TypeScript, and React files in the 'src' directory.
  ],

  // Enable dark mode based on the presence of a 'dark' class on the HTML element.
  // This allows you to toggle dark/light themes by adding/removing 'dark' class via JavaScript.
  darkMode: "class", // 🌙 Enable dark mode via class

  theme: {
    // Extend the default Tailwind CSS theme.
    // This allows you to add custom configurations without overriding Tailwind's defaults.
    extend: {
      // Define a custom color palette.
      // These colors can then be used as Tailwind classes (e.g., `bg-primary`, `text-secondary`).
      colors: {
        primary: "#1d4ed8",   // A shade of blue (e.g., for primary buttons, links) - corresponds to blue-700
        secondary: "#9333ea", // A shade of purple (e.g., for accents or secondary actions) - corresponds to purple-600
      },
      fontFamily: { // Define custom font family.
        // Add 'Inter' font, which should be imported from Google Fonts in index.html.
        // This allows you to use `font-inter` class in your components.
        inter: ['Inter', 'sans-serif'],
      },
    },
  },

  // Add any Tailwind CSS plugins here.
  // Plugins extend Tailwind's capabilities with new utilities or components.
  plugins: [],
};
