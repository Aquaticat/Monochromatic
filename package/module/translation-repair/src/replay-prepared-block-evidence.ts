import { isDeepStrictEqual, } from 'node:util';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { blockPairingQuestion, type BlockPairingQuestion, } from './block-pairing-question.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { readBlockPairingOutcomes, } from './pair-blocks-read-outcomes.ts';
import type { BlockPairingOutcome, } from './pair-blocks-stage.ts';
import type { PreparedBlockEvidence, } from './prepare-block-pairing-model.ts';
import { PreparationQualificationError, } from './preparation-qualification-error.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Current questioned-evidence replay before scope-specific qualification

/**
 * Replays exact current block evidence and its configured usable quorum without granting placement authority.
 * Full-parent coverage and definition-only domains are separate consumers of this boundary.
 *
 * @param pair - current parser-owned parent establishing local numbering and definition exemptions
 * @param evidence - retained acquisition evidence, never a historical-cache qualification shortcut
 * @param modelIds - independently configured electorate
 * @param l - caller logger retaining preparation scope
 * @returns Current replay view for immediate scope checks; the final qualifier owns its returned data
 * @throws PreparationQualificationError when cache origin, question, aggregate or usable quorum disagrees
 * @example
 * ```ts
 * const replay = replayPreparedBlockEvidence({ pair, evidence, modelIds, l });
 * ```
 */
export function replayPreparedBlockEvidence({ pair, evidence, modelIds, l, }: {
  readonly pair: ChunkPair;
  readonly evidence: PreparedBlockEvidence;
  readonly modelIds: readonly RosterModelId[];
  readonly l: Logger;
},): {
  readonly question: BlockPairingQuestion;
  readonly outcome: BlockPairingOutcome;
  readonly requiredUsable: number;
} {
  /** Replay is distinct from either acquisition or downstream scope qualification. */
  const pl = tagged({ tag: replayPreparedBlockEvidence.name, l, },);
  if (evidence.kind === 'cached')
    throw new PreparationQualificationError({ kind: 'historical-cache', },);
  /** Local numbering and interpretation always come from the current parent. */
  const question = blockPairingQuestion({ pair, },);
  if (evidence.key !== question.key)
    throw new PreparationQualificationError({ kind: 'question', },);
  /** Native replay validates independent seats and every usable wire before agreement. */
  const outcome = readBlockPairingOutcomes({
    outcomes: evidence.outcome.outcomes,
    modelIds,
    sourceCount: question.sourceBlocks.length,
    targetCount: question.targetBlocks.length,
    freeOrder: question.freeOrder,
    l: pl,
  },);
  if (!isDeepStrictEqual(outcome, evidence.outcome,))
    throw new PreparationQualificationError({ kind: 'result', },);
  /** Configured electorate, not the heard subset or a historical cache flag, sets this requirement. */
  const requiredUsable = rosterQuorumSize({ rosterSize: modelIds.length, },);
  pl.debug(`replaying ${String(outcome.usable,)} usable replies against ${String(requiredUsable,)} required`,);
  if (outcome.usable < requiredUsable)
    throw new PreparationQualificationError({ kind: 'usable-quorum', },);
  return { question, outcome, requiredUsable, };
}

//endregion Current questioned-evidence replay before scope-specific qualification
