/**
 * Site CSS orchestrator.
 *
 * Composes all style modules, both pure-style files and
 * colocated component CSS, into a single CSS string for the build.
 */
import * as calloutAlert from '../components/callout-alert.ts';
import * as pageContent from '../components/page-content.ts';
import * as postCard from '../components/post-card.ts';
import * as postList from '../components/post-list.ts';
import * as questionCheckbox from '../components/question-checkbox.ts';
import * as questionRadio from '../components/question-radio.ts';
import * as siteFooter from '../components/site-footer.ts';
import * as siteHeader from '../components/site-header.ts';
import * as siteSearch from '../components/site-search.ts';
import * as themeToggle from '../components/theme-toggle.ts';
import {
  fontFaceStyles,
  interactionStyles,
  resetStyles,
  typographyStyles,
} from './global.ts';
import { highlightStyles, } from './highlight.ts';
import { iconFontStyles, } from './icons.ts';
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
    fontFaceStyles(),
    iconFontStyles(),
    tokenStyles(),
    darkModeTokenStyles(),
    inverseTokenStyles(),
    resetStyles(),
    typographyStyles(),
    interactionStyles(),
    highlightStyles(),
    pageContent.css(),
    calloutAlert.css(),
    siteHeader.css(),
    themeToggle.css(),
    siteSearch.css(),
    postList.css(),
    postCard.css(),
    questionRadio.css(),
    questionCheckbox.css(),
    siteFooter.css(),
  ]
    .join('\n',);
}
