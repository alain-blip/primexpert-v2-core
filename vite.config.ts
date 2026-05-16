import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      // IMPORTANT — ordre des alias :
      // Les alias les plus SPECIFIQUES doivent venir EN PREMIER (forme array
      // pour garantir l'ordre). Le generique `@` est en dernier sinon il
      // intercepte `@primexpert/...` comme prefixe.
      alias: [
        { find: /^@primexpert\/core\/canonical$/, replacement: path.resolve(__dirname, 'packages/core/src/canonical/index.ts') },
        { find: /^@primexpert\/core\/valuation$/, replacement: path.resolve(__dirname, 'packages/core/src/valuation/index.ts') },
        { find: /^@primexpert\/core\/narrative$/, replacement: path.resolve(__dirname, 'packages/core/src/narrative/index.ts') },
        { find: /^@primexpert\/core\/quality$/, replacement: path.resolve(__dirname, 'packages/core/src/quality/index.ts') },
        { find: /^@primexpert\/core\/sources$/, replacement: path.resolve(__dirname, 'packages/core/src/sources/index.ts') },
        { find: /^@primexpert\/core\/export$/, replacement: path.resolve(__dirname, 'packages/core/src/export/index.ts') },
        { find: /^@primexpert\/core\/tenant$/, replacement: path.resolve(__dirname, 'packages/core/src/tenant/index.ts') },
        { find: /^@primexpert\/core\/mail$/, replacement: path.resolve(__dirname, 'packages/core/src/mail/index.ts') },
        { find: /^@primexpert\/core\/audio$/, replacement: path.resolve(__dirname, 'packages/core/src/audio/index.ts') },
        { find: /^@primexpert\/core\/financial$/, replacement: path.resolve(__dirname, 'packages/core/src/financial/index.ts') },
        { find: /^@primexpert\/core\/identity$/, replacement: path.resolve(__dirname, 'packages/core/src/identity/index.ts') },
        { find: /^@primexpert\/core\/utils\/formatting$/, replacement: path.resolve(__dirname, 'packages/core/src/utils/formatting.ts') },
        { find: /^@primexpert\/core\/services\/aiNarrativeService$/, replacement: path.resolve(__dirname, 'packages/core/src/services/aiNarrativeService.ts') },
        { find: /^@primexpert\/core$/, replacement: path.resolve(__dirname, 'packages/core/src/index.ts') },
        { find: '@', replacement: path.resolve(__dirname, '.') },
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // File watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    build: {
      // Phase F-1 - Code-splitting agressif :
      // Le bundle monolithique de 1.46 MB est eclate en chunks stables
      // et cacheables. Combine aux React.lazy() cote App, le payload
      // initial passe largement sous les 600 KB.
      target: 'es2020',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) {
              // Notre core metier : un chunk stable, partage entre routes.
              if (id.includes('/packages/core/')) return 'primexpert-core';
              return undefined;
            }
            // Vendors - classes par usage / poids :
            if (
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/') ||
              /\/react\//.test(id)
            ) {
              return 'react-vendor';
            }
            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'firebase-vendor';
            }
            if (
              id.includes('/motion/') ||
              id.includes('framer-motion') ||
              id.includes('/lucide-react/')
            ) {
              return 'ui-vendor';
            }
            if (
              id.includes('/react-markdown/') ||
              id.includes('/remark-') ||
              id.includes('/micromark') ||
              id.includes('/mdast-')
            ) {
              return 'markdown-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
