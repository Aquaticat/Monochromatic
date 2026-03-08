import { eslintCompatPlugin } from '@oxlint/plugins';

import { noArrowFunction } from './rules/no-arrow-function.ts';
import { noEnum } from './rules/no-enum.ts';
import { noForIn } from './rules/no-for-in.ts';
import { noHasownproperty } from './rules/no-hasownproperty.ts';
import { noPromiseCatch } from './rules/no-promise-catch.ts';
import { noPromiseFinally } from './rules/no-promise-finally.ts';
import { noRegexpExec } from './rules/no-regexp-exec.ts';
import { noRestParams } from './rules/no-rest-params.ts';
import { noSwitch } from './rules/no-switch.ts';
import { noVariableFunctionExpression } from './rules/no-variable-function-expression.ts';
import { requireDestructuredParams } from './rules/require-destructured-params.ts';
import { noTrimLeftRight } from './rules/no-trim-left-right.ts';
import { noTryFinally } from './rules/no-try-finally.ts';

/**
 * Oxlint JS plugin implementing `no-restricted-syntax` rules
 * that oxlint does not support natively.
 *
 * Oxlint lacks ESLint's `no-restricted-syntax` rule because it requires
 * a full AST selector engine. This plugin provides individual rules
 * for each banned syntax pattern instead.
 *
 * @example
 * ```jsonc
 * // .oxlintrc.json
 * {
 *   "jsPlugins": ["\@monochromatic-dev/config-oxlint-no-restricted-syntax"]
 * }
 * ```
 */
const plugin = eslintCompatPlugin({
  meta: {
    name: 'no-restricted-syntax',
  },
  rules: {
    'no-arrow-function': noArrowFunction,
    'no-enum': noEnum,
    'no-for-in': noForIn,
    'no-hasownproperty': noHasownproperty,
    'no-promise-catch': noPromiseCatch,
    'no-promise-finally': noPromiseFinally,
    'no-regexp-exec': noRegexpExec,
    'no-rest-params': noRestParams,
    'no-switch': noSwitch,
    'no-trim-left-right': noTrimLeftRight,
    'no-try-finally': noTryFinally,
    'no-variable-function-expression': noVariableFunctionExpression,
    'require-destructured-params': requireDestructuredParams,
  },
});

export default plugin;
