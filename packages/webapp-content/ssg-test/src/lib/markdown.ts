/**
 * Unified MDX processing pipeline.
 *
 * Configures the remark/rehype chain that converts raw MDX body text into
 * rendered HTML strings. Equivalent to the markdown config previously in
 * `astro.config.ts` but without any framework dependency.
 *
 * Syntax highlighting is handled client-side via the CSS Custom Highlight API
 * with Lezer parsers. The pipeline outputs plain `<pre><code class="language-xxx">`
 * blocks that the client script picks up.
 */
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug-custom-id';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import { remarkAlert, } from 'remark-github-blockquote-alert';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSectionize from 'remark-sectionize';
import {
  type Processor,
  unified,
} from 'unified';

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
 * 9. `rehype-stringify` -- serialize HTML AST to string
 *
 * Syntax highlighting happens client-side via the CSS Custom Highlight API.
 * Fenced code blocks produce `<pre><code class="language-xxx">` elements
 * that the client highlight script processes with Lezer parsers.
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
    // Content is trusted filesystem input authored by the site owner,
    // not user-submitted data, so allowing raw HTML is safe here.
    .use(
      remarkRehype,
      { allowDangerousHtml: true, },
    )
    .use(
      rehypeSlug,
      {
        enableCustomId: true,
        maintainCase: true,
        removeAccents: true,
      },
    )
    .use(rehypeAutolinkHeadings,)
    .use(
      rehypeStringify,
      { allowDangerousHtml: true, },
    ); // see remark-rehype comment above
}
