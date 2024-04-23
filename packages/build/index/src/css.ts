import apply from '@monochromatic.dev/lightningcss-plugin-apply';
import customUnits from '@monochromatic.dev/lightningcss-plugin-custom-units';
import propertyLookup from '@monochromatic.dev/lightningcss-plugin-property-lookup';
import size from '@monochromatic.dev/lightningcss-plugin-size';
import resolve from '@monochromatic.dev/module-resolve';
import browserslist from 'browserslist';
import cssnanoPresetDefault from 'cssnano-preset-default';
import {
  browserslistToTargets,
  type BundleAsyncOptions,
  composeVisitors,
  type CustomAtRules,
} from 'lightningcss';
import type { PluginCreator } from 'postcss';
export const cssnanoPreset = cssnanoPresetDefault({
  cssDeclarationSorter: false,
  calc: false,
  colormin: false,
  convertValues: false,
  discardComments: false,
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
  reduceInitial: false,
  reduceTransforms: false,
  svgo: false,
  uniqueSelectors: false,
}) as { plugins: [PluginCreator<any>, false][]; };

export const lightningcssOptions = function genLightningcssOptions(
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
