import { mkdir, writeFile, } from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import { bundleAsync, } from 'lightningcss';
// PostCSS is used only for AST parsing/stringification of the bundled CSS,
// so we can walk and manipulate custom @mixin/@apply at-rules.
// LightningCSS handles bundling but lacks a plugin system for custom at-rules.
import postcss from 'postcss';
import {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';
import type { BuildOptions, } from './resolve.ts';
import {
  createResolver,
  resolveImport,
} from './resolve.ts';

//region Re-exports -- public API surface for consumers importing from build.ts

export type { BuildOptions, } from './resolve.ts';
export {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';
export { createResolver, resolveImport, } from './resolve.ts';

//endregion Re-exports

/**
 * Builds CSS by bundling imports with LightningCSS and processing mixins.
 * Pipeline: resolve imports -> bundle -> collect mixin definitions ->
 * expand nested mixin bodies -> inline \@apply rules -> write output.
 * @param options - Build configuration
 * @returns Processed CSS string
 * @throws When an import cannot be resolved or a mixin reference is invalid
 */
export async function build(options: BuildOptions): Promise<string> {
  const { input, output, } = options;

  // Clear mixin registry for fresh build
  mixins.clear();

  /** Absolute path to the CSS entry point */
  const inputPath = resolve(input);
  /** Resolver configured for CSS-specific module resolution */
  const resolver = createResolver();

  // Bundle with LightningCSS using oxc-resolver for imports
  const { code, } = await bundleAsync({
    filename: inputPath,
    minify: false,
    resolver: {
      resolve(specifier, from) {
        return resolveImport(resolver, specifier, from);
      },
    },
  });

  /** UTF-8 decoded CSS text from the LightningCSS bundle output */
  const cssText = new TextDecoder().decode(code);
  /** PostCSS AST used to walk and manipulate custom @mixin/@apply at-rules */
  const root = postcss.parse(cssText, { from: inputPath, });

  collectMixins(root);
  expandMixinBodies();
  expandApplyRules(root);

  /** Final CSS with all mixins expanded and @apply rules inlined */
  const result = root.toString();
  /** Absolute path for the output file */
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true, });
  await writeFile(outputPath, result);

  return result;
}
