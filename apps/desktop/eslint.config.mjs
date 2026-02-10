import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { default: rootConfig } = await import(
  resolve(__dirname, '../../eslint.config.mjs')
);

import reactPlugin from 'eslint-plugin-react';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...rootConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    settings: {
      'import/core-modules': ['electron'],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off',
    },
  },
];
