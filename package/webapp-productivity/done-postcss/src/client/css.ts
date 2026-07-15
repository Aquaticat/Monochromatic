/**
 * Runtime CSS mixin expansion for web component Shadow DOM styles.
 *
 * Web components can't inherit global CSS. Each component calls
 * `css(\`...\`)` with `@apply --mixin-name` rules; the mixin bodies
 * are expanded at runtime using the build-css pipeline.
 *
 * The mixin definitions are imported as a text string (bundled inline
 * by tsdown) so no filesystem access is needed at runtime.
 */
// Importing the browser-compatible boundary also installs its minimal
// `globalThis.process` shim before PostCSS evaluates.
import { applyMixins, } from '@monochromatic-dev/build-tool-css/ts/apply-mixins';
// tsdown inlines the CSS file content as a string at bundle time
import mixinSource from './mixins.css' with { type: 'text', };

/**
 * Expands \@apply references in a CSS string using shared mixin definitions.
 *
 * Delegates to build-css's high-level applyMixins() so this module never
 * touches postcss directly; all parse/expand/serialize logic lives in one place.
 *
 * @param raw - CSS string containing \@apply references
 *
 * @returns Expanded CSS with all \@apply rules replaced by mixin bodies
 *
 * @example
 * ```ts
 * const styles = css(':host { \@apply --flex-column; }');
 * ```
 */
export function css(raw: string,): string {
  return applyMixins({
    cssText: raw,
    mixinCssText: mixinSource,
  },);
}
