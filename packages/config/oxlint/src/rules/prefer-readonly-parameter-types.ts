/**
 * `typescript/prefer-readonly-parameter-types` rule configuration.
 *
 * The rule fundamentally cannot model immutability of Web platform types
 * (TypedArrays carry a mutable numeric index signature, DOM nodes carry
 * mutator methods, fetch types have stream-consuming methods marked
 * mutable), nor third-party SDK types where the library owns the
 * signature. Whitelist those families via the upstream `allow` option
 * and turn on `ignoreInferredTypes` so callbacks whose signature is
 * dictated by an external lib (e.g. h3 EventHandlerWithFetch) are not
 * flagged when the parameter is left un-annotated.
 *
 * `treatMethodsAsReadonly` is intentionally left at the default `false`
 * because it silently passes legitimate `Set`/`Map`/class-state mutations
 * (verified empirically against `/tmp/oxlint-prerod` fixture, 2026-05-18).
 * Real mutable plain objects (`{ value: string }`) and arrays (`string[]`)
 * are still flagged.
 *
 * @example
 * ```typescript
 * import { preferReadonlyParameterTypesRule } from './rules/prefer-readonly-parameter-types.ts';
 * ```
 */

import type { DummyRuleMap, } from 'oxlint';

import { libAllowSpecifiers, } from './prefer-readonly-parameter-types.allow-lib.ts';
import { packageAllowSpecifiers, } from './prefer-readonly-parameter-types.allow-pkg.ts';

/**
 * Strong oxlint config entry type for `typescript/prefer-readonly-parameter-types`.
 */
type PreferReadonlyParameterTypesRule = NonNullable<
  DummyRuleMap['typescript/prefer-readonly-parameter-types']
>;

/**
 * Mutable specifier copies matching oxlint's generated option schema.
 */
const allowSpecifiers = [
  ...libAllowSpecifiers.map(function copyLibSpecifier(specifier,) {
    return {
      from: specifier.from,
      name: [...specifier.name,],
    };
  },),
  ...packageAllowSpecifiers.map(function copyPackageSpecifier(specifier,) {
    return {
      from: specifier.from,
      package: specifier.package,
      name: [...specifier.name,],
    };
  },),
];

/**
 * Rule entry for `typescript/prefer-readonly-parameter-types`.
 */
export const preferReadonlyParameterTypesRule: PreferReadonlyParameterTypesRule = [
  'warn',
  {
    allow: allowSpecifiers,
    ignoreInferredTypes: true,
  },
];
