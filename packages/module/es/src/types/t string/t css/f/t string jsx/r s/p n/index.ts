/**
 * String-returning hyperscript factory for CSS generation.
 *
 * Same composable pattern as `h-xml` and `h-html` but produces CSS strings.
 * Each call constructs a single node in the CSS tree — a style rule or an
 * at-rule — and returns it as a plain string. Nesting is explicit via
 * `children`, mirroring native CSS nesting.
 *
 * Replaces `@mixin`/`@apply` with plain functions that return declaration
 * records, composed via object spread.
 *
 * Types from `csstype` provide editor intellisense for:
 * - CSS property names (kebab-case) and their valid values
 * - At-rule names (`media`, `layer`, `keyframes`, ...)
 * - At-rule descriptors per type (`@font-face`, `@property`, `@counter-style`, ...)
 *
 * @param options - Named parameters describing the CSS construct
 * @returns CSS string
 *
 * @example Style rule
 * ```ts
 * const css = $({ rule: '.card', decls: { display: 'flex', gap: '1rem' } });
 * // '.card{display:flex;gap:1rem}'
 * ```
 *
 * @example Nested rule
 * ```ts
 * const css = $({
 *   rule: '.card',
 *   decls: { display: 'flex' },
 *   children: [
 *     $({ rule: '&:hover', decls: { opacity: '0.8' } }),
 *   ],
 * });
 * // '.card{display:flex;&:hover{opacity:0.8}}'
 * ```
 *
 * @example At-rule with children
 * ```ts
 * const css = $({
 *   at: 'media',
 *   params: '(prefers-color-scheme: dark)',
 *   children: [
 *     $({ rule: ':root', decls: { '--color-fg': 'oklch(0.9 0 0)' } }),
 *   ],
 * });
 * // '\@media (prefers-color-scheme: dark){:root{--color-fg:oklch(0.9 0 0)}}'
 * ```
 *
 * @example At-rule with typed descriptors (`@property`)
 * ```ts
 * const css = $({
 *   at: 'property',
 *   params: '--color-fg',
 *   decls: { syntax: '"<color>"', inherits: 'true', 'initial-value': 'black' },
 * });
 * // '\@property --color-fg{syntax:"<color>";inherits:true;initial-value:black}'
 * ```
 *
 * @example Statement at-rule (no block)
 * ```ts
 * const css = $({ at: 'layer', params: 'tokens, base, components' });
 * // '\@layer tokens, base, components;'
 * ```
 */
import type { AtRule, AtRules, PropertiesHyphen } from "csstype";

//region Types

/**
 * CSS declarations record with editor intellisense for standard property names and values.
 *
 * Combines `csstype`'s `PropertiesHyphen` (kebab-case standard properties with value autocomplete)
 * and a template literal index for CSS custom properties (`--*`).
 *
 * @example
 * ```ts
 * const decls: CssDeclarations = {
 *   display: 'flex',              // autocomplete for 'flex', 'grid', 'block', ...
 *   'align-items': 'center',      // autocomplete for 'center', 'flex-start', ...
 *   '--color-fg': 'oklch(0.2 0 0)', // custom properties accepted
 * };
 * ```
 */
export type CssDeclarations = PropertiesHyphen & Record<`--${string}`, string>;

/**
 * Strips the `@` prefix from csstype's `AtRules` union.
 *
 * Transforms `"@media" | "@layer" | ...` into `"media" | "layer" | ...`
 * to match h-css's `at` field convention (prefix added during string building).
 */
type StripAtPrefix<T> = T extends `@${infer Name}` ? Name : never;

/**
 * Union of all standard CSS at-rule names without the `@` prefix.
 *
 * @example `'media' | 'layer' | 'keyframes' | 'font-face' | 'property' | ...`
 */
type AtRuleName = StripAtPrefix<AtRules>;

/**
 * Maps at-rule names that have typed descriptor interfaces in csstype
 * to their kebab-case descriptor types.
 *
 * At-rules not in this map (e.g. `media`, `supports`, `layer`) either
 * take children instead of descriptors or have no typed descriptors in csstype.
 */
type AtRuleDeclsMap = {
  'counter-style': AtRule.CounterStyleHyphen;
  'font-face': AtRule.FontFaceHyphen;
  'font-palette-values': AtRule.FontPaletteValuesHyphen;
  'page': AtRule.PageHyphen;
  'property': AtRule.PropertyHyphen;
  'view-transition': AtRule.ViewTransitionHyphen;
};

/**
 * At-rule options for at-rules with typed descriptor interfaces.
 *
 * When `at` is `'font-face'`, `decls` accepts `AtRule.FontFaceHyphen`;
 * when `at` is `'property'`, `decls` accepts `AtRule.PropertyHyphen`; etc.
 * TypeScript narrows `decls` based on the `at` discriminant.
 */
type TypedAtRuleOptions = {
  [K in keyof AtRuleDeclsMap]: {
    /** At-rule name — narrows `decls` to the matching descriptor type */
    at: K;
    /** At-rule prelude/parameters (e.g. `'--color-fg'` for `@property`) */
    params?: string;
    /** At-rule descriptors with editor intellisense per at-rule type */
    decls?: AtRuleDeclsMap[K];
    /** Raw CSS string to inject inside the block (NOT escaped — caller responsible) */
    raw?: string;
    /** Nested rules or at-rules inside this block */
    children?: ReadonlyArray<string>;
  };
}[keyof AtRuleDeclsMap];

/**
 * At-rule names that do not have typed descriptor interfaces in csstype.
 *
 * Includes wrapper at-rules (`media`, `supports`, `container`, `layer`, etc.)
 * and statement at-rules (`charset`, `import`, `namespace`).
 */
type UntypedAtRuleName = Exclude<AtRuleName, keyof AtRuleDeclsMap>;

/**
 * At-rule options for at-rules without typed descriptors.
 *
 * Accepts any `Record<string, string>` for `decls` (if applicable)
 * and `(string & {})` as an escape hatch for non-standard at-rule names.
 */
type UntypedAtRuleOptions = {
  /** At-rule name — standard names get autocomplete, arbitrary strings accepted via `(string & {})` */
  at: UntypedAtRuleName | (string & {});
  /** At-rule prelude/parameters (e.g. `'(prefers-color-scheme: dark)'` for `@media`) */
  params?: string;
  /** At-rule descriptor declarations (untyped for at-rules without csstype descriptors) */
  decls?: Record<string, string>;
  /** Raw CSS string to inject inside the block (NOT escaped — caller responsible) */
  raw?: string;
  /** Nested rules or at-rules inside this block */
  children?: ReadonlyArray<string>;
};

/**
 * Options for a CSS at-rule.
 *
 * At-rules come in three forms:
 * - **Block with children**: `@media (...) { rules }` — provide `children`
 * - **Block with declarations**: `@property --x { syntax: ... }` — provide `decls`
 * - **Statement**: `@layer tokens;` — omit both `decls` and `children`
 *
 * For at-rules with csstype descriptor interfaces (`font-face`, `property`,
 * `counter-style`, `page`, `font-palette-values`, `view-transition`),
 * the `decls` field is typed to the matching descriptor interface.
 * For all other at-rules, `decls` accepts `Record<string, string>`.
 */
type AtRuleOptions = TypedAtRuleOptions | UntypedAtRuleOptions;

/**
 * Options for a CSS style rule.
 *
 * Produces `selector { declarations; children }`.
 */
type RuleOptions = {
  /** CSS selector (e.g. `'.card'`, `'&:hover'`, `':root'`) */
  rule: string;
  /** CSS declarations as property-value pairs with editor intellisense */
  decls?: CssDeclarations;
  /** Raw CSS string to inject inside the block (NOT escaped — caller responsible) */
  raw?: string;
  /** Nested rules or at-rules inside this block */
  children?: ReadonlyArray<string>;
};

/**
 * Union of all CSS hyperscript option shapes.
 *
 * Discriminated by presence of `rule` (style rule) vs `at` (at-rule).
 */
type CssOptions = AtRuleOptions | RuleOptions;

//endregion

//region Helpers

/**
 * Serializes a declarations record into a CSS declaration string.
 *
 * Accepts any declarations object — `CssDeclarations`, at-rule descriptor interfaces,
 * or plain `Record<string, string>`. Skips `undefined` values since csstype interfaces
 * mark all properties as optional.
 *
 * @param decls - property-value pairs (typed at the API boundary, loose here for internal flexibility)
 * @returns semicolon-separated declarations (e.g. `'display:flex;gap:1rem'`)
 *
 * @example
 * ```ts
 * serializeDecls({ display: 'flex', gap: '1rem' })
 * // 'display:flex;gap:1rem'
 * ```
 */
function serializeDecls(decls: object,): string {
  const parts: string[] = [];

  for (const [property, value,] of Object.entries(decls,) as ReadonlyArray<[string, string | number | undefined]>) {
    if (value === undefined || value === null) {
      continue;
    }

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
 * @returns `true` when the at-rule should produce a `{ }` block
 */
function hasBlock(options: AtRuleOptions,): boolean {
  if (options.decls !== undefined) {
    return true;
  }

  if (options.raw !== undefined) {
    return true;
  }

  if (options.children !== undefined && options.children.length > 0) {
    return true;
  }

  return false;
}

//endregion

//region Main export

/**
 * Creates a CSS string from declarative options.
 *
 * Accepts either a style rule (`rule` key) or an at-rule (`at` key).
 * Returns a minified CSS string with no trailing newlines.
 *
 * @param options - {@link CssOptions}
 * @returns CSS string
 */
/* @__NO_SIDE_EFFECTS__ */ export function $(
  options: CssOptions,
): string {
  if ('rule' in options) {
    return buildRule(options,);
  }

  return buildAtRule(options as AtRuleOptions,);
}

/**
 * Builds a CSS style rule string.
 *
 * @param options - {@link RuleOptions}
 * @returns CSS rule string (e.g. `'.card{display:flex}'`)
 */
function buildRule(
  { rule, decls, raw, children, }: RuleOptions,
): string {
  const parts: string[] = [`${rule}{`,];

  if (decls !== undefined) {
    parts.push(serializeDecls(decls,),);
  }

  if (raw !== undefined) {
    parts.push(raw,);
  }

  if (children !== undefined) {
    for (const child of children) {
      //region Semicolon separator
      // Insert a semicolon between trailing declarations and the first child,
      // so `display:flex` + `&:hover{...}` produces `display:flex;&:hover{...}`
      // rather than `display:flex&:hover{...}`.
      //endregion
      if (decls !== undefined && child === children[0]) {
        parts.push(';',);
      }

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
 * @param options - {@link AtRuleOptions}
 * @returns CSS at-rule string
 */
function buildAtRule(
  options: AtRuleOptions,
): string {
  const { at, params, decls, raw, children, } = options;
  const head = params !== undefined
    ? `@${at} ${params}`
    : `@${at}`;

  //region Statement at-rule
  // At-rules with no block content are statements terminated by a semicolon.
  //endregion
  if (!hasBlock(options,)) {
    return `${head};`;
  }

  const parts: string[] = [`${head}{`,];

  if (decls !== undefined) {
    parts.push(serializeDecls(decls,),);
  }

  if (raw !== undefined) {
    parts.push(raw,);
  }

  if (children !== undefined) {
    for (const child of children) {
      if (decls !== undefined && child === children[0]) {
        parts.push(';',);
      }

      parts.push(child,);
    }
  }

  parts.push('}',);

  return parts.join('',);
}

//endregion
