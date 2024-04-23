import rehypeSectionize from '@hbsnow/rehype-sectionize';
import mdx from '@mdx-js/esbuild';
import esbuildPluginJsonc from '@monochromatic.dev/esbuild-plugin-jsonc';
import esbuildPluginToml from '@monochromatic.dev/esbuild-plugin-toml';
import esbuildPluginYaml from '@monochromatic.dev/esbuild-plugin-yaml';
import ThemeConsts from '@monochromatic.dev/schema-theme-consts';
import browserslist from 'browserslist';
import type * as esbuild from 'esbuild';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';
import remarkGfm from 'remark-gfm';
import remarkAdmonitions from 'remark-github-beta-blockquote-admonitions';
import remarkSmartypants from 'remark-smartypants';

// TODO: Find or write an actually working esbuild plugin for Vue SFCs.
// import Vue from 'esbuild-plugin-vue3';

import { switcher } from 'rambdax';

export const D = (() => {
  if (
    typeof import.meta === 'undefined'
    || typeof import.meta.env === 'undefined'
    || typeof import.meta.env.MODE === 'undefined'
  ) {
    if (
      typeof process === 'undefined'
      || typeof process.env === 'undefined'
      || typeof process.env.NODE_ENV === 'undefined'
    ) {
      return false;
    }
    return process.env.NODE_ENV === 'development';
  }
  return import.meta.env.MODE === 'development';
})();

export const esbuildOptions = function genEsbuildOptions(
  entryPoints: [string, ...string[]] = ['src/index.ts'],
  outdir: string = 'dist/final',
): esbuild.BuildOptions {
  return ({
    external: [
      //region Formatters
      '@biomejs/*',
      '@dprint/*',
      'dprint',
      'dprint-*',
      //endregion

      //region Incompatible
      'node*',
      'find-up',
      'glob',
      '@types/*',
      '@babel/*',
      '@monochromatic.dev/build-*',
      '@monochromatic.dev/config-*',
      '@monochromatic.dev/module-equals',
      '@monochromatic.dev/module-fs-path',
      '@monochromatic.dev/module-resolve',
      'zod-opts',
      'zx',
      //endregion

      //region Build
      'smol-toml',
      'yaml',
      'jsonc-simple-parser',
      'typescript',
      'vue-tsc',
      '@microsoft/api-extractor',
      'browserslist',
      'chokidar',
      'chokidar-cli',
      '@esbuild/*',
      'esbuild',
      'esbuild-plugin-*',
      '@monochromatic.dev/esbuild-plugin-*',
      '@monochromatic.dev/modified-esbuild-plugin-*',
      '@monochromatic.dev/modified-pipe01-esbuild-plugin-*',
      'unplugin',
      'unplugin-*',
      'lightningcss',
      'lightningcss-plugin-*',
      '@monochromatic.dev/lightningcss-plugin-*',
      'postcss',
      'postcss-*',
      'cssnano',
      'cssnano-*',
      '@monochromatic.dev/schema-theme-consts',
      //endregion

      //region Unified
      '@mdx-js/*',
      '@monochromatic.dev/remark-plugin-*',
      '@monochromatic.dev/retext-plugin-*',
      '@monochromatic.dev/rehype-plugin-*',
      '@monochromatic.dev/recma-plugin-*',
      'remark',
      'remark-*',
      // External path cannot have more than one "*" wildcard
      // Modify as needed.
      '@-/remark-*',
      'mdast-*',
      'retext',
      'retext-*',
      '@-/retext-*',
      'nlcst-*',
      'rehype',
      'rehype-*',
      '@-/rehype-*',
      '@hbsnow/rehype-*',
      'hast-*',
      'recma',
      'recma-*',
      'esast-*',
      'xast-*',
      'unist-*',
      'vfile',
      'to-vfile',
      'unified',
      //endregion
    ],
    entryPoints: entryPoints,
    bundle: true,
    outdir: outdir,

    entryNames: switcher(true)
      .is(entryPoints[0].endsWith('.mdx'), '[dir]/[name].mdx')
      .is(entryPoints[0].endsWith('.vue'), '[dir]/[name].vue')
      .default('[dir]/[name]') as string,

    outbase: 'src',
    platform: 'node',

    mainFields: ['module', 'main'],

    // FIXME: Make the output files actually be utf8
    charset: 'utf8',

    format: 'esm',
    target: resolveToEsbuildTarget(browserslist()),

    define: {
      D: String(D),
      'import.meta.env.DEV': String(D),
      'import.meta.env.PROD': String(D),
      'import.meta.env.MODE': `'${D ? 'development' : 'production'}'`,
    },

    drop: ['debugger'],
    dropLabels: ['D', 'DEV'],
    keepNames: true,
    minifyWhitespace: true,
    minifySyntax: true,
    sourcemap: 'external',
    metafile: true,
    logLevel: 'info',
    logLimit: 0,
    plugins: [
      mdx({
        development: true,

        /* Considered not letting mdx compile jsx away,
           but then found out I'd need Babel for rendering jsx in Vue,
           which is yet another tool I won't have patience to maintain a setup for.

           Although we might have to do it anyway because
           unplugin-vue/esbuild seemingly doesn't have JSX support. */
        // jsx: true,

        jsxImportSource: 'vue',

        providerImportSource: '@mdx-js/vue',

        rehypePlugins: [rehypeSectionize],

        remarkPlugins: [remarkGfm, remarkSmartypants, remarkAdmonitions],
      }),
      esbuildPluginToml('index.toml', ThemeConsts, true),
      esbuildPluginYaml,
      esbuildPluginJsonc,
    ],
  });
};
