import {
  join,
  resolve,
} from 'node:path';
import type { UserConfig, } from 'vite';
import { json5Plugin, } from 'vite-plugin-json5';
import {
  FIREFOX_ESR_VERSION,
  FIREFOX_VERSION_SHIFT,
} from './constants.ts';
import { rolldownExternal, } from './utilities.ts';

/**
 * Creates the base Vite configuration shared across all packages.
 * Configures CSS processing, OXC transpilation, build output, and common plugins.
 *
 * @param configDir - absolute path to the package directory
 *
 * @returns base Vite user config
 */
function createBaseConfig(configDir: string,): UserConfig {
  return {
    plugins: [
      // Allows importing JSON5 files directly.
      json5Plugin(),
    ],
    resolve: {
      alias: {
        '@': resolve(configDir,),
        '@_': resolve(configDir, 'src',),
      },
      tsconfigPaths: true,
    },
    css: {
      transformer: 'lightningcss',
      lightningcss: {
        targets: {
          firefox: FIREFOX_ESR_VERSION << FIREFOX_VERSION_SHIFT,
        },
        cssModules: false,
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
}

export { createBaseConfig, };
