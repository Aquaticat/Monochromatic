/**
 * Runtime CSS mixin expansion for web component Shadow DOM styles.
 *
 * Web components can't inherit global CSS. Each component calls
 * `css(\`...\`)` with `@apply --mixin-name` rules; the mixin bodies
 * are expanded at runtime using the build-css pipeline.
 *
 * The mixin definitions are imported as a text string (bundled inline
 * by Bun) so no filesystem access is needed at runtime.
 */
// Side-effect: shims `globalThis.process` for PostCSS and node:path polyfill.
// Must be imported before build-css so the shim exists when postcss evaluates.
import '@monochromatic-dev/build-tool-css/ts/process-shim';
import { applyMixins, } from '@monochromatic-dev/build-tool-css/ts';
// Bun inlines the CSS file content as a string at bundle time
import mixinSource from './mixins.css' with { type: 'text', };

/**
 * Expands \@apply references in a CSS string using shared mixin definitions.
 *
 * Delegates to build-css's high-level applyMixins() so this module never
 * touches postcss directly — all parse/expand/serialize logic lives in one place.
 *
 * @param raw - CSS string containing \@apply references
 *
 * @returns Expanded CSS with all \@apply rules replaced by mixin bodies
 */
export function css(raw: string,): string {
  return applyMixins(raw, mixinSource,);
}
