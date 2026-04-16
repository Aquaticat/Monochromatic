/**
 * Material Symbols icon font `@font-face` and utility class.
 *
 * Self-hosted woff2 subsetted to `invert_colors` and `search` via
 * the Google Fonts `icon_names` parameter. The full variable font
 * axes (opsz, wght, FILL, GRAD) are preserved so icons can be
 * tuned per context.
 *
 * @example
 * ```html
 * <span class="material-symbols-outlined">invert_colors</span>
 * ```
 */

/**
 * Generates the `@font-face` declaration and `.material-symbols-outlined`
 * utility class for Material Symbols Outlined.
 *
 * Placed first in the CSS cascade so the font is declared before any
 * rules that reference it.
 *
 * @returns CSS string with font-face and utility class
 *
 * @example
 * ```ts
 * const css = iconFontStyles();
 * ```
 */
export function iconFontStyles(): string {
  return [
    [
      '@font-face {',
      "  font-family: 'Material Symbols Outlined';",
      '  font-style: normal;',
      '  font-weight: 100 700;',
      '  font-display: block;',
      "  src: url('/materialSymbols.woff2') format('woff2');",
      '}',
    ]
      .join('\n',),
    [
      '.material-symbols-outlined {',
      "  font-family: 'Material Symbols Outlined';",
      '  font-weight: normal;',
      '  font-style: normal;',
      '  font-size: 1.25rem;',
      '  line-height: 1;',
      '  letter-spacing: normal;',
      '  text-transform: none;',
      '  display: inline-block;',
      '  white-space: nowrap;',
      '  word-wrap: normal;',
      '  direction: ltr;',
      "  -webkit-font-feature-settings: 'liga';",
      '  -webkit-font-smoothing: antialiased;',
      '}',
    ]
      .join('\n',),
  ]
    .join('\n',);
}
