import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { runArchiveBlockReviewStage, } from '../archive-block-review-stage.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import type { UnclaimedTargetBlock, } from '../document-preparation.ts';
import { hashContent, } from '../document-node.ts';
import type { BenchSeating, } from '../bench-seating.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { sameWording, } from '../wording-key.ts';

//region Archive block repair

/**
 Outcome of reviewing all currently unclaimed archive blocks.
 */
export type ArchiveBlocksRepairOutcome = {
  /**
   Archive text after selected revisions.
   */
  readonly targetText: string;
  /**
   Operation-only findings safe for pass audit.
   */
  readonly findings: readonly string[];
};

/**
 Stable identity over location and exact block wording.
 
 @param block - structured unclaimed block
 
 @param targetText - archive whose offsets block indexes
 
 @returns Identity unaffected by edits after block
 
 @example
 ```ts
 const identity = archiveBlockIdentity({ block, targetText, });
 ```
 */
export function archiveBlockIdentity(
  {
    block,
    targetText,
  }: {
    readonly block: UnclaimedTargetBlock;
    readonly targetText: string;
  },
): string {
  return JSON.stringify({
    location: block.location,
    blockId: block.blockId,
    textDigest: hashContent({
      content: targetText.slice(
        block.startOffset,
        block.endOffset,
      ),
    },),
  },);
}

/**
 Line-ending characters, the only thing a block separator is made of.
 */
const LINE_ENDINGS: ReadonlySet<string> = new Set([
  '\n',
  '\r',
]);

/**
 Offset just past the run of line endings starting at an offset.

 @param text - document scanned

 @param offset - where the run may start

 @returns Offset of the first character that is no line ending, or the text's length

 @example
 ```ts
 pastLineEndings({ text: 'A\n\nB', offset: 1, },); // 3
 ```
 */
function pastLineEndings(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): number {
  for (let at = offset; at < text.length; at += 1) {
    if (!LINE_ENDINGS.has(text[at] ?? '',))
      return at;
  }
  return text.length;
}

/**
 Offset where the run of line endings ending at an offset starts.

 @param text - document scanned

 @param offset - offset just past the run

 @returns Offset of the run's first line ending, or the offset itself where none precedes it

 @example
 ```ts
 beforeLineEndings({ text: 'A\n\nB', offset: 3, },); // 1
 ```
 */
function beforeLineEndings(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): number {
  for (let at = offset; at > 0; at -= 1) {
    if (!LINE_ENDINGS.has(text[at - 1] ?? '',))
      return at;
  }
  return 0;
}

/**
 Span to cut when a review removes a block outright.

 CLASS NINETY-FOUR (XingZ627, 2026-09-23). A removal spliced as an empty
 replacement left the block's own separators standing on both sides, so the
 archive's placeholder line after the front matter left three blank lines
 behind it and the page shipped with a double blank line. The removed block
 takes the line endings that follow it, which leaves the separator before
 it to stand between its neighbours; a block that ends the document takes
 the line endings before it instead, so nothing trails.

 @param text - document the block sits in

 @param startOffset - where the block starts

 @param endOffset - offset just past the block

 @returns Span covering the block and one run of line endings beside it

 @example
 ```ts
 const span = removalSpan({ text: 'A\n\nB\n\nC', startOffset: 3, endOffset: 4, },);
 ```
 */
function removalSpan(
  {
    text,
    startOffset,
    endOffset,
  }: {
    readonly text: string;
    readonly startOffset: number;
    readonly endOffset: number;
  },
): {
  readonly startOffset: number;
  readonly endOffset: number;
} {
  /**
   Offset just past the line endings that follow the block.
   */
  const after = pastLineEndings({
    text,
    offset: endOffset,
  },);
  if (after > endOffset)
    return {
      startOffset,
      endOffset: after,
    };
  return {
    startOffset: beforeLineEndings({
      text,
      offset: startOffset,
    },),
    endOffset,
  };
}

/**
 Reviews unclaimed blocks in reverse offset order and applies selected revisions.
 
 EACH BLOCK IS REVIEWED IN THE PAGE THE REVISIONS ALREADY APPLIED LEAVE
 (ledger B80), so its reviewers, the quote style its revisions are restored
 to, and the footnote check on them all read the page a revision would
 join. Where two blocks' revisions conflict, the later block's, reviewed
 first, stands.
 
 @param client - provider client
 
 @param modelIds - review roster
 
 @param targetText - current archive document
 
 @param sourceContexts - expected source section per exact block identity
 
 @param blocks - unclaimed blocks in current preparation
 
 @param identityContext - declared names preparation holds, for every sheet
 the review asks (ledger B28)
 
 @param referenceContext - what the pages the original links say, with the
 attested lines under them
 
 @param signal - caller cancellation
 
 @param exchangeTimeoutMs - per-call bound
 
 @param l - pass logger
 
 @param beforeBlock - awaited before each block's review, handing it the roster it
 is asked of; none keeps the given one (ledger X12)
 
 @returns Revised text, retained identities, and audit findings
 
 @example
 ```ts
 const repaired = await repairArchiveBlocks(input);
 ```
 */
export async function repairArchiveBlocks(
  {
    client,
    modelIds,
    targetText,
    sourceContexts,
    blocks,
    identityContext,
    referenceContext,
    signal,
    exchangeTimeoutMs,
    l,
    beforeBlock,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly targetText: string;
    readonly sourceContexts: ReadonlyMap<string, string>;
    readonly blocks: readonly UnclaimedTargetBlock[];
    readonly identityContext?: string;
    readonly referenceContext?: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly beforeBlock?: () => Promise<BenchSeating>;
  }>,
): Promise<ArchiveBlocksRepairOutcome> {
  /**
   Operation-only audit findings.
   */
  const findings: string[] = [];
  /**
   Archive with selected corrections applied.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Reverse-offset sequential splicing carries each accepted correction forward.
  let revisedText = targetText;
  /**
   Blocks ordered so replacement cannot invalidate later offsets.
   */
  const ordered = blocks.toSorted(function latestFirst(
    left,
    right,
  ): number {
    return right.startOffset - left.startOffset;
  },);
  for (const block of ordered) {
    /**
     Stable license identity for current block.
     */
    const identity = archiveBlockIdentity({
      block,
      targetText,
    },);
    /**
     Exact archive wording under review.
     */
    const blockText = targetText.slice(
      block.startOffset,
      block.endOffset,
    );
    // EACH BLOCK IS REVIEWED BY THE ROSTER ITS HOOK HANDS OVER (ledger X12,
    // 2026-09-28): a dry-out inside the review left every later block on the
    // roster read before it.
    /* oxlint-disable no-await-in-loop -- Reverse-offset block corrections must settle in document order, each block asked of the bench as it stands. */
    /**
     Seating the hook hands this block: a roster read under a hold, or none,
     which keeps the one the review started on.
     */
    const blockSeating: BenchSeating = (beforeBlock === undefined) ? {} : await beforeBlock();
    /**
     Stage-local retained or revised outcome.
     */
    const outcome = await runArchiveBlockReviewStage({
      client,
      modelIds: blockSeating.modelIds ?? modelIds,
      sourceText: sourceContexts.get(identity,) ?? '',
      // THE PAGE THE REVISIONS ALREADY APPLIED LEAVE (ledger B80): a footnote
      // is a relation between blocks, so a revision is read in the page it
      // would join. Read in the archive as it came, two revisions each
      // dropping one marker of a note passed alone and shipped the note with
      // nothing referencing it. Later blocks go first, so this block stands
      // in that page at its archive offsets.
      targetText: revisedText,
      blockText,
      priorFindings: [],
      ...((identityContext === undefined) ? {} : { identityContext, }),
      ...((referenceContext === undefined) ? {} : { referenceContext, }),
      signal,
      exchangeTimeoutMs,
      l,
    },);
    /* oxlint-enable no-await-in-loop */
    if (outcome.kind === 'retained') {
      findings.push(`archive block reviewed and retained: ${identity}`);
      continue;
    }
    if (
      sameWording({
        proposal: outcome.text,
        standing: blockText,
        // READ AS PROSE whatever the block is: this review exists to remove or
        // reword archive text no source supports, and a demotion only keeps
        // the archive's bytes, so re-lining a verse block is kept out too.
        lineStructured: false,
      },)
    ) {
      // A revision that repeats its original wording, in all but layout the
      // page does not show (ledger B26), is a claimed change with no change;
      // the original is kept and the defective claim recorded.
      findings.push(`archive block revision repeated its original wording and was retained: ${identity}`);
      continue;
    }
    /**
     Span the revision replaces: the block alone, or the block with one of
     its separators when the revision removes it (class ninety-four).
     */
    const span = (outcome.text === '')
      ? removalSpan({
        text: revisedText,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
      },)
      : {
        startOffset: block.startOffset,
        endOffset: block.endOffset,
      };
    revisedText = `${revisedText.slice(
      0,
      span.startOffset,
    )}${outcome.text}${revisedText.slice(span.endOffset,)}`;
    findings.push(`archive block reviewed and revised: ${identity}`);
  }
  return {
    targetText: revisedText,
    findings,
  };
}

//endregion Archive block repair
