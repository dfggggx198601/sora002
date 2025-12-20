import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Prevent crash when accessing process.env in browser
  // 'process.env': {} // Removed to allow env var usage if needed, or better handled by loadEnv
});