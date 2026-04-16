/**
 * Site CSS orchestrator.
 *
 * Composes all style modules into a single CSS string for the build.
 */
import { footerStyles, } from './footer.ts';
import {
  layoutStyles,
  resetStyles,
  typographyStyles,
} from './global.ts';
import {
  headerStyles,
  searchAndInteractionStyles,
  themeToggleStyles,
} from './header.ts';
import { highlightStyles, } from './highlight.ts';
import { iconFontStyles, } from './icons.ts';
import { postStyles, } from './posts.ts';
import {
  darkModeTokenStyles,
  inverseTokenStyles,
  tokenStyles,
} from './tokens.ts';

/**
 * Generates the complete site CSS as a single string.
 *
 * @returns concatenated CSS rules from all style modules
 *
 * @example
 * ```ts
 * const css = generateSiteCss();
 * await writeFile('dist/styles.css', css);
 * ```
 */
export function generateSiteCss(): string {
  return [
    iconFontStyles(),
    tokenStyles(),
    darkModeTokenStyles(),
    inverseTokenStyles(),
    resetStyles(),
    layoutStyles(),
    typographyStyles(),
    highlightStyles(),
    headerStyles(),
    postStyles(),
    searchAndInteractionStyles(),
    themeToggleStyles(),
    footerStyles(),
  ]
    .join('\n',);
}
