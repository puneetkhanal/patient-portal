import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import n from 'eslint-plugin-n';
import importPlugin from 'eslint-plugin-import';
import promise from 'eslint-plugin-promise';
import jest from 'eslint-plugin-jest';

export default [
  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    plugins: {
      n,
      import: importPlugin,
      promise
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.eslint.json'
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',

      'n/no-missing-import': 'off',
      'n/no-unsupported-features/es-syntax': 'off',

      'import/no-unresolved': 'off',

      'promise/no-return-wrap': 'error',
      'promise/catch-or-return': 'error',

      'no-console': 'off'
    }
  },

  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    plugins: {
      jest
    },
    languageOptions: {
      globals: {
        ...jest.environments.globals.globals
      }
    },
    rules: {
      'no-undef': 'off'
    }
  }
];
