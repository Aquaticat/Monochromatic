import eslintConfig from '@monochromatic/eslint-config';

import eslintTypescriptConfig from '@monochromatic/eslint-config-typescript';

import eslintAstroConfig from '@monochromatic/eslint-config-astro';

export default [
  ...eslintConfig,
  {
    rules: {},
  },

  ...eslintTypescriptConfig,
  {
    files: [
      '**./*.ts',
      '**./*.mts',
      '**./*.cts',
      '**./*.tsx',
    ],
    rules: {},
  },

  ...eslintAstroConfig,
  {
    files: ['**./*.astro'],
    rules: {},
  },
];
