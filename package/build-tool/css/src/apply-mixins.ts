// Side-effect: shims globalThis.process for browser environments.
// Must precede postcss import because postcss references process.env without guards.
// oxlint-disable-next-line import/no-unassigned-import -- side-effect shim for browser process global
import './process-shim.ts';
import { parse, } from 'postcss';

import {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';

/**
 * Expands \@apply references in CSS text using separate mixin definitions.
 *
 * This browser-compatible boundary omits file-system and import-resolution code
 * used by {@link build} in the package root.
 *
 * @param cssText - CSS string containing \@apply references to expand
 *
 * @param mixinCssText - CSS string containing \@mixin definitions
 *
 * @returns Expanded CSS with all \@apply rules replaced by mixin bodies
 *
 * @throws When an \@apply references an unknown mixin
 *
 * @example
 * ```ts
 * const expanded = applyMixins({
 *   cssText: '.btn { \@apply --card; }',
 *   mixinCssText: '\@mixin --card { padding: 1rem; }',
 * });
 * ```
 */
export function applyMixins({
  cssText,
  mixinCssText,
}: {
  readonly cssText: string;
  readonly mixinCssText: string;
},): string {
  mixins.clear();

  /**
   * PostCSS AST of mixin definitions, parsed to extract \@mixin rules.
   */
  const mixinRoot = parse(
    mixinCssText,
    { from: 'mixins.css', },
  );
  collectMixins(mixinRoot,);
  expandMixinBodies();

  /**
   * PostCSS AST of consumer CSS, parsed for \@apply expansion.
   */
  const root = parse(cssText,);
  expandApplyRules(root,);

  return root.toString();
}
