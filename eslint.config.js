import eslintjs from '@eslint/js';
import { configs as tseslintConfigs } from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

const { configs: eslintConfigs } = eslintjs;

export default [
  {
    ...eslintConfigs.recommended,
    files: ['src/**/*.ts'],
  },
  ...tseslintConfigs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  prettierConfig,
];
