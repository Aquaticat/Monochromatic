import apply from '@monochromatic.dev/lightningcss-plugin-apply';
import customUnits from '@monochromatic.dev/lightningcss-plugin-custom-units';
import propertyLookup from '@monochromatic.dev/lightningcss-plugin-property-lookup';
import size from '@monochromatic.dev/lightningcss-plugin-size';
import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import resolve from '@monochromatic.dev/module-resolve';
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
import { cssFilePaths } from './g.ts';
import type { State } from './state.ts';

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

const lightningcssOptions = function genLightningcssOptions(
  filename: string = 'src/index.css',
): BundleAsyncOptions<CustomAtRules> {
  return {
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
  };
};

export default async function css(
): Promise<State> {
  if (cssFilePaths.length === 0) {
    return [
      'SKIP',
      `skipping css, none of ${cssFilePaths} matched by 'src/**/index.css', {ignore: '**/_*/**'} exist.`,
    ];
  }
  return await mapParallelAsync(
    async function lightningcssEach(cssFilePath): Promise<State> {
      c.log(`lightningcss ${cssFilePath}`);

      const options = lightningcssOptions(cssFilePath);
      const { code, map } = await lightningcssBundle(options);
      const outFilePath = path.join('dist', 'final', path.relative('src', cssFilePath));

      await fs.outputFile(outFilePath, code);
      c.log(`postcss ${outFilePath}`);
      const { css: minCode } = await postcss([cssnano(cssnanoPreset)]).process(
        await fs.readFileU(outFilePath),
        { from: outFilePath },
      );

      await fs.outputFile(outFilePath, minCode);
      await fs.outputFile(`${outFilePath}.map`, map!);
      return 'SUCCESS';
    },
    cssFilePaths,
  );
}
