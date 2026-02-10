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

export type { BuildOptions, } from './resolve.ts';
export {
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from './mixin.ts';
export { createResolver, resolveImport, } from './resolve.ts';

/**
 * Builds CSS by bundling imports with LightningCSS and processing mixins.
 * Pipeline: resolve imports -> bundle -> collect mixin definitions ->
 * expand nested mixin bodies -> inline \@apply rules -> write output.
 * @param options - Build configuration
 * @returns Processed CSS string
 */
export async function build(options: BuildOptions): Promise<string> {
  const { input, output, } = options;

  // Clear mixin registry for fresh build
  mixins.clear();

  const inputPath = resolve(input);
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

  // Parse bundled CSS with PostCSS to manipulate custom at-rules
  const root = postcss.parse(code.toString(), { from: inputPath, });

  collectMixins(root);
  expandMixinBodies();
  expandApplyRules(root);

  const result = root.toString();
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true, });
  await writeFile(outputPath, result);

  return result;
}
