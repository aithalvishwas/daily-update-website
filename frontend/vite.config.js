import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, send API calls straight to each service (in Docker, nginx does this).
const service = (port) => ({ target: `http://localhost:${port}`, changeOrigin: false });

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/auth': service(4001),
      '/api/users': service(4001),
      '/api/teams': service(4001),
      '/api/logs': service(4002),
      '/api/summaries': service(4003),
      '/api/epics': service(4004),
      '/api/issues': service(4004),
      '/api/weekend-requests': service(4004),
      '/api/notifications': service(4004),
      '/api/attachments': service(4004),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
