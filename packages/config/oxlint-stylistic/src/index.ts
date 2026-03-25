import { eslintCompatPlugin, } from '@oxlint/plugins';

import { argumentPerLine, } from './rules/argument-per-line.ts';
import { arrayElementPerLine, } from './rules/array-element-per-line.ts';
import { destructurePerLine, } from './rules/destructure-per-line.ts';
import { exportPerLine, } from './rules/export-per-line.ts';
import { importPerLine, } from './rules/import-per-line.ts';
import { objectPropertyPerLine, } from './rules/object-property-per-line.ts';
import { paramPerLine, } from './rules/param-per-line.ts';
import { tuplePerLine, } from './rules/tuple-per-line.ts';
import { typePropertyPerLine, } from './rules/type-property-per-line.ts';

/**
 * Oxlint JS plugin enforcing one-item-per-line formatting across
 * all multi-element constructs in TypeScript.
 *
 * Each rule fires when 2 or more items share a source line and
 * auto-fixes by placing every item on its own line with consistent
 * indentation. Works alongside dprint's `preferHanging: "always"`
 * setting, which formats multi-line items correctly but does not
 * force them to be multi-line.
 *
 * @example
 * ```jsonc
 * // .oxlintrc.json
 * {
 *   "jsPlugins": ["\@monochromatic-dev/config-oxlint-stylistic"]
 * }
 * ```
 */
const plugin = eslintCompatPlugin({
  meta: {
    name: 'stylistic',
  },
  rules: {
    //region Per-line rules -- enforce one item per line in multi-element constructs
    'param-per-line': paramPerLine,
    'argument-per-line': argumentPerLine,
    'array-element-per-line': arrayElementPerLine,
    'object-property-per-line': objectPropertyPerLine,
    'import-per-line': importPerLine,
    'export-per-line': exportPerLine,
    'type-property-per-line': typePropertyPerLine,
    'tuple-per-line': tuplePerLine,
    'destructure-per-line': destructurePerLine,
    //endregion Per-line rules
  },
},);

export default plugin;
