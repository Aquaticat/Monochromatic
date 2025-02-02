import mdx from '@astrojs/mdx';
import postcssCustomUnits from '@csstools/custom-units';
import {
  transformerNotationDiff,
  transformerNotationHighlight,
} from '@shikijs/transformers';
// import viteBasicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'astro/config';
import cssnanoPlugin from 'cssnano';
import { glob } from 'glob';
import spawn from 'nano-spawn';
import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcssCustomMedia from 'postcss-custom-media';
import postcssCustomSelectors from 'postcss-custom-selectors';
import postcssMixins from 'postcss-mixins';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeParse from 'rehype-parse';
import rehypePresetMinify from 'rehype-preset-minify';
import rehypeSlug from 'rehype-slug-custom-id';
import rehypeStringify from 'rehype-stringify';
import { remarkAlert } from 'remark-github-blockquote-alert';
import remarkSectionize from 'remark-sectionize';
import { read } from 'to-vfile';
import { unified } from 'unified';

// https://astro.build/config
export default defineConfig({
  site: 'https://aquati.cat',
  base: '/',

  vite: {
    plugins: [
      // bun bug https://github.com/oven-sh/bun/issues/14825, commented out for now.
      // viteBasicSsl({}),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./', import.meta.url)),
        '@_': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      postcss: {
        plugins: [
          postcssMixins(),
          postcssCustomUnits(),
          postcssCustomMedia(),
          postcssCustomSelectors(),
          cssnanoPlugin({
            preset: ['advanced', {
              autoprefixer: undefined,
              discardUnused: false,
              reduceIdents: false,
              svgo: false,
              zindex: false,
            }],
          }),
        ],
      },
      preprocessorMaxWorkers: true,
    },
    esbuild: {
      minifyIdentifiers: false,
    },
    build: {
      target: 'firefox128',
    },
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      wrap: true,
      transformers: [transformerNotationDiff(), transformerNotationHighlight()],
    },
    remarkPlugins: [[remarkAlert, {}], [remarkSectionize, {}]],
    rehypePlugins: [[rehypeSlug, {
      enableCustomId: true,
      maintainCase: true,
      removeAccents: true,
    }], [rehypeAutolinkHeadings, {}]],
    // remarkRehype: { allowDangerousHtml: true },
  },

  /*   i18n: {
    locales: [
      {
        path: 'en',
        codes: ['en', 'en-CA', 'en-US'],
      },
      {
        path: 'zh',
        codes: ['zh', 'zh-CN'],
      },
    ],
    defaultLocale: 'en',
    fallback: {
      zh: 'en',
    },
    routing: 'manual',
  }, */

  integrations: [
    mdx(),
    {
      name: 'astro-rehype',
      hooks: {
        'astro:build:done': async ({ dir, logger }) => {
          const relativeDir = relative(process.cwd(), fileURLToPath(dir));
          const htmlFilePaths = await glob(`${relativeDir}/**/*.html`);
          htmlFilePaths.forEach(async (htmlFilePath) => {
            await writeFile(htmlFilePath, String(await unified()
              .use(rehypeParse)
              .use(rehypePresetMinify)
              .use(rehypeStringify)
              .process(await read(htmlFilePath))));
          });
          logger.info(`minified html files in ${relativeDir}`);
        },
      },
    },
    {
      name: 'astro-zstd',
      hooks: {
        'astro:build:done': async ({ dir, logger }) => {
          const relativeDir = relative(process
            .cwd(), fileURLToPath(dir));
          try {
            await spawn('zstd', [
              '-z',
              '-f',
              '-v',
              '--no-check',
              '-T0',
              '--exclude-compressed',
              '--no-content-size',
              '-r',
              '--adapt',
              relativeDir,
            ]);
            logger
              .info(`compressed dir ${relativeDir}`);
          } catch (zstdError) {
            logger
              .error(String(zstdError));
          }
        },
      },
    },
  ],

  experimental: {
    svg: true,
  },
});
