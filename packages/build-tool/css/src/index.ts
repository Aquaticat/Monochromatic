// Side-effect: shims globalThis.process for browser environments.
// Must precede postcss import because postcss references process.env without guards.
// oxlint-disable-next-line no-unassigned-import -- side-effect shim for browser process global
import './process-shim.ts';
import {
  dirname,
  resolve,
} from '@monochromatic-dev/module-es/ts/path/index.ts';
import postcss, { parse, } from 'postcss';
import { readCssFile, } from './fs.ts';
import { postcssInlineImport, } from './import.ts';
import {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';

//region Types

/** Build options for the CSS processor */
export type BuildOptions = {
  /** Input CSS file path */
  input: string;
  /** Output CSS file path */
  output: string;
};

//endregion Types

//region Re-exports -- public API surface for consumers importing from build.ts

export {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';

//endregion Re-exports

/**
 * Expands \@apply references in a CSS string using mixin definitions
 * from a separate CSS source string.
 *
 * This is the high-level string-to-string API for consumers that already
 * have CSS text in memory (e.g. web component Shadow DOM styles). It
 * encapsulates the full postcss parse → collect → expand → serialize
 * pipeline so callers never touch postcss directly.
 *
 * @param cssText - CSS string containing \@apply references to expand
 *
 * @param mixinCssText - CSS string containing \@mixin definitions
 *
 * @returns Expanded CSS with all \@apply rules replaced by mixin bodies
 *
 * @throws When an \@apply references an unknown mixin
 */
export function applyMixins(cssText: string, mixinCssText: string): string {
  mixins.clear();

  /**
   * PostCSS AST of mixin definitions, parsed to extract \@mixin rules.
   */
  const mixinRoot = parse(mixinCssText, { from: 'mixins.css', });
  collectMixins(mixinRoot);
  expandMixinBodies();

  /**
   * PostCSS AST of the consumer CSS, parsed for \@apply expansion.
   */
  const root = parse(cssText);
  expandApplyRules(root);

  return root.toString();
}

/**
 * Builds CSS by inlining \@import rules and processing \@mixin/\@apply.
 *
 * Pipeline: read input → inline \@import (custom PostCSS plugin) →
 * collect mixin definitions → expand nested mixin bodies →
 * inline \@apply rules → write output.
 *
 * Uses only PostCSS (pure JS) — no native binary dependencies.
 *
 * @param options - Build configuration
 *
 * @returns Processed CSS string
 *
 * @throws When an import cannot be resolved or a mixin reference is invalid
 */
export async function build(options: BuildOptions): Promise<string> {
  const { input, output, } = options;

  // Clear mixin registry for fresh build
  mixins.clear();

  /** Absolute path to the CSS entry point */
  const inputPath = resolve(input);

  /** Raw CSS text read from the entry file */
  const cssText = await readCssFile(inputPath);

  // Phase 1: inline @import rules using our custom PostCSS plugin
  /**
   * PostCSS result after resolving and inlining all \@import rules.
   */
  const bundled = postcss([postcssInlineImport]).process(cssText, { from: inputPath, });

  /** PostCSS AST with all imports inlined, ready for mixin processing */
  const {root} = bundled;

  // Phase 2: process @mixin/@apply
  collectMixins(root);
  expandMixinBodies();
  expandApplyRules(root);

  /** Final CSS with all imports inlined and mixins expanded */
  const result = root.toString();

  // Write output — uses dynamic import so browser callers don't pull in node:fs
  const { mkdir, writeFile, } = await import('node:fs/promises');
  /** Absolute path for the output file */
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true, });
  await writeFile(outputPath, result);

  return result;
}
