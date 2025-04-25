import postcssCustomUnits from '@csstools/custom-units';
import { resolve } from 'node:path';
import postcssCustomMedia from 'postcss-custom-media';
import postcssCustomSelectors from 'postcss-custom-selectors';
import postcssMixins from 'postcss-mixins';
import {
  defineConfig,
  type UserConfig,
  type UserConfigFnObject,
} from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export const getSharedShared = (configDir: string): UserConfig =>
  defineConfig({
    plugins: [
      // bun bug https://github.com/oven-sh/bun/issues/14825, commented out for now.
      // viteBasicSsl({}),
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
          postcssCustomUnits(),
          postcssCustomMedia(),
          postcssCustomSelectors(),
        ],
      },
      lightningcss: {
        targets: {
          firefox: (128 << 16),
        },
        cssModules: false,
      },
      preprocessorMaxWorkers: true,
      devSourcemap: true,
    },
    esbuild: {
      // empty, for later referencing.
    },
    build: {
      target: 'firefox128',
      cssMinify: 'lightningcss',
      outDir: 'dist/final',
      rollupOptions: {
        // empty, for later referencing.
      },
    },
    worker: {
      format: 'es',
    },
  });

export const getSharedProduction = (configDir: string): UserConfig =>
  defineConfig({ ...getSharedShared(configDir) });

export const getSharedDevelopment = (configDir: string): UserConfig => {
  const sharedShared = getSharedShared(configDir);

  return defineConfig({
    ...sharedShared,
    build: {
      ...sharedShared.build,
      minify: false,
    },
  });
};

export const getShared = (configDir: string): UserConfigFnObject =>
  defineConfig(({ mode }) => {
    switch (mode) {
      case 'development':
        return getSharedDevelopment(configDir);

      case 'production':
        return getSharedProduction(configDir);

      default:
        throw new Error(`invalid mode ${mode}`);
    }
  });

export const getFigmaBackendShared = (configDir: string): UserConfig => {
  const sharedShared = getSharedShared(configDir);

  return defineConfig(
    {
      ...sharedShared,

      // Figma compatibility
      esbuild: {
        ...sharedShared.esbuild,
        supported: {
          'dynamic-import': false,
          'object-rest-spread': false,
          'top-level-await': false,
        },
      },

      build: {
        ...sharedShared.build,

        // Figma compatibility
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
    },
  );
};

export const getFigmaBackendProduction = (configDir: string): UserConfig =>
  defineConfig({
    ...getFigmaBackendShared(configDir),
  });

export const getFigmaBackendDevelopment = (configDir: string): UserConfig => {
  const figmaBackendShared = getFigmaBackendShared(configDir);

  return defineConfig({
    ...figmaBackendShared,

    build: {
      ...figmaBackendShared.build,

      minify: false,
    },
  });
};

export const getFigmaBackend = (configDir: string): UserConfigFnObject =>
  defineConfig(({ mode }) => {
    switch (mode) {
      case 'development':
        return getFigmaBackendDevelopment(configDir);

      case 'production':
        return getFigmaBackendProduction(configDir);

      default:
        throw new Error(`invalid mode ${mode}`);
    }
  });

export const getFigmaFrontendShared = (configDir: string): UserConfig => {
  const sharedShared = getSharedShared(configDir);

  return defineConfig(
    {
      ...sharedShared,

      define: {
        __filename: '""',
        __dirname: '""',
      },

      esbuild: {
        ...sharedShared.esbuild,
        exclude: ['browserslist'],
      },

      plugins: [
        ...sharedShared.plugins!,
        viteSingleFile({
          // Otherwise there'd be too many files in outDir
          // deleteInlinedFiles: true,
        }),
      ],

      root: resolve(configDir, 'src/frontend'),

      build: {
        ...sharedShared.build,

        outDir: '../../dist/final/frontend',
      },
    },
  );
};

export const getFigmaFrontendProduction = (configDir: string): UserConfig =>
  defineConfig({
    ...getFigmaFrontendShared(configDir),
  });

export const getFigmaFrontendDevelopment = (configDir: string): UserConfig => {
  const figmaFrontendShared = getFigmaFrontendShared(configDir);

  return defineConfig({
    ...figmaFrontendShared,

    build: {
      ...figmaFrontendShared.build,

      minify: false,
    },
  });
};

export const getFigmaFrontend = (configDir: string): UserConfigFnObject =>
  defineConfig(({ mode }) => {
    switch (mode) {
      case 'development':
        return getFigmaFrontendDevelopment(configDir);

      case 'production':
        return getFigmaFrontendProduction(configDir);

      default:
        throw new Error(`invalid mode ${mode}`);
    }
  });
