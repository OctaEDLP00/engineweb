// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config'
import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import configPrettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lock',
    'package-lock.json',
    '**/.astro/**',
    'node_modules',
    '.trash',
    '_trash',
    '*.mdx',
    '*.md',
  ]),
  [
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    configPrettier,
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ['**/*.ts'],
      rules: {
        '@typescript-eslint/triple-slash-reference': 'off',
        '@typescript-eslint/array-type': [
          'warn',
          {
            default: 'generic',
            readonly: 'array-simple',
          },
        ],
      },
    },
    {
      rules: {
        semi: ['warn', 'never'],
      },
    },
  ],
)
