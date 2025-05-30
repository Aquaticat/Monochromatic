import postcssCustomUnits from '@csstools/custom-units';
import { build as esbuildBuild } from 'esbuild';
import spawn, { type Options } from 'nano-spawn';
import {
  readdir,
  readFile,
} from 'node:fs/promises';
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

const firefoxVersion = 128 << 16;

const spawnOptions: Options = {
  preferLocal: true,
  stdio: 'inherit',
};

const vitestExcludeCommon = [
  '**/{node_modules,bak}/**',
  '**/.{idea,git,cache,output,temp}/**',

  // 'packages/*/*/**/src/**/*.browser.test.ts',
  'packages/*/*/**/src/**/*.js',

  // TypeScript definition files can't be tested.
  '**/*.d.ts',

  // Not meant to be directly exported or tested.
  '**/*.shared.ts',
  '**/*.fixture.*.ts',

  // temporarily deprecated. Might be resurrected later.
  '**/theme/subtle/**',

  // deprecated
  'packages/module/es/src/testing.ts',
];

const rollupExternal = (moduleId: string): boolean => {
  if (
    [
      'node:',
      'node_modules/',
      'oxc-',
    ]
      .some(function startingWithPrefix(prefix) {
        return moduleId.startsWith(prefix);
      })
  ) {
    return true;
  }
  return [
    'vite',
    'vitest',
    'path',
    'fs',
    'util',
    'os',
    'esbuild',

    // Too big.
    'typescript-eslint',
  ]
    .includes(moduleId);
};

const createBaseConfig = (configDir: string): UserConfig => ({
  plugins: [
    // Allow importing JSON5 files directly.
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
        (postcssCustomUnits as () => PostcssPlugin)(),
        postcssCustomMedia(),
        postcssCustomSelectors(),
      ],
    },
    lightningcss: {
      targets: {
        firefox: firefoxVersion,
      },
      cssModules: false,
    },
    preprocessorMaxWorkers: true,
    devSourcemap: true,
  },
  esbuild: {
    // Minifying them make resulting code harder to debug.
    minifyIdentifiers: false,
  },
  build: {
    target: 'firefox128',
    cssMinify: 'lightningcss',
    outDir: join('dist', 'final', 'js'),

    // Sometimes removes important files.
    // Sometimes crashes because node rmSync doesn't work properly.
    emptyOutDir: false,

    rollupOptions: {
      external: rollupExternal,
    },

    // A little bit faster builds.
    reportCompressedSize: false,
  },
  worker: {
    format: 'es',
  },

  // Causes problems when running many scripts together in watch mode.
  clearScreen: false,
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
        // So istanbul can know which lines are covered.
        sourcemap: 'inline',
      },

      plugins: [
        (function oxcMinifyLibPlugin(): PluginOption {
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
                // So istanbul can know which lines are covered.
                sourcemap: 'linked',
                minifyWhitespace: true,
                outdir,
                allowOverwrite: true,
              });
            },
          };
        })(),
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
    const modes: string[] = mode.split(',');

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

const createFrontendLikeConfig = (configDir: string, subDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    define: {
      __filename: '""',
      __dirname: '""',
    },
    esbuild: {
      exclude: ['browserslist'],
    },
    plugins: [
      viteSingleFile({}),
    ],
    root: resolve(configDir, 'src', subDir),
    build: {
      outDir: join('..', '..', 'dist', 'final', subDir),
    },
  });

// TODO: Check if this is necessary.
const vitestCommonToAllProjects = defineVitestConfig(
  {
    test: {
      projects: ['packages/*/*'],
      include: ['packages/*/*/**/src/**/*.test.ts'],
      exclude: vitestExcludeCommon,
      name: 'workspace',
      deps: {
        // We're never importing CJS module's default export via `import {x} from 'y'`.
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
      coverage: {
        provider: 'v8',
        enabled: true,
        excludeAfterRemap: true,
        reportOnFailure: true,
        skipFull: true,

        experimentalAstAwareRemapping: true,

        // We don't really need to see the coverage report every time we run any test.
        all: false,

        thresholds: {
          perFile: true,
          // Error: Failed to update coverage thresholds. Configuration file is too complex.
          autoUpdate: false,
        },

        // Only this works for coverage to follow sourcemap.
        extension: [
          '.js',
          '.ts',
          // Commented out until I see the value of testing non typescript files.
          // '.vue',
          // '.astro'
        ],
        include: [
          'packages/*/*/**/dist/final/**',
          'packages/*/*/**/src/**',
        ],

        exclude: [...vitestExcludeCommon, 'packages/*/*/**/src/**/*.browser.test.ts'],
      },
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
    },
  },
);

/**
 @remarks
 Use it like:

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

export const getFigmaFrontend = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, function createFigmaFrontendConfig(configDir) {
    return mergeConfig(createFrontendLikeConfig(configDir, 'frontend'), {
      plugins: [
        (function inlineIframePlugin(): PluginOption {
          const iframePath = join(configDir, 'dist/final/iframe/index.html');
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
                const iframeFile = await readFile(iframePath, 'utf8');
                return html.replace(
                  'REPLACE_WITH_IFRAME_INDEX_HTML',
                  iframeFile.replaceAll("'", '&apos;'),
                );
              }
              return html;
            },
          };
        })(),
      ],
    });
  });

export const getFigmaIframe = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, function createFigmaIframeConfig(configDir) {
    return mergeConfig(createFrontendLikeConfig(configDir, 'iframe'), {
      plugins: [
        (function buildFrontendPlugin(): PluginOption {
          return {
            name: 'vite-plugin-build-figma-frontend',
            enforce: 'post',
            async writeBundle(): Promise<void> {
              await spawn(`pnpm`, [
                'exec',
                'vite',
                'build',
                '--config',
                'vite.config.frontend.ts',
                '--mode',
                'production',
              ], spawnOptions);
            },
          };
        })(),
      ],
    });
  });

export const vitestOnlyConfigWorkspace: VitestUserConfig = defineVitestConfig({
  test: {
    projects: [
      // 'packages/*/*',
      {
        test: {
          name: 'browser',
          include: ['packages/*/*/**/src/**/*.browser.test.ts'],
          exclude: [...vitestExcludeCommon, '*.unit.test.ts'],
          browser: {
            provider: 'playwright',
            enabled: true,
            headless: true,
            instances: [
              { browser: 'chromium' },
              // @vitest/coverage-v8 does not work with firefox.
              // { browser: 'firefox' },
            ],
          },
        },
      },
      {
        test: {
          name: { label: 'unit', color: 'black' },
          include: ['packages/*/*/**/src/**/*.unit.test.ts'],
          exclude: [...vitestExcludeCommon, '*.browser.test.ts'],
        },
      },
    ],
    name: 'workspace',
    deps: {
      // We're never importing CJS module's default export via `import {x} from 'y'`.
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
    coverage: {
      provider: 'v8',
      enabled: true,
      excludeAfterRemap: true,
      reportOnFailure: true,
      skipFull: true,

      experimentalAstAwareRemapping: true,

      // We don't really need to see the coverage report every time we run any test.
      all: false,

      thresholds: {
        perFile: true,
        // Error: Failed to update coverage thresholds. Configuration file is too complex.
        autoUpdate: false,
      },

      // Only this works for coverage to follow sourcemap.
      extension: [
        '.js',
        '.ts',
        // Commented out until I see the value of testing non typescript files.
        // '.vue',
        // '.astro'
      ],
      include: [
        'packages/*/*/**/dist/final/**',
        'packages/*/*/**/src/**/*.ts',
      ],
    },
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
  },
});

export const createVitestBaseConfigWorkspace = (configDir: string): VitestUserConfig =>
  mergeConfig(
    createBaseConfig(configDir),
    vitestOnlyConfigWorkspace,
  );

export const getVitestWorkspace = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createVitestBaseConfigWorkspace);
