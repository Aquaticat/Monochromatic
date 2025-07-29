import {
  alwaysTrue,
  wait,
} from '@monochromatic-dev/module-es/.ts';
import {
  composeVisitors,
  type ContainerRule,
  type CounterStyleRule,
  type CustomAtRules,
  type CustomMediaRule,
  type DeclarationBlock,
  type FontFaceRule,
  type FontFeatureValuesRule,
  type FontPaletteValuesRule,
  type ImportRule,
  type KeyframesRule,
  type LayerBlockRule,
  type LayerStatementRule,
  type MediaRule,
  type MozDocumentRule,
  type NamespaceRule,
  type NestedDeclarationsRule,
  type NestingRule,
  type PageRule,
  type PropertyRule,
  type ScopeRule,
  type StartingStyleRule,
  type StyleRule,
  type SupportsRule,
  type UnknownAtRule,
  type ViewportRule,
  type ViewTransitionRule,
  type Visitor,
} from 'lightningcss';
import { readFile } from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';
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
  type ViteUserConfig as VitestUserConfig,
} from 'vitest/config';
import vitestExcludeCommonConfig from './vitest-exclude-common.json' with {
  type: 'json',
};

//region Constants -- Configuration values used throughout the file

// Browser versions
/** Latest ESR (as of Jun 25 2025) */
const FIREFOX_ESR_VERSION = 140;
/** Bit shift for Firefox version encoding in LightningCSS */
const FIREFOX_VERSION_SHIFT = 16;

// Ports
const VITEST_API_PORT = 3001;
const VITEST_BROWSER_API_PORT = 3003;

// Timeouts
const DEFAULT_TEST_TIMEOUT = 2000;
const BROWSER_TEST_TIMEOUT = 1000;

// Other constants
const MAX_CONCURRENCY = 16;

//endregion Constants

const vitestExcludeCommon = vitestExcludeCommonConfig.patterns;

//region LightningCSS Visitors -- Custom CSS transform implementations

/** Storage for mixin definitions */
const mixins = new Map<string,
  | Required<DeclarationBlock>
  | (
    | { type: 'ignored'; }
    | { type: 'custom'; value: null; }
    | ({ type: 'font-face'; value: FontFaceRule; } & { value: Required<FontFaceRule>; })
    | ({ type: 'font-palette-values'; value: FontPaletteValuesRule; } & {
      value: Required<FontPaletteValuesRule>;
    })
    | ({ type: 'font-feature-values'; value: FontFeatureValuesRule; } & {
      value: Required<FontFeatureValuesRule>;
    })
    | ({ type: 'namespace'; value: NamespaceRule; } & { value: Required<NamespaceRule>; })
    | ({ type: 'layer-statement'; value: LayerStatementRule; } & {
      value: Required<LayerStatementRule>;
    })
    | ({ type: 'property'; value: PropertyRule; } & { value: Required<PropertyRule>; })
    | ({ type: 'view-transition'; value: ViewTransitionRule; } & {
      value: Required<ViewTransitionRule>;
    })
    | ({ type: 'unknown'; value: UnknownAtRule; } & { value: Required<UnknownAtRule>; })
    | ({ type: 'media'; value: MediaRule; } & {
      value: Required<MediaRule>;
    })
    | ({ type: 'import'; value: ImportRule; } & {
      value: Required<ImportRule>;
    })
    | ({ type: 'style'; value: StyleRule; } & {
      value: Required<StyleRule> & {
        declarations: Required<DeclarationBlock>;
      };
    })
    | ({ type: 'keyframes'; value: KeyframesRule; } & {
      value: Required<KeyframesRule>;
    })
    | ({ type: 'page'; value: PageRule; } & {
      value: Required<PageRule>;
    })
    | ({ type: 'supports'; value: SupportsRule; } & {
      value: Required<SupportsRule>;
    })
    | ({ type: 'counter-style'; value: CounterStyleRule; } & {
      value: Required<CounterStyleRule>;
    })
    | ({ type: 'moz-document'; value: MozDocumentRule; } & {
      value: Required<MozDocumentRule>;
    })
    | ({ type: 'nesting'; value: NestingRule; } & {
      value: Required<NestingRule>;
    })
    | ({ type: 'nested-declarations'; value: NestedDeclarationsRule; } & {
      value: Required<NestedDeclarationsRule>;
    })
    | ({ type: 'viewport'; value: ViewportRule; } & {
      value: Required<ViewportRule>;
    })
    | ({ type: 'custom-media'; value: CustomMediaRule; } & {
      value: Required<CustomMediaRule>;
    })
    | ({ type: 'layer-block'; value: LayerBlockRule; } & {
      value: Required<LayerBlockRule>;
    })
    | ({ type: 'container'; value: ContainerRule; } & {
      value: Required<ContainerRule>;
    })
    | ({ type: 'scope'; value: ScopeRule; } & {
      value: Required<ScopeRule>;
    })
    | ({ type: 'starting-style'; value: StartingStyleRule; } & {
      value: Required<StartingStyleRule>;
    })
  )[]>();

/** Transforms custom property units into `calc()` expressions */
const customUnitsVisitor: Visitor<CustomAtRules> = {
  Token: {
    dimension(token) {
      if (token.unit.startsWith('--')) {
        return {
          type: 'function',
          value: {
            name: 'calc',
            arguments: [
              {
                type: 'token',
                value: {
                  type: 'number',
                  value: token.value,
                },
              },
              {
                type: 'token',
                value: {
                  type: 'delim',
                  value: '*',
                },
              },
              {
                type: 'var',
                value: {
                  name: {
                    ident: token.unit,
                  },
                },
              },
            ],
          },
        };
      }
      return;
    },
  },
};

/** Transforms `@mixin` definitions and `@apply` usage */
const mixinsVisitor: Visitor<CustomAtRules> = {
  Rule: {
    custom: {
      mixin(rule) {
        // Uncomment to get the updated TypeScript inferred type for the map.
        // const body = rule.body.value;
        mixins.set(rule.prelude.value as string, rule.body.value);
        return [];
      },
      apply(rule) {
        return mixins.get(rule.prelude.value as string);
      },
    },
  },
};

//endregion LightningCSS Visitors

//region Helper Functions -- Utilities used throughout configurations

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
    'lightningcss',
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
 */
async function readFileWithRetry(
  path: Parameters<typeof readFile>[0],
  options: Parameters<typeof readFile>[1],
  retries = 4,
  delayMs = 10,
): Promise<string> {
  try {
    // Explicitly types the return as string for `utf8` encoding
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

//endregion Helper Functions

//region Base Configurations -- Core configuration factories

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
    tsconfigPaths: true,
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        firefox: FIREFOX_ESR_VERSION << FIREFOX_VERSION_SHIFT,
      },
      cssModules: false,
      visitor: composeVisitors([
        customUnitsVisitor,
        mixinsVisitor,
      ]),
    },
    preprocessorMaxWorkers: true,
    devSourcemap: true,
  },
  esbuild: {
    // Minifying them makes resulting code harder to debug.
    minifyIdentifiers: false,
  },
  build: {
    target: `firefox${FIREFOX_ESR_VERSION}`,
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
        rollupOptions: {
          output: {
            // Rolldown-vite emits a small runtime chunk and index chunk for correctness
            // See https://rolldown.rs/guide/in-depth/advanced-chunks#why-there-s-always-a-runtime-js-chunk
            advancedChunks: {
              groups: [
                {
                  name: 'index',
                  test: alwaysTrue, // Match all modules into a single chunk
                },
              ],
            },
            inlineDynamicImports: true, // Force all dynamic imports to be inlined
          },
        },
      },
    },
  );

//endregion Base Configurations

//region Configuration Modifiers -- Functions that enhance base configs

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
    // Parse modes from space or comma-separated string
    const modes = mode.includes(' ')
      ? mode.split(' ')
      : (mode.includes(',')
        ? mode.split(',')
        : [mode]);

    // Apply mode-specific transformations using reduce for immutability
    const config = modes.reduce(
      (currentConfig, currentMode) => {
        switch (currentMode) {
          case 'development':
            return withNoMinify(currentConfig);
          case 'node':
            return withNodeResolveConditions(currentConfig);
          default:
            return currentConfig;
        }
      },
      sharedFactory(configDir),
    );

    return config;
  });

//endregion Configuration Modifiers

//region Figma Configurations -- Figma plugin specific configs

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

//endregion Figma Configurations

//region Public API -- Exported configuration factories

/**
 @remarks
 Use it like this:

```ts
 import { getShared, UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

 export default getShared(import.meta.dirname) satisfies UserConfigFnObject;
```
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

//endregion Public API

//region Vitest Configurations -- Test runner configurations

export const vitestOnlyConfigWorkspace: VitestUserConfig = defineVitestConfig({
  test: {
    name: 'workspace',
    api: {
      host: '0.0.0.0',
      port: VITEST_API_PORT,
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
    testTimeout: DEFAULT_TEST_TIMEOUT,
    silent: 'passed-only',
    logHeapUsage: true,
    maxConcurrency: MAX_CONCURRENCY,
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
        port: VITEST_BROWSER_API_PORT,
      },

      instances: [
        {
          browser: 'chromium',
          testTimeout: BROWSER_TEST_TIMEOUT,
        },
        // @vitest/coverage-v8 doesn't work with firefox because Firefox doesn't use v8 engine.
        { browser: 'firefox', testTimeout: BROWSER_TEST_TIMEOUT },
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

//endregion Vitest Configurations

export type { UserConfigFnObject } from 'vite';
