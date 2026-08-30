import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { repairArchiveBlock, } from '../archive-block-review-stage.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import type { UnclaimedTargetBlock, } from '../document-preparation.ts';
import { hashContent, } from '../document-node.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';

//region Archive block repair

/**
 * Outcome of reviewing all currently unclaimed archive blocks.
 */
export type ArchiveBlocksRepairOutcome = {
  /**
   * Archive text after selected revisions.
   */
  readonly targetText: string;
  /**
   * Operation-only findings safe for pass audit.
   */
  readonly findings: readonly string[];
};

/**
 * Stable identity over location and exact block wording.
 *
 * @param block - structured unclaimed block
 *
 * @param targetText - archive whose offsets block indexes
 *
 * @returns Identity unaffected by edits after block
 *
 * @example
 * ```ts
 * const identity = archiveBlockIdentity({ block, targetText, });
 * ```
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
 * Reviews unclaimed blocks in reverse offset order and applies selected revisions.
 *
 * @param client - provider client
 *
 * @param modelIds - review roster
 *
 * @param targetText - current archive document
 *
 * @param sourceContexts - expected source section per exact block identity
 *
 * @param blocks - unclaimed blocks in current preparation
 *
 * @param signal - caller cancellation
 *
 * @param exchangeTimeoutMs - per-call bound
 *
 * @param l - pass logger
 *
 * @returns Revised text, retained identities, and audit findings
 *
 * @example
 * ```ts
 * const repaired = await repairArchiveBlocks(input);
 * ```
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
   * Operation-only audit findings.
   */
  const findings: string[] = [];
  /**
   * Archive with selected corrections applied.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Reverse-offset sequential splicing carries each accepted correction forward.
  let revisedText = targetText;
  /**
   * Blocks ordered so replacement cannot invalidate later offsets.
   */
  const ordered = blocks.toSorted(function latestFirst(
    left,
    right,
  ): number {
    return right.startOffset - left.startOffset;
  },);
  for (const block of ordered) {
    /**
     * Stable license identity for current block.
     */
    const identity = archiveBlockIdentity({
      block,
      targetText,
    },);
    /**
     * Exact archive wording under review.
     */
    const blockText = targetText.slice(
      block.startOffset,
      block.endOffset,
    );
    /**
     * Stage-local retained or revised outcome.
     */
    // oxlint-disable-next-line no-await-in-loop -- Reverse-offset block corrections must settle in document order.
    const outcome = await repairArchiveBlock({
      client,
      modelIds,
      sourceText: sourceContexts.get(identity,) ?? '',
      targetText,
      blockText,
      signal,
      exchangeTimeoutMs,
      l,
    },);
    if (outcome.kind === 'retained') {
      findings.push(`archive block reviewed and retained: ${identity}`);
      continue;
    }
    if (outcome.text === blockText) {
      throw new TranslationRepairInterruptedError({
        reason: 'archive-block-unresolved',
        findings: outcome.findings,
      },);
    }
    revisedText = `${revisedText.slice(
      0,
      block.startOffset,
    )}${outcome.text}${revisedText.slice(block.endOffset,)}`;
    findings.push(`archive block reviewed and revised: ${identity}`);
  }
  return {
    targetText: revisedText,
    findings,
  };
}

//endregion Archive block repair
