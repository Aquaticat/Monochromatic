import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Candidate selection model
// Types the selection stage shares with its callers. They live apart from
// `candidate-select.ts` so the stage function keeps its line budget, and because
// the producer union is the piece other stages have to reason about: it is what
// stops a stitched composite from being reported as one model's work.

/**
 * Votes a winner must draw before a selection counts.
 *
 * One vote deciding is one model deciding, which is the exact thing the
 * ensemble exists to prevent: a round where every other judge abstained or was
 * lost would otherwise hand the whole chunk to whichever single judge answered.
 * Two is the smallest number that makes a selection an agreement rather than an
 * opinion.
 */
export const MIN_SELECTION_VOTES = 2;

/**
 * Who produced a candidate.
 *
 * A composite is text NO model wrote or read as a whole, so it names its
 * contributors instead of borrowing one model's identity. Reporting stitched
 * text under a single model's name would misstate who is answerable for it, and
 * every contributor still has to be barred from judging it.
 *
 * The composite variant also carries the case where several models
 * independently produced the SAME text and their candidates were collapsed:
 * more than one model has a stake either way, and every one of them must be
 * barred. What the variant means precisely is "more than one model has a stake
 * in this text", with stitching the usual reason.
 *
 * @example
 * ```ts
 * const producer: CandidateProducer = { kind: 'model', modelId, };
 * ```
 */
export type CandidateProducer =
  | {
    readonly kind: 'model';

    /**
     * Model that wrote this candidate by itself.
     */
    readonly modelId: SyntheticModelId;
  }
  | {
    readonly kind: 'composite';

    /**
     * Models whose work the composite carries, in assembly order.
     */
    readonly contributors: readonly SyntheticModelId[];
  };

/**
 * Every model with a stake in a candidate, so callers bar all of them from
 * judging it without knowing how the candidate was assembled.
 *
 * @param producer - candidate's provenance
 *
 * @returns Model ids that must not judge this candidate
 *
 * @example
 * ```ts
 * const barred = producerModelIds({ kind: 'composite', contributors, },);
 * ```
 */
export function producerModelIds(producer: CandidateProducer,): readonly SyntheticModelId[] {
  if (producer.kind === 'model')
    return [producer.modelId,];
  return producer.contributors;
}

/**
 * Renders a producer for logs and scorecard findings.
 *
 * @param producer - candidate's provenance
 *
 * @returns Model id, or the contributor list for a composite
 *
 * @example
 * ```ts
 * const label = describeProducer(candidate.producer,);
 * ```
 */
export function describeProducer(producer: CandidateProducer,): string {
  if (producer.kind === 'model')
    return producer.modelId;
  return `composite(${producer.contributors
    .join(' + ',)})`;
}

/**
 * Combines the stakes of two candidates whose text turned out identical, so
 * collapsing a duplicate never drops a model from the barred set.
 *
 * Without this, an editor could judge its own words: if the composite carries
 * one model's operation while another model's whole-chunk text happens to match
 * it exactly, keeping either candidate alone would leave the other free to
 * judge text it wrote.
 *
 * @param left - producer of the candidate being kept
 *
 * @param right - producer of the duplicate being collapsed into it
 *
 * @returns Single-model producer when both name the same one model, else a
 * composite over the union in first-seen order
 *
 * @example
 * ```ts
 * const producer = mergeProducers({ left: kept.producer, right: duplicate.producer, },);
 * ```
 */
export function mergeProducers(
  {
    left,
    right,
  }: {
    readonly left: CandidateProducer;
    readonly right: CandidateProducer;
  },
): CandidateProducer {
  /**
   * Every model with a stake, in first-seen order without repeats.
   */
  const united = [
    ...new Set([
      ...producerModelIds(left,),
      ...producerModelIds(right,),
    ],),
  ];

  /**
   * Sole stakeholder, when both sides named the same one model.
   */
  const [only,] = united;
  if ((united.length === 1) && (only !== undefined))
    return {
      kind: 'model',
      modelId: only,
    };
  return {
    kind: 'composite',
    contributors: united,
  };
}

/**
 * One proposed candidate with the provenance that bars its authors from
 * judging it.
 *
 * @example
 * ```ts
 * const candidate: Candidate<string> = {
 *   producer: { kind: 'model', modelId, },
 *   value: patched,
 *   rendered: patched,
 * };
 * ```
 */
export type Candidate<ValueT,> = {
  /**
   * Who wrote this candidate; excluded from judging it.
   */
  readonly producer: CandidateProducer;

  /**
   * Value handed back when this candidate wins.
   */
  readonly value: ValueT;

  /**
   * Text judges compare; may be a rendering of `value` rather than `value`.
   */
  readonly rendered: string;
};

/**
 * What a selection round counted, recorded whether or not it chose anything.
 *
 * Kept on BOTH outcomes because the decline rate is the measurement that says
 * whether an ensemble does any work at all: a stage that always declines buys
 * several times the tokens for a result identical to one model's.
 *
 * @example
 * ```ts
 * const tally: SelectionTally = { judgesAvailable: 4, ballots: 3, abstentions: 1, };
 * ```
 */
export type SelectionTally = {
  /**
   * Judges left after producers were removed.
   */
  readonly judgesAvailable: number;

  /**
   * Judges whose ballot arrived and validated.
   */
  readonly ballots: number;

  /**
   * Ballots naming no usable candidate, whether by declining outright or by
   * naming an index no candidate occupies.
   */
  readonly abstentions: number;
};

/**
 * Which kind of failure a decline was.
 *
 * The two are not interchangeable, and treating them alike is how a pipeline
 * either overrides its judges or throws away work over a coin flip:
 *
 * -   `indecision` means judges answered but did not converge, by tying or by
 *     leaving the leader short of the minimum votes. Every candidate may be
 *     perfectly good; nobody said otherwise. This is a failure to rank.
 * -   `rejection` means judges affirmatively answered that NO candidate is
 *     acceptable, or that no disinterested judge could be seated at all. This
 *     is a substantive negative verdict, and shipping over it would be
 *     overruling the judges rather than routing around their silence.
 *
 * @example
 * ```ts
 * const disposition: SelectionDisposition = 'indecision';
 * ```
 */
export type SelectionDisposition =
  | 'indecision'
  | 'rejection';

/**
 * What a selection round decided.
 *
 * @example
 * ```ts
 * const outcome: SelectionOutcome<string> = { kind: 'declined', reason: 'judges tied', tally, };
 * ```
 */
export type SelectionOutcome<ValueT,> =
  | {
    readonly kind: 'selected';

    /**
     * Winning candidate's value.
     */
    readonly value: ValueT;

    /**
     * Who produced the winner.
     */
    readonly producer: CandidateProducer;

    /**
     * Votes the winner drew.
     */
    readonly votes: number;

    /**
     * What the round counted.
     */
    readonly tally: SelectionTally;
  }
  | {
    readonly kind: 'declined';

    /**
     * Why nothing was selected, in scorecard-stable wording.
     */
    readonly reason: string;

    /**
     * Which kind of failure this was, so callers can answer the two very
     * different questions separately.
     */
    readonly disposition: SelectionDisposition;

    /**
     * What the round counted.
     */
    readonly tally: SelectionTally;
  };

//endregion Candidate selection model
