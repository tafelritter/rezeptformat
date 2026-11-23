// SPDX-License-Identifier: AGPL-3.0-or-later
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Der Parser-Teil läuft im Browser: keine Node-Module außerhalb von katalog.ts.
    files: ['src/**/*.ts'],
    ignores: ['src/katalog.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'yaml'], message: 'Nur katalog.ts darf Node-Module nutzen.' },
          ],
        },
      ],
    },
  },
  { files: ['bin/**/*.mjs', '*.mjs'], ...tseslint.configs.disableTypeChecked },
  {
    files: ['bin/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
)
