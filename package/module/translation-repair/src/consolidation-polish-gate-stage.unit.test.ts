/**
 Tests for how the polish gate settles and what it says when it cannot.

 WHAT THIS FILE PINS: the gate ships the base on every outcome but a clear
 polish win, and says in its findings when too few ballots were usable to
 settle or the router left the bench short; the ballot counting itself is
 pinned in `consolidation-polish-gate.unit.test.ts`.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CONSOLIDATION_POLISH_GATE_QUORUM,
  gateConsolidationPolish,
  NoProviderForModelError,
  reachableQuorum,
  shortBenchStageFinding,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import {
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';
import { HANG_STOP_MS, } from './hang-stop.test-fixture.ts';

/**
 Gate bench of three.
 */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
] as const;

/**
 Gate bench of six, whose quorum of three the router can leave out of reach.
 */
const SIX_SEAT_ROSTER = [
  ...ROSTER,
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_VISION,
] as const;

/**
 The rewrite the gate decides about, against the base it would replace.
 */
const SUBJECT = {
  sourceText: '猫在窗边睡了一下午。',
  archiveText: 'The cat slept by the window all afternoon.',
  baseText: 'The cat slept by the window the whole afternoon.',
  polishedText: 'The cat napped by the window all afternoon.',
  mode: { kind: 'comparative', },
  lineStructured: false,
} as const;

/**
 Builds a gate client from what each seat does.

 @param choice - what every seat that answers chooses

 @param unusable - seats whose reply no sheet can read

 @param refused - seats the router refuses for want of a wet provider

 @returns Scripted gate client

 @example
 ```ts
 const client = gateClient({ choice: 'base', },);
 ```
 */
function gateClient(
  {
    choice,
    unusable = [],
    refused = [],
  }: {
    readonly choice: 'base' | 'polished';
    readonly unusable?: readonly RosterModelId[];
    readonly refused?: readonly RosterModelId[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the polish gate',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      if (refused.includes(request.modelId,)) {
        throw new NoProviderForModelError({
          modelId: request.modelId,
          reason: 'every provider serving this cat is out of budget',
        },);
      }
      if (unusable.includes(request.modelId,)) {
        return {
          kind: 'schema-mismatch',
          rawText: '{}',
          detail: 'scripted unusable seat',
        };
      }
      /**
       This seat's ballot.
       */
      const value: unknown = {
        choice,
        unsupported: [],
        dropped: [],
        reason: 'the cat naps either way',
      };
      if (!request.validate(value,))
        throw new Error('scripted polish gate ballot failed validation',);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the polish gate',);
    },
  };
}

/**
 Runs the gate on one bench.

 @param client - scripted gate client

 @param modelIds - gate bench

 @returns What the gate settled, shipped and found
 */
async function gateWith(
  {
    client,
    modelIds = ROSTER,
  }: {
    readonly client: SyntheticClient;
    readonly modelIds?: readonly RosterModelId[];
  },
) {
  /**
   The gate's outcome.
   */
  const outcome = await gateConsolidationPolish({
    client,
    modelIds,
    subject: SUBJECT,
    signal: AbortSignal.timeout(HANG_STOP_MS,),
    exchangeTimeoutMs: HANG_STOP_MS,
    l: tagged({ tag: 'consolidation-polish-gate-stage-test', },),
  },);
  return {
    choice: outcome.choice,
    ships: outcome.ships,
    usable: outcome.usable,
    findings: outcome.findings,
  };
}

await describe({
  name: gateConsolidationPolish.name,
  children: [
    it({
      name: 'SHIPS THE POLISH when the judges back it by quorum, the control for every case keeping the base',
      fn: async () => {
        expect(await gateWith({ client: gateClient({ choice: 'polished', },), },),).toEqual({
          choice: 'polished',
          ships: 'polished',
          usable: ROSTER.length,
          findings: [],
        },);
      },
    },),
    it({
      name: 'SETTLES ON THE BASE and ships it when the judges back the base by quorum',
      fn: async () => {
        expect(await gateWith({ client: gateClient({ choice: 'base', },), },),).toEqual({
          choice: 'base',
          ships: 'base',
          usable: ROSTER.length,
          findings: [],
        },);
      },
    },),
    it({
      name: 'KEEPS THE BASE AND SAYS SO when too few ballots are usable to settle, however the one usable '
        + 'ballot votes',
      fn: async () => {
        /** Seats whose reply no sheet can read, leaving one usable ballot. */
        const unusable = ROSTER.slice(1,);
        /** Ballots the gate can read. */
        const usable = ROSTER.length - unusable.length;
        expect(usable,).toBeLessThan(CONSOLIDATION_POLISH_GATE_QUORUM,);
        expect(await gateWith({
          client: gateClient({
            choice: 'polished',
            unusable,
          },),
        },),).toEqual({
          choice: 'neither',
          ships: 'base',
          usable,
          findings: [
            `consolidation-polish-gate heard ${String(usable,)} usable ballot, below `
            + `${String(CONSOLIDATION_POLISH_GATE_QUORUM,)} needed to settle`,
          ],
        },);
      },
    },),
    it({
      name: 'SAYS THE BENCH WAS SHORT when the router refuses seats past the bench quorum, and still settles on '
        + 'the ballots it heard (ledger X8)',
      fn: async () => {
        /** Seats the router refuses, leaving the gate's quorum in reach and the bench's out of it. */
        const refused = SIX_SEAT_ROSTER.slice(CONSOLIDATION_POLISH_GATE_QUORUM,);
        /** The bench's quorum once those seats are out of reach. */
        const quorum = reachableQuorum({
          benchSize: SIX_SEAT_ROSTER.length,
          unreachable: refused.length,
        },);
        expect(quorum.short,).toBe(true,);
        expect(await gateWith({
          client: gateClient({
            choice: 'polished',
            refused,
          },),
          modelIds: SIX_SEAT_ROSTER,
        },),).toEqual({
          choice: 'polished',
          ships: 'polished',
          usable: SIX_SEAT_ROSTER.length - refused.length,
          findings: [
            shortBenchStageFinding({
              stage: 'consolidation-polish-gate',
              quorum,
              benchSize: SIX_SEAT_ROSTER.length,
            },),
          ],
        },);
      },
    },),
  ],
},);
