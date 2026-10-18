import {
  isLinkNode,
  type LinkLabelKind,
  linkLabelKindOf,
} from './consistency-link-label.ts';
import type { TreeNode, } from '@monochromatic-dev/translation-repair-typography/ts';

//region Consistency markup ranges
// THE STRETCHES OF FIVE KINDS OF MARKUP a parse holds, which the word test of a span edge reads apart from the prose
// (`consistency-shown-kinds.ts`, n160 Y2 and Y4): the images, which show a reader a picture between two words; the rows of tables,
// whose pipes and padding are written between the cells; and the content of inline code, which a reader sees as the code word it is.
// The other two kinds are read by the fold of the consistency pass (`consistency-folded-links.ts`, n168): the links, references and
// images whose label shows nothing, and those whose label shows marks and spaces and no letter or digit (`consistency-link-label.ts`).

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

  /**
   The links, link references, images and image references whose label shows nothing (`[](u)`, `[](u "t")`, `[]()`, `[][r]`,
   `![](u)`), each from its first mark to its last.
   */
  readonly emptyLinks: readonly MarkupRange[];

  /**
   The links and images whose label shows marks and spaces, no letter or digit, and no closing bracket or quotation mark last
   (`[ ](u)`, `[-](u)`).
   */
  readonly markOnlyLinks: readonly MarkupRange[];

  /**
   The links and images whose label shows closing round or square brackets and closing curly double quotation marks and nothing
   else (`[\]](u)`, `[”](u)`), each from its first mark to its last.
   */
  readonly closingLinks: readonly MarkupRange[];

  /**
   The resource of every link, reference and image: from the end of the label of a link or reference to its end, and the whole of an
   image. A line break inside one is part of the markup and shows a reader nothing.
   */
  readonly linkResources: readonly MarkupRange[];

  /**
   The links and references, not the images, whose label shows letters or digits or marks, a closing mark last among them or not
   (`[kit](u)`, `[-](u)`, `[kit][r]`), each with the opening bracket it is written with and its resource (n173).
   */
  readonly labelledLinks: readonly LabelledLink[];
};

/**
 The two stretches of a link with a label that show a reader nothing, around the label that they show.
 */
export type LabelledLink = {
  /**
   The opening square bracket, before the label.
   */
  readonly opener: MarkupRange;

  /**
   The resource, from the end of the label to the end of the link: the closing bracket and the destination, the title or the
   reference.
   */
  readonly resource: MarkupRange;
};

/**
 What a parse that was refused holds: nothing.
 */
export const NO_MARKUP_RANGES: MarkupRanges = {
  images: [],
  tableRows: [],
  codeContents: [],
  emptyLinks: [],
  markOnlyLinks: [],
  closingLinks: [],
  linkResources: [],
  labelledLinks: [],
};

/**
 The stretches of some nodes.

 @param nodes - nodes of the tree

 @returns The stretches of the nodes the parser gave a position, in the order the nodes were listed

 @example
 ```ts
 const rows = stretchesOfNodes({ nodes: rowNodes, },);
 ```
 */
function stretchesOfNodes({ nodes, }: { readonly nodes: readonly TreeNode[]; },): readonly MarkupRange[] {
  return nodes
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
  return stretchesOfNodes({
    nodes: nodes.filter(function isOfType({ type, },): boolean {
      return types.includes(type,);
    },),
  },);
}

/**
 The stretches of the resources of the links, references and images of a tree: for a link or a reference, from the end of its label
 to its end (the closing bracket, the destination and the title, or the reference), and for an image the whole of it, since an image
 shows a reader a picture and not its alt text. A link whose label has a child the parser gave no position is left out, since where
 its label ends is then unknown.

 @param nodes - every node of the tree

 @returns The stretches, in the order the nodes were listed

 @example
 ```ts
 const resources = linkResourcesOf({ nodes, },);
 ```
 */
function linkResourcesOf({ nodes, }: { readonly nodes: readonly TreeNode[]; },): readonly MarkupRange[] {
  return nodes
    .filter(function isLink(node,): boolean {
      return isLinkNode({ node, },);
    },)
    .flatMap(function resourceOfLink(node,): readonly MarkupRange[] {
      /**
       Offset where the node starts, absent where the parser gave none.
       */
      const start = node.position
        ?.start
        .offset;
      /**
       Offset where the node ends, absent where the parser gave none.
       */
      const end = node.position
        ?.end
        .offset;
      if ((start === undefined) || (end === undefined))
        return [];
      if ((node.type === 'image') || (node.type === 'imageReference')) {
        return [
          {
            start,
            end,
          },
        ];
      }
      /**
       The children of the label, none for an empty label.
       */
      const children = ('children' in node ? (node.children as readonly TreeNode[]) : []);
      /**
       The last child of the label.
       */
      const lastChild = children.at(-1,);
      /**
       Offset where the label ends, the opening bracket's end for an empty label, absent where the last child has no position.
       */
      const labelEnd = (lastChild === undefined)
        ? start + 1
        : lastChild.position
          ?.end
          .offset;
      return ((labelEnd === undefined) || (labelEnd > end))
        ? []
        : [
          {
            start: labelEnd,
            end,
          },
        ];
    },);
}

/**
 The kinds of label that show a reader something to read between the brackets: a word or a digit, or marks that close nothing.
 */
const LABELLED_KINDS: ReadonlySet<LinkLabelKind> = new Set<LinkLabelKind>([
  'marks',
  'other',
],);

/**
 The links and references of a tree whose label shows letters or digits or marks, with the two stretches of each that show a reader
 nothing: the opening square bracket and the resource (n173). A link whose label shows nothing is read whole as an empty link and one
 whose label shows closing marks alone as a closing link, so neither is listed; an image is hidden whole, so it is not either. A link
 that does not begin with a square bracket (`<https://u>`) is left out, and so is one whose resource cannot be placed.

 @param english - the English the tree was read from, which tells a link written with square brackets from an autolink

 @param nodes - every node of the tree

 @returns The links, in the order the nodes were listed

 @example
 ```ts
 const [link,] = labelledLinksOf({ english: '[kit](u)', nodes, },); // opener 0 to 1, resource 4 to 8
 ```
 */
function labelledLinksOf(
  {
    english,
    nodes,
  }: {
    readonly english: string;
    readonly nodes: readonly TreeNode[];
  },
): readonly LabelledLink[] {
  return nodes
    .filter(function showsLabel(node,): boolean {
      return ((node.type === 'link') || (node.type === 'linkReference'))
        && LABELLED_KINDS.has(linkLabelKindOf({ node, },),);
    },)
    .flatMap(function partsOfLink(node,): readonly LabelledLink[] {
      /**
       Offset where the node starts, absent where the parser gave none.
       */
      const start = node.position
        ?.start
        .offset;
      /**
       The resource of the link, absent where the parser gave no position.
       */
      const [resource,] = linkResourcesOf({ nodes: [node,], },);
      if ((start === undefined) || (resource === undefined))
        return [];
      // A link that does not begin with a square bracket (an autolink) has no opening bracket to hide.
      if (english.charAt(start,) !== '[')
        return [];
      return [
        {
          opener: {
            start,
            end: start + 1,
          },
          resource,
        },
      ];
    },);
}

/**
 The stretches of the links, references and images whose label shows a given kind of text.

 @param nodes - every node of the tree

 @param kind - what the label shows

 @returns The stretches of the links the parser gave a position, in the order the nodes were listed

 @example
 ```ts
 const empty = stretchesOfLabelsShowing({ nodes, kind: 'empty', },);
 ```
 */
function stretchesOfLabelsShowing(
  {
    nodes,
    kind,
  }: {
    readonly nodes: readonly TreeNode[];
    readonly kind: LinkLabelKind;
  },
): readonly MarkupRange[] {
  return stretchesOfNodes({
    nodes: nodes.filter(function showsKind(node,): boolean {
      return isLinkNode({ node, },) && (linkLabelKindOf({ node, },) === kind);
    },),
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
 The content of an inline code stretch as CommonMark shows it: the stretch without the backticks that open it and the same number that
 close it, and without one space on each side when the content begins and ends with a space and is not all spaces (the padding that
 lets code begin or end with a backtick). Where only one side holds a space, or the content is spaces alone, every space is shown.

 @param english - the English the tree was read from

 @param range - the stretch of the whole code node, backticks included

 @returns The stretch of the content

 @example
 ```ts
 const content = codeContentOf({ english: 'a `kit` b', range: { start: 2, end: 7, }, },); // 3 to 6
 const padded = codeContentOf({ english: 'a ` kit ` b', range: { start: 2, end: 9, }, },); // 4 to 7
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
  /**
   Where the content ends, never before where it starts.
   */
  const end = Math.max(
    range.end - ticks,
    start,
  );
  /**
   The content between the backticks, as written.
   */
  const written = english.slice(
    start,
    end,
  );
  /**
   Whether the content begins and ends with a space.
   */
  const bothEndsSpaced = written.startsWith(' ',) && written.endsWith(' ',);
  /**
   Whether the content holds a character that is no space.
   */
  const holdsNoSpace = Array.from(written,)
    .some(function isNoSpace(character,): boolean {
      return character !== ' ';
    },);
  /**
   Whether one space pads each side: both ends are spaces and the content holds a character that is no space.
   */
  const padded = bothEndsSpaced && holdsNoSpace;
  return padded
    ? {
      start: start + 1,
      end: end - 1,
    }
    : {
      start,
      end,
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
    emptyLinks: stretchesOfLabelsShowing({
      nodes,
      kind: 'empty',
    },),
    markOnlyLinks: stretchesOfLabelsShowing({
      nodes,
      kind: 'marks',
    },),
    closingLinks: stretchesOfLabelsShowing({
      nodes,
      kind: 'closing',
    },),
    linkResources: linkResourcesOf({ nodes, },),
    labelledLinks: labelledLinksOf({
      english,
      nodes,
    },),
  };
}

//endregion Consistency markup ranges
