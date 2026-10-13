import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { Nodes, } from 'mdast';

import { treeNodes, } from './mdast-tree-nodes.ts';
import {
  parseBodyTolerant,
  parseDocument,
} from './parse-document.ts';

//region Consistency carry standing
// WHERE A SPAN OF THE ENGLISH STANDS AMONG ITS BLOCKS, decided without a model.
// A rewrite of a receiving place's paragraph needs the paragraph or heading
// that holds the place's words, whole. Words in a table, a fenced code block or
// a setext heading have no such paragraph: a rewrite of "the paragraph" would
// have to write the table's cells, the fence or the underline too, so only the
// code splice can carry words there, and the standing names which of the three
// kinds holds them. Words in no body block, in a footnote definition or across
// blocks have no block and no kind.

/**
 A body block of an English: the paragraph a receiving place's span lies in.

 @example
 ```ts
 const block: CarryBlock = { start: 0, end: 13, text: 'The cat naps.', };
 ```
 */
export type CarryBlock = {
  /**
   Offset in the English where the block starts.
   */
  readonly start: number;

  /**
   Exclusive offset where it ends.
   */
  readonly end: number;

  /**
   The block's text, cut from the English as written. For a paragraph inside a
   block quote that runs over several lines, the first line carries no `> `
   marker, since the parser puts the paragraph's start after the marker that
   opens it, while every later line keeps its own marker, since they lie
   inside the cut.
   */
  readonly text: string;
};

/**
 Kinds of node a writer rewrites: the leaf blocks that hold running text. A
 list, a block quote or a table around one is only where it stands.
 */
const RUNNING_TEXT_BLOCKS: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
],);

/**
 Where a parsed node stands in the text it was parsed from.

 @example
 ```ts
 const offsets: LeafOffsets = { from: 4, to: 28, };
 ```
 */
type LeafOffsets = {
  /**
   Offset where the node starts.
   */
  readonly from: number;

  /**
   Exclusive offset where it ends.
   */
  readonly to: number;
};

/**
 The offsets a parsed node stands at in the text it was parsed from.

 @param leaf - a node of the parsed tree

 @returns The start and the exclusive end as a list of zero or one; none for a
 node that the parser gave no position

 @example
 ```ts
 const [offsets,] = leafOffsetsOf({ leaf, },);
 ```
 */
function leafOffsetsOf(
  { leaf, }: { readonly leaf: ForeignBorrowed<Nodes>; },
): readonly LeafOffsets[] {
  /**
   Where the parser put the node.
   */
  const { position, } = leaf;
  if (position === undefined)
    return [];
  /**
   Offset where the node starts.
   */
  const { offset: from, } = position.start;
  /**
   Offset where the node ends.
   */
  const { offset: to, } = position.end;
  return ((from === undefined) || (to === undefined))
    ? []
    : [
      {
        from,
        to,
      },
    ];
}

/**
 A kind of block a span can stand in where no paragraph rewrite can carry words
 to it, named as a reader of a finding says it.
 */
export type SpliceOnlyKind = 'table' | 'code block' | 'setext heading';

/**
 Where a span of the English stands among its blocks.

 @example
 ```ts
 const standing: BlockStanding = { block: [], spliceOnlyIn: ['table',], };
 ```
 */
export type BlockStanding = {
  /**
   The block a writer is given, as a list of zero or one: none where the span
   lies in no body block, in a footnote definition, in a table, a code block
   or a setext heading.
   */
  readonly block: readonly CarryBlock[];

  /**
   The kind of block the span stands in where only a splice can carry words,
   as a list of zero or one.
   */
  readonly spliceOnlyIn: readonly SpliceOnlyKind[];
};

/**
 A node of the parsed tree that holds a span whole, with where it stands in the
 English.

 @example
 ```ts
 const holder: SpanHolder = { type: 'paragraph', start: 4, end: 28, };
 ```
 */
type SpanHolder = {
  /**
   The mdast type of the node.
   */
  readonly type: string;

  /**
   Offset in the English where the node starts.
   */
  readonly start: number;

  /**
   Exclusive offset where it ends.
   */
  readonly end: number;
};

/**
 The kind a node of the parsed tree is where no paragraph rewrite can carry
 words into it.

 A setext heading is a heading whose text does not open with `#`: its text
 spans lines and its underline is part of the node, so a rewrite of "the
 paragraph" would have to write the underline too.

 @param type - the mdast type of the node

 @param text - the node's text in the English

 @returns The kind as a list of zero or one; none for a node a writer can rewrite or that holds no running text

 @example
 ```ts
 const [kind,] = spliceOnlyKindOf({ type: 'table', text: '| a |', },); // 'table'
 ```
 */
function spliceOnlyKindOf(
  {
    type,
    text,
  }: {
    readonly type: string;
    readonly text: string;
  },
): readonly SpliceOnlyKind[] {
  if (type === 'table')
    return ['table',];
  if (type === 'code')
    return ['code block',];
  if (type !== 'heading')
    return [];
  /**
   Whether the heading opens with the mark of an ATX heading.
   */
  const isAtx = text
    .trimStart()
    .startsWith('#',);
  return isAtx ? [] : ['setext heading',];
}

/**
 Where a span stands inside a top-level block that holds it whole: in the
 innermost paragraph or ATX heading around it, as a block of the English; in a
 table, a code block or a setext heading, which no paragraph rewrite can carry
 words into; or, when the block holds no such leaf around the span, in the
 top-level block itself.

 A heading at the top is one line of running text when it is ATX. A top-level
 "paragraph" is read again, since the document reader joins the text of an HTML
 container's content with its closing tag into one such node, and the writer is
 to be given the paragraph alone.

 @param node - the top-level block of the English that holds the span

 @param english - the slice's English

 @param start - offset where the span starts

 @param end - exclusive offset where it ends

 @returns Where the span stands

 @throws Whatever `parseBodyTolerant` throws for text plain markdown refuses

 @example
 ```ts
 const standing = standingIn({ node, english, start: 4, end: 7, },);
 ```
 */
function standingIn(
  {
    node,
    english,
    start,
    end,
  }: {
    readonly node: {
      readonly kind: string;
      readonly text: string;
      readonly startOffset: number;
      readonly endOffset: number;
    };
    readonly english: string;
    readonly start: number;
    readonly end: number;
  },
): BlockStanding {
  /**
   The top-level block as the block of the English it is.
   */
  const whole: CarryBlock = {
    start: node.startOffset,
    end: node.endOffset,
    text: node.text,
  };
  /**
   The kind the top-level node is itself, where it is one a rewrite cannot carry words into.
   */
  const topKind = spliceOnlyKindOf({
    type: node.kind,
    text: node.text,
  },);
  if (topKind.length > 0) {
    return {
      block: [],
      spliceOnlyIn: topKind,
    };
  }
  if (node.kind === 'heading') {
    return {
      block: [whole,],
      spliceOnlyIn: [],
    };
  }
  /**
   The block read as markdown, its offsets counted from its own start.
   */
  const { root, } = parseBodyTolerant({
    body: node.text,
    bodyOffset: node.startOffset,
  },);
  /**
   Every node of the block that holds the span whole, outermost first.
   */
  const holders = treeNodes({ root, },)
    .flatMap(function holderOf(leaf: ForeignBorrowed<Nodes>,): readonly SpanHolder[] {
      return leafOffsetsOf({ leaf, },)
        .flatMap(function holdingSpan(
          {
            from,
            to,
          },
        ): readonly SpanHolder[] {
          return (((node.startOffset + from) <= start) && (end <= (node.startOffset + to)))
            ? [
              {
                type: leaf.type,
                start: node.startOffset + from,
                end: node.startOffset + to,
              },
            ]
            : [];
        },);
    },);
  /**
   The first holder that a rewrite cannot carry words into, none when there is no such holder.
   */
  const [spliceOnly,] = holders.flatMap(function kindOfHolder(holder,): readonly SpliceOnlyKind[] {
    return spliceOnlyKindOf({
      type: holder.type,
      text: english.slice(
        holder.start,
        holder.end,
      ),
    },);
  },);
  if (spliceOnly !== undefined) {
    return {
      block: [],
      spliceOnlyIn: [spliceOnly,],
    };
  }
  /**
   The paragraphs and headings that hold the span, as blocks of the English: at most one, since a paragraph or a heading holds no other.
   */
  const [leaf,] = holders.filter(function isRunningText({ type, },): boolean {
    return RUNNING_TEXT_BLOCKS.has(type,);
  },);
  return {
    block: [
      (leaf === undefined)
        ? whole
        : {
          start: leaf.start,
          end: leaf.end,
          text: english.slice(
            leaf.start,
            leaf.end,
          ),
        },
    ],
    spliceOnlyIn: [],
  };
}

/**
 Where a span of an English stands among its body blocks.

 @param english - the slice's English

 @param start - offset where the span starts

 @param end - exclusive offset where it ends

 @returns The innermost block that holds the span whole, the paragraph or the
 ATX heading itself, also when a list item or a block quote holds it (the text
 of a multi-line paragraph in a block quote has no `> ` marker on its first
 line, since the paragraph starts after the marker, and keeps the marker of
 every later line); the kind of block where a table, a code block or a setext
 heading holds it, and no block then; no block and no kind where the span lies
 in no body block, in a footnote definition, or across blocks

 @throws Whatever `parseDocument` throws for text the shared grammar and the front-matter reader refuse, and whatever the plain markdown reader throws for a container it cannot read, which the pass contains

 @example
 ```ts
 const { block, spliceOnlyIn, } = blockStandingOf({ english: 'The cat naps.\n\nThe fish swims.', start: 4, end: 7, },);
 ```
 */
export function blockStandingOf(
  {
    english,
    start,
    end,
  }: {
    readonly english: string;
    readonly start: number;
    readonly end: number;
  },
): BlockStanding {
  /**
   The top-level body block that holds the span, as a list of zero or one.
   */
  const standings = parseDocument({ text: english, },)
    .nodes
    .filter(function holdsSpan(node,): boolean {
      return (node.zone === 'body') && (node.startOffset <= start)
        && (end <= node.endOffset);
    },)
    .slice(
      0,
      1,
    )
    .map(function standingOf(node,): BlockStanding {
      return standingIn({
        node,
        english,
        start,
        end,
      },);
    },);
  return standings[0] ?? {
    block: [],
    spliceOnlyIn: [],
  };
}

/**
 The innermost body block of an English that holds a span whole: the paragraph
 or heading itself, also when a list item, a block quote or a table holds it.

 @param english - the slice's English

 @param start - offset where the span starts

 @param end - exclusive offset where it ends

 @returns The block as a list of zero or one; none where the span lies in no
 body block, in a footnote definition, in a table, a code block or a setext
 heading, or across blocks

 @throws Whatever `parseDocument` throws for text the shared grammar and the front-matter reader refuse, and whatever the plain markdown reader throws for a container it cannot read, which the pass contains

 @example
 ```ts
 const [block,] = blockHolding({ english: 'The cat naps.\n\nThe fish swims.', start: 4, end: 7, },);
 ```
 */
export function blockHolding(
  {
    english,
    start,
    end,
  }: {
    readonly english: string;
    readonly start: number;
    readonly end: number;
  },
): readonly CarryBlock[] {
  /**
   Where the span stands.
   */
  const { block, } = blockStandingOf({
    english,
    start,
    end,
  },);
  return block;
}

//endregion Consistency carry standing
