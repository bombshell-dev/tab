import eslintjs from '@eslint/js';
import { configs as tseslintConfigs } from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

const { configs: eslintConfigs } = eslintjs;
const completionFileGlobs = [
  'src/**/*.ts',
  'bin/**/*.ts',
  'benchmarks/**/*.ts',
  '*.ts',
];

export default [
  {
    ignores: ['dist/**'],
  },
  {
    ...eslintConfigs.recommended,
    files: completionFileGlobs,
  },
  ...tseslintConfigs.strict,
  {
    files: completionFileGlobs,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^ignore',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      'default-case-last': 'error',
      eqeqeq: ['error', 'smart'],
      'no-fallthrough': ['error', { allowEmptyCase: true }],
      'prefer-template': 'error',
      'no-console': 'off',
    },
  },
  prettierConfig,
];
