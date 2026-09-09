import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { selectionFanOut, } from './candidate-select-fanout.ts';
import {
  MIN_SELECTION_BALLOTS,
  selectionMinimum,
  shortBenchFinding,
} from './candidate-select-minimum.ts';
import { countBallots, } from './candidate-select-count.ts';
import {
  type Candidate,
  describeProducer,
  producerModelIds,
  SELF_VOTE_WEIGHT,
  type SelectionOutcome,
  type SelectionTally,
} from './candidate-select-model.ts';
import {
  buildCandidateSelectMessages,
  CANDIDATE_SELECT_RESPONSE_FORMAT,
  isCandidateBallotAsSent,
  type SelectEvidence,
} from './candidate-select-wire.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { ProducerRosterError, } from './repair-contract.ts';
import type { FanOutMode, } from './stage-fanout-window.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

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
 * @param declineConsequence - what this caller does when every judge declines,
 * omitted where the default holds
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sourceText - original the candidates render, when the caller has
 * it, so the sheet names a candidate lacking a community rendering
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
 * const outcome = await decideBestCandidate({ client, candidates, judgeModelIds, ... },);
 * ```
 */
export async function decideBestCandidate<ValueT,>(
  {
    client,
    candidates,
    judgeModelIds,
    task,
    criteria,
    evidence,
    declineConsequence,
    signal,
    perCallTimeoutMs,
    l,
    fanOut,
    sourceText,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly candidates: readonly Candidate<ValueT>[];
    readonly judgeModelIds: readonly RosterModelId[];
    readonly task: string;
    readonly criteria: readonly string[];
    readonly evidence: readonly SelectEvidence[];
    readonly declineConsequence?: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
    readonly fanOut?: FanOutMode;
    readonly sourceText?: string;
  }>,
): Promise<SelectionOutcome<ValueT>> {
  /**
   * Logger tagged with this stage.
   */
  const sl = tagged({
    tag: decideBestCandidate.name,
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
   * enough to reach the minimum weight alone: exactly the single-model
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
      ): readonly RosterModelId[] {
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
      ReadonlySet<RosterModelId>,
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
      ...((declineConsequence === undefined) ? {} : { declineConsequence, }),
      // Conditional spread keeps the original absent instead of undefined.
      ...((sourceText === undefined) ? {} : { sourceText, }),
    },),
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: CANDIDATE_SELECT_RESPONSE_FORMAT,
    validate: isCandidateBallotAsSent,
    stage: 'select',
    l,
    fanOut: selectionFanOut({
      judgeCount: judges.length,
      // Conditional spread keeps the request absent instead of undefined.
      ...((fanOut === undefined) ? {} : { requested: fanOut, }),
    },),
  },);

  /**
   * Every ballot as cast and weighed, what each candidate drew, the ranking
   * and the abstention and self-vote counts (`candidate-select-count.ts`).
   */
  const {
    ballots,
    perCandidate,
    ranked,
    abstained,
    self,
  } = countBallots({
    voices: gather.voices,
    stakesByIndex,
    candidateCount: candidates.length,
    l: sl,
  },);

  /**
   * Ballots a judge cast for its own work, named so the rate is readable from
   * findings as well as from the tally.
   */
  const selfVotes = ballots.filter(function isSelfVote(ballot,): boolean {
    return ballot.weight === SELF_VOTE_WEIGHT;
  },);

  /**
   * Minimum this round applies, sized to the seats a wet provider could
   * serve (the owner's decision of 2026-09-09, `candidate-select-minimum.ts`).
   */
  const minimum = selectionMinimum({
    benchSize: judges.length,
    unreachable: gather.unreachable
      .size,
  },);
  /**
   * Minimum weight as the log prints it.
   */
  const minimumLabel = minimum.weight
    .toFixed(2,);
  if (minimum.short) {
    sl.warn(
      `bench short of quorum: ${String(minimum.reachable,)} of ${String(judges.length,)} seats reachable against a `
        + `quorum of ${String(minimum.quorum,)}; the winner needs weight ${minimumLabel} from at least `
        + `${String(MIN_SELECTION_BALLOTS,)} ballots`,
    );
  }

  /**
   * Findings every exit past the fan-out carries.
   */
  const roundFindings: readonly string[] = [
    ...gather.findings,
    ...(minimum.short
      ? [shortBenchFinding({
        minimum,
        benchSize: judges.length,
      },),]
      : []),
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
    abstentions: abstained,
    selfVotes: self,
  };

  /**
   * Leading entry, absent when every judge abstained.
   */
  const [leader,] = ranked;
  if (leader === undefined) {
    sl.info(
      `every judge declined (${String(abstained,)} abstentions); keeping the fallback`,
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
  if (leader[1] < minimum.weight) {
    // A plurality of one is not agreement. Lost voices and abstentions can
    // leave a single judge as the only one who named anything, and letting
    // that judge decide would put one model back in control of the stage.
    sl.info(
      `winner drew only weight ${String(leader[1],)} across ${String(counted.ballots,)} ballots `
      + `(${String(counted.abstentions,)} abstentions) against a minimum of ${minimumLabel}; keeping the fallback`,
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
   * What the leader drew, absent only if the tally and the per-candidate
   * count disagree.
   */
  const leaderDrawn = perCandidate.find(function isLeader(drawn,): boolean {
    return drawn.index === leader[0];
  },);

  /**
   * Ballots naming the leader, self-votes included.
   */
  const leaderBallots = leaderDrawn?.ballots ?? 0;
  if (leaderBallots < MIN_SELECTION_BALLOTS) {
    // THE FLOOR UNDER THE SCALED MINIMUM. On a bench short of quorum the
    // weight can fall to what one full ballot carries; two ballots is what
    // keeps one judge from deciding, which is what the absolute minimum was
    // for (owner, 2026-09-09).
    sl.info(
      `winner was named by ${String(leaderBallots,)} ballot against a floor of ${String(MIN_SELECTION_BALLOTS,)}; `
      + 'keeping the fallback',
    );
    return {
      kind: 'declined',
      reason: 'winner named by one judge alone',
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
