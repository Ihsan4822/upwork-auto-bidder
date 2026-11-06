import js from '@eslint/js';
import tsPlugin from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/coverage/**',
      'apps/web/**',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['log', 'warn', 'error', 'table'] }],
    },
  },
];
