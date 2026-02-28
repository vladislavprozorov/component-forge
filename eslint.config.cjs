const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const importPlugin = require('eslint-plugin-import')

module.exports = [
  // Базовые JS рекомендации
  js.configs.recommended,

  // Рекомендации для TypeScript
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Строгий TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error'],

      // Архитектурная дисциплина
      'import/no-cycle': 'error',
      'import/no-unresolved': 'error',
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // Чистота кода
      'no-duplicate-imports': 'error',
      'no-console': 'off', // CLI имеет право логировать
    },
  },

  // Отключает конфликты между ESLint и Prettier
  require('eslint-config-prettier'),
]
