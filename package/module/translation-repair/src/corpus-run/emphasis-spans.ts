import type { Nodes, } from 'mdast';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { maskHtmlComments, } from '../mask-html-comments.ts';
import { treeNodes, } from '../mdast-tree-nodes.ts';
import { parseBodyTolerant, } from '../parse-document.ts';

//region Emphasis spans
// Where a text sets words in italics, read off the parse (ledger B72). The
// italic-title pass read the archive's italics by splitting each line at its
// stars, which took words inside an HTML comment or an MDX expression for
// italics, took the first line of a span across two lines for a span of its
// own, and never saw a linked title or one set with underscores; and it wrote a
// quoted title in italics inside an italic span, where it shows no different
// from the words around it.
//
// COMMENTS ARE MASKED to blanks of the same length first, as `parse-slice-body.ts`
// does, so no offset moves and no comment's words are read. THE PARSE IS THE
// TOLERANT ONE the document reader uses: strict MDX first, plain Markdown where
// the strict grammar refuses a text. Its downgrade finding is not carried,
// since inline emphasis follows the same rules in both grammars; what they read
// differently lies in JSX and expressions, which the italic pass already leaves
// alone (`prose-ranges.ts`), and every archive at the pin parses strictly.

/**
 One italic span of a text.
 */
export type EmphasisSpan = {
  /**
   First unit of the span, its opening delimiter included.
   */
  readonly start: number;

  /**
   First unit after its closing delimiter.
   */
  readonly end: number;

  /**
   Words it sets in italics, every whitespace run read as one space.
   */
  readonly words: string;
};

/**
 Words with every whitespace run read as one space.

 @param text - words as written

 @returns Words on one line

 @example
 ```ts
 oneLine({ text: 'Long:\nNap', },); // 'Long: Nap'
 ```
 */
export function oneLine({ text, }: { readonly text: string; },): string {
  return text
    .replaceAll(
      '\n',
      ' ',
    )
    .split(' ',)
    .filter(function hasWords(piece,): boolean {
      return piece.length > 0;
    },)
    .join(' ',);
}

/**
 Words a node shows, in document order: its text and code, a hard break read
 as a line break.

 @param node - node whose words are wanted

 @returns Words as the node holds them

 @example
 ```ts
 wordsOf({ node: emphasisNode, },); // 'Long Nap'
 ```
 */
function wordsOf({ node, }: { readonly node: Nodes; },): string {
  /**
   Words met so far, in document order.
   */
  const pieces: string[] = [];
  /**
   Nodes still to read, the next one last.
   */
  const pending: Nodes[] = [node,];
  // Each node in document order: children go on reversed, so the first pops first.
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if ((next.type === 'text') || (next.type === 'inlineCode'))
      pieces.push(next.value,);
    if (next.type === 'break')
      pieces.push('\n',);
    if ('children' in next)
      pending.push(...(next.children as readonly Nodes[]).toReversed(),);
  }
  return pieces.join('',);
}

/**
 Every span a text sets in italics, nested ones included.

 @param text - text as the page or archive carries it

 @returns Italic spans, with offsets into that text

 @example
 ```ts
 emphasisSpans({ text: 'She loved *Long Nap*.', },); // [{ start: 10, end: 20, words: 'Long Nap' }]
 ```
 */
export function emphasisSpans({ text, }: { readonly text: string; },): readonly EmphasisSpan[] {
  /**
   Text with its comments blanked, each blank as long as its comment.
   */
  const { masked, } = maskHtmlComments({ text, },);
  /**
   Tree of that text.
   */
  const { root, } = parseBodyTolerant({
    body: masked,
    bodyOffset: 0,
  },);
  return treeNodes({ root, },)
    .flatMap(function toSpan(node,): readonly EmphasisSpan[] {
      if (node.type !== 'emphasis')
        return [];
      return [{
        start: nonNullishOrThrow(node.position
          ?.start
          .offset,),
        end: nonNullishOrThrow(node.position
          ?.end
          .offset,),
        words: oneLine({ text: wordsOf({ node, },), },),
      },];
    },);
}

//endregion Emphasis spans
