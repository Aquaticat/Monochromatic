import postcssCustomUnits from '@csstools/custom-units';
import {
  chmodSync,
  constants,
  readFileSync,
} from 'node:fs';
import {
  join,
  resolve,
} from 'node:path';
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
import { viteSingleFile } from 'vite-plugin-singlefile';
import {
  defineConfig as defineVitestConfig,
  type ViteUserConfig as VitestUserConfig,
} from 'vitest/config';

const firefoxVersion = 128 << 16;

const rollupExternal = (moduleId: string): boolean => {
  if (
    ['node:', 'node_modules/'].some(function startingWithPrefix(prefix) {
      return moduleId.startsWith(prefix);
    })
  ) {
    return true;
  }
  return ['vite', 'vitest', 'path', 'fs', 'util', 'os'].includes(moduleId);
};

const createBaseConfig = (configDir: string): UserConfig => ({
  plugins: [],
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
        postcssCustomUnits(),
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
  esbuild: {},
  build: {
    target: 'firefox128',
    cssMinify: 'lightningcss',
    outDir: 'dist/final',
    emptyOutDir: true,
    rollupOptions: {
      external: rollupExternal,
    },
  },
  worker: {
    format: 'es',
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
      },
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

    const maybeWithNoMinify: UserConfig = modes.every(function notProduction(m) {
        return m !== 'production';
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
            transformIndexHtml(html): string {
              if (html.includes('REPLACE_WITH_IFRAME_INDEX_HTML')) {
                console.log('replacing iframe');
                chmodSync(iframePath, constants.S_IRUSR);
                const iframeFile = readFileSync(iframePath, 'utf8');
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
    return createFrontendLikeConfig(configDir, 'iframe');
  });

export const vitestOnlyConfigWorkspace: VitestUserConfig = defineVitestConfig({
  test: {
    workspace: ['packages/*/*'],
    include: ['packages/*/*/**/src/**/*.test.ts'],
    exclude: ['**/{node_modules,dist,bak}/**', '**/.{idea,git,cache,output,temp}/**'],
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
      enabled: true,
      excludeAfterRemap: true,
      skipFull: true,

      // We don't really need to see the coverage report every time we run any test.
      all: false,

      thresholds: {
        perFile: true,
        // Error: Failed to update coverage thresholds. Configuration file is too complex.
        autoUpdate: false,
      },
      extension: ['.ts' // Commented out until I see the value of testing non typescript files.
        // '.vue',
        // '.astro'
      ],
      include: ['packages/*/*/**/src/**'],
      exclude: [
        '**/{node_modules,dist,bak}/**',
        '**/.{idea,git,cache,output,temp}/**',
        // temporarily deprecated. Might be resurrected later.
        '**/theme/subtle/**',
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
