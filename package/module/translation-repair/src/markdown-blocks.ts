//region Markdown blocks
// TOP-LEVEL BLOCKS OF A PASSAGE, split on blank lines for the target-only run,
// which splices the archive's own text and so needs the text of each block
// rather than a parse of it.
//
// NOT A READING OF STRUCTURE. A blank-line split is not what the parser reads:
// a blockquote may open on the line after a paragraph's, and a container tag
// holds blocks of its own. The quote guard counted quotes on this split and
// refused replacements that kept every quote, so it now counts off the parse
// the floor reads (ledger B42, `quote-preservation.ts`). A question about
// what a passage's blocks ARE belongs to the parse.
//
// CARRIAGE RETURNS ARE FOLDED FIRST, and that is a measured requirement rather
// than defensiveness. Of the 184 markdown files in the pinned corpus, one uses
// CRLF throughout: `people/gqt/page.md`. A splitter looking for the two-byte
// sequence `\n\n` never finds a boundary in that file, so the whole document
// reads as ONE block, no block of it can match the source's last one, and no
// transcript in it is ever held out of translation.

/**
 Separator between top-level blocks, which is a blank line.
 */
const BLOCK_SEPARATOR = '\n\n';

/**
 Splits a passage into its top-level blocks, keeping no empty ones.

 @param text - passage to split

 @returns Its blocks, in order, each trimmed

 @example
 ```ts
 const blocks = topLevelBlocks({ text: 'One.\n\nTwo.', },);
 ```
 */
export function topLevelBlocks({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split('\r\n',)
    .join('\n',)
    .split(BLOCK_SEPARATOR,)
    .map(function trimmed(block,): string {
      return block.trim();
    },)
    .filter(function present(block,): boolean {
      return block !== '';
    },);
}

//endregion Markdown blocks
