/**
 * CSS stylesheet for paper2vn.
 *
 * Concatenates rule arrays from `styles/theme.ts`, `styles/elements.ts`,
 * `styles/screen.ts`, and `styles/stage.ts` to keep this orchestrator
 * file under the max-lines cap. Layout is screen-as-flex-column with
 * `[hidden]` toggling between screens; data attributes drive state
 * variants instead of BEM-style class modifiers.
 */
import { elementRules, } from './styles/elements.ts';
import { screenRules, } from './styles/screen.ts';
import { stageRules, } from './styles/stage.ts';
import { themeRules, } from './styles/theme.ts';

/**
 * Generates the complete stylesheet.
 *
 * @returns minified CSS string
 *
 * @example
 * ```ts
 * const css = renderStyles();
 * // css starts with `:root{--bg:oklch(0.97 0.01 50)...}`
 * ```
 */
export function renderStyles(): string {
  return [
    ...themeRules(),
    ...elementRules(),
    ...screenRules(),
    ...stageRules(),
  ]
    .join('\n',);
}
