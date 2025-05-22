import eslint from '@eslint/js';
// import oxlintrc from '@monochromatic-dev/config-oxlint/index.jsonc';
import {
  eslintRules,
  importRules,
  jsdocRules,
  jsxA11yRules,
  nodeRules,
  promiseRules,
  reactRules,
  typescriptRules,
  unicornRules,
  vitestRules,
} from 'eslint-plugin-oxlint/rules-by-scope';
import tseslint from 'typescript-eslint';
import type { ConfigArray } from 'typescript-eslint';

const myConfigArray: ConfigArray = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/bak/**',
      '**/temp/**',
      '**/node_modules/**',
      '**/.astro/**',
      // We're not linting js files.
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    // Turn off rules already supported by oxlint.
    rules: {
      ...eslintRules,
      ...importRules,
      ...jsdocRules,
      ...jsxA11yRules,
      ...nodeRules,
      ...promiseRules,
      ...reactRules,
      ...typescriptRules,
      ...unicornRules,
      ...vitestRules,
    },
  },
);

export default myConfigArray;

/*
 Cannot use buildFromOxlintConfig because:

```ts
 import eslint from '@eslint/js';
 import oxlintrc from '@monochromatic-dev/config-oxlint/index.jsonc';
 import oxlint from 'eslint-plugin-oxlint';
 import tseslint from 'typescript-eslint';
 import type { ConfigArray } from 'typescript-eslint';

 const myConfigArray: ConfigArray = tseslint.config(
 eslint.configs.recommended,
 ...tseslint.configs.recommendedTypeChecked,
 ...oxlint.buildFromOxlintConfig(oxlintrc),
 {
 languageOptions: {
 parserOptions: {
 projectService: true,
 tsconfigRootDir: import.meta.dirname,
 },
 },
 },
 );

 export default myConfigArray;
```

Would fail with

```ansi
 . b:js: error during build:
 . b:js: ../../../node_modules/.pnpm/eslint-plugin-oxlint@0.16.11/node_modules/eslint-plugin-oxlint/dist/build-from-oxlint-config/index.mjs (2:7): "default" is not exported by "../../../node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/main.js", imported by "../../../node_modules/.pnpm/eslint-plugin-oxlint@0.16.11/node_modules/eslint-plugin-oxlint/dist/build-from-oxlint-config/index.mjs".
 . b:js: file: C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/eslint-plugin-oxlint@0.16.11/node_modules/eslint-plugin-oxlint/dist/build-from-oxlint-config/index.mjs:2:7
 . b:js:
 . b:js: 1: import fs from "node:fs";
 . b:js: 2: import JSONCParser from "jsonc-parser";
 . b:js:           ^
 . b:js: 3: import { isObject } from "./utilities.mjs";
 . b:js: 4: import { readRulesFromConfig, handleRulesScope } from "./rules.mjs";
 . b:js:
 . b:js:     at getRollupError (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/parseAst.js:397:41)
 . b:js:     at error (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/parseAst.js:393:42)
 . b:js:     at Module.error (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:16759:16)
 . b:js:     at Module.traceVariable (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:17208:29)
 . b:js:     at ModuleScope.findVariable (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:14864:39)
 . b:js:     at ReturnValueScope.findVariable (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:5582:38)
 . b:js:     at FunctionBodyScope.findVariable (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:5582:38)
 . b:js:     at BlockScope.findVariable (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:5582:38)
 . b:js:     at BlockScope.findVariable (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:5582:38)
 . b:js:     at MemberExpression.bind (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:7285:49)
```

This looks like a bug in eslint-plugin-oxlint.
 */
