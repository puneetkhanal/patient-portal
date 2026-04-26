module.exports = {
    root: true,
  
    env: {
      node: true,
      es2022: true
    },
  
    extends: [
      'eslint:recommended',
      '@typescript-eslint/recommended',
      'plugin:node/recommended',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript',
      'plugin:promise/recommended'
    ],
  
    parser: '@typescript-eslint/parser',
  
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      project: ['./tsconfig.eslint.json']
    },
  
    plugins: ['@typescript-eslint', 'n', 'import', 'promise'],
  
    overrides: [
      {
        files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
        env: {
          jest: true
        },
        rules: {
          'no-undef': 'off'
        }
      }
    ],
  
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
  
      'n/no-missing-import': 'off',
'n/no-unsupported-features/es-syntax': 'off',
  
      'import/no-unresolved': 'off',
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always'
      }],
  
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
  
      'promise/no-return-wrap': 'error',
      'promise/catch-or-return': 'error'
    },
  
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
        node: { extensions: ['.js', '.ts', '.json'] }
      }
    },
  
    ignorePatterns: [
      'dist/',
      'node_modules/',
      'client/',
      'coverage/',
      '*.config.js',
      '*.config.ts'
    ]
  };
  