import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SPA_ROUTES = new Set([
  '/login',
  '/signup',
  '/hello',
  '/write',
  '/done',
  '/letters',
  '/letter-login',
  '/pink-letters',
  '/view-letter',
  '/admin',
]);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.method || req.method !== 'GET' || !req.url) return next();
        const pathname = req.url.split('?')[0];
        if (SPA_ROUTES.has(pathname)) {
          req.url = '/index.html';
        }
        return next();
      });
    },
    proxy: {
      '/login': 'http://localhost:4000',
      '/register': 'http://localhost:4000',
      '/check-username': 'http://localhost:4000',
      '/logout': 'http://localhost:4000',
      '/get-user-info': 'http://localhost:4000',
      '/update-email': 'http://localhost:4000',
      '/update-profile': 'http://localhost:4000',
      '/write-letter': 'http://localhost:4000',
      '/get-upload-url': 'http://localhost:4000',
      '/get-image-upload-url': 'http://localhost:4000',
      '/my-letters': 'http://localhost:4000',
      '/delete-letter': 'http://localhost:4000',
      '/trigger-send': 'http://localhost:4000',
      '/send-call-reply': 'http://localhost:4000',
      '/teacher-letters': 'http://localhost:4000',
      '/my-teacher-letter': 'http://localhost:4000',
      '/db-test': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
