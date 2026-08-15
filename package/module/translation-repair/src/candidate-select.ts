import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type Candidate,
  describeProducer,
  FULL_VOTE_WEIGHT,
  MIN_SELECTION_WEIGHT,
  producerModelIds,
  SELF_VOTE_WEIGHT,
  type SelectionBallot,
  type SelectionOutcome,
  type SelectionTally,
} from './candidate-select-model.ts';
import { countCandidateWeights, } from './candidate-weights.ts';
import {
  buildCandidateSelectMessages,
  CANDIDATE_NONE,
  CANDIDATE_SELECT_RESPONSE_FORMAT,
  isCandidateBallotWire,
  type SelectEvidence,
} from './candidate-select-wire.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { ProducerRosterError, } from './repair-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Candidate selection stage
// Shared by every stage that generates text rather than verdicts: the ensemble
// editor, the naturalness refinement lane and the translate lane all propose N
// candidates and need one chosen.
//
// Two invariants make the ensemble worth having, and both are enforced here
// rather than trusted to callers:
//
// - A model may judge its own work, and its ballot for its own work counts for
//   LESS. Producers used to be removed from the roster outright; the user
//   replaced that with a discount on 2026-08-14, because these models have
//   different blind spots and dropping three of six judges to keep the rest
//   disinterested threw away readings nothing else supplies. A producer reading
//   its own text is a weaker instrument than a disinterested one, not a
//   worthless one.
// - A tie or an empty judge roster DECLINES. Declining returns the caller's
//   fallback, which is text the pipeline already trusts, so the conservative
//   outcome is the default whenever the ensemble fails to agree.
//
// The discount is sized so it cannot decide anything by itself: see
// `SELF_VOTE_WEIGHT`. Self-preference is not assumed away, so every self-vote
// is recorded by name, weighed on the ballot, and counted in the tally.
//
// Callers pass their WHOLE roster as `judgeModelIds`. Hand-partitioning a judge
// list outside is how a caller ends up with an empty roster it cannot see.

/**
 * Runs one selection round: judges compare the anonymized set and name a
 * winner, and anything short of a clear plurality declines. Every judge on the
 * roster is seated, with a ballot for its own work discounted.
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
 * @param judgeModelIds - whole roster, producers included
 *
 * @param task - one sentence naming what candidates attempt
 *
 * @param criteria - ordered decision rules, most important first
 *
 * @param evidence - source and baseline material judges compare against
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - logger of the calling stage
 *
 * @returns Winner with the ballot weight it drew, or a decline carrying its
 * reason; either way the round's tally and every ballot cast
 *
 * @throws {@link import('./repair-contract.ts').ProducerRosterError} when a judge
 * appears twice on the roster, which would let one model reach the minimum
 * weight by itself
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
    readonly evidence: readonly SelectEvidence[];
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
    selfVotes: 0,
  };
  if (candidates.length === 0)
    return {
      kind: 'declined',
      reason: 'no candidates proposed',
      disposition: 'rejection',
      tally: emptyTally,
      findings: [],
      ballots: [],
      perCandidate: [],
    };

  /**
   * Judges this round seats: the whole roster, producers included.
   */
  const judges = judgeModelIds;
  if (judges.length === 0) {
    sl.warn('no judge roster was passed; declining rather than selecting unexamined text',);
    return {
      kind: 'declined',
      reason: 'no judge available',
      disposition: 'rejection',
      tally: emptyTally,
      findings: [],
      ballots: [],
      perCandidate: [],
    };
  }

  /**
   * Judges keyed for repeat detection.
   *
   * A repeated id is one model given two exchanges and two ballots, which is
   * enough to reach {@link MIN_SELECTION_WEIGHT} alone: exactly the single-model
   * control the ensemble exists to prevent, arriving as a roster typo rather
   * than as a policy change.
   *
   * Refused HERE as well as in `assertJudgeableProducerRoster`, because that
   * guard runs at STAGE entry while `selectPerEnvelope` and `selectChunkPatch`
   * are exported and reachable without one. Thrown rather than deduplicated,
   * since a caller that passed a repeat believes it has more judges than it
   * has, and silently collapsing the roster answers a question it did not ask.
   *
   * Before the fan-out rather than at the count, so a roster fault costs no
   * model calls.
   */
  const distinctJudges = new Set(judges,);
  if (distinctJudges.size !== judges.length) {
    throw new ProducerRosterError({
      producerModelIds: candidates.flatMap(function toStakeholders(
        candidate,
      ): readonly SyntheticModelId[] {
        return producerModelIds(candidate.producer,);
      },),
      judgeModelIds: judges,
      role: 'producer',
      fault: 'a judge is listed more than once, which would let one model reach the minimum weight alone',
    },);
  }

  /**
   * Models with a stake in each one-based candidate index, for telling a
   * self-vote from an ordinary one.
   */
  const stakesByIndex = new Map(
    candidates.map(function toStake(
      candidate,
      index,
    ): readonly [
      number,
      ReadonlySet<SyntheticModelId>,
    ] {
      return [
        index + 1,
        new Set(producerModelIds(candidate.producer,),),
      ];
    },),
  );

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
   * Every ballot as cast, weighed, and carried out of this function rather
   * than left in a log line.
   *
   * Self-votes are counted rather than prevented: the reason for seating
   * producers is that their judgement carries value, and the reason for
   * weighing and recording is that self-preference is a known failure of
   * exactly this arrangement. A rate nobody can read is an assumption.
   */
  const ballots: readonly SelectionBallot[] = gather.voices
    .map(function toBallot(voice,): SelectionBallot {
      /**
       * This judge's chosen index.
       */
      const { best, } = voice.value;

      /**
       * Whether this judge named text it has a stake in.
       */
      const ownWork = stakesByIndex.get(best,)
        ?.has(voice.modelId,)
        === true;
      /**
       * Whether this ballot names a candidate at all.
       */
      const usable = (best !== CANDIDATE_NONE) && (best <= candidates.length);
      return {
        modelId: voice.modelId,
        best,
        reason: voice.value
          .reason,
        weight: usable
          ? (ownWork ? SELF_VOTE_WEIGHT : FULL_VOTE_WEIGHT)
          : 0,
        selfVote: usable && ownWork,
      };
    },);

  /**
   * What each candidate drew, kept per index so a decline says by how much the
   * leader fell short and against what.
   */
  const perCandidate = countCandidateWeights({
    ballots,
    candidateCount: candidates.length,
  },);

  /**
   * Ballot weight per one-based candidate index; out-of-range ballots and
   * explicit declines are counted as abstentions rather than discarded
   * silently.
   */
  const tally = new Map<number, number>();

  /**
   * Ballots that named no usable candidate, kept so a selection that failed
   * for want of agreement is distinguishable from one nobody voted in, and
   * ballots a judge cast for its own work.
   */
  const counters = {
    abstained: 0,
    self: 0,
  };
  for (const ballot of ballots) {
    if (ballot.weight === 0) {
      counters.abstained += 1;
      continue;
    }
    if (ballot.weight === SELF_VOTE_WEIGHT)
      counters.self += 1;
    tally.set(
      ballot.best,
      (tally.get(ballot.best,) ?? 0) + ballot.weight,
    );
    sl.info(
      `${ballot.modelId} chose candidate ${String(ballot.best,)} at weight ${
        String(ballot.weight,)
      }: ${ballot.reason}`,
    );
  }

  /**
   * Ballots a judge cast for its own work, named so the rate is readable from
   * findings as well as from the tally.
   */
  const selfVotes = ballots.filter(function isSelfVote(ballot,): boolean {
    return ballot.weight === SELF_VOTE_WEIGHT;
  },);

  /**
   * Findings every exit past the fan-out carries.
   */
  const roundFindings: readonly string[] = [
    ...gather.findings,
    ...selfVotes.map(function toSelfVoteFinding(ballot,): string {
      return `select-self-vote (${ballot.modelId})`;
    },),
  ];

  /**
   * What this round counted, reported whichever way it ends.
   */
  const counted: SelectionTally = {
    judgesAvailable: judges.length,
    ballots: gather.voices
      .length,
    abstentions: counters.abstained,
    selfVotes: counters.self,
  };

  /**
   * Candidate indexes ordered by drawn weight, most first.
   */
  const ranked = [...tally.entries(),].toSorted(function byWeight(
    a,
    b,
  ): number {
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
      disposition: 'rejection',
      tally: counted,
      findings: roundFindings,
      ballots,
      perCandidate,
    };
  }

  /**
   * Runner-up's drawn weight, zero when only one candidate drew any.
   */
  const runnerUpWeight = ranked[1]?.[1] ?? 0;
  if (leader[1] === runnerUpWeight) {
    sl.info(`judges tied at weight ${String(leader[1],)}; keeping the fallback`,);
    return {
      kind: 'declined',
      reason: 'judges tied',
      disposition: 'indecision',
      tally: counted,
      findings: roundFindings,
      ballots,
      perCandidate,
    };
  }
  if (leader[1] < MIN_SELECTION_WEIGHT) {
    // A plurality of one is not agreement. Lost voices and abstentions can
    // leave a single judge as the only one who named anything, and letting
    // that judge decide would put one model back in control of the stage.
    sl.info(
      `winner drew only weight ${String(leader[1],)} across ${String(counted.ballots,)} ballots `
      + `(${String(counted.abstentions,)} abstentions); keeping the fallback`,
    );
    return {
      kind: 'declined',
      reason: 'winner short of the minimum vote weight',
      disposition: 'indecision',
      tally: counted,
      findings: roundFindings,
      ballots,
      perCandidate,
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
      disposition: 'rejection',
      tally: counted,
      findings: roundFindings,
      ballots,
      perCandidate,
    };
  }
  sl.info(
    `candidate ${String(leader[0],)} from ${describeProducer(winner.producer,)} won `
    + `weight ${String(leader[1],)} across ${String(counted.ballots,)} ballots`,
  );
  return {
    kind: 'selected',
    value: winner.value,
    producer: winner.producer,
    voteWeight: leader[1],
    selectedIndex: leader[0],
    tally: counted,
    findings: roundFindings,
    ballots,
    perCandidate,
  };
}

//endregion Candidate selection stage
