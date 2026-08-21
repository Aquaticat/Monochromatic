import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import {
  buildLaneContestMessages,
  isLaneContestWire,
  type LaneChoice,
  type LaneContestBallot,
  type LaneContestSubject,
  readLaneContestBallot,
} from './lane-contest-wire.ts';
import { runGatherRound, } from './stage-round.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Lane contest stage
// SETTLES ONE CONTESTED SLICE by asking the roster which candidate the original
// supports, and counting the answers.
//
// NO SINGLE MODEL DECIDES, which is this package's rule wherever a model is
// asked anything. It matters here because the thing being decided is what a
// reader will see on a memorial page, with no later stage to catch a mistake.
//
// DECLINING IS COUNTED, NOT DISCARDED. A judge answering `neither` has said
// something: that the two candidates differ only in wording. Treating that as a
// lost voice would make an undecidable slice look like an unanswered one, and
// those need opposite handling.

/**
 * Voices that must back a candidate before it is called the winner.
 *
 * TWO, matching every other agreement rule in this package. One judge is an
 * opinion; two reaching the same reading of the same original is corroboration.
 *
 * FROZEN, like the version 2 comparison rules. The settled-artifact reader
 * recomputes every recorded verdict against this number, so raising or lowering
 * it re-decides every contest already on disk and makes artifacts settled under
 * the old value refuse to parse. A different quorum is a different question and
 * needs a new artifact generation, not a tuned constant.
 */
export const LANE_CONTEST_QUORUM = 2;

/**
 * Voices the round waits for before it starts timing out stragglers.
 */
const HEARD_NEEDED = 2;

/**
 * Schema a reply must satisfy before it reaches the reader.
 */
const CONTEST_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'lane_contest',
    schema: {
      type: 'object',
      properties: {
        choice: { type: 'string', },
        unsupported: {
          type: 'array',
          items: { type: 'string', },
        },
        dropped: {
          type: 'array',
          items: { type: 'string', },
        },
        reason: { type: 'string', },
      },
      required: [
        'choice',
        'unsupported',
        'dropped',
        'reason',
      ],
    },
  },
};

/**
 * What the roster settled on for one contested slice.
 *
 * @example
 * ```ts
 * const outcome: LaneContestOutcome = { choice: 'neither', ballots: [], usable: 0, findings: [], };
 * ```
 */
export type LaneContestOutcome = {
  /**
   * Candidate enough voices backed, or `neither`.
   */
  readonly choice: LaneChoice;

  /**
   * Every usable ballot, for the audit trail.
   */
  readonly ballots: readonly LaneContestBallot[];

  /**
   * Voices whose answer arrived and could be read as a ballot.
   *
   * ONE COUNT RATHER THAN TWO. Other stages separate voices heard from voices
   * whose reply survived their reader, because those readers can refuse a
   * well-shaped reply. This one cannot: anything passing the shape guard reads
   * as a ballot, so a second count would always equal the first and invite a
   * reader to believe otherwise.
   */
  readonly usable: number;

  /**
   * What went wrong, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Counts how many ballots named each candidate.
 *
 * @param ballots - usable ballots
 *
 * @returns Voice count per candidate name
 *
 * @example
 * ```ts
 * const votes = countChoices({ ballots, },);
 * ```
 */
function countChoices(
  { ballots, }: { readonly ballots: readonly LaneContestBallot[]; },
): ReadonlyMap<LaneChoice, number> {
  /**
   * Votes so far.
   */
  const votes = new Map<LaneChoice, number>();
  for (const ballot of ballots)
    votes.set(
      ballot.choice,
      (votes.get(ballot.choice,) ?? 0) + 1,
    );
  return votes;
}

/**
 * Reads the winner out of the votes, or `neither`.
 *
 * A CLEAR WINNER OR NONE. A candidate that ties with the other has not been
 * chosen, and shipping either on a tie would be picking by list order.
 *
 * @param votes - voice count per candidate
 *
 * @returns Candidate to ship, or `neither`
 *
 * @example
 * ```ts
 * const choice = settleVotes({ votes, },);
 * ```
 */
function settleVotes(
  { votes, }: { readonly votes: ReadonlyMap<LaneChoice, number>; },
): LaneChoice {
  /**
   * Votes for the repair candidate.
   */
  const repair = votes.get('repair',) ?? 0;

  /**
   * Votes for the translate candidate.
   */
  const translate = votes.get('translate',) ?? 0;
  if ((repair >= LANE_CONTEST_QUORUM) && (repair > translate))
    return 'repair';
  if ((translate >= LANE_CONTEST_QUORUM) && (translate > repair))
    return 'translate';
  return 'neither';
}

/**
 * Reads the winner out of a set of ballots, or `neither`.
 *
 * SHARED WITH THE ARTIFACT READER rather than kept private, so a stored verdict
 * can be recomputed from the ballots stored beside it and refused when the two
 * disagree, exactly as the recorded lane comparison already is.
 *
 * @param ballots - usable ballots
 *
 * @returns Candidate to ship, or `neither`
 *
 * @example
 * ```ts
 * const choice = settleLaneContestBallots({ ballots, },);
 * ```
 */
export function settleLaneContestBallots(
  { ballots, }: { readonly ballots: readonly LaneContestBallot[]; },
): LaneChoice {
  return settleVotes({ votes: countChoices({ ballots, },), },);
}

/**
 * Asks the roster which candidate one contested slice should ship.
 *
 * @param client - synthetic chat client
 *
 * @param modelIds - roster to ask
 *
 * @param subject - passage, archive rendering and both candidates
 *
 * @param signal - abort shared with the rest of the entry
 *
 * @param exchangeTimeoutMs - per-call ceiling
 *
 * @param l - logger to tag
 *
 * @returns What the roster settled on, with every usable ballot
 *
 * @example
 * ```ts
 * const outcome = await contestLaneSlice({ client, modelIds, subject, signal, exchangeTimeoutMs, l, },);
 * ```
 */
export async function contestLaneSlice(
  {
    client,
    modelIds,
    subject,
    signal,
    exchangeTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly modelIds: readonly SyntheticModelId[];
    readonly subject: LaneContestSubject;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<LaneContestOutcome> {
  /**
   * Logger naming this stage.
   */
  const cl = tagged({
    l,
    tag: contestLaneSlice.name,
  },);

  /**
   * One reply per voice, heard or lost.
   */
  const outcomes = await runGatherRound({
    client,
    modelIds,
    messages: buildLaneContestMessages({ subject, },),
    signal,
    exchangeTimeoutMs,
    responseFormat: CONTEST_RESPONSE_FORMAT,
    validate: isLaneContestWire,
    stage: 'lane-contest',
    l: cl,
    heardNeeded: HEARD_NEEDED,
  },);

  /**
   * Ballots read out of the replies that arrived and validated in shape.
   *
   * FLAT-MAPPED RATHER THAN FILTERED AND MAPPED, so the narrowing on `heard`
   * reaches the value: a filtered array is still typed as the whole union.
   */
  const ballots = outcomes.flatMap(function toBallot(
    outcome,
  ): readonly LaneContestBallot[] {
    /**
     * This voice, heard or lost.
     */
    const { voice, } = outcome;
    return voice.heard
      ? [ readLaneContestBallot({ wire: voice.value, },), ]
      : [];
  },);

  /**
   * Candidate enough voices backed.
   */
  const choice = settleLaneContestBallots({ ballots, },);
  cl.info(
    `lane contest: ${String(ballots.length,)}/${String(outcomes.length,)} usable, settled on ${choice}`,
  );
  return {
    choice,
    ballots,
    usable: ballots.length,
    findings: (ballots.length < LANE_CONTEST_QUORUM)
      ? [ `lane-contest heard ${String(ballots.length,)} usable ballots, below the ${String(LANE_CONTEST_QUORUM,)} needed to settle`, ]
      : [],
  };
}

//endregion Lane contest stage
