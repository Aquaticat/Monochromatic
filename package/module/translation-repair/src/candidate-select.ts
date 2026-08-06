import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type Candidate,
  describeProducer,
  producerModelIds,
  type SelectionOutcome,
  type SelectionTally,
} from './candidate-select-model.ts';
import {
  buildCandidateSelectMessages,
  CANDIDATE_NONE,
  CANDIDATE_SELECT_RESPONSE_FORMAT,
  isCandidateBallotWire,
} from './candidate-select-wire.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Candidate selection stage
// Shared by every stage that generates text rather than verdicts: the ensemble
// editor and the naturalness refinement lane both propose N candidates and need
// one chosen without the proposer grading itself.
//
// Two invariants make the ensemble worth having, and both are enforced here
// rather than trusted to callers:
//
// - A model NEVER judges a candidate set containing its own work. Every model
//   that contributed to a candidate is removed from the judge roster, which for
//   a composite means all of its contributors.
// - A tie or an empty judge roster DECLINES. Declining returns the caller's
//   fallback, which is text the pipeline already trusts, so the conservative
//   outcome is the default whenever the ensemble fails to agree.
//
// Callers pass their WHOLE roster as `judgeModelIds` and let this function
// subtract producers. Hand-partitioning a judge list outside is how a caller
// ends up with an empty roster it cannot see.

/**
 * Runs one selection round: judges that contributed no candidate compare the
 * anonymized set and name a winner, and anything short of a clear plurality
 * declines.
 *
 * Every candidate handed in is judged, including a lone one. A caller that has
 * already deduplicated its set and knows one candidate survived may short
 * circuit before calling; this function does not assume that on its behalf,
 * because a single candidate arriving here is generally the caller's only
 * proposal rather than a proven consensus.
 *
 * @param client - injected model client
 *
 * @param candidates - proposals in caller-fixed order
 *
 * @param judgeModelIds - whole roster; producers are removed here
 *
 * @param task - one sentence naming what candidates attempt
 *
 * @param criteria - ordered decision rules, most important first
 *
 * @param evidence - source and baseline text judges compare against
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - logger of the calling stage
 *
 * @returns Winner with its vote count, or a decline carrying its reason;
 * either way the round's tally
 *
 * @example
 * ```ts
 * const outcome = await selectBestCandidate({ client, candidates, judgeModelIds, ... },);
 * ```
 */
export async function selectBestCandidate<ValueT,>(
  {
    client,
    candidates,
    judgeModelIds,
    task,
    criteria,
    evidence,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly candidates: readonly Candidate<ValueT>[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly task: string;
    readonly criteria: readonly string[];
    readonly evidence: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<SelectionOutcome<ValueT>> {
  /**
   * Logger tagged with this stage.
   */
  const sl = tagged({
    tag: selectBestCandidate.name,
    l,
  },);

  /**
   * Tally of a round that never reached the judges.
   */
  const emptyTally: SelectionTally = {
    judgesAvailable: 0,
    ballots: 0,
    abstentions: 0,
  };
  if (candidates.length === 0)
    return {
      kind: 'declined',
      reason: 'no candidates proposed',
      tally: emptyTally,
    };

  /**
   * Models that contributed to any candidate, barred from judging this set.
   */
  const producers = new Set(
    candidates.flatMap(function toProducers(candidate,) {
      return [...producerModelIds(candidate.producer,),];
    },),
  );

  /**
   * Judges with no stake in the outcome.
   */
  const judges = judgeModelIds.filter(function isDisinterested(modelId,) {
    return !producers.has(modelId,);
  },);
  if (judges.length === 0) {
    sl.warn('every judge contributed a candidate; declining rather than letting a model grade itself',);
    return {
      kind: 'declined',
      reason: 'no disinterested judge available',
      tally: emptyTally,
    };
  }

  /**
   * Ballots from the judges that answered.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: judges,
    messages: buildCandidateSelectMessages({
      task,
      criteria,
      evidence,
      rendered: candidates.map(function toRendered(candidate,) {
        return candidate.rendered;
      },),
    },),
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: CANDIDATE_SELECT_RESPONSE_FORMAT,
    validate: isCandidateBallotWire,
    stage: 'select',
    l,
  },);

  /**
   * Votes per one-based candidate index; out-of-range ballots and explicit
   * declines are counted as abstentions rather than discarded silently.
   */
  const tally = new Map<number, number>();

  /**
   * Ballots that named no usable candidate, kept so a selection that failed
   * for want of agreement is distinguishable from one nobody voted in.
   */
  const counters = { abstained: 0, };
  for (const voice of gather.voices) {
    /**
     * This judge's chosen index.
     */
    const { best, } = voice.value;
    if ((best === CANDIDATE_NONE) || (best > candidates.length)) {
      counters.abstained += 1;
      continue;
    }
    tally.set(
      best,
      (tally.get(best,) ?? 0) + 1,
    );
    sl.info(
      `${voice.modelId} chose candidate ${String(best,)}: ${voice.value
        .reason}`,
    );
  }

  /**
   * What this round counted, reported whichever way it ends.
   */
  const counted: SelectionTally = {
    judgesAvailable: judges.length,
    ballots: gather.voices
      .length,
    abstentions: counters.abstained,
  };

  /**
   * Candidate indexes ordered by votes, most first.
   */
  const ranked = [...tally.entries(),].toSorted(function byVotes(
    a,
    b,
  ) {
    return b[1] - a[1];
  },);

  /**
   * Leading entry, absent when every judge abstained.
   */
  const [leader,] = ranked;
  if (leader === undefined) {
    sl.info(
      `every judge declined (${String(counters.abstained,)} abstentions); keeping the fallback`,
    );
    return {
      kind: 'declined',
      reason: 'every judge declined',
      tally: counted,
    };
  }

  /**
   * Runner-up's vote count, zero when only one candidate drew votes.
   */
  const runnerUpVotes = ranked[1]?.[1] ?? 0;
  if (leader[1] === runnerUpVotes) {
    sl.info(`judges tied at ${String(leader[1],)} votes; keeping the fallback`,);
    return {
      kind: 'declined',
      reason: 'judges tied',
      tally: counted,
    };
  }

  /**
   * Winning candidate, indexed back from the one-based ballot.
   */
  const winner = candidates[leader[0] - 1];
  if (winner === undefined) {
    return {
      kind: 'declined',
      reason: 'winning index out of range',
      tally: counted,
    };
  }
  sl.info(
    `candidate ${String(leader[0],)} from ${describeProducer(winner.producer,)} won `
    + `${String(leader[1],)} of ${String(counted.ballots,)} ballots`,
  );
  return {
    kind: 'selected',
    value: winner.value,
    producer: winner.producer,
    votes: leader[1],
    tally: counted,
  };
}

//endregion Candidate selection stage
