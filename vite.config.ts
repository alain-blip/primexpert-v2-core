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
      // Les alias les plus SPÉCIFIQUES doivent venir EN PREMIER (forme array
      // pour garantir l'ordre). Le générique `@` est en dernier sinon il
      // intercepte `@primexpert/...` comme préfixe.
      alias: [
        { find: /^@primexpert\/core\/canonical$/, replacement: path.resolve(__dirname, 'packages/core/src/canonical/index.ts') },
        { find: /^@primexpert\/core\/valuation$/, replacement: path.resolve(__dirname, 'packages/core/src/valuation/index.ts') },
        { find: /^@primexpert\/core\/narrative$/, replacement: path.resolve(__dirname, 'packages/core/src/narrative/index.ts') },
        { find: /^@primexpert\/core\/quality$/, replacement: path.resolve(__dirname, 'packages/core/src/quality/index.ts') },
        { find: /^@primexpert\/core\/sources$/, replacement: path.resolve(__dirname, 'packages/core/src/sources/index.ts') },
        { find: /^@primexpert\/core\/export$/, replacement: path.resolve(__dirname, 'packages/core/src/export/index.ts') },
        { find: /^@primexpert\/core\/tenant$/, replacement: path.resolve(__dirname, 'packages/core/src/tenant/index.ts') },
        { find: /^@primexpert\/core\/utils\/formatting$/, replacement: path.resolve(__dirname, 'packages/core/src/utils/formatting.ts') },
        { find: /^@primexpert\/core\/services\/aiNarrativeService$/, replacement: path.resolve(__dirname, 'packages/core/src/services/aiNarrativeService.ts') },
        { find: /^@primexpert\/core$/, replacement: path.resolve(__dirname, 'packages/core/src/index.ts') },
        { find: '@', replacement: path.resolve(__dirname, '.') },
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
  };
});
