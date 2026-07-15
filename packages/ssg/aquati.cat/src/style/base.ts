/**
 * Site CSS orchestrator.
 *
 * Composes all style modules, both pure-style files and
 * colocated component CSS, into a single CSS string for the build.
 */
import * as calloutAlert from '../component/callout-alert.ts';
import * as langSwitcher from '../component/lang-switcher.ts';
import * as pageContent from '../component/page-content.ts';
import * as postCard from '../component/post-card.ts';
import * as postList from '../component/post-list.ts';
import * as questionCheckbox from '../component/question-checkbox.ts';
import * as questionRadio from '../component/question-radio.ts';
import * as shuffleChildren from '../component/shuffle-children.ts';
import * as siteFooter from '../component/site-footer.ts';
import * as siteHeader from '../component/site-header.ts';
import * as siteSearch from '../component/site-search.ts';
import * as themeToggle from '../component/theme-toggle.ts';
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
    langSwitcher.css(),
    themeToggle.css(),
    siteSearch.css(),
    postList.css(),
    postCard.css(),
    questionRadio.css(),
    questionCheckbox.css(),
    shuffleChildren.css(),
    siteFooter.css(),
  ]
    .join('\n',);
}
