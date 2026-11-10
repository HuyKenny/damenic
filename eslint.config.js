import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// .astro files are type-checked by `astro check`; ESLint covers TS/TSX and scripts.
export default defineConfig(
  { ignores: ['dist', '.astro', 'node_modules', 'playwright-report', 'test-results', 'shots'] },
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  { files: ['scripts/**'], rules: { 'no-console': 'off' }, languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
);
