import type { Nodes, } from 'mdast';

import {
  requireFrontMatterRefusal,
  splitFrontMatter,
} from './front-matter.ts';
import { requireMdxRefusal, } from './parse-mdx.ts';
import { parseSliceBody, } from './parse-slice-body.ts';
import type { DeepReadonlyData, } from './readonly-data.ts';

//region Prose mask
// Which characters of a text are prose a typography rule may rewrite: the text nodes of the page parse, and nothing else.
//
// A straight quote inside a link destination or title, a bare address or an autolink, inline code of any backtick count, a
// code block of any kind, math, an MDX expression, a tag or any attribute of it, an HTML comment or front matter is not
// prose: a rule that curls it changes what the page says (a link to another address, a title lost, code that no longer
// runs, a string literal that compiles nowhere). On 2026-09-06 the yulianNyanner page shipped exactly that for a tag, after
// the typography restoration reached a blockquoted component line for the first time; the n155 review of 2026-10-15 found
// the same for the rest of the list, which the earlier scanner of backticks and tags never read.
//
// The mask is built from the parse the page assembly runs on every slice (`parse-slice-body.ts`), so what a rule may write
// and what the page shows as text are one thing. A unit is prose when a text node of that parse covers it and the parser
// read the unit as written: a comment, a lone container tag line and a line of invisible characters are turned into spaces
// before the parse, and the spaces they became are no prose. The text of a link written between brackets is prose; the text of
// a bare address, a `www.` address or an email address is the address itself, which the parser also puts in a text node, and
// it is no prose here. The text of an element between tags is prose; the tag and its attributes are not. A text node that
// runs over several lines of a quotation covers the markers at the start of each line, units no rule rewrites.
//
// A TEXT THE PAGE PARSE REFUSES HAS NO PROSE AT ALL. No parse shows what is text there, so no rule writes anything: the page
// assembly guard withdraws a slice that breaks the parse (`corpus-run/page-assembly-guard.ts`), so a refused slice would
// not ship, and a replacement that the grammar refuses is refused by the lane before it ships.
//
// The mask is computed once per text and read by every rule, so the rules agree on what prose is instead of each carrying
// its own scanner. A text read before is answered from a short memory, since the parse costs more than the rules that read it.

/**
 A node of the tree the slice grammar reads, which it hands over read-only.
 */
type TreeNode = DeepReadonlyData<Nodes>;

/**
 A node of the tree with whether the text nodes under it are prose.
 */
type VisitedNode = {
  /**
   The node.
   */
  readonly node: TreeNode;

  /**
   Whether a text node under it is prose.
   */
  readonly prose: boolean;
};

/**
 The offsets one text node of the tree covers in the body.
 */
type ProseRange = {
  /**
   Offset where the text node starts.
   */
  readonly start: number;

  /**
   Exclusive offset where it ends.
   */
  readonly end: number;
};

/**
 What the parse of a text body says: the text the parser read and the offsets the text nodes of the tree cover.
 */
type ProseRead = {
  /**
   The body with every comment, lone container tag and invisible-only line turned into spaces of the same length.
   */
  readonly masked: string;

  /**
   The offsets of the text nodes that are prose, in the body.
   */
  readonly ranges: readonly ProseRange[];
};

/**
 How many texts the memory holds: the page pass reads each slice twice (its tally and its rewrite) and the rules read the
 rewritten text again, so a handful of the most recent texts answers nearly every question.
 */
const REMEMBERED_MASKS = 32;

/**
 The masks of the most recent texts, the oldest first. A mask is a function of its text alone, so remembering it changes no
 answer.
 */
const rememberedMasks = new Map<string, readonly boolean[]>();

/**
 Whether a link node is written between brackets, so its text is the label a reader reads and not the address itself.

 @param node - the link node

 @param masked - the text the parser read

 @returns Whether the node starts with an opening bracket; false for an autolink, a bare address and a node with no position

 @example
 ```ts
 const labelled = writesLabel({ node, masked: '[Peter](https://x.example)', },);
 ```
 */
function writesLabel(
  {
    node,
    masked,
  }: {
    readonly node: TreeNode;
    readonly masked: string;
  },
): boolean {
  /**
   Offset where the node starts, none for a node the autolink transform built.
   */
  const start = node.position
    ?.start
    .offset;
  if (start === undefined)
    return false;
  return masked.charAt(start,) === '[';
}

/**
 The text nodes of a tree that are prose, walked with a work stack rather than by recursion, since a tree is as deep as the
 nesting a page writes.

 @param root - the tree's top node

 @param masked - the text the parser read

 @returns The offsets the text nodes cover, as start and exclusive end

 @example
 ```ts
 const ranges = proseRangesOf({ root, masked: '*it’s*', },);
 ```
 */
function proseRangesOf(
  {
    root,
    masked,
  }: {
    readonly root: TreeNode;
    readonly masked: string;
  },
): readonly ProseRange[] {
  /**
   Ranges met so far.
   */
  const ranges: ProseRange[] = [];
  /**
   Nodes still to visit.
   */
  const pending: VisitedNode[] = [
    {
      node: root,
      prose: true,
    },
  ];
  // Each node in turn, until the stack is empty.
  for (let item = pending.pop(); item !== undefined; item = pending.pop()) {
    /**
     The node and whether a text node under it is prose.
     */
    const {
      node,
      prose,
    } = item;
    if ((node.type === 'text') && prose) {
      /**
       Where the parser started the text.
       */
      const start = node.position
        ?.start
        .offset;
      /**
       Where the parser ended the text.
       */
      const end = node.position
        ?.end
        .offset;
      if ((start !== undefined) && (end !== undefined)) {
        ranges.push({
          start,
          end,
        },);
      }
    }
    if ('children' in node) {
      /**
       Whether the text under the node is prose: the text of a link is, unless the address is the text.
       */
      const childrenProse = (node.type === 'link')
        ? (prose && writesLabel({
          node,
          masked,
        },))
        : prose;
      for (const child of node.children as readonly TreeNode[]) {
        pending.push({
          node: child,
          prose: childrenProse,
        },);
      }
    }
  }
  return ranges;
}

/**
 What the parse of a text body says of its prose, none when the grammar refuses the body.

 @param body - text after any front matter

 @returns The text the parser read and the prose ranges as a list of one, none when the grammar refused the body

 @throws The error of any failure that is no refusal of the grammar

 @example
 ```ts
 const [read,] = proseReadOf({ body: 'The cat’s nap.', },);
 ```
 */
function proseReadOf({ body, }: { readonly body: string; },): readonly ProseRead[] {
  try {
    /**
     The tree of the body and the text the parser read.
     */
    const {
      root,
      masked,
    } = parseSliceBody({ text: body, },);
    return [
      {
        masked,
        ranges: proseRangesOf({
          root: root as TreeNode,
          masked,
        },),
      },
    ];
  }
  catch (error) {
    // Only the grammar's own refusal says the body has no prose; anything else keeps propagating.
    requireMdxRefusal({ error, },);
    return [];
  }
}

/**
 Where the body of a text starts, past any front matter, none when the fences are there and the YAML between them refuses to
 parse (so the text has no prose that can be told).

 @param text - the whole text

 @returns Offset of the body in the text as a list of one, none when the front matter is refused

 @throws The error of any failure that is no refusal of the front matter

 @example
 ```ts
 const [offset,] = bodyOffsetOf({ text: '---\ntitle: it’s\n---\n\nBody', },); // 20
 ```
 */
function bodyOffsetOf({ text, }: { readonly text: string; },): readonly number[] {
  try {
    /**
     Where the body starts, past the front matter.
     */
    const { bodyOffset, } = splitFrontMatter({ text, },);
    return [bodyOffset,];
  }
  catch (error) {
    requireFrontMatterRefusal({ error, },);
    return [];
  }
}

/**
 Builds the mask of a text, without the memory.

 @param text - text to mask

 @returns One flag per UTF-16 unit

 @example
 ```ts
 const mask = buildMask({ text: 'a <b c="d"> e', },);
 ```
 */
function buildMask({ text, }: { readonly text: string; },): readonly boolean[] {
  /**
   Flags for the text, false until a text node of the parse covers the unit.
   */
  const mask: boolean[] = Array.from(
    { length: text.length, },
    function unmasked(): boolean {
      return false;
    },
  );
  /**
   Where the body starts: front matter is no prose.
   */
  const [bodyOffset,] = bodyOffsetOf({ text, },);
  if (bodyOffset === undefined)
    return mask;
  /**
   The body, which the offsets of the parse index.
   */
  const body = text.slice(bodyOffset,);
  /**
   What the parse says of the body.
   */
  const [read,] = proseReadOf({ body, },);
  if (read === undefined)
    return mask;
  /**
   The text the parser read, which differs from the body where a comment, a lone tag line or an invisible-only line was turned
   into spaces.
   */
  const { masked, } = read;
  for (const {
    start,
    end,
  } of read.ranges) {
    for (let index = start; index < end; index += 1) {
      /**
       The unit as written.
       */
      const written = body.charAt(index,);
      // A unit the parser read as something else than it was written (a comment, a lone tag line) is no prose.
      if (written === masked.charAt(index,))
        mask[bodyOffset + index] = true;
    }
  }
  return mask;
}

/**
 Marks each unit of a text as prose or not.

 Prose is the text the page parse shows as text: a link's label, a heading, a paragraph, a table cell, the text of an element
 between tags. A link destination or title, an address, code of any kind, math, an expression, a tag and its attributes, a
 comment and front matter are not, and a text the grammar refuses has none. The mask has one entry per UTF-16 unit of the
 text, so it indexes exactly as `charAt` does.

 @param text - text to mask

 @returns One flag per unit, true where a typography rule may write

 @example
 ```ts
 proseMask({ text: 'a <b c="d"> e', },);
 ```
 */
export function proseMask({ text, }: { readonly text: string; },): readonly boolean[] {
  /**
   The mask read before for an equal text.
   */
  const known = rememberedMasks.get(text,);
  if (known !== undefined)
    return known;
  /**
   The mask of this text.
   */
  const mask = buildMask({ text, },);
  rememberedMasks.set(
    text,
    mask,
  );
  if (rememberedMasks.size > REMEMBERED_MASKS) {
    /**
     The oldest text remembered, which goes.
     */
    const [oldest,] = rememberedMasks.keys();
    if (oldest !== undefined)
      rememberedMasks.delete(oldest,);
  }
  return mask;
}

//endregion Prose mask
