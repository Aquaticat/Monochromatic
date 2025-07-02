import postcssCustomUnits from '@csstools/custom-units';
import { readFile } from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';
import type { AcceptedPlugin as PostcssPlugin } from 'postcss';
import postcssCustomMedia from 'postcss-custom-media';
import postcssCustomSelectors from 'postcss-custom-selectors';
import postcssMixins from 'postcss-mixins';
import {
  defineConfig,
  mergeConfig,
  type PluginOption,
  type UserConfig,
  type UserConfigFnObject,
} from 'vite';
import { json5Plugin } from 'vite-plugin-json5';
import { viteSingleFile } from 'vite-plugin-singlefile';
import {
  defineConfig as defineVitestConfig,
  defineProject,
  type ViteUserConfig as VitestUserConfig,
} from 'vitest/config';
import vitestExcludeCommonConfig from './vitest-exclude-common.json' with {
  type: 'json',
};

//region Duplicated from module-es to avoid circular dependency
// TODO: Directly import source in module-es instead.
type falsy = false | null | 0 | 0n | '' | undefined;

function notFalsyOrThrow<T,>(
  potentiallyFalsy: T,
): Exclude<T, falsy> {
  if (!potentiallyFalsy) {
    throw new TypeError(`${JSON.stringify(potentiallyFalsy)} is falsy`);
  }
  return potentiallyFalsy as Exclude<T, falsy>;
}

function wait(timeInMs: number): Promise<undefined> {
  // oxlint-disable-next-line avoid-new
  return new Promise(function createTimeout(_resolve) {
    return setTimeout(_resolve, timeInMs);
  });
}
//endregion Duplicated from module-es to avoid circular dependency

/** Latest ESR (as of Jun 25 2025) */
const firefoxVersion = 140;

/** Bit shift for Firefox version encoding in LightningCSS */
const FIREFOX_VERSION_SHIFT = 16;

const vitestExcludeCommon = vitestExcludeCommonConfig.patterns;

const rollupExternal = (moduleId: string): boolean => {
  if (
    [
      'node:',
      'node_modules/',
      'oxc-',
      'eslint-plugin-',
      '@typescript-eslint/',
      '@eslint/',
      '@vitest/',
    ]
      .some(function startingWithPrefix(prefix) {
        return moduleId.startsWith(prefix);
      })
  ) {
    return true;
  }
  return [
    //region Build
    'vite',
    'vitest',
    'esbuild',
    'typescript-eslint',
    //endregion Build

    //region Node
    'path',
    'fs',
    'util',
    'os',
    'constants',
    'stream',
    'assert',
    'module',
    'events',
    'url',
    'crypto',
    //endregion Node
  ]
    .includes(moduleId);
};

/**
 * Read file with retry logic for EPERM errors on Windows.
 * TODO: Move this fn to module-es
 */
async function readFileWithRetry(
  path: Parameters<typeof readFile>[0],
  options: Parameters<typeof readFile>[1],
  retries = 4,
  delayMs = 10,
): Promise<string> {
  try {
    // Explicitly types the return as string for 'utf8' encoding
    return await readFile(path, options) as string;
  } catch (error) {
    if (
      error instanceof Error && 'code' in error && error
          .code === 'EPERM' && retries > 0
    ) {
      // console.warn(`Retrying readFile for ${path} due to EPERM... (${retries} retries left, delay ${delayMs}ms)`);
      await wait(delayMs);
      return readFileWithRetry(path, options, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

const createBaseConfig = (configDir: string): UserConfig => ({
  plugins: [
    // Allows importing JSON5 files directly.
    json5Plugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(configDir),
      '@_': resolve(configDir, 'src'),
    },
  },
  css: {
    postcss: {
      plugins: [
        postcssMixins(),
        // TODO: Write lightningcss mixin, custom units, and custom selectors plugins. Lightningcss has custom media support builtin.
        //region Cause type error
        // (postcssCustomUnits as () => PostcssPlugin)(),
        // postcssCustomMedia(),
        // postcssCustomSelectors(),
        //endregion Cause type error
      ],
    },
    lightningcss: {
      targets: {
        firefox: firefoxVersion << FIREFOX_VERSION_SHIFT,
      },
      cssModules: false,
    },
    preprocessorMaxWorkers: true,
    devSourcemap: true,
  },
  esbuild: {
    // Minifying them makes resulting code harder to debug.
    minifyIdentifiers: false,
  },
  build: {
    target: `firefox${firefoxVersion}`,
    cssMinify: 'lightningcss',
    outDir: join('dist', 'final', 'js'),

    // Sometimes removes important files.
    // Sometimes crashes because node rmSync doesn't work.
    emptyOutDir: false,

    rollupOptions: {
      external: rollupExternal,
    },

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
});

const createBaseLibConfig = (configDir: string): UserConfig =>
  mergeConfig(
    createBaseConfig(configDir),
    {
      build: {
        lib: {
          entry: resolve(configDir, 'src', 'index.ts'),
          name: 'index',
          fileName: 'index',
          formats: ['es'],
        },
        // So istanbul knows which lines have coverage.
        sourcemap: 'inline',
      },

      plugins: [
        // TODO: Temporarily commented out. Either remove or refine.
        /*         (function oxcMinifyLibPlugin(): PluginOption {
          return {
            name: 'vite-plugin-oxc-minify-lib',
            enforce: 'post',

            // renderChunk doesn't work for whatever reason.
            async writeBundle() {
              const outdir = join(configDir, 'dist', 'final', 'js');
              const entryPointNames = (await readdir(outdir)).filter(
                function isJsFile(file) {
                  return file.endsWith('.js');
                },
              );
              const entryPoints: string[] = entryPointNames.map(
                function fullPath(entryPointName: string): string {
                  return join(outdir, entryPointName);
                },
              );
              await esbuildBuild({
                entryPoints,
                // So istanbul knows which lines have coverage.
                sourcemap: 'linked',
                minifyWhitespace: true,
                outdir,
                allowOverwrite: true,
              });
            },
          };
        })(), */
      ],
    },
  );

const withNoMinify = (config: UserConfig): UserConfig =>
  mergeConfig(config, { build: { minify: false } });

const withNodeResolveConditions = (config: UserConfig): UserConfig =>
  mergeConfig(config, {
    resolve: {
      conditions: ['node', 'module', 'import', 'default'],
    },
    build: {
      lib: {
        fileName: 'index.node',
      },
    },
  });

const createModeConfig = (
  configDir: string,
  sharedFactory: (configDir: string) => UserConfig,
): UserConfigFnObject =>
  defineConfig(function enhanceBaseConfig({ mode }) {
    const modes = (function getModes(mode: string): string[] {
      if (mode.includes(' ')) {
        return mode.split(' ');
      }
      if (mode.includes(',')) {
        return mode.split(',');
      }
      return [mode];
    })(mode);

    // TODO: Refactor this.

    const maybeWithNoMinify: UserConfig = modes.some(function isDev(m) {
        return m === 'development';
      })
      ? withNoMinify(sharedFactory(configDir))
      : sharedFactory(configDir);

    const nodeOrBrowser: UserConfig = modes.some(function isNode(m) {
        return m === 'node';
      })
      ? withNodeResolveConditions(maybeWithNoMinify)
      : maybeWithNoMinify;

    // console.log(modes);

    return nodeOrBrowser;
  });

const createFigmaBackendConfig = (configDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    esbuild: {
      supported: {
        'dynamic-import': false,
        'object-rest-spread': false,
        'top-level-await': false,
      },
    },
    build: {
      target: 'es2019',
      outDir: join('dist', 'final', 'backend'),
      lib: {
        entry: resolve(configDir, 'src', 'backend', 'index.ts'),
        name: 'index',
        fileName: 'index',
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

const createPrefixedFrontendLikeConfig = (configDir: string,
  subDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    define: {
      // So postcss modules can be bundled and correctly working in browsers.
      __filename: '""',
      __dirname: '""',
    },
    esbuild: {
      exclude: ['browserslist'],
    },
    plugins: [
      viteSingleFile({}),
    ],

    // Be aware of how Vite resolves paths.
    root: resolve(configDir),
    build: {
      rollupOptions: {
        input: {
          index: join('src', subDir, 'index.html'),
        },
      },
      outDir: join('dist', 'final', subDir),
    },
  });

const createUnprefixedFrontendLikeConfig = (configDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    define: {
      // So postcss modules can be bundled and correctly working in browsers.
      __filename: '""',
      __dirname: '""',
    },
    esbuild: {
      exclude: ['browserslist'],
    },
    plugins: [
      viteSingleFile({}),
    ],

    root: resolve(configDir),
  });

/**
 @remarks
 Use it like this:

 import { getShared } from '@monochromatic-dev/config-vite';

 import { dirname } from 'node:path';
 import { fileURLToPath } from 'node:url';

 const __dirname = dirname(fileURLToPath(import.meta.url));

 export default getShared(__dirname);
 */
export const getShared = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createBaseConfig);

export const getLib = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createBaseLibConfig);

export const getFigmaBackend = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createFigmaBackendConfig);

export const getFrontend = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createUnprefixedFrontendLikeConfig);

export const getFigmaFrontend = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, function createFigmaFrontendConfig(configDir) {
    return mergeConfig(createPrefixedFrontendLikeConfig(configDir, 'frontend'), {
      plugins: [
        (function inlineIframePlugin(): PluginOption {
          const iframePath = join(configDir, 'dist/final/iframe/src/iframe/index.html');
          return {
            name: 'vite-plugin-inline-iframe',
            enforce: 'post',
            buildStart(): void {
              this.addWatchFile(iframePath);
            },
            async transformIndexHtml(html): Promise<string> {
              if (html.includes('REPLACE_WITH_IFRAME_INDEX_HTML')) {
                console.log('replacing iframe');
                // chmodSync(iframePath, constants.S_IRUSR);
                // FIXME: Find out why this fails with a permission issue. Could be a Vite configuration not allowing plugins to read files outside of root dir. Could be something else.
                //  Update: Probably not due to Vite. Read the docs and only the server can't serve files out of root dir.
                //error during build:
                //           css-variables:js_default | EPERM: operation not permitted, open 'C:\Users\user\Text\Projects\Aquaticat\monochromatic2025MAY24-pnpmTest\packages\figma-plugin\css-variables\dist\final\iframe\index.html'
                //           css-variables:js_default |     at async open (node:internal/fs/promises:633:25)
                //           css-variables:js_default |     at async writeFile (node:internal/fs/promises:1207:14)
                //           css-variables:js_default |     at async Queue.work (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rollup@4.40.2/node_modules/rollup/dist/es/shared/node-entry.js:22320:32)
                //  error during build:
                //           css-variables:js_default | Build failed with 1 error:
                //           css-variables:js_default |
                //           css-variables:js_default | [UNHANDLEABLE_ERROR] Error: Something went wrong inside rolldown, please report this problem at https://github.com/rolldown/rolldown/issues.
                //           css-variables:js_default | Access denied. (os error 5)
                //           css-variables:js_default |
                //           css-variables:js_default |     at normalizeErrors (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown@1.0.0-beta.11-commit.83d4d62/node_modules/rolldown/dist/shared/src-C1CX2gm4.mjs:2362:18)
                //           css-variables:js_default |     at handleOutputErrors (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown@1.0.0-beta.11-commit.83d4d62/node_modules/rolldown/dist/shared/src-C1CX2gm4.mjs:3368:34)
                //           css-variables:js_default |     at transformToRollupOutput (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown@1.0.0-beta.11-commit.83d4d62/node_modules/rolldown/dist/shared/src-C1CX2gm4.mjs:3362:2)
                //           css-variables:js_default |     at RolldownBuild.write (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown@1.0.0-beta.11-commit.83d4d62/node_modules/rolldown/dist/shared/src-C1CX2gm4.mjs:4623:11)
                //           css-variables:js_default |     at async buildEnvironment (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown-vite@6.3.17_@types_1e456e895584948faf6ff142639fbae7/node_modules/rolldown-vite/dist/node/chunks/dep-BVD1pq3j.js:44451:16)
                //           css-variables:js_default |     at async Object.defaultBuildApp [as buildApp] (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown-vite@6.3.17_@types_1e456e895584948faf6ff142639fbae7/node_modules/rolldown-vite/dist/node/chunks/dep-BVD1pq3j.js:44957:5)
                //           css-variables:js_default |     at async CAC.<anonymous> (file:///C:/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest/node_modules/.pnpm/rolldown-vite@6.3.17_@types_1e456e895584948faf6ff142639fbae7/node_modules/rolldown-vite/dist/node/cli.js:864:7)
                const iframeFileContent = await readFileWithRetry(iframePath, 'utf8');
                return html.replace(
                  'REPLACE_WITH_IFRAME_INDEX_HTML',
                  iframeFileContent.replaceAll("'", '&apos;'),
                );
              }
              return html;
            },
          };
        })(),
      ],
    });
  });

/** */
export const getFigmaIframe = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, function createFigmaIframeConfig(configDir) {
    return createPrefixedFrontendLikeConfig(configDir, 'iframe');
  });

export const vitestOnlyConfigWorkspace: VitestUserConfig = defineVitestConfig({
  test: {
    name: 'workspace',
    api: {
      host: '0.0.0.0',
      port: 3001,
    },

    reporters: ['dot'],

    deps: {
      // Never importing CJS module's default export via `import {x} from 'y'`.
      interopDefault: false,
    },
    benchmark: {
      outputJson: join('bak', new Date().toISOString().replaceAll(':', ''),
        'vitest.benchmark.json'),
    },
    outputFile: join('bak', new Date().toISOString().replaceAll(':', ''),
      'vitest.result.json'),
    pool: 'threads',
    poolOptions: {
      threads: {
        useAtomics: true,
      },
      vmThreads: {
        useAtomics: true,
      },
    },
    testTimeout: 2000,
    silent: 'passed-only',
    logHeapUsage: true,
    maxConcurrency: 16,
    sequence: {
      concurrent: true,
    },
    typecheck: {
      enabled: true,

      // Overwrite this to vue-tsc in packages that use Vue.
      checker: 'tsc',
    },
    chaiConfig: {
      includeStack: true,
    },
    expect: {
      requireAssertions: true,
    },

    // Coverage configuration at workspace level - only runs for unit tests
    coverage: {
      provider: 'v8',
      enabled: true,
      excludeAfterRemap: true,
      reportOnFailure: true,
      skipFull: true,

      reporter: [
        join(import.meta.dirname, 'coverage-reporter.cjs'),
        'html',
        'clover',
        'json',
      ],

      thresholds: {
        perFile: true,
        // Error: Failed to update coverage thresholds. The Configuration file is too complex.
        autoUpdate: false,
      },

      // Only this works for coverage to follow sourcemap.
      include: [
        'packages/*/*/**/dist/final/**/*.js',
        'packages/*/*/**/src/**/*.ts',
      ],
      exclude: [
        ...vitestExcludeCommon,
        ...(vitestExcludeCommonConfig.coverageAdditionalPatterns),
      ],
    },
  },
});

export const vitestOnlyUnitConfigWorkspace: VitestUserConfig = {
  test: {
    ...vitestOnlyConfigWorkspace.test,
    name: 'unit',
    include: ['packages/*/*/**/src/**/*.unit.test.ts'],
    exclude: [...vitestExcludeCommon, '**/*.browser.test.ts'],
  },
};

export const vitestOnlyBrowserConfigWorkspace: VitestUserConfig = {
  test: {
    ...vitestOnlyConfigWorkspace.test,

    coverage: {
      // Turned off for browsers. See https://github.com/vitest-dev/vitest/issues/5477
      enabled: false,
    },
    name: 'browser',
    include: ['packages/*/*/**/src/**/*.browser.test.ts'],
    exclude: [...vitestExcludeCommon, '**/*.unit.test.ts'],

    browser: {
      provider: 'playwright',
      enabled: true,
      headless: true,

      api: {
        host: '0.0.0.0',
        port: 3003,
      },

      instances: [
        {
          browser: 'chromium',
          testTimeout: 1000,
        },
        // @vitest/coverage-v8 doesn't work with firefox because Firefox doesn't use v8 engine.
        { browser: 'firefox', testTimeout: 1000 },
      ],
    },
  },
};

export const createVitestBaseUnitConfigWorkspace = (
  configDir: string,
): VitestUserConfig =>
  mergeConfig(
    createBaseConfig(configDir),
    vitestOnlyUnitConfigWorkspace,
  );

export const createVitestBaseBrowserConfigWorkspace = (
  configDir: string,
): VitestUserConfig =>
  mergeConfig(
    createBaseConfig(configDir),
    vitestOnlyBrowserConfigWorkspace,
  );

export const getVitestUnitWorkspace = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createVitestBaseUnitConfigWorkspace);
export const getVitestBrowserWorkspace = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createVitestBaseBrowserConfigWorkspace);

export type { UserConfigFnObject } from 'vite';
