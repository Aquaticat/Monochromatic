import type { CreateOnceRule, } from '@oxlint/plugins';

import { methodCallBanRule, } from './_method-call-ban-rule.ts';

/**
 * Bans `.hasOwnProperty()` method calls in favor of `Object.hasOwn()`. Built
 * via {@link methodCallBanRule}.
 *
 * `Object.hasOwn(obj, key)` was introduced in ES2022 as the modern replacement
 * for `Object.prototype.hasOwnProperty.call(obj, key)` and `obj.hasOwnProperty(key)`.
 * It is shorter, works on objects created with `Object.create(null)`,
 * and cannot be shadowed by a property named `hasOwnProperty`.
 *
 * @example
 * ```ts
 * // Bad
 * obj.hasOwnProperty('key');
 * Object.prototype.hasOwnProperty.call(obj, 'key');
 *
 * // Good
 * Object.hasOwn(obj, 'key');
 * ```
 */
export const noHasownproperty: CreateOnceRule = methodCallBanRule({
  methodNames: ['hasOwnProperty',],
  description: 'Disallow .hasOwnProperty(). Use Object.hasOwn() instead.',
  message: '.hasOwnProperty() is banned. Use Object.hasOwn(obj, key) instead.',
},);
