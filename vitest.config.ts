import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@upwork-bidder/config': path.resolve(__dirname, './packages/config/src'),
      '@upwork-bidder/core': path.resolve(__dirname, './packages/core/src'),
      '@upwork-bidder/ai': path.resolve(__dirname, './packages/ai/src'),
      '@upwork-bidder/db': path.resolve(__dirname, './packages/db/src'),
      '@upwork-bidder/ui': path.resolve(__dirname, './packages/ui/src'),
      '@upwork-bidder/clocked': path.resolve(__dirname, './packages/clocked/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Every test file in packages/**/tests/ and apps/**/tests/
    include: ['packages/**/tests/**/*.test.ts', 'apps/**/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', 'dist', '.next', 'tests/e2e/**'],
    },
  },
});
