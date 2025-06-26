import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Define plugins for Vite, including the React plugin for React support
  plugins: [react()],
  // Configure the development server
  server: {
    port: 5173 // Specify the port for the development server
  },
  // Optionally, configure environment variables for the client-side
  // This might be needed if you're explicitly exposing env variables to the browser
  // For this project, .env variables are directly consumed by `import.meta.env`
  // build: {
  //   sourcemap: true, // Enable sourcemaps for easier debugging in production builds
  // },
});
