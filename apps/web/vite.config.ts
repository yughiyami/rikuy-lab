import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * HTTPS en desarrollo: los celulares solo permiten micrófono y cámara en
 * contextos seguros. Al abrir https://<IP-de-la-laptop>:5173 el navegador
 * avisa del certificado propio: "Avanzado" → "Continuar".
 */
export default defineConfig({
  // Rutas relativas: funciona en la raíz del servidor del aula y en
  // subcarpetas como https://q3son.github.io/rikuy-lab/
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    // PWA (ARQUITECTURA 1.2): Workbox with our own worker (src/sw.ts) and a precache generated from
    // the build, so every file of the shell, including the legacy hologram pages, is available offline.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // public/manifest.webmanifest is the manifest (also linked by the legacy pages)
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2,json,opus,task,wasm}'],
        // MediaPipe models (gestos/senales groups) are far above the per-file limit: they skip the size
        // check and are listed by hand below. The worker never precaches them with the shell; they are
        // cached on first use or when the page asks for their group (src/sw.ts).
        additionalManifestEntries: entradasMediapipe(resolve(import.meta.dirname, 'public')),
        // 8 MB is the whole precache budget (ARQUITECTURA 1.2); one file may not take more than 3 MB.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // The MediaPipe hand model and runtime (~22 MB, fetched by scripts/mediapipe-assets.mjs) load on
        // demand when a group turns the camera on; they would blow the precache budget.
        globIgnores: ['**/node_modules/**', 'mediapipe/**'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    rollupOptions: {
      input: {
        // React SPA (hash router)
        index: resolve(import.meta.dirname, 'index.html'),
        // Classic hologram pages (vanilla code in legacy/), kept until F1/F3 port them (5.1)
        clasico: resolve(import.meta.dirname, 'clasico.html'),
        display: resolve(import.meta.dirname, 'display.html'),
        control: resolve(import.meta.dirname, 'control.html'),
        panel: resolve(import.meta.dirname, 'panel.html'),
      },
    },
  },
});

/** Every bundled MediaPipe file (if present) as a precache entry revisioned by its content hash. */
function entradasMediapipe(publicDir: string): { url: string; revision: string }[] {
  const raiz = join(publicDir, 'mediapipe');
  if (!existsSync(raiz)) return [];
  const archivos = (readdirSync(raiz, { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
    .filter((e) => e.isFile() && /\.(js|json|task|wasm)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
  return archivos.map((f) => ({
    url: relative(publicDir, f).replace(/\\/g, '/'),
    revision: createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16),
  }));
}
