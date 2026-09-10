// @ts-check
// ESLint flat config — linting only. Formatting is handled by Prettier.
// `eslint-config-prettier/flat` is last so it disables all formatting/stylistic
// rules that would conflict with Prettier. Do NOT add formatting rules here.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['build/**', 'node_modules/**', 'coverage/**', '**/.venv/**', '**/venv/**', 'disaster-ml/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    // Plain-JS backend files run on Node — provide Node globals (process, console, …)
    files: ['**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      // allow unused function args prefixed with _ (e.g. Express `next`)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
