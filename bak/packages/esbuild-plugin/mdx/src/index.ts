import rehypeSectionize from '@hbsnow/rehype-sectionize';
import { compile } from '@mdx-js/mdx';
import { toJs as dataToJs } from '@monochromatic-dev/esbuild-plugin-data';
import { toTs as layoutToTs } from '@monochromatic-dev/esbuild-plugin-vue';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import toExport from '@monochromatic-dev/module-object-to-export';
import pm from '@monochromatic-dev/module-pm';
import resolve from '@monochromatic-dev/module-resolve';
import type { Plugin } from 'esbuild';
import { findUpMultiple } from 'find-up';
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
import memoizeFs from 'memoize-fs';
import {
  mapParallelAsync,
  pipedAsync,
} from 'rambdax';
import type { Options as rehypeHighlightOptions } from 'rehype-highlight';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import remarkAdmonitions from 'remark-github-beta-blockquote-admonitions';
import remarkSmartypants from 'remark-smartypants';
import { VFile } from 'vfile';

const memoizer = memoizeFs({
  cachePath: 'dist/temp/cache/',
  cacheId: 'mdx',
  astBody: true,
  retryOnInvalidCache: true,
});

const toJsWoCache = async (
  input: string,
  inputPath: string,
): Promise<string> =>
  String(
    await compile(new VFile({ path: inputPath, value: input }), {
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
  );

export const toJs: typeof toJsWoCache = await memoizer.fn(toJsWoCache);

// FIXME: write it
const toHtmlWoCache = async (input: string, inputPath: string): Promise<string> => {
};

/**
@param options Object Options
*/
export default (
  options?: { save?: boolean | string | string[]; },
): Plugin => {
  const save = options?.save ?? false;

  return {
    name: 'mdx',

    setup(build) {
      const saveTo: string[] = save === true
        ? [build.initialOptions.outdir ?? 'dist/temp/mdx']
        : save === false
        ? []
        : typeof save === 'string'
        ? [save]
        : save;

      build.onResolve({ filter: /\.mdx$/ }, async (args) => {
        return {
          path: await resolve(args.path, args.importer),
          namespace: 'mdx',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'mdx' }, async (args) => {
        const input = await fs.readFileMU(args.path);

        const contents = await toJs(input, args.path);

        await mapParallelAsync(
          async (outputDirPath) =>
            await fs.outputFile(
              `${
                path.join(
                  outputDirPath,
                  path.relative(
                    path.join(path.resolve(), 'src'),
                    args
                      .path,
                  ),
                )
              }.js`,
              contents,
            ),
          saveTo,
        );

        return {
          contents,
          resolveDir: (await path.parseFs(args.path)).dir,
        };
      });
    },
  };
};
