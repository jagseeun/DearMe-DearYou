import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://localhost:4000';

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

function rewriteSpaRoutes(req, _res, next) {
  if (!req.method || req.method !== 'GET' || !req.url) return next();
  const pathname = req.url.split('?')[0];
  if (SPA_ROUTES.has(pathname)) {
    req.url = '/index.html';
  }
  return next();
}

const spaRouteFallback = {
  name: 'spa-route-fallback',
  configureServer(server) {
    server.middlewares.use(rewriteSpaRoutes);
  },
  configurePreviewServer(server) {
    server.middlewares.use(rewriteSpaRoutes);
  },
};

const apiProxy = () => ({
  target: API_TARGET,
  changeOrigin: true,
});

export default defineConfig({
  plugins: [react(), spaRouteFallback],
  server: {
    port: 5173,
    proxy: {
      '/login': apiProxy(),
      '/register': apiProxy(),
      '/check-username': apiProxy(),
      '/logout': apiProxy(),
      '/get-user-info': apiProxy(),
      '/update-email': apiProxy(),
      '/update-profile': apiProxy(),
      '/change-password': apiProxy(),
      '/write-letter': apiProxy(),
      '/get-upload-url': apiProxy(),
      '/get-image-upload-url': apiProxy(),
      '/my-letters': apiProxy(),
      '/delete-letter': apiProxy(),
      '/trigger-send': apiProxy(),
      '/send-call-reply': apiProxy(),
      '/teacher-letters': apiProxy(),
      '/my-teacher-letter': apiProxy(),
      '/admin/users': apiProxy(),
      '/admin/letters': apiProxy(),
      '/db-test': apiProxy(),
    },
  },
  build: {
    outDir: 'dist',
  },
});
