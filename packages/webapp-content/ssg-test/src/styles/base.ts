/**
 * Site CSS orchestrator.
 *
 * Composes all style modules into a single CSS string for the build.
 */
import { layoutStyles, resetStyles, typographyStyles, } from './global.ts';
import { headerStyles, searchAndInteractionStyles, } from './header.ts';
import { postStyles, } from './posts.ts';
import { tokenStyles, } from './tokens.ts';

/**
 * Generates the complete site CSS as a single string.
 *
 * @returns concatenated CSS rules from all style modules
 */
export function generateSiteCss(): string {
  return [
    tokenStyles(),
    resetStyles(),
    layoutStyles(),
    typographyStyles(),
    headerStyles(),
    postStyles(),
    searchAndInteractionStyles(),
  ].join('\n',);
}
