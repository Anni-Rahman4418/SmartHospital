import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, send /api requests to the local API server (server/dev.js).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
