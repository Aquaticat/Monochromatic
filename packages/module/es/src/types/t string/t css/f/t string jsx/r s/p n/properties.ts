/**
 * Strict CSS property and at-rule type definitions.
 *
 * Omits disallowed properties from csstype's `PropertiesHyphen` and excludes
 * banned at-rules from the at-rule name union, enforcing the project's
 * CSS conventions at the type level (replacing stylelint's runtime checks).
 */
import type { AtRules, PropertiesHyphen } from "csstype";

import type { CssValue, StrictValue } from "./values.ts";

//region Disallowed properties

/**
 * CSS properties banned by the project's style guide.
 *
 * Categories:
 * - **Pointless**: `clear`, `float`
 * - **Deprecated**: `clip`, `font-smooth`
 * - **Shorthands**: Always use longhand form
 * - **Non-logical**: Use logical property equivalents
 *
 * @example
 * ```ts
 * // These properties cause type errors in StrictCssDeclarations:
 * const bad: StrictCssDeclarations = {
 *   width: cssRem(10),   // ✗ use 'inline-size'
 *   margin: cssRem(1),   // ✗ use 'margin-block' / 'margin-inline'
 *   float: 'left',       // ✗ pointless property
 * };
 * ```
 */
export type DisallowedProperties =
  // Pointless properties
  | 'clear'
  | 'float'

  // Deprecated / non-standard
  | 'clip'
  | 'font-smooth'

  // Shorthand properties — always use longhand
  | 'animation'
  | 'background'
  | 'border'
  | 'border-block'
  | 'border-inline'
  | 'container'
  | 'flex'
  | 'font'
  | 'font-synthesis'
  | 'font-variant'
  | 'grid'
  | 'grid-area'
  | 'grid-template'
  | 'inset'
  | 'list-style'
  | 'margin'
  | 'scroll-margin'
  | 'mask'
  | 'offset'
  | 'outline'
  | 'overflow'
  | 'overscroll-behavior'
  | 'padding'
  | 'scroll-padding'
  | 'place-content'
  | 'place-items'
  | 'place-self'
  | 'scroll-timeline'
  | 'transition'
  | 'view-timeline'

  // Non-logical dimension properties — use inline-size / block-size equivalents
  | 'width'
  | 'height'
  | 'min-width'
  | 'min-height'
  | 'max-width'
  | 'max-height'
  | 'contain-intrinsic-width'
  | 'contain-intrinsic-height'

  // Non-logical direction properties — use logical equivalents
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'border-top'
  | 'border-top-color'
  | 'border-top-style'
  | 'border-top-width'
  | 'border-bottom'
  | 'border-bottom-color'
  | 'border-bottom-style'
  | 'border-bottom-width'
  | 'border-left'
  | 'border-left-color'
  | 'border-left-style'
  | 'border-left-width'
  | 'border-right'
  | 'border-right-color'
  | 'border-right-style'
  | 'border-right-width'
  | 'border-top-left-radius'
  | 'border-top-right-radius'
  | 'border-bottom-left-radius'
  | 'border-bottom-right-radius'
  | 'margin-top'
  | 'margin-bottom'
  | 'margin-left'
  | 'margin-right'
  | 'padding-top'
  | 'padding-bottom'
  | 'padding-left'
  | 'padding-right'
  | 'scroll-margin-top'
  | 'scroll-margin-bottom'
  | 'scroll-margin-left'
  | 'scroll-margin-right'
  | 'scroll-padding-top'
  | 'scroll-padding-bottom'
  | 'scroll-padding-left'
  | 'scroll-padding-right'
  | 'overflow-clip-margin';

//endregion

//region Disallowed at-rules

/**
 * At-rule names banned by the project's style guide.
 *
 * - `charset`: unnecessary in UTF-8 workflows; HTTP `Content-Type` header is authoritative
 * - `font-palette-values`: not yet broadly supported in the target browser baseline
 *
 * @example
 * ```ts
 * // StrictAtRuleName excludes these:
 * type Bad = 'charset';    // ✗ not assignable to StrictAtRuleName
 * type Good = 'media';     // ✓ assignable to StrictAtRuleName
 * ```
 */
export type DisallowedAtRules = 'charset' | 'font-palette-values';

//endregion

//region Strict declarations

/**
 * Strict CSS declarations with disallowed properties omitted and values type-checked.
 *
 * - Property names: csstype's `PropertiesHyphen` minus {@link DisallowedProperties}
 * - Property values: csstype keyword literals (minus named colors) plus `CssValue` branded type
 * - Custom properties: `--*` accepted with `CssValue` or plain `string` values
 *
 * @example
 * ```ts
 * const decls: StrictCssDeclarations = {
 *   display: 'flex',                     // keyword literal
 *   gap: cssRem(1),                      // branded constructor
 *   'background-color': cssVar('bg'),    // branded var reference
 *   width: cssRem(10),                   // type error — 'width' is disallowed
 *   color: 'red',                        // type error — named colors excluded
 * };
 * ```
 */
export type StrictCssDeclarations = {
  [K in Exclude<keyof PropertiesHyphen, DisallowedProperties>]?: StrictValue<PropertiesHyphen[K]>;
} & Record<`--${string}`, CssValue | string>;

//endregion

//region Strict at-rule names

/**
 * Strips the `@` prefix from csstype's `AtRules` union.
 *
 * Transforms `"@media" | "@layer" | ...` into `"media" | "layer" | ...`
 * to match the h-css `at` field convention (prefix added during string building).
 *
 * @example
 * ```ts
 * type Name = StripAtPrefix<'@media'>; // 'media'
 * ```
 */
type StripAtPrefix<T> = T extends `@${infer Name}` ? Name : never;

/**
 * All standard CSS at-rule names without the `@` prefix, minus {@link DisallowedAtRules}.
 *
 * @example
 * ```ts
 * const at: StrictAtRuleName = 'media';           // allowed
 * const bad: StrictAtRuleName = 'charset';         // type error
 * ```
 */
export type StrictAtRuleName = Exclude<StripAtPrefix<AtRules>, DisallowedAtRules>;

//endregion
