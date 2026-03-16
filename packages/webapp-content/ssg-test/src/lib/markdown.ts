/**
 * Unified MDX processing pipeline.
 *
 * Configures the remark/rehype chain that converts raw MDX body text into
 * rendered HTML strings. Equivalent to the markdown config previously in
 * `astro.config.ts` but without any framework dependency.
 */
import rehypeShiki from '@shikijs/rehype';
import {
  transformerNotationDiff,
  transformerNotationHighlight,
} from '@shikijs/transformers';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug-custom-id';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import { remarkAlert, } from 'remark-github-blockquote-alert';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSectionize from 'remark-sectionize';
import { type Processor, unified, } from 'unified';

import type { Root, } from 'hast';

/**
 * Creates a configured unified processor for MDX-to-HTML conversion.
 *
 * Pipeline order:
 * 1. `remark-parse` -- parse markdown syntax
 * 2. `remark-mdx` -- parse MDX extensions (JSX expressions, imports)
 * 3. `remark-gfm` -- GitHub Flavored Markdown (tables, autolinks, task lists)
 * 4. `remark-github-blockquote-alert` -- `> [!NOTE]` style alerts
 * 5. `remark-sectionize` -- wrap headings in `<section>` elements
 * 6. `remark-rehype` -- convert markdown AST to HTML AST
 * 7. `rehype-slug` -- add `id` attributes to headings
 * 8. `rehype-autolink-headings` -- add anchor links to headings
 * 9. `@shikijs/rehype` -- syntax highlighting with Shiki
 * 10. `rehype-stringify` -- serialize HTML AST to string
 *
 * @returns configured unified processor (call `.process(content)` to render)
 *
 * @example
 * ```ts
 * const processor = createProcessor();
 * const result = await processor.process(mdxBodyString);
 * const html = String(result);
 * ```
 */
export function createProcessor(): Processor<Root, Root, Root, Root, string> {
  return unified()
    .use(remarkParse,)
    .use(remarkMdx,)
    .use(remarkGfm,)
    .use(remarkAlert,)
    .use(remarkSectionize,)
    .use(remarkRehype, { allowDangerousHtml: true, },)
    .use(rehypeSlug, {
      enableCustomId: true,
      maintainCase: true,
      removeAccents: true,
    },)
    .use(rehypeAutolinkHeadings,)
    .use(rehypeShiki, {
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      transformers: [transformerNotationDiff(), transformerNotationHighlight(),],
    },)
    .use(rehypeStringify, { allowDangerousHtml: true, },);
}
