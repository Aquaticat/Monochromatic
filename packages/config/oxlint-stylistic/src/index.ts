import {
  eslintCompatPlugin,
  type Plugin,
} from '@oxlint/plugins';

import { argumentPerLine, } from './rules/argument-per-line.ts';
import { arrayElementPerLine, } from './rules/array-element-per-line.ts';
import { destructurePerLine, } from './rules/destructure-per-line.ts';
import { exportPerLine, } from './rules/export-per-line.ts';
import { importPerLine, } from './rules/import-per-line.ts';
import { noMixedOperators, } from './rules/no-mixed-operators.ts';
import { objectPropertyPerLine, } from './rules/object-property-per-line.ts';
import { paramPerLine, } from './rules/param-per-line.ts';
import { tuplePerLine, } from './rules/tuple-per-line.ts';
import { typePropertyPerLine, } from './rules/type-property-per-line.ts';

/**
 * Oxlint JS plugin for TypeScript stylistic rules: one-item-per-line
 * formatting across multi-element constructs and explicit operator
 * structure in nested expressions.
 *
 * The per-line rules fire when 2 or more items share a source line and
 * auto-fix by placing every item on its own line with consistent
 * indentation. They work alongside dprint's `preferHanging: "always"`
 * setting, which formats multi-line items correctly but does not
 * force them to be multi-line.
 *
 * The expression-structure rules surface ambiguous operator precedence
 * by requiring explicit parentheses at operator boundaries.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts
 * import { defineConfig } from 'oxlint';
 * export default defineConfig({
 *   jsPlugins: ['\@monochromatic-dev/config-oxlint-stylistic'],
 * });
 * ```
 */
const plugin: Plugin = eslintCompatPlugin({
  meta: {
    name: 'stylistic',
  },
  rules: {
    //region Per-line rules: enforce one item per line in multi-element constructs
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

    //region Expression structure: enforce explicit parens at operator boundaries
    'no-mixed-operators': noMixedOperators,
    //endregion Expression structure
  },
},);

export default plugin;
