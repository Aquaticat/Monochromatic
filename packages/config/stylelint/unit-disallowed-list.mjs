/**
 * CSS units banned from use in stylesheets.
 *
 * Grouped by category: angle (use `turn`), font-relative length (unpredictable),
 * viewport (use logical), absolute length (use `rem`), and time (use `s`).
 *
 * @type {ReadonlyArray<string>}
 * @example
 * ```js
 * // stylelint.config.mjs
 * import { unitDisallowedList } from './unit-disallowed-list.mjs';
 * export default { rules: { 'unit-disallowed-list': unitDisallowedList } };
 * ```
 */
export const unitDisallowedList = [
  //region angle - Use turn

  'rad',
  'deg',

  //endregion angle

  //region length

  /* The font-based units vary wildly depending on the font.
       This is as intended, but could make layout unpredictable.
       Use 1em or 0.5em instead. */
  'ch',
  'rch',
  'ex',
  'rex',
  'cap',
  'rcap',
  'ic',
  'ric',
  // lh is not banned.

  // Use logical
  'vh',
  'vw',
  'cqw',
  'cqh',

  // Do not use absolute length
  'px',
  'cm',
  'mm',
  'Q',
  'in',
  'pc',
  'pt',

  //endregion length

  //region Other

  // Always use s
  'ms',
  //endregion Other
];
