# eslint-config-astro

# Example usage

`eslint.config.js`

```js
import eslintConfig from '@monochromatic.dev/eslint-config';

import eslintTypescriptConfig from '@monochromatic.dev/eslint-config-typescript';

import eslintAstroConfig from '@monochromatic.dev/eslint-config-astro';

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
```
