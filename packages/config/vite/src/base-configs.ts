import {
  join,
  resolve,
} from 'node:path';
import { type UserConfig, } from 'vite';
import { json5Plugin, } from 'vite-plugin-json5';
import { FIREFOX_ESR_VERSION, } from './constants.ts';
import { postcssMixin, preloadMixins, } from './postcss-mixin-plugin.ts';
import { rolldownExternal, } from './utilities.ts';

const createBaseConfig = (configDir: string,): UserConfig => {
  const styleMonochromaticPath = resolve(configDir, '..', '..', 'style', 'monochromatic', 'src',);

  // Preload mixin definitions before PostCSS starts processing
  preloadMixins([
    join(styleMonochromaticPath, 'mixin.css'),
  ]);

  return {
    plugins: [
      // Allows importing JSON5 files directly.
      json5Plugin(),
    ],
    resolve: {
      alias: {
        '@': resolve(configDir,),
        '@_': resolve(configDir, 'src',),
        '@monochromatic-dev/style-monochromatic': styleMonochromaticPath,
      },
      tsconfigPaths: true,
    },
    css: {
      postcss: {
        plugins: [postcssMixin(),],
      },
      preprocessorMaxWorkers: true,
      devSourcemap: true,
    },
  oxc: {
    assumptions: {
      // Error: Compiler assumption `objectRestNoSymbols` is not implemented for object-rest-spread.
      // ignoreFunctionLength: true,

      noDocumentAll: true,

      // Error: Compiler assumption `objectRestNoSymbols` is not implemented for object-rest-spread.
      // objectRestNoSymbols: true,

      pureGetters: true,

      setPublicClassFields: true,
    },

    decorator: {
      emitDecoratorMetadata: true,
    },

    jsx: 'preserve',

    target: `firefox${FIREFOX_ESR_VERSION}`,

    typescript: {
      declaration: {
        sourcemap: true,
        stripInternal: true,
      },
      rewriteImportExtensions: true,
    },
  },
  build: {
    cssMinify: false,
    rolldownOptions: {
      // https://github.com/rolldown/rolldown/blob/5a5fbb88da1c9c37cc5c25f2cfb3d66124c31dc6/packages/rolldown/src/options/generated/checks-options.ts
      checks: {
        circularDependency: true,
      },

      experimental: {
        incrementalBuild: true,
      },

      external: rolldownExternal,

      output: {
        keepNames: true,
        sourcemap: true,
        minify: {
          codegen: true,
          compress: true,
          mangle: false,
        },
      },
    },
    target: `firefox${FIREFOX_ESR_VERSION}`,
    outDir: join('dist', 'final', 'js',),

    // Sometimes removes important files.
    // Sometimes crashes because node rmSync doesn't work.
    emptyOutDir: false,

    // A little bit faster builds.
    reportCompressedSize: false,

    sourcemap: true,
  },
  worker: {
    format: 'es',
  },

  // Causes problems when running many scripts together in watch mode.
  clearScreen: false,

  experimental: {
    enableNativePlugin: true,
  },
  };
};

export { createBaseConfig };
