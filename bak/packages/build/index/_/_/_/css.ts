import { getLogger } from '@logtape/logtape';
import apply from '@monochromatic-dev/lightningcss-plugin-apply';
import customUnits from '@monochromatic-dev/lightningcss-plugin-custom-units';
import propertyLookup from '@monochromatic-dev/lightningcss-plugin-property-lookup';
import size from '@monochromatic-dev/lightningcss-plugin-size';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import resolve from '@monochromatic-dev/module-resolve';
import browserslist from 'browserslist';
import cssnano from 'cssnano';
import cssnanoPresetAdvanced from 'cssnano-preset-advanced';
import { bundleAsync as lightningcssBundle } from 'lightningcss';
import {
  browserslistToTargets,
  type BundleAsyncOptions,
  composeVisitors,
  type CustomAtRules,
} from 'lightningcss';
import type { PluginCreator } from 'postcss';
import postcss from 'postcss';
import { mapParallelAsync } from 'rambdax';
import { cssFilePaths, esbuildOptions } from '@/src/consts.js';
import type { State } from '@/src/state.ts';
import esbuild from 'esbuild';
const l = getLogger(['a', 'css']);

const cssnanoPreset = cssnanoPresetAdvanced({
  autoprefixer: undefined,
  cssDeclarationSorter: false,
  calc: false,
  colormin: false,
  convertValues: false,
  discardComments: false,
  discardUnused: false,
  mergeIdents: false,
  mergeLonghand: false,
  mergeRules: false,
  minifyFontValues: false,
  minifyGradients: false,
  minifyParams: false,
  minifySelectors: false,
  normalizeCharset: false,
  normalizeDisplayValues: false,
  normalizePositions: false,
  normalizeRepeatStyle: false,
  normalizeString: false,
  normalizeTimingFunctions: false,
  normalizeUnicode: false,
  normalizeUrl: false,
  normalizeWhitespace: false,
  orderedValues: false,
  reduceIdents: false,
  reduceInitial: false,
  reduceTransforms: false,
  svgo: false,
  uniqueSelectors: false,
  zindex: false,
}) as { plugins: [PluginCreator<any>, false][]; };

const lightningcssOptions = (
  filename: string = 'src/index.css',
): BundleAsyncOptions<CustomAtRules> => {
  l.debug`gen lightningcss options with filename ${filename}`;

  const result = {
    filename: filename,
    minify: true,
    sourceMap: true,
    targets: browserslistToTargets(browserslist()),
    cssModules: { pattern: '[local]' },

    analyzeDependencies: true,

    visitor: composeVisitors([apply, customUnits, propertyLookup, size]),
    drafts: { customMedia: true },
    resolver: {
      async resolve(specifier, from) {
        return await resolve(specifier, from);
      },
    },
  } satisfies BundleAsyncOptions<CustomAtRules>;

  l.debug`lightningcss options ${result}`;
  return result;
};

export default async function css(): Promise<State> {
  if (cssFilePaths.length === 0) {
    return [
      'css',
      'SKIP',
      `skipping css, none of ${cssFilePaths} matched by 'src/**/index.css', {ignore: '**/_*/**'} exist.`,
    ];
  }

  l.debug`esbuild index.css ${cssFilePaths}`;
  const ctx = await esbuild.context(esbuildOptions(cssFilePaths as [string, ...string[]], 'dist/final'));
  const result = await ctx.rebuild();
  await ctx.dispose();
  l.debug`esbuild built index.css ${cssFilePaths}`;

  return [
    'css',
    'SUCCESS',
    // esbuild
    await fs.outputFile(
      path.join('dist', 'temp', 'esbuild', 'css.meta.json'),
      JSON.stringify(result.metafile, null, 2),
    ),
    // LightningCSS + PostCSS
/*     await mapParallelAsync(
      async function cssEach(cssFilePath): Promise<State> {
        const outFilePath = path.join('dist', 'final', path.relative('src', cssFilePath));

        l.debug`lightningcss ${cssFilePath}`;

        const options = lightningcssOptions(cssFilePath);
        const { code, map } = await lightningcssBundle(options);
        l.debug`lightningcss gave code for ${cssFilePath}`;

        await fs.outputFile(outFilePath, code.toString());

        l.debug`postcss ${outFilePath}`;

        const { css: minCode } = await postcss([cssnano(cssnanoPreset)]).process(
          await fs.readFileU(outFilePath),
          { from: outFilePath },
        );

        await fs.outputFile(`${outFilePath}.map`, (map!).toString());
        l.debug`css ${cssFilePath} finished at ${outFilePath}`;
        return ['cssEach', 'SUCCESS', await fs.outputFile(outFilePath, minCode)];
      },
      cssFilePaths,
    ), */
  ];
}
