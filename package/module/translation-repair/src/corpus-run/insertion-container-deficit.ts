import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import {
  type ContainerHalfPair,
  containerHalfPairs,
} from '../container-half-pairs.ts';
import { maskLoneContainerTags, } from '../mask-container-tags.ts';
import { maskHtmlComments, } from '../mask-html-comments.ts';
import type { InsertionCoverageRow, } from './insertion-coverage-model.ts';

//region Insertion container deficit
// A CONTAINER THE ARCHIVE CARRIES SHORT OF BLOCKS. The whole-page budget
// corroborates an absent verdict by the page's size, and on a page whose
// translated part runs long it has nothing to spend: XingZ611 (2026-09-19)
// read the memorial disclosure block's third paragraph absent by a majority
// and refused it on an interior budget of zero, so it shipped as a recorded
// gap. The archive's block is a rendering of another revision of that
// memorial, three paragraphs where the original writes four, and the block's
// own shape is the deterministic second signal the budget could not give:
// inside one container the original has more blocks than the archive
// renders, so at least that many source blocks have no rendering of their
// own. An absent verdict inside such a container is admitted while the
// deficit lasts, in document order. A container the archive carries with as
// many blocks as the original admits nothing here: a merged rendering is
// what the roster's carried verdicts are for.
// THE DEFICIT DECIDES A SPLIT TOO (class sixty-nine, XingZ618, 2026-09-19):
// the rule first admitted absent verdicts alone, and the same third
// paragraph split on its next run, one voice anchoring a claim on an
// archive sentence the pairing never assigned, and stayed unresolved. A
// minority anchored claim is no majority, and a block the archive
// measurably lacks is the second signal; where a majority found the
// passage carried, the row stays out. The shape of class sixty in the tail.

/**
 Finding prefix an admitted passage is recorded under.

 @example
 ```ts
 findings.some((finding) => finding.startsWith(CONTAINER_DEFICIT_ADMITTED_FINDING));
 ```
 */
export const CONTAINER_DEFICIT_ADMITTED_FINDING: string = 'insertion-container-deficit-admitted';

/**
 Finding prefix a split verdict the deficit decided is recorded under.

 @example
 ```ts
 findings.some((finding) => finding.startsWith(SPLIT_IN_CONTAINER_DEFICIT_FINDING));
 ```
 */
export const SPLIT_IN_CONTAINER_DEFICIT_FINDING: string = 'insertion-split-in-container-deficit';

/**
 Not found, as `indexOf` reports it.
 */
const NOT_FOUND = -1;

/**
 Which part of a container a slice is.
 */
type ContainerRole = 'open' | 'close' | 'inside';

/**
 One container both of whose halves the archive carries, with the blocks
 each side writes inside it.
 */
type CarriedContainer = {
  /**
   Halves in their slices.
   */
  readonly pair: ContainerHalfPair;

  /**
   Blocks the original writes inside the container.
   */
  readonly sourceBlocks: number;

  /**
   Blocks the archive writes inside it.
   */
  readonly targetBlocks: number;
};

/**
 Counts blank-line separated blocks in text whose lone tags and comments are
 already blanked.

 @param text - masked text of one side of one slice

 @returns Blocks, one per run of non-blank lines

 @example
 ```ts
 const blocks = countBlocks({ text: 'a\n\nb\n', },); // 2
 ```
 */
function countBlocks({ text, }: { readonly text: string; },): number {
  /**
   Whether the line before was blank, so a non-blank line opens a block.
   */
  let afterBlank = true;
  /**
   Blocks opened so far.
   */
  let blocks = 0;
  for (const line of text.split('\n',)) {
    /**
     Whether this line carries anything.
     */
    const filled = line.trim() !== '';
    /**
     Whether this line opens a block.
     */
    const opens = afterBlank && filled;
    if (opens)
      blocks += 1;
    afterBlank = !filled;
  }
  return blocks;
}

/**
 Text of one side of one slice with comments and lone container tags
 blanked, cut to the part inside the container: after the opening tag in the
 opening half, before the closing tag in the closing half.

 @param text - side text as written

 @param name - element name of the container

 @param role - which half this slice is, or a whole slice inside

 @returns Masked text inside the container

 @example
 ```ts
 const inside = insideContainer({ text, name: 'details', role: 'open', },);
 ```
 */
function insideContainer(
  {
    text,
    name,
    role,
  }: {
    readonly text: string;
    readonly name: string;
    readonly role: ContainerRole;
  },
): string {
  /**
   Text with comments blanked, so a tag in a comment is not structure.
   */
  const { masked: uncommented, } = maskHtmlComments({ text, },);
  /**
   Lone tags of this side, and the text with them blanked.
   */
  const {
    masked,
    tags,
  } = maskLoneContainerTags({ text: uncommented, },);
  if (role === 'inside')
    return masked;
  /**
   Tag of the container on this side, if this side writes it.
   */
  const tag = tags.find(function ofContainer(candidate,): boolean {
    return (candidate.kind === role) && (candidate.name === name);
  },);
  if (tag === undefined)
    return masked;
  /**
   Tag exactly as written.
   */
  const written = tag.text;
  /**
   Where the tag stands in the unmasked text; the mask keeps every offset.
   */
  const at = (role === 'open')
    ? uncommented.indexOf(written,)
    : uncommented.lastIndexOf(written,);
  if (at === NOT_FOUND)
    return masked;
  if (role === 'open')
    return masked.slice(at + written.length,);
  return masked.slice(
    0,
    at,
  );
}

/**
 Role of the slice at one offset inside a container of `count` slices.

 @param offset - position from the opening half

 @param count - slices from the opening half through the closing half

 @returns Which part of the container the slice is

 @example
 ```ts
 const role = roleAt({ offset: 0, count: 4, },); // 'open'
 ```
 */
function roleAt(
  {
    offset,
    count,
  }: {
    readonly offset: number;
    readonly count: number;
  },
): ContainerRole {
  if (offset === 0)
    return 'open';
  return (offset === (count - 1)) ? 'close' : 'inside';
}

/**
 Blocks one side writes inside a container, summed over its slices.

 @param texts - side text of every slice from the opening half through the closing half, empty where the side has none

 @param name - element name of the container

 @returns Blocks inside the container on that side

 @example
 ```ts
 const blocks = blocksInside({ texts: [open, body, close,], name: 'details', },);
 ```
 */
function blocksInside(
  {
    texts,
    name,
  }: {
    readonly texts: readonly string[];
    readonly name: string;
  },
): number {
  return texts.reduce(
    function add(
      sum: number,
      text,
      offset,
    ): number {
      return sum + countBlocks({
        text: insideContainer({
          text,
          name,
          role: roleAt({
            offset,
            count: texts.length,
          },),
        },),
      },);
    },
    0,
  );
}

/**
 Reads every container both of whose halves the archive carries, with the
 blocks each side writes inside it.

 @param slices - prepared slices in document order

 @returns Carried containers in closing-half order

 @example
 ```ts
 const containers = carriedContainers({ slices, },);
 ```
 */
function carriedContainers(
  { slices, }: { readonly slices: readonly ChunkPair[]; },
): readonly CarriedContainer[] {
  return containerHalfPairs({ slices, },)
    .filter(function bothCarried(pair,): boolean {
      /**
       Halves of the container.
       */
      const {
        open,
        close,
      } = pair;
      /**
       Whether the archive carries the opening half.
       */
      const openCarried = !open.insertion;
      /**
       Whether the archive carries the closing half.
       */
      const closeCarried = !close.insertion;
      return openCarried && closeCarried;
    },)
    .map(function counted(pair,): CarriedContainer {
      /**
       Halves of the container.
       */
      const {
        open,
        close,
      } = pair;
      /**
       Slices from the opening half through the closing half.
       */
      const inside = slices.slice(
        open.position,
        close.position + 1,
      );
      return {
        pair,
        sourceBlocks: blocksInside({
          texts: inside.map(function sourceOf(slice,): string {
            /**
             Original side of this slice.
             */
            const { source, } = slice;
            return source.text;
          },),
          name: open.name,
        },),
        targetBlocks: blocksInside({
          texts: inside.map(function targetOf(slice,): string {
            /**
             Archive side of this slice, which writes nothing where it is an
             insertion.
             */
            const { target, } = slice;
            return isInsertionChunk(target,) ? '' : target.text;
          },),
          name: open.name,
        },),
      };
    },);
}

/**
 Whether no majority found the passage carried: an absent majority, or a
 split (class sixty-nine; class forty-eight's unanchored split among them).

 @param row - unresolved coverage row

 @returns True when the verdict is absent or split

 @example
 ```ts
 const undecided = unresolvedRows.filter(noMajorityCarried);
 ```
 */
function noMajorityCarried(row: InsertionCoverageRow,): boolean {
  return (row.verdictKind === 'absent') || (row.verdictKind === 'split');
}

/**
 Finding naming a split the deficit decided, when the row is one with an
 anchored claim; an unanchored split is read as absent already (class
 forty-eight) and needs no second line.

 @param row - row the deficit admitted

 @returns One finding, or none

 @example
 ```ts
 const lines = splitFinding({ row, },);
 ```
 */
function splitFinding({ row, }: { readonly row: InsertionCoverageRow; },): readonly string[] {
  /**
   Whether any voice anchored a claim of coverage.
   */
  const anchored = (row.anchoredFull > 0) || (row.anchoredPartial > 0);
  if ((row.verdictKind !== 'split') || (!anchored))
    return [];
  return [
    `${SPLIT_IN_CONTAINER_DEFICIT_FINDING} (slice ${String(row.sliceIndex,)}, full ${String(row.anchoredFull,)}, partial ${
      String(row.anchoredPartial,)
    }, absent ${String(row.absentCount,)} of ${String(row.asked,)} asked; no majority, the block deficit decides)`,
  ];
}

/**
 Admits passages no majority found carried inside one carried container
 while its block deficit lasts, in document order.

 @param container - carried container with its block counts

 @param unresolvedRows - rows neither admitted nor proven carried

 @returns Findings per admitted position

 @example
 ```ts
 const admitted = spendDeficit({ container, unresolvedRows, },);
 ```
 */
function spendDeficit(
  {
    container,
    unresolvedRows,
  }: {
    readonly container: CarriedContainer;
    readonly unresolvedRows: readonly InsertionCoverageRow[];
  },
): ReadonlyMap<number, readonly string[]> {
  /**
   Halves of the container.
   */
  const {
    open,
    close,
  } = container.pair;
  /**
   Blocks the archive is short of, spent as rows are admitted.
   */
  let deficit = container.sourceBlocks - container.targetBlocks;
  /**
   Positions admitted here, with their findings.
   */
  const admitted = new Map<number, readonly string[]>();
  /**
   Rows no majority found carried inside this container, in document order.
   */
  const inside = unresolvedRows
    .filter(noMajorityCarried,)
    .filter(function within(row,): boolean {
      return (row.position >= open.position) && (row.position <= close.position);
    },)
    .toSorted(function byPosition(
      left,
      right,
    ): number {
      return left.position - right.position;
    },);
  for (const row of inside) {
    /**
     Blocks this row's source writes.
     */
    const blocks = countBlocks({
      text: insideContainer({
        text: row.sourceText,
        name: open.name,
        role: 'inside',
      },),
    },);
    /**
     Whether the deficit has room for this passage.
     */
    const affordable = (blocks > 0) && (blocks <= deficit);
    if (!affordable)
      continue;
    deficit -= blocks;
    admitted.set(
      row.position,
      [
        ...splitFinding({ row, },),
        `${CONTAINER_DEFICIT_ADMITTED_FINDING} (slice ${String(row.sliceIndex,)} inside ${open.name} of slices ${
          String(open.sliceIndex,)
        } to ${String(close.sliceIndex,)}: the original writes ${String(container.sourceBlocks,)} blocks there, `
          + `the archive ${String(container.targetBlocks,)})`,
      ],
    );
  }
  return admitted;
}

/**
 Admits passages no majority found carried inside a container the archive
 carries with fewer blocks than the original writes there, while the
 deficit lasts.

 @param slices - prepared slices, whose source names the containers

 @param positions - positions admitted on their own evidence

 @param unresolvedRows - rows neither admitted nor proven carried

 @returns Positions and unresolved rows after the deficit is spent, with a finding per passage admitted

 @example
 ```ts
 const deficit = admitContainerDeficit({ slices, positions, unresolvedRows, },);
 ```
 */
export function admitContainerDeficit(
  {
    slices,
    positions,
    unresolvedRows,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly positions: ReadonlySet<number>;
    readonly unresolvedRows: readonly InsertionCoverageRow[];
  },
): {
  readonly positions: ReadonlySet<number>;
  readonly unresolvedRows: readonly InsertionCoverageRow[];
  readonly findings: readonly string[];
} {
  /**
   Positions admitted over every carried container, with their findings.
   */
  const admitted = new Map<number, readonly string[]>();
  for (const container of carriedContainers({ slices, },)) {
    for (
      const [
        position,
        findings,
      ] of spendDeficit({
        container,
        unresolvedRows,
      },)
    )
      admitted.set(
        position,
        findings,
      );
  }
  return {
    positions: new Set([
      ...positions,
      ...admitted.keys(),
    ],),
    unresolvedRows: unresolvedRows.filter(function stillUnresolved(row,): boolean {
      return !admitted.has(row.position,);
    },),
    findings: [...admitted.values(),].flat(),
  };
}

//endregion Insertion container deficit
