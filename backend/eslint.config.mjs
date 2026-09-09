// @ts-check
// ESLint flat config — linting only. Formatting is handled by Prettier.
// `eslint-config-prettier/flat` is last so it disables all formatting/stylistic
// rules that would conflict with Prettier. Do NOT add formatting rules here.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['build/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.ts'],
    rules: {
      // allow unused function args prefixed with _ (e.g. Express `next`)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
