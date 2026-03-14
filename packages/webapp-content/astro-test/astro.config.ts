// oxlint-disable typescript-eslint/no-unsafe-type-assertion -- adapter type is opaque
import mdx from '@astrojs/mdx';
import { createBaseConfig, } from '@monochromatic-dev/config-vite';
import {
  transformerNotationDiff,
  transformerNotationHighlight,
} from '@shikijs/transformers';
import { defineConfig, } from 'astro/config';
import { glob, } from 'glob';
import spawn from 'nano-spawn';
import { writeFile, } from 'node:fs/promises';
import { relative, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeParse from 'rehype-parse';
import rehypePresetMinify from 'rehype-preset-minify';
import rehypeSlug from 'rehype-slug-custom-id';
import rehypeStringify from 'rehype-stringify';
import { remarkAlert, } from 'remark-github-blockquote-alert';
import remarkSectionize from 'remark-sectionize';
import { read, } from 'to-vfile';
import { unified, } from 'unified';

/**
 * Creates a new object with specified keys omitted.
 *
 * @param source - Object to omit keys from
 *
 * @param keys - Keys to exclude from the result
 *
 * @returns new object without the specified keys
 */
function omit<
  const T extends object,
  const K extends keyof T,
>(
  source: T,
  ...keys: K[]
): Omit<T, K> {
  const keysSet = new Set<PropertyKey>(keys,);
  return Object.fromEntries(
    Object.entries(source,).filter(
      function notExcluded([key,],) { return !keysSet.has(key,); },
    ),
  ) as Omit<T, K>;
}

/** Base Vite config with rolldownOptions suitable for library builds. */
const baseViteConfig = createBaseConfig(import.meta.dirname,);

/**
 * Astro-specific Vite config.
 * Omits rolldownOptions from build since Astro manages its own bundling.
 */
const astroViteConfig = {
  ...baseViteConfig,
  build: omit(baseViteConfig.build!, 'rolldownOptions',),
};

// https://astro.build/config
export default defineConfig({
  site: 'https://aquati.cat',
  base: '/',

  vite: astroViteConfig,

  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      wrap: true,
      transformers: [transformerNotationDiff(), transformerNotationHighlight(),],
    },
    remarkPlugins: [[remarkAlert, {},], [remarkSectionize, {},],],
    rehypePlugins: [[rehypeSlug, {
      enableCustomId: true,
      maintainCase: true,
      removeAccents: true,
    },], [rehypeAutolinkHeadings, {},],],
  },

  integrations: [
    mdx(),
    {
      name: 'astro-rehype',
      hooks: {
        async 'astro:build:done'({ dir, logger, }): Promise<void> {
          const relativeDir = relative(process.cwd(), fileURLToPath(dir,),);
          const htmlFilePaths = await glob(`${relativeDir}/**/*.html`,);
          await Promise.all(htmlFilePaths.map(async function minifyHtml(htmlFilePath) {
            await writeFile(htmlFilePath, String(await unified()
              .use(rehypeParse,)
              .use(rehypePresetMinify,)
              .use(rehypeStringify,)
              .process(await read(htmlFilePath,),),),);
          },),);
          logger.info(`minified html files in ${relativeDir}`,);
        },
      },
    },
    {
      name: 'astro-zstd',
      hooks: {
        async 'astro:build:done'({ dir, logger, }): Promise<void> {
          const relativeDir = relative(process
            .cwd(), fileURLToPath(dir,),);
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
            ],);
            logger
              .info(`compressed dir ${relativeDir}`,);
          }
          catch (zstdError) {
            logger
              .error(String(zstdError,),);
          }
        },
      },
    },
  ],

  experimental: {
    clientPrerender: true,
    contentIntellisense: true,
  },
},);
