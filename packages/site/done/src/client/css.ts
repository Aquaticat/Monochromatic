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
// Must be imported before postcss so the shim exists when postcss evaluates.
import "@monochromatic-dev/build-css/ts/process-shim";
import postcss from "postcss";
import {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from "@monochromatic-dev/build-css/ts";
// Bun inlines the CSS file content as a string at bundle time
import mixinSource from "./mixins.css" with { type: "text" };

/** Parsed mixin definitions, collected once and reused across all css() calls */
let mixinsReady = false;

/**
 * Ensures mixin definitions are collected exactly once.
 * Subsequent calls are no-ops.
 */
function ensureMixins(): void {
  if (mixinsReady) {
    return;
  }
  mixins.clear();
  const mixinRoot = postcss.parse(mixinSource, { from: "mixins.css" });
  collectMixins(mixinRoot);
  expandMixinBodies();
  mixinsReady = true;
}

/**
 * Expands \@apply references in a CSS string using shared mixin definitions.
 *
 * Reuses the \@mixin/\@apply pipeline from \@monochromatic-dev/build-css
 * so mixin semantics stay consistent across the monorepo.
 * @param raw - CSS string containing \@apply references
 * @returns Expanded CSS with all \@apply rules replaced by mixin bodies
 */
export function css(raw: string): string {
  ensureMixins();

  const root = postcss.parse(raw);
  expandApplyRules(root);

  return root.toString();
}
