import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { runArchiveBlockReviewStage, } from '../archive-block-review-stage.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import type { UnclaimedTargetBlock, } from '../document-preparation.ts';
import { hashContent, } from '../document-node.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';

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
 
 @param client - provider client
 
 @param modelIds - review roster
 
 @param targetText - current archive document
 
 @param sourceContexts - expected source section per exact block identity
 
 @param blocks - unclaimed blocks in current preparation
 
 @param signal - caller cancellation
 
 @param exchangeTimeoutMs - per-call bound
 
 @param l - pass logger
 
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
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly targetText: string;
    readonly sourceContexts: ReadonlyMap<string, string>;
    readonly blocks: readonly UnclaimedTargetBlock[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
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
    /**
     Stage-local retained or revised outcome.
     */
    // oxlint-disable-next-line no-await-in-loop -- Reverse-offset block corrections must settle in document order.
    const outcome = await runArchiveBlockReviewStage({
      client,
      modelIds,
      sourceText: sourceContexts.get(identity,) ?? '',
      targetText,
      blockText,
      priorFindings: [],
      signal,
      exchangeTimeoutMs,
      l,
    },);
    if (outcome.kind === 'retained') {
      findings.push(`archive block reviewed and retained: ${identity}`);
      continue;
    }
    if (outcome.text === blockText) {
      // A revision that repeats its original wording is a claimed change with
      // no change; the original is kept and the defective claim recorded.
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
