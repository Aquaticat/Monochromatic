import type { CreateOnceRule, } from '@oxlint/plugins';

import { simpleBanRule, } from './_simple-ban-rule.ts';

/**
 * Bans `for...in` loops in favor of `Object.entries` and functional methods.
 * Built via {@link simpleBanRule}.
 *
 * `for...in` iterates over inherited properties and requires `hasOwnProperty`
 * guards. `Object.entries`/`Object.keys`/`Object.values` with functional
 * methods are safer and more explicit.
 *
 * @example
 * ```ts
 * // Bad
 * for (const key in obj) {
 *   process(obj[key]);
 * }
 *
 * // Good
 * Object.entries(obj).forEach(function processEntry([key, value]) {
 *   process(value);
 * });
 * ```
 */
export const noForIn: CreateOnceRule = simpleBanRule({
  type: 'suggestion',
  nodeType: 'ForInStatement',
  description:
    'Disallow for...in loops. Use Object.entries/keys/values with functional methods instead.',
  messageId: 'forbidden',
  message:
    'for...in loops are banned. Use Object.entries/keys/values with functional methods instead.',
},);
