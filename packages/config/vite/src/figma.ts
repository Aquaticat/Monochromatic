import {
  mergeConfig,
  type UserConfig,
} from 'vite';
import { json5Plugin } from 'vite-plugin-json5';
import {
  join,
  resolve,
} from 'node:path';
import { viteSingleFile, } from 'vite-plugin-singlefile';
import { createBaseConfig } from './base-configs.js';
import { viteNoopPlugin } from './utils.js';

//region Figma Configurations -- Figma plugin specific configs

const createFigmaBackendConfig = (configDir: string,): UserConfig =>
  mergeConfig(createBaseConfig(configDir,), {
    build: {
      target: 'es2019',
      outDir: join('dist', 'final', 'backend',),
      lib: {
        entry: resolve(configDir, 'src', 'backend', 'index.ts',),
        name: 'index',
        fileName: 'index',
        formats: ['iife',],
      },
    },
  },);

const createPrefixedFrontendLikeConfig = (configDir: string, subDir: string,
  { singleFile, }: { singleFile: boolean; } = { singleFile: true, },): UserConfig =>
  mergeConfig(createBaseConfig(configDir,), {
    define: {
      // So postcss modules can be bundled and correctly working in browsers.
      __filename: '""',
      __dirname: '""',
    },
    plugins: [
      singleFile ? viteSingleFile({ deleteInlinedFiles: false, },) : viteNoopPlugin(),
    ],

    // Be aware of how Vite resolves paths.
    root: resolve(configDir,),
    build: {
      sourcemap: true,
      rolldownOptions: {
        input: {
          index: join('src', subDir, 'index.html',),
        },
      },
      outDir: join('dist', 'final', subDir,),
    },
  },);

const createUnprefixedFrontendLikeConfig = (configDir: string,
  { singleFile, }: { singleFile: boolean; } = { singleFile: true, },): UserConfig =>
  mergeConfig(createBaseConfig(configDir,), {
    define: {
      // So postcss modules can be bundled and correctly working in browsers.
      __filename: '""',
      __dirname: '""',
    },
    plugins: [
      singleFile ? viteSingleFile({ deleteInlinedFiles: false, },) : viteNoopPlugin(),
    ],

    root: resolve(configDir,),
  },);

//endregion Figma Configurations

export {
  createFigmaBackendConfig,
  createPrefixedFrontendLikeConfig,
  createUnprefixedFrontendLikeConfig,
};
