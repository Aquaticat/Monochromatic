# eslint-config-typescript

# Example usage

`eslint.config.js`

```js
import eslintConfig from '@monochromatic.dev/eslint-config';

import eslintTypescriptConfig from '@monochromatic.dev/eslint-config-typescript';

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
];
```
