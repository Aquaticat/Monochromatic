/**
 * Properties banned from use in stylesheets.
 *
 * Grouped by rationale: pointless legacy properties, deprecated/non-standard,
 * shorthand properties (always use longhand), and physical (non-logical) properties.
 *
 * @type {ReadonlyArray<string | RegExp>}
 * @example
 * ```js
 * // stylelint.config.mjs
 * import { propertyDisallowedList } from './property-disallowed-list.mjs';
 * export default { rules: { 'property-disallowed-list': propertyDisallowedList } };
 * ```
 */
export const propertyDisallowedList = [
  //region Pointless

  'clear',

  'float',

  //endregion

  //region deprecated and non-standard

  'clip',

  'font-smooth',

  //endregion

  //region Shorthands - Always use full form.

  'animation',

  'background',

  'border',

  'border-block',

  'border-inline',

  'container',

  'flex',

  'font',

  'font-synthesis',

  'font-variant',

  'grid',

  'grid-area',

  'grid-template',

  'inset',

  'list-style',

  /margin$/,

  'mask',

  'offset',

  'outline',

  'overflow',

  'overscroll-behavior',

  /padding$/,

  /^place-[\w-]+$/,

  'scroll-timeline',

  'transition',

  'view-timeline',

  //endregion Shorthands

  //region Non-logical

  'width',

  'height',

  // Can't use that here: false positive: *-inline-width, *-width
  // /^[\w\-]+-width$/,
  'contain-intrinsic-width',
  'max-width',

  // Can't use that here: false positive: line-height
  // /^[\w\-]+-height$/,
  'contain-intrinsic-height',
  'max-height',

  /^[\w-]+-top$/,

  /^[\w-]+-left$/,

  /[\w-]+-right/,

  /[\w-]+-bottom/,
  //endregion Non-logical
];
