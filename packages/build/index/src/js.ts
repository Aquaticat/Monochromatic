import rehypeSectionize from '@hbsnow/rehype-sectionize';
import esbuildPluginMdx from '@mdx-js/esbuild';
import esbuildPluginJsonc from '@monochromatic.dev/esbuild-plugin-jsonc';
import esbuildPluginToml from '@monochromatic.dev/esbuild-plugin-toml';
import esbuildPluginVue from '@monochromatic.dev/esbuild-plugin-vue';
import esbuildPluginYaml from '@monochromatic.dev/esbuild-plugin-yaml';
import ThemeConsts from '@monochromatic.dev/schema-theme-consts';
/* import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers';
import rehypeShiki, { type RehypeShikiOptions } from '@shikijs/rehype'; */
import browserslist from 'browserslist';
import * as esbuild from 'esbuild';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';
import remarkGfm from 'remark-gfm';
import remarkAdmonitions from 'remark-github-beta-blockquote-admonitions';
import remarkSmartypants from 'remark-smartypants';
/* import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { getHighlighterCore } from 'shiki/core';
import shikiLangCss from 'shiki/langs/css.mjs';
import shikiLangHtml from 'shiki/langs/html.mjs';
import shikiLangJavascript from 'shiki/langs/javascript.mjs';
import shikiLangJson from 'shiki/langs/json.mjs';
import shikiLangToml from 'shiki/langs/toml.mjs';
import shikiLangTypescript from 'shiki/langs/typescript.mjs';
import shikiLangVue from 'shiki/langs/vue.mjs';
import shikiLangXml from 'shiki/langs/xml.mjs';
import shikiLangYaml from 'shiki/langs/yaml.mjs';
import shikiThemeGithubDark from 'shiki/themes/github-dark.mjs';
import shikiThemeGithubLight from 'shiki/themes/github-light.mjs';
import shikiWasm from 'shiki/wasm'; */
import rehypeHighlight from 'rehype-highlight';

import { switcher } from 'rambdax';

import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';

import { Glob } from 'glob';
import D from './dev.ts';
import external from './external.ts';
import g from './g.ts';
import type { State } from './state.ts';

import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import txt from 'highlight.js/lib/languages/plaintext';
import yaml from 'highlight.js/lib/languages/yaml';
import typescript from 'highlight.js/lib/languages/yaml';
import type { Options as rehypeHighlightOptions } from 'rehype-highlight';

/* const highlighter = await getHighlighterCore({
  themes: [shikiThemeGithubLight, shikiThemeGithubDark],
  langs: [
    shikiLangCss,
    shikiLangHtml,
    shikiLangJavascript,
    shikiLangJson,
    shikiLangToml,
    shikiLangTypescript,
    shikiLangVue,
    shikiLangXml,
    shikiLangYaml,
  ],
  loadWasm: shikiWasm,
}); */

export const esbuildOptions = function genEsbuildOptions(
  entryPoints: [string, ...string[]] = ['src/index.ts'],
  outdir: string = 'dist/final',
): esbuild.BuildOptions {
  return ({
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
              text: txt,
              uml: txt,
              markdown,
              md: markdown,
              mkd: markdown,
              mkdown: markdown,
              mdx: markdown,
            },
          } satisfies rehypeHighlightOptions,
        ] /* Cannot process MDX file with esbuild???
         [
          rehypeShiki,
          {
            themes: { light: 'github-light', dark: 'github-dark' },
            langs: ['css', 'html', 'javascript', 'typescript', 'vue', 'json', 'toml', 'xml', 'yaml'],
            transformers: [
              transformerMetaHighlight(),
              transformerMetaWordHighlight(),
              transformerNotationDiff(),
              transformerNotationErrorLevel(),
              transformerNotationFocus(),
              transformerNotationHighlight(),
              transformerNotationWordHighlight(),
            ],
            addLanguageClass: true,
          } satisfies RehypeShikiOptions,
        ] */],

        remarkPlugins: [remarkGfm, remarkSmartypants, remarkAdmonitions],
      }),
      esbuildPluginToml('index.toml', ThemeConsts, true),
      esbuildPluginYaml,
      esbuildPluginJsonc,
      esbuildPluginVue(),
    ],
  });
};

export default async function indexJs(globCache = g()): Promise<State> {
  const indexJsPaths = [...new Glob('src/**/index.{ts,js,mjs,mts,jsx,tsx}', globCache)].filter((potentialIndexJsPath) =>
    !potentialIndexJsPath.includes('/_')
  );
  if (indexJsPaths.length === 0) {
    return [
      'SKIP',
      `skipping index.ts, none of ${indexJsPaths} matched by src/**/index.{ts,js,mjs,mts,jsx,tsx} , {ignore: '**/_*/**'} exist`,
    ];
  }

  c.log('esbuild index.js', ...indexJsPaths);
  const ctx = await esbuild.context(esbuildOptions(indexJsPaths as [string, ...string[]], 'dist/final'));
  const result = await ctx.rebuild();
  await ctx.dispose();
  await fs.outputFile(
    path.join('dist', 'temp', 'esbuild', 'js.meta.json'),
    JSON.stringify(result.metafile, null, 2),
  );
  return 'SUCCESS';
}
