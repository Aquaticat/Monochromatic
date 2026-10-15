import type { TreeNode, } from './typography-link-text.ts';

//region Consistency markup ranges
// THE STRETCHES OF THREE KINDS OF MARKUP a parse holds, which the word test of a span edge reads apart from the prose
// (`consistency-shown-kinds.ts`, n160 Y2 and Y4): the images, which show a reader a picture between two words; the rows of tables,
// whose pipes and padding are written between the cells; and the content of inline code, which a reader sees as the code word it is.

/**
 One stretch of the English, from its start to its exclusive end.
 */
export type MarkupRange = {
  /**
   Offset where the stretch starts.
   */
  readonly start: number;

  /**
   Exclusive offset where it ends.
   */
  readonly end: number;
};

/**
 The stretches the three kinds of markup cover, each in the order the walk of the tree listed its nodes (no promise of position order).
 */
export type MarkupRanges = {
  /**
   The images (`![pic](u)`, `![pic][r]`).
   */
  readonly images: readonly MarkupRange[];

  /**
   The rows of tables.
   */
  readonly tableRows: readonly MarkupRange[];

  /**
   The content of inline code, between its backticks.
   */
  readonly codeContents: readonly MarkupRange[];
};

/**
 What a parse that was refused holds: nothing.
 */
export const NO_MARKUP_RANGES: MarkupRanges = {
  images: [],
  tableRows: [],
  codeContents: [],
};

/**
 The stretches of the nodes of some types.

 @param nodes - every node of the tree

 @param types - node types

 @returns The stretches of the nodes the parser gave a position, in the order the nodes were listed

 @example
 ```ts
 const rows = stretchesOfTypes({ nodes, types: ['tableRow',], },);
 ```
 */
function stretchesOfTypes(
  {
    nodes,
    types,
  }: {
    readonly nodes: readonly TreeNode[];
    readonly types: readonly string[];
  },
): readonly MarkupRange[] {
  return nodes
    .filter(function isOfType({ type, },): boolean {
      return types.includes(type,);
    },)
    .flatMap(function stretchOfNode({ position, },): readonly MarkupRange[] {
      /**
       Offset where the node starts, absent where the parser gave none.
       */
      const start = position
        ?.start
        .offset;
      /**
       Offset where the node ends, absent where the parser gave none.
       */
      const end = position
        ?.end
        .offset;
      return ((start === undefined) || (end === undefined))
        ? []
        : [
          {
            start,
            end,
          },
        ];
    },);
}

/**
 How many backticks a text opens with.

 @param text - the text

 @returns The count, the length of the text when it is all backticks

 @example
 ```ts
 const ticks = leadingBackticksOf({ text: '``a`b``', },); // 2
 ```
 */
function leadingBackticksOf({ text, }: { readonly text: string; },): number {
  /**
   Where the first character that is no backtick stands, none when every character is one.
   */
  const firstOther = Array.from(text,)
    .findIndex(function isNoBacktick(character,): boolean {
      return character !== '`';
    },);
  return (firstOther === (-1)) ? text.length : firstOther;
}

/**
 The content of an inline code stretch: the stretch without the backticks that open it and the same number that close it.

 @param english - the English the tree was read from

 @param range - the stretch of the whole code node, backticks included

 @returns The stretch of the content

 @example
 ```ts
 const content = codeContentOf({ english: 'a `kit` b', range: { start: 2, end: 7, }, },); // 3 to 6
 ```
 */
function codeContentOf(
  {
    english,
    range,
  }: {
    readonly english: string;
    readonly range: MarkupRange;
  },
): MarkupRange {
  /**
   How many backticks open the code, which as many close.
   */
  const ticks = leadingBackticksOf({
    text: english.slice(
      range.start,
      range.end,
    ),
  },);
  /**
   Where the content starts, never past the end of the code.
   */
  const start = Math.min(
    range.start + ticks,
    range.end,
  );
  return {
    start,
    end: Math.max(
      range.end - ticks,
      start,
    ),
  };
}

/**
 The stretches of the images, of the table rows and of the content of inline code a tree holds.

 @param english - the English the tree was read from

 @param nodes - every node of the tree

 @returns The stretches of the three kinds

 @example
 ```ts
 const { images, } = markupRangesOf({ english: 'a ![pic](u) b', nodes: [], },);
 ```
 */
export function markupRangesOf(
  {
    english,
    nodes,
  }: {
    readonly english: string;
    readonly nodes: readonly TreeNode[];
  },
): MarkupRanges {
  return {
    images: stretchesOfTypes({
      nodes,
      types: [
        'image',
        'imageReference',
      ],
    },),
    tableRows: stretchesOfTypes({
      nodes,
      types: ['tableRow',],
    },),
    codeContents: stretchesOfTypes({
      nodes,
      types: ['inlineCode',],
    },)
      .map(function contentOf(range,): MarkupRange {
        return codeContentOf({
          english,
          range,
        },);
      },),
  };
}

//endregion Consistency markup ranges
