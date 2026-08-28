import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import {
  CONTEST_REFUSAL,
  contestResponseFormat,
} from './contest-ballot-wire.ts';
import {
  buildConsolidationPolishGateMessages,
  type ConsolidationPolishBallot,
  type ConsolidationPolishGateSubject,
  isConsolidationPolishGateWire,
  type PolishChoice,
  readConsolidationPolishBallot,
} from './consolidation-polish-gate-wire.ts';
import { runGatherRound, } from './stage-round.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation polish gate stage

/**
 * Voices required before polish replaces approved base.
 */
export const CONSOLIDATION_POLISH_GATE_QUORUM = 2;

/**
 * Voices gathered before grace begins.
 */
const HEARD_NEEDED = 2;

/**
 * Structured reply contract for naturalness gate.
 */
const RESPONSE_FORMAT: JsonSchemaResponseFormat = contestResponseFormat({
  schemaName: 'consolidation_polish_gate',
  asksArchive: false,
},);

/**
 * Result of final naturalness gate.
 *
 * @example
 * ```ts
 * const outcome: ConsolidationPolishGateOutcome = { choice: 'base', ships: 'base', ballots: [], usable: 0, findings: [], };
 * ```
 */
export type ConsolidationPolishGateOutcome = {
  /**
   * Panel choice, refusal included.
   */
  readonly choice: PolishChoice;

  /**
   * Text role shipping after conservative tie rule.
   */
  readonly ships: 'polished' | 'base';

  /**
   * Every usable ballot.
   */
  readonly ballots: readonly ConsolidationPolishBallot[];

  /**
   * Number of usable voices.
   */
  readonly usable: number;

  /**
   * Stable stage findings.
   */
  readonly findings: readonly string[];
};

/**
 * Counts ballots naming candidate.
 *
 * @param ballots - usable ballots
 *
 * @param choice - candidate to count
 *
 * @returns Number naming candidate
 *
 * @example
 * ```ts
 * const votes = polishVotesFor({ ballots, choice: 'polished', });
 * ```
 */
function polishVotesFor(
  {
    ballots,
    choice,
  }: {
    readonly ballots: readonly ConsolidationPolishBallot[];
    readonly choice: PolishChoice;
  },
): number {
  /**
   * Ballots selecting requested choice.
   */
  const named = ballots.filter(function names(ballot,): boolean {
    return ballot.choice === choice;
  },);
  return named.length;
}

/**
 * Settles naturalness ballots with approved base winning every tie.
 *
 * @param ballots - usable ballots
 *
 * @returns Clear winner or refusal
 *
 * @example
 * ```ts
 * const choice = settleConsolidationPolishBallots({ ballots, });
 * ```
 */
export function settleConsolidationPolishBallots(
  { ballots, }: { readonly ballots: readonly ConsolidationPolishBallot[]; },
): PolishChoice {
  /**
   * Votes backing proposed polish.
   */
  const polished = polishVotesFor({
    ballots,
    choice: 'polished',
  },);
  /**
   * Votes backing approved base.
   */
  const base = polishVotesFor({
    ballots,
    choice: 'base',
  },);
  if ((polished >= CONSOLIDATION_POLISH_GATE_QUORUM) && (polished > base))
    return 'polished';
  if ((base >= CONSOLIDATION_POLISH_GATE_QUORUM) && (base > polished))
    return 'base';
  return CONTEST_REFUSAL;
}

/**
 * Asks roster whether naturalness polish may replace approved base.
 *
 * @param client - shared provider client
 *
 * @param modelIds - fidelity and naturalness judges
 *
 * @param subject - original and both English candidates
 *
 * @param signal - caller cancellation
 *
 * @param exchangeTimeoutMs - per-call ceiling
 *
 * @param l - parent logger
 *
 * @returns Panel outcome with conservative shipping choice
 *
 * @example
 * ```ts
 * const outcome = await gateConsolidationPolish({ client, modelIds, subject, signal, exchangeTimeoutMs, l, });
 * ```
 */
export async function gateConsolidationPolish(
  {
    client,
    modelIds,
    subject,
    signal,
    exchangeTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly subject: ConsolidationPolishGateSubject;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<ConsolidationPolishGateOutcome> {
  /**
   * Logger naming final naturalness gate.
   */
  const gl = tagged({
    l,
    tag: gateConsolidationPolish.name,
  },);
  /**
   * One outcome per requested voice.
   */
  const outcomes = await runGatherRound({
    client,
    modelIds,
    messages: buildConsolidationPolishGateMessages({ subject, },),
    signal,
    exchangeTimeoutMs,
    responseFormat: RESPONSE_FORMAT,
    validate: isConsolidationPolishGateWire,
    stage: 'consolidation-polish-gate',
    l: gl,
    heardNeeded: HEARD_NEEDED,
  },);
  /**
   * Ballots read from usable voices.
   */
  const ballots = outcomes.flatMap(function toBallot(
    outcome,
  ): readonly ConsolidationPolishBallot[] {
    /**
     * Voice heard or lost.
     */
    const { voice, } = outcome;
    return voice.heard
      ? [readConsolidationPolishBallot({ wire: voice.value, },),]
      : [];
  },);
  /**
   * Panel choice from ballots.
   */
  const choice = settleConsolidationPolishBallots({ ballots, },);
  /**
   * Approved base wins every non-clear outcome.
   */
  const ships = (choice === 'polished') ? 'polished' as const : 'base' as const;
  gl.info(
    `consolidation polish gate: ${String(ballots.length,)}/${String(outcomes.length,)} usable, settled on ${choice}, ships ${ships}`,
  );
  return {
    choice,
    ships,
    ballots,
    usable: ballots.length,
    findings: (ballots.length < CONSOLIDATION_POLISH_GATE_QUORUM)
      ? [
        `consolidation-polish-gate heard ${String(ballots.length,)} usable ballots, below ${String(CONSOLIDATION_POLISH_GATE_QUORUM,)} needed to settle`,
      ]
      : [],
  };
}

//endregion Consolidation polish gate stage
