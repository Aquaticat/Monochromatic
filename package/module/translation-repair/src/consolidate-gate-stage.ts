import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import { contestResponseFormat, } from './contest-ballot-wire.ts';
import {
  buildConsolidateGateMessages,
  type ConsolidateGateSubject,
  type GateBallot,
  type GateChoice,
  isConsolidateGateWire,
  readConsolidateGateBallot,
} from './consolidate-gate-wire.ts';
import { runGatherRound, } from './stage-round.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Consolidate gate stage
// DECIDES WHETHER THE RENDERING THIS RUN WROTE REPLACES THE ONE THAT WOULD SHIP.
//
// NO SINGLE MODEL DECIDES, as everywhere else in this package.
//
// THE STANDING TEXT WINS EVERYTHING THAT IS NOT A CLEAR WIN FOR THE
// CONSOLIDATION: a tie, a refusal, and a roster too thin to settle all keep it.
// Changing what a reader sees on a memorial page needs more evidence than
// leaving it, and `translate-wire.ts` already records the reason: a reader who
// knows this archive should not see it churn.
//
// WHAT THE ROSTER SETTLED ON AND WHAT SHIPS ARE REPORTED SEPARATELY, because
// they differ on exactly the cases a later reader will ask about. A slice where
// the roster refused and a slice where it never answered both ship the standing
// text, and only one of them is evidence about the passage.

/**
 * Voices that must back the consolidation before it replaces anything.
 *
 * TWO, matching the lane contest and every other agreement rule here.
 */
export const CONSOLIDATE_GATE_QUORUM = 2;

/**
 * Voices the round waits for before it starts timing out stragglers.
 */
const HEARD_NEEDED = 2;

/**
 * Schema a reply must satisfy before it reaches the reader.
 */
const GATE_RESPONSE_FORMAT: JsonSchemaResponseFormat = contestResponseFormat({ schemaName: 'consolidate_gate', },);

/**
 * Rendering that ships once the gate has answered.
 */
export type GateShipped = 'consolidated' | 'standing';

/**
 * What the roster settled for one gated slice.
 *
 * @example
 * ```ts
 * const outcome: ConsolidateGateOutcome = { choice: 'standing', ships: 'standing', ballots: [], usable: 0, findings: [], };
 * ```
 */
export type ConsolidateGateOutcome = {
  /**
   * What the roster settled on, refusal included.
   */
  readonly choice: GateChoice;

  /**
   * Rendering that ships, after the rule that a tie keeps the standing text.
   */
  readonly ships: GateShipped;

  /**
   * Every usable ballot, for the audit trail.
   */
  readonly ballots: readonly GateBallot[];

  /**
   * Voices whose answer arrived and could be read as a ballot.
   */
  readonly usable: number;

  /**
   * What went wrong, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Counts how many ballots named one rendering.
 *
 * @param ballots - usable ballots
 *
 * @param name - rendering to count votes for
 *
 * @returns Voice count for that rendering
 *
 * @example
 * ```ts
 * const backing = countFor({ ballots, name: 'consolidated', },);
 * ```
 */
function countFor(
  {
    ballots,
    name,
  }: {
    readonly ballots: readonly GateBallot[];
    readonly name: GateChoice;
  },
): number {
  /**
   * Ballots naming that rendering.
   */
  const named = ballots.filter(function namesIt(ballot,): boolean {
    return ballot.choice === name;
  },);
  return named.length;
}

/**
 * Reads what the roster settled on, or the refusal.
 *
 * SHARED WITH ANY LATER READER of a stored gate record, on the rule the lane
 * contest already follows: a recorded verdict nobody can recompute from the
 * ballots beside it can quietly become a lie.
 *
 * @param ballots - usable ballots
 *
 * @returns Rendering enough voices backed, or the refusal
 *
 * @example
 * ```ts
 * const choice = settleGateBallots({ ballots, },);
 * ```
 */
export function settleGateBallots(
  { ballots, }: { readonly ballots: readonly GateBallot[]; },
): GateChoice {
  /**
   * Voices backing the rendering this run wrote.
   */
  const consolidated = countFor({
    ballots,
    name: 'consolidated',
  },);

  /**
   * Voices backing the rendering that would ship anyway.
   */
  const standing = countFor({
    ballots,
    name: 'standing',
  },);
  if ((consolidated >= CONSOLIDATE_GATE_QUORUM) && (consolidated > standing))
    return 'consolidated';
  if ((standing >= CONSOLIDATE_GATE_QUORUM) && (standing > consolidated))
    return 'standing';
  return 'neither';
}

/**
 * Asks the roster whether one consolidation replaces the standing text.
 *
 * @param client - synthetic chat client
 *
 * @param modelIds - roster to ask
 *
 * @param subject - passage, archive rendering and the two renderings
 *
 * @param signal - abort shared with the rest of the entry
 *
 * @param exchangeTimeoutMs - per-call ceiling
 *
 * @param l - logger to tag
 *
 * @returns What the roster settled, what ships, and every usable ballot
 *
 * @example
 * ```ts
 * const outcome = await gateConsolidatedSlice({ client, modelIds, subject, signal, exchangeTimeoutMs, l, },);
 * ```
 */
export async function gateConsolidatedSlice(
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
    readonly subject: ConsolidateGateSubject;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<ConsolidateGateOutcome> {
  /**
   * Logger naming this stage.
   */
  const gl = tagged({
    l,
    tag: gateConsolidatedSlice.name,
  },);

  /**
   * One reply per voice, heard or lost.
   */
  const outcomes = await runGatherRound({
    client,
    modelIds,
    messages: buildConsolidateGateMessages({ subject, },),
    signal,
    exchangeTimeoutMs,
    responseFormat: GATE_RESPONSE_FORMAT,
    validate: isConsolidateGateWire,
    stage: 'consolidate-gate',
    l: gl,
    heardNeeded: HEARD_NEEDED,
  },);

  /**
   * Ballots read out of the replies that arrived and validated in shape.
   */
  const ballots = outcomes.flatMap(function toBallot(
    outcome,
  ): readonly GateBallot[] {
    /**
     * This voice, heard or lost.
     */
    const { voice, } = outcome;
    return voice.heard
      ? [ readConsolidateGateBallot({ wire: voice.value, },), ]
      : [];
  },);

  /**
   * What the roster settled on.
   */
  const choice = settleGateBallots({ ballots, },);

  /**
   * Rendering that ships, after the rule that only a clear win replaces.
   */
  const ships: GateShipped = ((ballots.length >= CONSOLIDATE_GATE_QUORUM)
      && (choice === 'consolidated'))
    ? 'consolidated'
    : 'standing';
  gl.info(
    `consolidate gate: ${String(ballots.length,)}/${String(outcomes.length,)} usable, settled on ${choice}, ships ${ships}`,
  );
  return {
    choice,
    ships,
    ballots,
    usable: ballots.length,
    findings: (ballots.length < CONSOLIDATE_GATE_QUORUM)
      ? [ `consolidate-gate heard ${String(ballots.length,)} usable ballots, below the ${String(CONSOLIDATE_GATE_QUORUM,)} needed to settle`, ]
      : [],
  };
}

//endregion Consolidate gate stage
