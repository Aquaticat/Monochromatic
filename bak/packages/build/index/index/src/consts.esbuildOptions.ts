import { external } from '@/src/consts.ts';
import rehypeSectionize from '@hbsnow/rehype-sectionize';
import { getLogger } from '@logtape/logtape';
import esbuildPluginMdx from '@mdx-js/esbuild';
import esbuildPluginVue from '@monochromatic-dev/esbuild-plugin-vue';
import { js } from '@monochromatic-dev/module-child';
import { path } from '@monochromatic-dev/module-fs-path';
import ThemeConsts from '@monochromatic-dev/schema-theme-consts';
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
import type { Options as rehypeHighlightOptions } from 'rehype-highlight';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import remarkAdmonitions from 'remark-github-beta-blockquote-admonitions';
import remarkSmartypants from 'remark-smartypants';
const l = getLogger(['a', 'esbuildOptions']);
import esbuildPluginCss from '@monochromatic-dev/esbuild-plugin-css';
import esbuildPluginData from '@monochromatic-dev/esbuild-plugin-data';

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

    // TODO: Replace with my own switch exp lib
    // FIXME: This really shouldn't happen?
    //        TypeError: Cannot read properties of undefined (reading 'endsWith')
    //        Using optional chaining for now. I'll fix it later.
    entryNames: entryPoints[0]?.endsWith('.mdx')
      ? '[dir]/[name].mdx'
      : entryPoints[0]?.endsWith('.vue')
      ? '[dir]/[name].vue'
      : '[dir]/[name]',

    outbase: entryPoints[0]?.startsWith('src/')
      ? 'src'
      : entryPoints[0]?.startsWith('dist/temp/')
      ? path.split(entryPoints[0]).slice(0, 3).join(path.sep)
      : '',

    platform: 'node',

    mainFields: ['module', 'main'],

    charset: 'utf8',

    format: 'esm',

    // Force enable tree shaking.
    // Trying to fix esbuild not tree-shaking unused fns in generated *.test.js files #1
    treeShaking: true,

    target: resolveToEsbuildTarget(browserslist()),

    supported: {
      'node-colon-prefix-import': true,
    },

    drop: ['debugger'],

    dropLabels: ['D', 'DEV'],

    keepNames: true,

    minify: !(entryPoints[0]?.endsWith('.test.ts')),

    metafile: true,

    logLevel: 'info',

    logLimit: 0,

    // Change this to sourcemap: external when using transform api.
    sourcemap: true,

    sourcesContent: true,

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
      esbuildPluginData({
        mergeParent: true,
        schema: ThemeConsts,
        injectMetadata: true,
        save: true,
      }),
      esbuildPluginVue(),
      esbuildPluginCss(),
    ],
  }) satisfies esbuild.BuildOptions;

  l.debug`esbuild options ${{ ...result, external: js(result.external).slice(0, 128) }}`;

  return result;
};
