import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Candidate selection model
// Types the selection stage shares with its callers. They live apart from
// `candidate-select.ts` so the stage function keeps its line budget, and because
// the producer union is the piece other stages have to reason about: it is what
// stops a stitched composite from being reported as one model's work.

/**
 * Weight one disinterested judge's ballot carries.
 */
export const FULL_VOTE_WEIGHT = 1;

/**
 * Weight a judge's ballot carries when it names a candidate that judge helped
 * write.
 *
 * Self-judging is ALWAYS allowed, by user decision on 2026-08-14: these models
 * have different blind spots, and a producer's reading of its own text is a
 * weaker instrument than a disinterested reading, not a worthless one. Barring
 * producers threw that reading away and, on a six-model roster with three
 * producers, halved the panel to do it.
 *
 * What the discount corrects is a TILT rather than a declared preference. The
 * judge sheet is anonymized and says so, so a producer does not know which
 * candidate is its own and cannot set out to back it; it is only somewhat more
 * likely to land there. Sizing this as though every self-vote were deliberate
 * would overcorrect a bias nobody has measured on this roster yet, which is
 * what `#84` is for.
 *
 * A half rather than some tuned fraction, and the arithmetic is the argument: a
 * single-model candidate can draw at most this much from its own author, and
 * three contributors to a composite at most three halves, so a self-vote can
 * never reach {@link MIN_SELECTION_WEIGHT} by itself however the roster grows.
 * A model still cannot select its own work; it can only add to a case
 * disinterested judges already made.
 *
 * Exactly representable in binary floating point, which the tie comparison
 * depends on: two halves sum to one with no residue, so a tie between a
 * self-supported candidate and an equally supported rival still reads as a tie.
 */
export const SELF_VOTE_WEIGHT: number = 1 / 2;

/**
 * Summed ballot weight a winner must draw before a selection counts.
 *
 * One vote deciding is one model deciding, which is the exact thing the
 * ensemble exists to prevent: a round where every other judge abstained or was
 * lost would otherwise hand the whole chunk to whichever single judge answered.
 * Two is the smallest number that makes a selection an agreement rather than an
 * opinion.
 */
export const MIN_SELECTION_WEIGHT = 2;

/**
 * Who produced a candidate.
 *
 * A composite is text NO model wrote or read as a whole, so it names its
 * contributors instead of borrowing one model's identity. Reporting stitched
 * text under a single model's name would misstate who is answerable for it, and
 * every contributor still has a stake in it.
 *
 * The composite variant also carries the case where several models
 * independently produced the SAME text and their candidates were collapsed:
 * more than one model has a stake either way, and every one of them holds it.
 * What the variant means precisely is "more than one model has a stake in this
 * text", with stitching the usual reason.
 *
 * The incumbent variant is text that was ALREADY THERE: a human translation the
 * translate lane offers as one candidate among the fresh ones. Nobody on the
 * roster wrote it, so no judge is discounted for it, and the alternative of
 * giving it a stand-in model id would both discount a model that never saw it
 * and count a producer the roster guard is arithmetic over.
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
  }
  | {
    readonly kind: 'incumbent';

    /**
     * Models that independently produced text identical to the incumbent's and
     * were collapsed into it, discounted when they judge it although it is not
     * their work. Empty in the ordinary case, where the incumbent stands alone.
     */
    readonly matched: readonly SyntheticModelId[];
  };

/**
 * Every model with a stake in a candidate, so callers can weigh or exclude all
 * of them without knowing how the candidate was assembled.
 *
 * @param producer - candidate's provenance
 *
 * @returns Model ids whose ballots for this candidate are self-votes
 *
 * @example
 * ```ts
 * const barred = producerModelIds({ kind: 'composite', contributors, },);
 * ```
 */
export function producerModelIds(producer: CandidateProducer,): readonly SyntheticModelId[] {
  if (producer.kind === 'model')
    return [producer.modelId,];
  if (producer.kind === 'incumbent')
    return producer.matched;
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
  if (producer.kind === 'incumbent') {
    /**
     * Models that independently reproduced this text.
     */
    const { matched, } = producer;
    if (matched.length === 0)
      return 'incumbent';
    return `incumbent(matched by ${matched.join(' + ',)})`;
  }
  return `composite(${producer.contributors
    .join(' + ',)})`;
}

/**
 * Combines the stakes of two candidates whose text turned out identical, so
 * collapsing a duplicate never drops a model from the discounted set.
 *
 * Without this, an editor could judge its own words at full weight: if the
 * composite carries one model's operation while another model's whole-chunk text
 * happens to match it exactly, keeping either candidate alone would leave the
 * other voting on text it wrote as though it were a stranger's.
 *
 * @param left - producer of the candidate being kept
 *
 * @param right - producer of the duplicate being collapsed into it
 *
 * @returns Incumbent carrying every stake when either side is the incumbent,
 * single-model producer when both name the same one model, else a composite
 * over the union in first-seen order
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

  // Incumbency survives the collapse. A model reproducing the incumbent's text
  // exactly gains a stake in it and must be barred, but the text is still the
  // one that was already there, and reporting it as that model's work would
  // turn "the human translation was kept" into "a model rewrote it identically"
  // on exactly the slices where the two are indistinguishable.
  if ((left.kind === 'incumbent') || (right.kind === 'incumbent'))
    return {
      kind: 'incumbent',
      matched: united,
    };

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
   * Who wrote this candidate; its ballot for this candidate counts less.
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
   * Judges the round seated.
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

  /**
   * Ballots naming a candidate their own judge helped write.
   *
   * Counted on every round because seating producers is a deliberate trade of
   * independence for coverage, and a trade nobody measures is an assumption. A
   * stage where this approaches the ballot count is one where the discount is
   * carrying the whole result.
   */
  readonly selfVotes: number;
};

/**
 * One judge's ballot as cast.
 *
 * Kept because the tally answers how many judges preferred something and never
 * why. Ballot reasons reached a log line and nothing durable, so a run whose log
 * was lost, which happened on 2026-08-13 when a pass wrote twenty minutes of
 * output into a pipe whose reader had exited, left no account of any decision it
 * made. That is tolerable while selection only ranks repairs of text the
 * pipeline keeps either way, and not once selection decides whether a human
 * translation is replaced.
 *
 * @example
 * ```ts
 * const ballot: SelectionBallot = { modelId, best: 2, reason: 'renders the omitted clause', };
 * ```
 */
export type SelectionBallot = {
  /**
   * Judge that cast it.
   */
  readonly modelId: SyntheticModelId;

  /**
   * One-based candidate index, or `CANDIDATE_NONE` when this judge named no
   * candidate. An index past the end of the set is recorded as cast rather than
   * corrected, since a judge naming a candidate that does not exist is itself
   * the finding.
   */
  readonly best: number;

  /**
   * Judge's stated reason, verbatim.
   */
  readonly reason: string;

  /**
   * Weight this ballot carried: {@link SELF_VOTE_WEIGHT} when the judge named
   * a candidate it helped write, {@link FULL_VOTE_WEIGHT} otherwise, and zero
   * for an abstention.
   */
  readonly weight: number;
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
 *     acceptable, or that no judge could be seated at all. This
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
     * Summed ballot weight the winner drew, which is a COUNT only when no
     * producer voted for its own work; see {@link SELF_VOTE_WEIGHT}.
     */
    readonly voteWeight: number;

    /**
     * What the round counted.
     */
    readonly tally: SelectionTally;

    /**
     * Degradation findings from the judge fan-out, for the caller to carry
     * into the artifact.
     *
     * The tally already counts how many judges answered, and that is not the
     * same thing: it says how many voices were lost without saying WHICH model
     * went silent, and the identity is what every voice-loss diagnosis has
     * turned on. This channel existed nowhere on the selection path until
     * 2026-08-13, so the fan-out's findings were built and discarded.
     */
    readonly findings: readonly string[];

    /**
     * Every ballot cast, in the order judges answered.
     */
    readonly ballots: readonly SelectionBallot[];
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

    /**
     * {@inheritDoc SelectionOutcome.findings}
     */
    readonly findings: readonly string[];

    /**
     * {@inheritDoc SelectionOutcome.ballots}
     */
    readonly ballots: readonly SelectionBallot[];
  };

//endregion Candidate selection model
