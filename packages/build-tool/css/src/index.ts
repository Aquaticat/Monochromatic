// Side-effect: shims globalThis.process for browser environments.
// Must precede postcss import because postcss references process.env without guards.
// oxlint-disable-next-line import/no-unassigned-import -- side-effect shim for browser process global
import './process-shim.ts';
import {
  dirname,
  resolve,
} from '@monochromatic-dev/module-fs-path/ts';
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

/**
 * Build options for the CSS processor
 */
export type BuildOptions = {
  /**
   * Input CSS file path
   */
  readonly input: string;
  /**
   * Output CSS file path
   */
  readonly output: string;
};

//endregion Types

//region Re-exports: public API surface for consumers importing from build.ts

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
 * encapsulates the full postcss parse → {@link collectMixins} →
 * {@link expandApplyRules} → serialize pipeline so callers never touch
 * postcss directly.
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
   * PostCSS AST of the consumer CSS, parsed for \@apply expansion.
   */
  const root = parse(cssText,);
  expandApplyRules(root,);

  return root.toString();
}

/**
 * Builds CSS by inlining \@import rules and processing \@mixin/\@apply.
 *
 * Pipeline: read input → inline \@import (custom PostCSS plugin
 * {@link postcssInlineImport}) → collect mixin definitions
 * ({@link collectMixins}) → expand nested mixin bodies
 * ({@link expandMixinBodies}) → inline \@apply rules
 * ({@link expandApplyRules}) → write output.
 *
 * Uses only PostCSS (pure JS): no native binary dependencies.
 *
 * @param options - Build configuration
 *
 * @returns Processed CSS string
 *
 * @throws When an import cannot be resolved or a mixin reference is invalid
 *
 * @example
 * ```ts
 * const css = await build({ input: 'src/main.css', output: 'dist/main.css' });
 * ```
 */
export async function build(options: BuildOptions,): Promise<string> {
  /**
   * Destructured upfront so input and output paths are visible to the whole flow.
   */
  const {
    input,
    output,
  } = options;

  // Clear mixin registry for fresh build
  mixins.clear();

  /**
   * Absolute path to the CSS entry point
   */
  const inputPath = resolve([input,],);

  /**
   * Raw CSS text read from the entry file
   */
  const cssText = await readCssFile(inputPath,);

  // Phase 1: inline @import rules using our custom PostCSS plugin
  /**
   * PostCSS result after resolving and inlining all \@import rules.
   */
  const bundled = postcss([postcssInlineImport,],)
    .process(
    cssText,
    {
      from: inputPath,
    },
  );

  /**
   * PostCSS AST with all imports inlined, ready for mixin processing
   */
  const { root, } = bundled;

  // Phase 2: process @mixin/@apply
  collectMixins(root,);
  expandMixinBodies();
  expandApplyRules(root,);

  /**
   * Final CSS with all imports inlined and mixins expanded
   */
  const result = root.toString();

  // Write output: uses dynamic import so browser callers don't pull in node:fs
  /**
   * Dynamic import keeps `node:fs/promises` out of browser bundles.
   */
  const {
    mkdir,
    writeFile,
  } = await import('node:fs/promises');
  /**
   * Absolute path for the output file
   */
  const outputPath = resolve([output,],);
  await mkdir(
    dirname(outputPath,),
    { recursive: true, },
  );
  await writeFile(
    outputPath,
    result,
  );

  return result;
}
