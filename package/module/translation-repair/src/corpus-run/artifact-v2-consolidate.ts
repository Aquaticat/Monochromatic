import type {
  ConsolidationSettlement,
  ConsolidationTerminal,
  ProposalVerdict,
} from '../consolidate-settle.ts';
import type { GateBallot, } from '../consolidate-gate-wire.ts';

//region Artifact version 2 consolidation
// ONE CONSOLIDATED SLICE AS THE STAGE LEFT IT, written so a later reader can
// answer why without re-running anything.
//
// EVERY ROUND THAT DID NOT RUN IS NAMED ABSENT rather than omitted, following
// the pattern `#135` set for the pairing field. A missing key and a round that
// was deliberately not bought look identical in JSON, and the difference is
// exactly what a census of this stage is counting.

/**
 * What the gate settled, or why it was never asked.
 *
 * @example
 * ```ts
 * const gate: ArtifactConsolidateGateV2 = { kind: 'not-asked', };
 * ```
 */
export type ArtifactConsolidateGateV2 =
  | {
    /**
     * The gate ran and its ballots are here.
     */
    readonly kind: 'asked';

    /**
     * Every usable ballot, kept whichever way the gate settled, for the reason
     * the contest record gives: a reader asking why a slice kept its standing
     * text is asking exactly where a wins-only record would be silent.
     */
    readonly ballots: readonly GateBallot[];

    /**
     * Voices whose answer arrived and could be read as a ballot.
     */
    readonly usable: number;
  }
  | {
    /**
     * No consolidation reached the gate, so there was nothing to ask about.
     * The terminal state says which of the earlier exits was taken.
     */
    readonly kind: 'not-asked';
  };

/**
 * One consolidated slice as the stage left it.
 *
 * @example
 * ```ts
 * const slice: ArtifactConsolidateSliceV2 = { chunkIndex: 0, terminal: 'incumbent-only', rewrapped: false, demoted: false, verdicts: [], gate: { kind: 'not-asked', }, };
 * ```
 */
export type ArtifactConsolidateSliceV2 = {
  /**
   * Slice both lanes name it by, matching the comparison row it answers.
   */
  readonly chunkIndex: number;

  /**
   * How the slice left the stage, which is the field a census should count.
   */
  readonly terminal: ConsolidationTerminal;

  /**
   * Whether the wrap altered what the producer emitted, which separates a
   * roster that honours the rule from one this stage is silently correcting.
   */
  readonly rewrapped: boolean;

  /**
   * Whether wrapping left nothing between the consolidation and what stands.
   */
  readonly demoted: boolean;

  /**
   * Every voice's structural verdict, survivors and refusals alike.
   *
   * CARRIES NO PROPOSAL TEXT. The proposals are corpus renderings and only the
   * one that ships belongs in a record; who was refused and why is what a later
   * reader cannot recover any other way.
   */
  readonly verdicts: readonly ProposalVerdict[];

  /**
   * What the gate settled, or a named absence saying it was never asked.
   */
  readonly gate: ArtifactConsolidateGateV2;
};

/**
 * Reads the artifact's record out of what the consolidation stage returned.
 *
 * @param chunkIndex - slice this answers
 *
 * @param settlement - what the stage settled
 *
 * @returns Record for one consolidated slice
 *
 * @example
 * ```ts
 * const slice = describeConsolidateSlice({ chunkIndex: 0, settlement, },);
 * ```
 */
export function describeConsolidateSlice(
  {
    chunkIndex,
    settlement,
  }: {
    readonly chunkIndex: number;
    readonly settlement: ConsolidationSettlement;
  },
): ArtifactConsolidateSliceV2 {
  /**
   * What the gate settled, absent where no consolidation reached it. Read off
   * the settlement so the branch below is one member step rather than two.
   */
  const { gate, } = settlement;
  return {
    chunkIndex,
    terminal: settlement.terminal,
    rewrapped: settlement.rewrapped,
    demoted: settlement.demoted,
    verdicts: settlement.verdicts,
    gate: (gate === undefined)
      ? { kind: 'not-asked', }
      : {
        kind: 'asked',
        ballots: gate.ballots,
        usable: gate.usable,
      },
  };
}

//endregion Artifact version 2 consolidation
