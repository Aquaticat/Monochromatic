import { getLogger } from '@logtape/logtape';
import type { Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { pipedAsync } from 'rambdax';
import rehypeRemoveComments from 'rehype-remove-comments';
import { unified } from 'unified';
const l = getLogger(['a', 'rehype']);

export default async function rehypedHtml(html: string): Promise<string> {
  l.debug`rehypedHtml`;

  return pipedAsync(
    html,
    async (html) =>
      fromHtml(html, {
        onerror: (error) => {
          throw new Error(`${error} at ${html}`);
        },
      }),
    async (tree) => await unified().use(rehypeRemoveComments).run(tree) as Root,
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
