import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@primexpert/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@primexpert/core/financial': path.resolve(
        __dirname,
        'packages/core/src/financial/index.ts'
      ),
      '@primexpert/core/residence': path.resolve(
        __dirname,
        'packages/core/src/residence/index.ts'
      ),
      '@primexpert/core/transaction': path.resolve(
        __dirname,
        'packages/core/src/transaction/index.ts'
      ),
      '@primexpert/core/market': path.resolve(__dirname, 'packages/core/src/market/index.ts'),
      '@primexpert/core/utils/formatting': path.resolve(
        __dirname,
        'packages/core/src/utils/formatting.ts'
      ),
      '@primexpert/core/canonical': path.resolve(
        __dirname,
        'packages/core/src/canonical/index.ts'
      ),
    },
  },
  test: {
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx,js}',
      'packages/core/src/**/__tests__/**/*.{test,spec}.{ts,tsx,js}',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/config/pipelineStages.ts', 'packages/core/src/transaction/promesseAchatEngine.ts'],
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: './coverage/rpa-transaction',
    },
  },
});
