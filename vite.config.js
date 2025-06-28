import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Vite plugin for React applications

export default defineConfig({
  // Define plugins for Vite. Plugins extend Vite's capabilities.
  // The 'react()' plugin is essential for React support, enabling JSX transformation, HMR, etc.
  plugins: [react()],

  // Configure the development server.
  server: {
    port: 5173 // Specify the port number on which the development server will run.
              // If this port is already in use, Vite will automatically try the next available port.
  },

  // Build configuration (optional, currently commented out in the provided code).
  // This section would define how Vite builds your application for production.
  // build: {
  //   sourcemap: true, // Enabling sourcemaps is useful for debugging production builds.
  // },

  // Further configurations could include:
  // - `resolve.alias`: For setting up path aliases (e.g., '@components' to 'src/components').
  // - `css.postcss`: If custom PostCSS processing is needed beyond the default setup.
  // - `optimizeDeps`: For fine-tuning dependency pre-bundling.
});
