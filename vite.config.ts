import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '..');

// Dev/browser preview only: serve <app>/icons and <app>/database under /mtr/.
// Inside Tauri the same files come from the `mtr://` protocol.
const serveAppFiles = (): Plugin => ({
  name: 'serve-app-files',
  configureServer(server) {
    server.middlewares.use('/mtr', (req, res, next) => {
      const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
      if (!/^(icons|database|sample)\//.test(rel) || rel.includes('..')) return next();
      const p = rel.startsWith('sample/') ? path.join(__dirname, 'docs', rel) : path.join(APP, rel);
      if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', p.endsWith('.png') ? 'image/png' : 'application/json');
      fs.createReadStream(p).pipe(res);
    });
  },
});

export default defineConfig({
  plugins: [react(), serveAppFiles()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1000 },
  test: { include: ['src/**/*.test.ts'] },
} as any);
