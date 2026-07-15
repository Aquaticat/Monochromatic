/**
 * TSDoc jsPlugin rule configuration.
 *
 * Configures severity for rules provided by the `tsdoc` JS plugin
 * (`\@monochromatic-dev/config-oxlint-tsdoc`). The plugin itself defines
 * the rule implementations; this module only sets their severity levels.
 *
 * @example
 * ```typescript
 * import { tsdocRules } from './rule/tsdoc.ts';
 * // spread into the main config's `rules` field
 * ```
 */

import type { DummyRuleMap, } from 'oxlint';

/**
 * Rule severity for the tsdoc JS plugin.
 */
export const tsdocRules: DummyRuleMap = {
  // Every documentable declaration (function, type, const, class, enum) needs a /** *\/ comment,
  // including local consts and lets inside function bodies and block scopes.
  // For-loop bindings (`for (const x of arr)`) are exempt.
  'tsdoc/require-tsdoc': 'error',

  // Exported functions must include at least one @example tag.
  // Functions with @inheritDoc or @internal are exempt.
  'tsdoc/require-example': 'warn',

  // Leading * on each comment line must align vertically with the opener's first *.
  'tsdoc/check-alignment': 'error',

  // All TSDoc comments must use multiline /** *\/ format; single-line blocks are auto-fixable.
  'tsdoc/multiline-blocks': 'warn',

  // No ** at start of comment lines (e.g. ` ** text` is invalid TSDoc).
  'tsdoc/no-multi-asterisks': 'error',

  // Blank comment line required before each block tag (@param, @returns, @example, etc.).
  'tsdoc/tag-lines': 'warn',

  // Modifier tags (@public, @readonly, @override, etc.) must stand alone with no content.
  'tsdoc/empty-tags': 'error',

  // Unescaped *\/ inside comment content must be written as *\/.
  'tsdoc/escape-inline-tags': 'error',

  // Only TSDoc-standard tags allowed. Unescaped @ in prose is flagged: escape as \@.
  'tsdoc/check-tag-names': 'error',

  // No conflicting access modifiers (e.g. @public and @internal together).
  'tsdoc/check-access': 'error',

  // TSDoc syntax must parse without errors (malformed inline tags, broken links, etc.).
  'tsdoc/valid-types': 'warn',

  // No JSDoc-style {Type} annotations in TSDoc: TypeScript handles types.
  'tsdoc/no-types': 'error',

  // @param names must match the function signature.
  // For destructured parameters ({ value, count }: Options), document each
  // destructured property by name (@param value, @param count), not the binding pattern.
  'tsdoc/check-param-names': 'error',

  // Every function parameter needs a @param tag.
  // For destructured parameters, write one @param per destructured property name.
  'tsdoc/require-param': 'warn',

  // @param tags must include the parameter name.
  'tsdoc/require-param-name': 'error',

  // @param tags should include a description.
  'tsdoc/require-param-description': 'warn',

  // @mutates targets must name one callable parameter exactly once and include rationale.
  'tsdoc/check-mutates': 'error',

  // Functions that return a value need @returns. Skips void, never,
  // Promise<void>, Promise<never> return types, constructors, and setters.
  'tsdoc/require-returns': 'warn',

  // @returns on a function that returns nothing is an error.
  // Void, never, Promise<void>, and Promise<never> return types must not have @returns.
  'tsdoc/require-returns-check': 'error',

  // @returns tags should include a description.
  'tsdoc/require-returns-description': 'warn',

  // @yields is not part of the TSDoc specification. Disabled to keep the plugin TSDoc-compliant.
  // Generator return types should be documented via @returns instead.
  'tsdoc/require-yields': 'off',
  'tsdoc/require-yields-check': 'off',
};
