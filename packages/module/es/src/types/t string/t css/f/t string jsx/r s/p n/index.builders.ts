/**
 * Internal builder functions for the CSS hyperscript factory.
 *
 * Separated from the main index to stay within the line budget.
 */

import type {
  AtRuleOptions,
  CssOptions,
  RuleOptions,
} from './index.types.ts';
import type { CssValue, } from './values.ts';

export type {
  AtRuleOptions,
  CssOptions,
  RuleOptions,
} from './index.types.ts';

//region Helpers

/**
 * Serializes a declarations record into a CSS declaration string.
 *
 * Accepts any declarations object — `StrictCssDeclarations`, at-rule descriptor
 * interfaces, or plain `Record<string, string>`. Skips `undefined` values since
 * csstype interfaces mark all properties as optional.
 *
 * @param decls - property-value pairs (typed at the API boundary, loose here for internal flexibility)
 *
 * @returns semicolon-separated declarations (e.g. `'display:flex;gap:1rem'`)
 *
 * @example
 * ```ts
 * serializeDecls({ display: 'flex', gap: cssRem(1) })
 * // 'display:flex;gap:1rem'
 * ```
 */
function serializeDecls(decls: object,): string {
  const parts: string[] = [];

  for (const [property, value,] of Object.entries(decls,) as readonly [string,
    CssValue | string | number | undefined,][])
  {
    if (value === undefined)
      continue;

    parts.push(`${property}:${value}`,);
  }

  return parts.join(';',);
}

/**
 * Checks whether an at-rule has any block content (declarations, raw, or children).
 *
 * Statement at-rules like `@layer tokens;` have no block.
 *
 * @param options - at-rule options to inspect
 *
 * @returns `true` when the at-rule should produce a `{ }` block
 */
function hasBlock(options: AtRuleOptions,): boolean {
  if (options.decls !== undefined)
    return true;

  if (options.raw !== undefined)
    return true;

  if (options.children !== undefined && options.children.length > 0)
    return true;

  return false;
}

//endregion

//region Builder functions

/**
 * Builds a CSS style rule string.
 *
 * @param rule - CSS selector string
 *
 * @param decls - declarations to serialize
 *
 * @param raw - raw CSS strings to inject verbatim
 *
 * @param children - nested child rules
 *
 * @returns CSS rule string (e.g. `'.card{display:flex}'`)
 */
export function buildRule(
  { rule, decls, raw, children, }: RuleOptions,
): string {
  const parts: string[] = [`${rule}{`,];

  if (decls !== undefined)
    parts.push(serializeDecls(decls,),);

  if (raw !== undefined)
    parts.push(raw,);

  if (children !== undefined) {
    for (const child of children) {
      //region Semicolon separator
      // Insert a semicolon between trailing declarations and the first child,
      // so `display:flex` + `&:hover{...}` produces `display:flex;&:hover{...}`
      // rather than `display:flex&:hover{...}`.
      //endregion
      if (decls !== undefined && child === children[0])
        parts.push(';',);

      parts.push(child,);
    }
  }

  parts.push('}',);

  return parts.join('',);
}

/**
 * Builds a CSS at-rule string.
 *
 * Produces either a block at-rule (`@media (...) { ... }`) or a statement
 * at-rule (`@layer tokens;`) depending on whether block content is present.
 *
 * @param options - at-rule configuration with keyword, params, and optional block content
 *
 * @returns CSS at-rule string
 */
export function buildAtRule(
  options: AtRuleOptions,
): string {
  const { at, params, decls, raw, children, } = options;
  const head = params !== undefined
    ? `@${at} ${params}`
    : `@${at}`;

  //region Statement at-rule
  // At-rules with no block content are statements terminated by a semicolon.
  //endregion
  if (!hasBlock(options,))
    return `${head};`;

  const parts: string[] = [`${head}{`,];

  if (decls !== undefined)
    parts.push(serializeDecls(decls,),);

  if (raw !== undefined)
    parts.push(raw,);

  if (children !== undefined) {
    for (const child of children) {
      if (decls !== undefined && child === children[0])
        parts.push(';',);

      parts.push(child,);
    }
  }

  parts.push('}',);

  return parts.join('',);
}

//endregion
