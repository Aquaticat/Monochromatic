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
import {
  type CssValue,
  cssRem,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

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
    $({
      at: 'font-face',
      decls: {
        'font-family': "'Material Symbols Outlined'",
        'font-style': 'normal',
        'font-weight': '100 700',
        'font-display': 'block',
        src: "url('/materialSymbols.woff2') format('woff2')",
      },
    },),
    /* oxlint-disable no-unsafe-type-assertion -- icon utility class mixes standard keywords with vendor-prefixed values that lack branded constructors */
    $({
      rule: '.material-symbols-outlined',
      decls: {
        'font-family': "'Material Symbols Outlined'" as CssValue,
        'font-weight': 'normal' as CssValue,
        'font-style': 'normal' as CssValue,
        'font-size': cssRem(1.25,),
        'line-height': '1' as CssValue,
        'letter-spacing': 'normal' as CssValue,
        'text-transform': 'none' as CssValue,
        display: 'inline-block',
        'white-space': 'nowrap',
        'overflow-wrap': 'normal' as CssValue,
        direction: 'ltr',
        '-webkit-font-feature-settings': "'liga'" as CssValue,
        '-webkit-font-smoothing': 'antialiased' as CssValue,
      },
    },),
    /* oxlint-enable no-unsafe-type-assertion */
  ]
    .join('\n',);
}
