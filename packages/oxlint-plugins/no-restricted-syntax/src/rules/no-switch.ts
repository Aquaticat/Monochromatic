import type { CreateOnceRule, } from '@oxlint/plugins';

import { simpleBanRule, } from './_simple-ban-rule.ts';

/**
 * Bans `switch` statements in favor of if/else chains or `Record` lookups.
 * Built via {@link simpleBanRule}.
 *
 * If/else avoids `break` boilerplate and fallthrough bugs.
 * `Record` is preferred when mapping a discriminant to a value.
 *
 * @example
 * ```ts
 * // Bad
 * switch (kind) {
 *   case 'a': return 1;
 *   default: return 0;
 * }
 *
 * // Good; if/else
 * if (kind === 'a') {
 *   return 1;
 * } else {
 *   return 0;
 * }
 *
 * // Good; Record lookup
 * const VALUES: Record<string, number> = { a: 1 };
 * return VALUES[kind] ?? 0;
 * ```
 */
export const noSwitch: CreateOnceRule = simpleBanRule({
  type: 'suggestion',
  nodeType: 'SwitchStatement',
  description: 'Disallow switch statements. Use if/else chains or Record lookups instead.',
  messageId: 'forbidden',
  message: 'Switch statements are banned. Use if/else chains or Record lookups instead.',
},);
