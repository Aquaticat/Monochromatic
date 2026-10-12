import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { Nodes, } from 'mdast';

import {
  choiceTallyOf,
  type ConsistencyChoiceVoice,
} from './consistency-choice.ts';
import { compareCodePoints, } from './code-points.ts';
import { hashContent, } from './document-node.ts';
import { treeNodes, } from './mdast-tree-nodes.ts';
import {
  parseBodyTolerant,
  parseDocument,
} from './parse-document.ts';
import { wordingKey, } from './wording-key.ts';

//region Consistency carry
// CARRYING THE CHOSEN RENDERING TO A RECEIVING PLACE IS A CHOICE AMONG TEXTS.
// The place's own paragraph of English (the current text), the chosen words
// moved into it by code where that is possible (the splice), and each writer's
// rewrite of the paragraph are the candidates. They are offered to the bench
// under neutral labels in an order that depends on the text and not on who
// wrote it, so no position and no author is favoured, and a strict majority of
// the usable choices decides. This module holds what is decided without a
// model: which block of the English a span lies in, which candidates are
// distinct, in what order they are shown, and what the choices come to.

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
   The block's text.
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
 Where a parsed leaf stands in the text it was parsed from.

 @example
 ```ts
 const offsets: LeafOffsets = { from: 4, to: 28, };
 ```
 */
type LeafOffsets = {
  /**
   Offset where the leaf starts.
   */
  readonly from: number;

  /**
   Exclusive offset where it ends.
   */
  readonly to: number;
};

/**
 The offsets a parsed leaf stands at in the text it was parsed from.

 @param leaf - a node of the parsed tree

 @returns The start and the exclusive end as a list of zero or one; none for a
 node that is not a paragraph or a heading or that the parser gave no position

 @example
 ```ts
 const [offsets,] = runningTextOffsetsOf({ leaf, },);
 ```
 */
function runningTextOffsetsOf(
  { leaf, }: { readonly leaf: ForeignBorrowed<Nodes>; },
): readonly LeafOffsets[] {
  if (!RUNNING_TEXT_BLOCKS.has(leaf.type,))
    return [];
  /**
   Where the parser put the leaf.
   */
  const { position, } = leaf;
  if (position === undefined)
    return [];
  /**
   Offset where the leaf starts.
   */
  const { offset: from, } = position.start;
  /**
   Offset where the leaf ends.
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
 The innermost paragraph or heading inside a top-level block that holds a span
 whole, as a block of the English; the top-level block itself when it is a
 heading or holds no such leaf around the span.

 @param node - the top-level block of the English that holds the span

 @param english - the slice's English

 @param start - offset where the span starts

 @param end - exclusive offset where it ends

 @returns The innermost block the writer is given

 @throws Whatever `parseBodyTolerant` throws for text plain markdown refuses

 @example
 ```ts
 const block = innermostBlockOf({ node, english, start: 4, end: 7, },);
 ```
 */
function innermostBlockOf(
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
): CarryBlock {
  /**
   The top-level block as the block of the English it is.
   */
  const whole: CarryBlock = {
    start: node.startOffset,
    end: node.endOffset,
    text: node.text,
  };
  // A heading is one line of running text. A top-level "paragraph" is read again, since the document reader joins the
  // text of an HTML container's content with its closing tag into one such node, and the writer is to be given the
  // paragraph alone.
  if (node.kind === 'heading')
    return whole;
  /**
   The block read as markdown, its offsets counted from its own start.
   */
  const { root, } = parseBodyTolerant({
    body: node.text,
    bodyOffset: node.startOffset,
  },);
  /**
   The paragraphs and headings of the block that hold the span, as blocks of the English: at most one, since a paragraph or a heading holds no other.
   */
  const leaves = treeNodes({ root, },)
    .flatMap(function leafHolding(leaf: ForeignBorrowed<Nodes>,): readonly CarryBlock[] {
      return runningTextOffsetsOf({ leaf, },)
        .flatMap(function blockOf(
          {
            from,
            to,
          },
        ): readonly CarryBlock[] {
          /**
           Where the leaf starts in the English.
           */
          const leafStart = node.startOffset + from;
          /**
           Where the leaf ends in the English.
           */
          const leafEnd = node.startOffset + to;
          return ((leafStart <= start) && (end <= leafEnd))
            ? [
              {
                start: leafStart,
                end: leafEnd,
                text: english.slice(
                  leafStart,
                  leafEnd,
                ),
              },
            ]
            : [];
        },);
    },);
  return leaves[0] ?? whole;
}

/**
 The innermost body block of an English that holds a span whole: the paragraph
 or heading itself, also when a list item, a block quote or a table holds it.

 @param english - the slice's English

 @param start - offset where the span starts

 @param end - exclusive offset where it ends

 @returns The block as a list of zero or one; none where the span lies in no
 body block, in a footnote definition, or across blocks

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
  return parseDocument({ text: english, },)
    .nodes
    .filter(function holdsSpan(node,): boolean {
      return (node.zone === 'body') && (node.startOffset <= start)
        && (end <= node.endOffset);
    },)
    .slice(
      0,
      1,
    )
    .map(function blockOf(node,): CarryBlock {
      return innermostBlockOf({
        node,
        english,
        start,
        end,
      },);
    },);
}

/**
 One text a receiving place's carry chooses among, before it is labelled.
 */
type CarryOfferDraft = {
  /**
   Where the text came from.
   */
  readonly kind: 'current' | 'splice' | 'writer';

  /**
   Seats whose reply was exactly this text or its layout.
   */
  readonly writers: readonly string[];

  /**
   The paragraph.
   */
  readonly text: string;
};

/**
 One text a receiving place's carry chooses among.

 @example
 ```ts
 const offer: CarryOffer = { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'The cat naps.', };
 ```
 */
export type CarryOffer = CarryOfferDraft & {
  /**
   Label the choice sheet gives it, counted from one in sheet order.
   */
  readonly label: string;
};

/**
 The distinct texts a receiving place's carry chooses among, in the order the
 sheet shows them and under their labels.

 Two texts that publish the same page are one candidate (`wordingKey`), so a
 writer that returned the paragraph unchanged, or the splice that came out as a
 writer's text, does not split the stake of one wording. The current text wins
 the name of the candidate it joins, then the splice, then the first writer.
 The order is by a digest of the text, so it is the same on a resume and favours
 neither the current text nor any seat.

 @param current - the receiving paragraph as the English has it

 @param splice - the paragraph with the chosen words moved in by code, as a
 list of zero or one: none where that is not possible or a floor refused it

 @param written - each writer's paragraph that passed the floors, in roster order

 @param lineStructured - whether the line-structure rule governs the slice

 @returns The distinct candidates, the current text always among them

 @example
 ```ts
 const offers = carryOffersOf({ current, splice: [], written: [], lineStructured: false, },);
 ```
 */
export function carryOffersOf(
  {
    current,
    splice,
    written,
    lineStructured,
  }: {
    readonly current: string;
    readonly splice: readonly string[];
    readonly written: readonly {
      readonly seat: string;
      readonly text: string;
    }[];
    readonly lineStructured: boolean;
  },
): readonly CarryOffer[] {
  /**
   The splice as a draft, none where there is no splice.
   */
  const spliced = splice.map(function draftOfSplice(text,): CarryOfferDraft {
    return {
      kind: 'splice',
      writers: [],
      text,
    };
  },);
  /**
   Every text on offer before duplicates join, in the order they take a name.
   */
  const drafts: readonly CarryOfferDraft[] = [
    {
      kind: 'current',
      writers: [],
      text: current,
    },
    ...spliced,
    ...written.map(function draftOf({
      seat,
      text,
    },): CarryOfferDraft {
      return {
        kind: 'writer',
        writers: [seat,],
        text,
      };
    },),
  ];
  /**
   Every draft with the page its text publishes.
   */
  const keyed = drafts.map(function keyOf(draft,): {
    readonly draft: CarryOfferDraft;
    readonly key: string;
  } {
    return {
      draft,
      key: wordingKey({
        text: draft.text,
        lineStructured,
      },),
    };
  },);
  /**
   The first draft of each page, which gives the candidate its name, in order of first appearance.
   */
  const firsts = keyed.filter(function isFirstOfPage(
    entry,
    at,
  ): boolean {
    return keyed.findIndex(function samePage(other,): boolean {
      return other.key === entry.key;
    },) === at;
  },);
  return firsts
    .map(function joinedWithLater(first,): CarryOfferDraft {
      return {
        ...first.draft,
        writers: keyed
          .filter(function onSamePage(other,): boolean {
            return other.key === first.key;
          },)
          .flatMap(function writersOf({ draft, },): readonly string[] {
            return draft.writers;
          },),
      };
    },)
    .toSorted(function byDigest(
      left,
      right,
    ): number {
      return compareCodePoints({
        left: hashContent({ content: left.text, },),
        right: hashContent({ content: right.text, },),
      },);
    },)
    .map(function labelled(
      draft,
      position,
    ): CarryOffer {
      return {
        ...draft,
        label: `CANDIDATE ${String(position + 1,)}`,
      };
    },);
}

/**
 What the choices among a place's candidates decided.

 @example
 ```ts
 const choice: CarryChoice = { kind: 'none', reason: 'no-majority', };
 ```
 */
export type CarryChoice =
  | {
    /**
     A strict majority of the usable choices named a candidate.
     */
    readonly kind: 'chosen';

    /**
     Label of the candidate.
     */
    readonly label: string;
  }
  | {
    /**
     No candidate won, so the place's English stands.
     */
    readonly kind: 'none';

    /**
     Why: the usable choices missed the quorum, or no label has more than half.
     */
    readonly reason: 'no-quorum' | 'no-majority';
  };

/**
 Counts the choices among a place's candidates.

 @param voices - every heard choice with its seat

 @param labels - labels the sheet showed

 @param quorum - voices the gather closed on, which the usable choices must reach

 @returns How many choices counted and what they decided

 @example
 ```ts
 const { usable, choice, } = carryChoiceOf({ voices, labels: ['CANDIDATE 1', 'CANDIDATE 2',], quorum: 2, },);
 ```
 */
export function carryChoiceOf(
  {
    voices,
    labels,
    quorum,
  }: {
    readonly voices: readonly ConsistencyChoiceVoice[];
    readonly labels: readonly string[];
    readonly quorum: number;
  },
): {
  readonly usable: number;
  readonly choice: CarryChoice;
} {
  /**
   How many choices counted, and the candidate more than half of them named.
   */
  const {
    usable,
    chosen,
  } = choiceTallyOf({
    voices,
    labels,
  },);
  if ((usable === 0) || (usable < quorum)) {
    return {
      usable,
      choice: {
        kind: 'none',
        reason: 'no-quorum',
      },
    };
  }
  /**
   The candidate a strict majority named, if one did.
   */
  const [label,] = chosen;
  return {
    usable,
    choice: (label === undefined)
      ? {
        kind: 'none',
        reason: 'no-majority',
      }
      : {
        kind: 'chosen',
        label,
      },
  };
}

//endregion Consistency carry
