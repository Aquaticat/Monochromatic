import { js } from '@/src/child.ts';
import { external } from '@/src/consts.js';
import D from '@/src/dev.ts';
import rehypeSectionize from '@hbsnow/rehype-sectionize';
import { getLogger } from '@logtape/logtape';
import esbuildPluginMdx from '@mdx-js/esbuild';
import esbuildPluginJsonc from '@monochromatic.dev/esbuild-plugin-jsonc';
import esbuildPluginToml from '@monochromatic.dev/esbuild-plugin-toml';
import esbuildPluginVue from '@monochromatic.dev/esbuild-plugin-vue';
import esbuildPluginYaml from '@monochromatic.dev/esbuild-plugin-yaml';
import { path } from '@monochromatic.dev/module-fs-path';
import ThemeConsts from '@monochromatic.dev/schema-theme-consts';
import browserslist from 'browserslist';
import type * as esbuild from 'esbuild';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import txt from 'highlight.js/lib/languages/plaintext';
import html from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import typescript from 'highlight.js/lib/languages/yaml';
import { switcher } from 'rambdax';
import type { Options as rehypeHighlightOptions } from 'rehype-highlight';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import remarkAdmonitions from 'remark-github-beta-blockquote-admonitions';
import remarkSmartypants from 'remark-smartypants';
const l = getLogger(['app', 'esbuildOptions']);
import esbuildPluginCss from '@monochromatic.dev/esbuild-plugin-css';

export default (
  entryPoints: [string, ...string[]] = ['src/index.ts'],
  outdir: string = 'dist/final',
): esbuild.BuildOptions => {
  const result = ({
    external,

    entryPoints,

    logOverride: {
      'assign-to-define': 'debug',
    },

    bundle: true,

    outdir,

    entryNames: switcher(true)
      .is(entryPoints[0].endsWith('.mdx'), '[dir]/[name].mdx')
      .is(entryPoints[0].endsWith('.vue'), '[dir]/[name].vue')
      .default('[dir]/[name]') as string,

    outbase: entryPoints[0].startsWith('src')
      ? 'src'
      : entryPoints[0].startsWith('dist/temp/')
      ? path.split(entryPoints[0]).slice(0, 3).join(path.sep)
      : '',

    platform: 'node',

    mainFields: ['module', 'main'],

    charset: 'utf8',

    format: 'esm',

    target: resolveToEsbuildTarget(browserslist()),

    define: {
      D: String(D),
      DEV: String(D),
      P: String(!D),
      PROD: String(!D),
      'import.meta.env.DEV': String(D),
      'import.meta.env.PROD': String(D),
      'import.meta.env.MODE': `'${D ? 'development' : 'production'}'`,
      'process.env.NODE_ENV': `'${D ? 'development' : 'production'}'`,
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

    loader: {
      // @ts-expect-error The loader global-css actually exists.
      '.css': 'global-css'
    },

    plugins: [
      esbuildPluginMdx({
        /* Considered not letting mdx compile jsx away,
           but then found out I'd need Babel for rendering jsx in Vue,
           which is yet another tool I won't have patience to maintain a setup for.

           Although we might have to do it anyway because
           unplugin-vue/esbuild seemingly doesn't have JSX support. */
        // jsx: true,

        jsxImportSource: 'vue',

        providerImportSource: '@mdx-js/vue',

        rehypePlugins: [rehypeSectionize, [
          rehypeHighlight,
          {
            languages: {
              bash,
              sh: bash,
              zsh: bash,
              shell: bash,
              yaml,
              yml: yaml,
              typescript,
              ts: typescript,
              tsx: typescript,
              mts: typescript,
              cts: typescript,
              javascript,
              js: javascript,
              jsx: javascript,
              mjs: javascript,
              cjs: javascript,
              css,
              html,
              vue: html,
              xml: html,
              rss: html,
              svg: html,
              ini,
              toml: ini,
              json,
              json5: json,
              jsonc: json,
              txt,
              ansi: txt,
              text: txt,
              uml: txt,
              markdown,
              md: markdown,
              mkd: markdown,
              mkdown: markdown,
              mdx: markdown,
            },
          } satisfies rehypeHighlightOptions,
        ]],

        remarkPlugins: [remarkGfm, remarkSmartypants, remarkAdmonitions],
      }),
      esbuildPluginToml('index.toml', ThemeConsts, true),
      esbuildPluginYaml,
      esbuildPluginJsonc,
      esbuildPluginVue(),
      esbuildPluginCss(),
    ],
  }) satisfies esbuild.BuildOptions;

  l.debug`esbuild options ${{ ...result, external: js(result.external).slice(0, 128) }}`;

  // @ts-expect-error The loader global-css actually exists.
  return result;
};
