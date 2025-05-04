import postcssCustomUnits from '@csstools/custom-units';
import constants from 'node:fs';
import {
  chmodSync,
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
  type PluginOption,
  type UserConfig,
  type UserConfigFnObject,
} from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const firefoxVersion = 128 << 16;

function createBaseConfig(configDir: string): UserConfig {
  return {
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
      rollupOptions: {},
    },
    worker: {
      format: 'es',
    },
  };
}

function withNoMinify(config: UserConfig): UserConfig {
  return {
    ...config,
    build: {
      ...config.build,
      minify: false,
    },
  };
}

function createModeConfig(
  configDir: string,
  sharedFactory: (configDir: string) => UserConfig,
): UserConfigFnObject {
  return defineConfig(({ mode }) => {
    switch (mode) {
      case 'development':
        return withNoMinify(sharedFactory(configDir));
      case 'production':
        return sharedFactory(configDir);
      default:
        throw new Error(`invalid mode ${mode}`);
    }
  });
}

function createBackendConfig(configDir: string): UserConfig {
  const base = createBaseConfig(configDir);
  return {
    ...base,
    esbuild: {
      ...base.esbuild,
      supported: {
        'dynamic-import': false,
        'object-rest-spread': false,
        'top-level-await': false,
      },
    },
    build: {
      ...base.build,
      target: 'es2019',
      outDir: 'dist/final/backend',
      lib: {
        entry: resolve(configDir, 'src/backend/index.ts'),
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
  };
}

function createFrontendLikeConfig(
  configDir: string,
  subDir: string,
): UserConfig {
  const base = createBaseConfig(configDir);
  return {
    ...base,
    define: {
      __filename: '""',
      __dirname: '""',
    },
    esbuild: {
      ...base.esbuild,
      exclude: ['browserslist'],
    },
    plugins: [
      ...(base.plugins || []),
      viteSingleFile({}),
    ],
    root: resolve(configDir, `src/${subDir}`),
    build: {
      ...base.build,
      outDir: `../../dist/final/${subDir}`,
    },
  };
}

export const getShared = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createBaseConfig);

export const getFigmaBackend = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, createBackendConfig);

export const getFigmaFrontend = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, (configDir) => {
    const frontendLikeConfigForFigmaFrontend = createFrontendLikeConfig(configDir,
      'frontend');
    return {
      ...frontendLikeConfigForFigmaFrontend,
      plugins: [
        ...frontendLikeConfigForFigmaFrontend.plugins!,
        (function inlineIframePlugin(): PluginOption {
          const iframePath = join(configDir, 'dist/final/iframe/index.html');
          return {
            name: 'vite-plugin-inline-iframe',
            enforce: 'post',
            buildStart() {
              this.addWatchFile(iframePath);
            },
            transformIndexHtml(html): string {
              if (html.includes('REPLACE_WITH_IFRAME_INDEX_HTML')) {
                console.log('replacing iframe');
                chmodSync(iframePath, constants.constants.S_IRUSR);
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
    };
  });

export const getFigmaIframe = (configDir: string): UserConfigFnObject =>
  createModeConfig(configDir, (configDir) =>
    createFrontendLikeConfig(configDir, 'iframe'));
