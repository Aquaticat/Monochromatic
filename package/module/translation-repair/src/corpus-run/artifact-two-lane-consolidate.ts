import type { ConsolidationPolishGateOutcome, } from '../consolidation-polish-gate-stage.ts';
import type {
  ConsolidationSettlement,
  ConsolidationTerminal,
  ProposalVerdict,
} from '../consolidate-settle.ts';
import type { GateBallot, } from '../consolidate-gate-wire.ts';
import { NaturalnessCompletenessError, } from '../naturalness-completeness-error.ts';

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
 * const gate: ArtifactConsolidateGate = { kind: 'not-asked', };
 * ```
 */
export type ArtifactConsolidateGate =
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
 * Wording this slice contributes to the assembled document.
 *
 * NAMED ABSENCE RATHER THAN AN UNCONDITIONAL STRING, because exactly one
 * terminal state produces text an assembly must apply. Every other one leaves
 * the slice with whatever the lane contest settled, and one of them,
 * `no-standing-text`, carries the EMPTY STRING as its text: the contest chose
 * neither lane, so nothing stands. A consumer reading a bare `text` field per
 * slice and writing it into the document would delete every declined-contest
 * slice outright. This shape makes that unrepresentable rather than warning
 * against it.
 *
 * @example
 * ```ts
 * const shipped: ArtifactConsolidateShipped = { kind: 'unchanged', };
 * ```
 */
export type ArtifactConsolidateShipped =
  | {
    /**
     * A consolidation won both rounds and survived the wrap, so this text
     * replaces what the lane contest left at this slice.
     */
    readonly kind: 'consolidated';

    /**
     * Wording to write, wrapped, exactly as it should reach the document.
     */
    readonly text: string;
  }
  | {
    /**
     * Nothing here replaces what the lane contest left, whether because the
     * floor refused the slate, the judges kept the standing text, the gate
     * did, the wrap erased the difference, or the contest named neither lane.
     * The terminal state says which.
     */
    readonly kind: 'unchanged';
  };

/**
 * Terminal as an ARTIFACT may name it, which is wider than what a run writes.
 *
 * CARRIES ONE RETIRED SPELLING. `slate-kept-standing` named three states at
 * once: judges endorsing the archive, a slate carrying one candidate nobody
 * judged, and judges refusing to settle. It was split because a tally over it
 * added a working roster to a failing one to a slate that measured neither.
 *
 * THE OLD ROWS CANNOT BE RECLASSIFIED, and this type is how that is said out
 * loud rather than guessed at. Eleven rows across four settled entries carry
 * the spelling, every one of them with the same key set and no record of the
 * judged round, so which of the three each was is not recoverable from the
 * artifact, from a log, or from a cache that no longer resumes.
 *
 * A RUN NEVER WRITES IT. `ConsolidationTerminal` carries only the three new
 * names, so this widening reaches the reader and stops there.
 *
 * @example
 * ```ts
 * const terminal: ArtifactConsolidationTerminal = 'slate-kept-standing';
 * ```
 */
export type ArtifactConsolidationTerminal =
  | ConsolidationTerminal
  | 'slate-kept-standing';

/**
 * Paragraph-located absolute naturalness defect.
 *
 * @example
 * ```ts
 * const finding: ArtifactNaturalnessFinding = { paragraph: 1, problem: 'Replace stiff syntax.' };
 * ```
 */
export type ArtifactNaturalnessFinding = {
  /**
   * One-based paragraph reviewer was shown.
   */
  readonly paragraph: number;

  /**
   * Concise actionable defect.
   */
  readonly problem: string;
};

/**
 * One roster seat in absolute naturalness review.
 *
 * @example
 * ```ts
 * const seat: ArtifactNaturalnessReviewSeat = { modelId: 'hf:cat/Cat-A', status: 'acceptable', findings: [], reason: 'ready' };
 * ```
 */
export type ArtifactNaturalnessReviewSeat = {
  /**
   * Reviewer model id.
   */
  readonly modelId: string;

  /**
   * Usable verdict or named unusable seat.
   */
  readonly status: 'acceptable' | 'unacceptable' | 'unusable';

  /**
   * Actionable defects from rejecting seat.
   */
  readonly findings: readonly ArtifactNaturalnessFinding[];

  /**
   * Usable explanation, empty for unusable seat.
   */
  readonly reason: string;
};

/**
 * Candidate-bound absolute naturalness review round.
 *
 * @example
 * ```ts
 * const round: ArtifactNaturalnessReviewRound = { candidateDigest: 'sha256:abc', paragraphCount: 0, seats: [], usable: 0, verdict: 'quorum-not-met', findings: [] };
 * ```
 */
export type ArtifactNaturalnessReviewRound = {
  /**
   * Digest binding review to exact candidate bytes.
   */
  readonly candidateDigest: string;

  /**
   * Exact reviewed candidate, required from generation nine.
   */
  readonly candidateText?: string;

  /**
   * Structurally correctable paragraphs reviewer was shown.
   */
  readonly paragraphCount: number;

  /**
   * Digest of each reviewed paragraph, required from generation nine.
   */
  readonly paragraphDigests?: readonly string[];

  /**
   * Every requested seat in roster order.
   */
  readonly seats: readonly ArtifactNaturalnessReviewSeat[];

  /**
   * Seats carrying usable structured verdict.
   */
  readonly usable: number;

  /**
   * Aggregate fail-closed verdict.
   */
  readonly verdict: 'acceptable' | 'unacceptable' | 'quorum-not-met';

  /**
   * Rejection findings in roster order without exact duplicates.
   */
  readonly findings: readonly ArtifactNaturalnessFinding[];
};

/**
 * Digest-bound rejected-input to gated-correction transition.
 *
 * @example
 * ```ts
 * const correction: ArtifactNaturalnessCorrection = { inputDigest, findingsDigest, gatedTextDigest, };
 * ```
 */
export type ArtifactNaturalnessCorrection = {
  /**
   * Exact rejected candidate supplied to correction.
   */
  readonly inputDigest: string;

  /**
   * Canonical structured findings supplied to correction.
   */
  readonly findingsDigest: string;

  /**
   * Exact post-fidelity-gate correction reviewed next.
   */
  readonly gatedTextDigest: string;
};

/**
 * Absolute naturalness review audit added in artifact generation eight.
 *
 * @example
 * ```ts
 * const review: ArtifactNaturalnessReview = { correctionCount: 0, corrections: [], rounds: [] };
 * ```
 */
export type ArtifactNaturalnessReview = {
  /**
   * Dedicated correction generations bought.
   */
  readonly correctionCount: 0 | 1 | 2;

  /**
   * Digest-bound correction transitions, required from generation nine.
   */
  readonly corrections?: readonly ArtifactNaturalnessCorrection[];

  /**
   * Initial and post-correction absolute reviews.
   */
  readonly rounds: readonly ArtifactNaturalnessReviewRound[];
};

/**
 * Auditable post-consolidation body polish record.
 *
 * @example
 * ```ts
 * const polish: ArtifactConsolidationPolish = { kind: 'not-run', reason: 'front-matter', };
 * ```
 */
export type ArtifactConsolidationPolish =
  | {
    /**
     * Naturalness stage did not run.
     */
    readonly kind: 'not-run';

    /**
     * Why stage was absent.
     */
    readonly reason: 'front-matter' | 'not-configured' | 'unsafe-baseline';
  }
  | {
    /**
     * Naturalness stage examined approved base.
     */
    readonly kind: 'settled';

    /**
     * Approved text before polish.
     */
    readonly baseText: string;

    /**
     * Selected rewrite before final gate.
     */
    readonly proposedText: string;

    /**
     * Final text after gate.
     */
    readonly text: string;

    /**
     * Whether final text replaces base.
     */
    readonly changed: boolean;

    /**
     * Rewriters heard.
     */
    readonly refinersHeard: readonly string[];

    /**
     * Models contributing selected proposal.
     */
    readonly contributors: readonly string[];

    /**
     * Number of naturalness selection rounds retained in run ledger.
     */
    readonly roundCount: number;

    /**
     * Final fidelity-first naturalness gate.
     */
    readonly gate?: ConsolidationPolishGateOutcome;

    /**
     * Absolute whole-passage review, required from artifact generation eight.
     */
    readonly review?: ArtifactNaturalnessReview;

    /**
     * Stable naturalness findings.
     */
    readonly findings: readonly string[];
  };

/**
 * One consolidated slice as stage left it.
 *
 * @example
 * ```ts
 * const slice: ArtifactConsolidateSlice = { sliceIndex: 0, terminal: 'incumbent-only', shipped: { kind: 'unchanged', }, rewrapped: false, demoted: false, verdicts: [], gate: { kind: 'not-asked', }, };
 * ```
 */
export type ArtifactConsolidateSlice = {
  /**
   * Slice both lanes name it by, matching the comparison row it answers.
   */
  readonly sliceIndex: number;

  /**
   * How the slice left the stage, which is the field a census should count.
   */
  readonly terminal: ArtifactConsolidationTerminal;

  /**
   * Wording this slice contributes, or a named absence saying it contributes
   * none. This is the field an assembly reads; `terminal` says why.
   */
  readonly shipped: ArtifactConsolidateShipped;

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
  readonly gate: ArtifactConsolidateGate;

  /**
   * Final body naturalness decision. Absent only on artifacts before generation six.
   */
  readonly polish?: ArtifactConsolidationPolish;
};

/**
 * Projects internal polish settlement into artifact audit shape.
 *
 * @param settlement - consolidation result carrying optional polish
 *
 * @param sliceIndex - prepared slice named if unsettled reaches serializer
 *
 * @returns Artifact polish record, naming disabled stage when absent
 *
 * @example
 * ```ts
 * const polish = artifactPolishOf({ settlement, });
 * ```
 */
function artifactPolishOf(
  {
    settlement,
    sliceIndex,
  }: {
    readonly settlement: ConsolidationSettlement;
    readonly sliceIndex: number;
  },
): ArtifactConsolidationPolish {
  /**
   * Internal polish settlement, absent before stage integration.
   */
  const { polish, } = settlement;
  if (polish === undefined) {
    return {
      kind: 'not-run',
      reason: 'not-configured',
    };
  }
  if (polish.kind === 'not-run')
    return polish;
  if (polish.kind === 'unsettled')
    throw new NaturalnessCompletenessError({ sliceIndex, },);
  /**
   * Naturalness selection rounds retained in run ledger.
   */
  const roundCount = polish.rounds
    .length;
  return {
    kind: 'settled',
    baseText: polish.baseText,
    proposedText: polish.proposedText,
    text: polish.text,
    changed: polish.changed,
    refinersHeard: polish.refinersHeard,
    contributors: polish.contributors,
    roundCount,
    ...((polish.gate === undefined) ? {} : { gate: polish.gate, }),
    review: polish.review,
    findings: polish.findings,
  };
}

/**
 * Reads the artifact's record out of what the consolidation stage returned.
 *
 * @param sliceIndex - slice this answers
 *
 * @param settlement - what the stage settled
 *
 * @returns Record for one consolidated slice
 *
 * @example
 * ```ts
 * const slice = describeConsolidateSlice({ sliceIndex: 0, settlement, },);
 * ```
 */
export function describeConsolidateSlice(
  {
    sliceIndex,
    settlement,
  }: {
    readonly sliceIndex: number;
    readonly settlement: ConsolidationSettlement;
  },
): ArtifactConsolidateSlice {
  /**
   * What the gate settled, absent where no consolidation reached it. Read off
   * the settlement so the branch below is one member step rather than two.
   */
  const { gate, } = settlement;

  /**
   * Whether this slice replaces anything. Read off the terminal rather than
   * off `ships` or off the text differing from the standing text, because
   * only the terminal distinguishes a consolidation that won from a wrap that
   * erased the difference, and only it separates both from a contest that
   * named neither lane and left the settlement's text empty.
   */
  const consolidated = settlement.terminal === 'consolidated';
  return {
    sliceIndex,
    terminal: settlement.terminal,
    shipped: consolidated
      ? {
        kind: 'consolidated',
        text: settlement.text,
      }
      : { kind: 'unchanged', },
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
    polish: artifactPolishOf({
      settlement,
      sliceIndex,
    },),
  };
}

/**
 * What the consolidation stage did over one document, or that it did not run.
 *
 * A STATED ABSENCE rather than an empty list, following `laneSelection` for the
 * same reason: a pass that never asked for a third rendering and a document
 * where no slice was eligible are different facts, and an empty `slices` array
 * would be the only record of either.
 *
 * @example
 * ```ts
 * const consolidation: ArtifactConsolidation = { kind: 'not-run', };
 * ```
 */
export type ArtifactConsolidation =
  | {
    /**
     * No third rendering was asked for over this entry.
     */
    readonly kind: 'not-run';
  }
  | {
    /**
     * The stage ran at every slice the lane contest settled.
     */
    readonly kind: 'settled';

    /**
     * One record per consolidated slice, in comparison-row order.
     */
    readonly slices: readonly ArtifactConsolidateSlice[];
  };

//endregion Artifact version 2 consolidation
