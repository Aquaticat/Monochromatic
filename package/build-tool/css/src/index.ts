// Side-effect: shims globalThis.process for browser environments.
// Must precede postcss import because postcss references process.env without guards.
// oxlint-disable-next-line import/no-unassigned-import -- side-effect shim for browser process global
import './process-shim.ts';
import {
  dirname,
  resolve,
} from '@monochromatic-dev/module-fs-path/ts';
import postcss from 'postcss';
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

export { applyMixins, } from './apply-mixins.ts';
export {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';

//endregion Re-exports

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
