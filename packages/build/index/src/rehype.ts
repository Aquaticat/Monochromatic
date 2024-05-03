// import hastUtilShiki from '@monochromatic.dev/hast-util-shiki';
// import c from '@monochromatic.dev/module-console';
import type { Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { pipedAsync } from 'rambdax';
import rehypeRemoveComments from 'rehype-remove-comments';
import { unified } from 'unified';

export default async function rehypedHtml(html: string): Promise<string> {
  return pipedAsync(
    html,
    async (html) =>
      fromHtml(html, {
        onerror: (error) => {
          throw new Error(`${error} at ${html}`);
        },
      }),
    async (tree) => await unified().use(rehypeRemoveComments).run(tree) as Root,
    // FIXME: Some documents give invalid ast when this is applied, but some don't.
    // async (tree) => await hastUtilShiki(tree),
    (tree) =>
      toHtml(tree, {
        allowDangerousCharacters: true,
        allowDangerousHtml: true,
        collapseEmptyAttributes: true,
        quote: "'",
        quoteSmart: true,
      }),
    (processedHtml) => {
      if (processedHtml === '') throw new Error(`${html} processed to empty`);
      return processedHtml;
    },
  );
}
