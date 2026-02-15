/**
 * Bun build-time macro for CSS mixin expansion in web component Shadow DOM styles.
 *
 * Web components can't inherit global CSS. Instead, each component calls
 * `css(\`...\`)` with `@apply --mixin-name` rules; Bun invokes this macro
 * at bundle time and replaces the call with the expanded CSS string literal.
 * This gives web components access to shared mixins at zero runtime cost.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import postcss from "postcss";
import {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from "@monochromatic-dev/build-css/ts";

/** Path to the shared mixin definitions, resolved relative to this macro file */
const MIXINS_PATH = resolve(dirname(import.meta.filename), "mixins.css");

/**
 * Build-time macro that expands \@apply references in a CSS string.
 * Reads mixin definitions from mixins.css, collects them into the
 * build-css mixin registry, then expands any \@apply --name; rules.
 *
 * Reuses the \@mixin/\@apply pipeline from \@monochromatic-dev/build-css
 * so mixin semantics stay consistent across the monorepo.
 *
 * Imported with `{ type: "macro" }` so Bun executes this at bundle
 * time and inlines the resulting string literal.
 * @param raw - CSS string containing \@apply references
 * @returns Expanded CSS with all \@apply rules replaced by mixin bodies
 */
export function css(raw: string): string {
  mixins.clear();

  const mixinSource = readFileSync(MIXINS_PATH, "utf-8");
  const mixinRoot = postcss.parse(mixinSource, { from: MIXINS_PATH });
  collectMixins(mixinRoot);
  expandMixinBodies();

  const root = postcss.parse(raw);
  expandApplyRules(root);

  return root.toString();
}
