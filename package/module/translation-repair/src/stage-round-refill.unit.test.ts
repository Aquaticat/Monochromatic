/**
 Tests that a seat the router refuses for want of a wet provider gives its
 place in the round to the next pending seat at once, rather than leaving the
 round to wait on its slowest remaining voice or to fall through to a retry
 round, and that a windowed stage never re-asks a refused seat.

 TianqiChen66620 (2026-09-27): 269 of 421 rounds lost a seat and closed with
 no grace window, 2,852 s of the 4,575 s its rounds took, while the seat
 reader had seated two judges no provider served; the ledger's P3 and X7.

 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  gatherStageVoices,
  type JsonSchemaResponseFormat,
  NoProviderForModelError,
  type RosterModelId,
  rotatedBench,
  runWindowedRounds,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_TEXT_BEDROCK,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 How long the slow seat takes to answer, far past the grace window, so a
 round that waited for it is told apart from one that closed on the others.
 */
const SLOW_MS = 1_500;

/**
 Straggler window after quorum, short so the test's wall clock stays small.
 */
const GRACE_MS = 20;

/**
 Exchange deadline, above the slow seat's answer so it is not cut by it.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 Logger for the rounds under test.
 */
const l = tagged({ tag: 'stage-round-refill-test', },);

/**
 Prompt every seat is asked, which also fixes the rotation.
 */
const MESSAGES = [{ role: 'user', content: 'which cushion is warmest', },] as const;

/**
 Six seats, whose roles are assigned by their place in the prompt's rotation.
 */
const SIX_SEATS: readonly RosterModelId[] = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_HYPER_VISION,
  SEAT_HYPER_TEXT_BEDROCK,
];

/**
 How a scripted seat behaves when asked.
 */
type SeatRole = 'refused' | 'slow' | 'fast' | 'failing';

/**
 Trivial reply payload the scripted client emits.
 */
type PurrReply = {
  readonly purr: string;
};

/**
 Guards the trivial payload.

 @param value - reply to check

 @returns Whether the reply is the scripted shape
 */
function isPurrReply(value: unknown,): value is PurrReply {
  return ((typeof value) === 'object') && (value !== null)
    && ((typeof (value as PurrReply).purr) === 'string');
}

/**
 Response format naming the test stage.
 */
const PURR_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'purr_reply',
    schema: { type: 'object', },
  },
};

/**
 Client scripted per seat: refused by the router, answering late, answering
 at once, or failing in transport on a wet provider; records every call.

 @param roles - behaviour per seat

 @param calls - call count per seat, written as calls arrive

 @returns Client honouring that script

 @example
 ```ts
 const client = scriptedClient({ roles, calls, },);
 ```
 */
function scriptedClient(
  {
    roles,
    calls,
  }: {
    readonly roles: ReadonlyMap<RosterModelId, SeatRole>;
    readonly calls: Record<string, number>;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      calls[request.modelId] = (calls[request.modelId] ?? 0) + 1;
      /**
       What this seat was scripted to do.
       */
      const role = roles.get(request.modelId,);
      if (role === 'refused') {
        throw new NoProviderForModelError({
          modelId: request.modelId,
          reason: 'every provider serving this model is out of budget',
        },);
      }
      if (role === 'failing')
        throw new Error('scripted transport failure',);
      if (role === 'slow')
        await wait(SLOW_MS,);

      /**
       Scripted payload for the answering call.
       */
      const scripted: unknown = { purr: request.modelId, };
      if (!request.validate(scripted,))
        throw new Error('scripted payload failed the guard',);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 The six seats in the prompt's rotation, with the first refused by the
 router, the second slow, and the rest answering at once. The round-0
 window is the first four (quorum three of six, plus one spare), so the
 fifth is the seat a refusal should hand its place to.

 @returns Rotated seats and the role of each
 */
function refusedFirstBench(): {
  readonly rotated: readonly RosterModelId[];
  readonly roles: ReadonlyMap<RosterModelId, SeatRole>;
} {
  /**
   Seats in the order the gather will ask them.
   */
  const rotated = rotatedBench({
    modelIds: SIX_SEATS,
    messages: MESSAGES,
  },);
  /**
   Behaviour per rotated position.
   */
  const roles = new Map<RosterModelId, SeatRole>(rotated.map(function roleAt(
    modelId,
    index,
  ): readonly [
    RosterModelId,
    SeatRole,
  ] {
    if (index === 0)
      return [modelId, 'refused',];
    if (index === 1)
      return [modelId, 'slow',];
    return [modelId, 'fast',];
  },),);
  return {
    rotated,
    roles,
  };
}

/**
 Seat at one rotated position, which the fixture always has.

 @param rotated - seats in rotation order

 @param index - position wanted

 @returns Seat at that position
 */
function seatAt(
  {
    rotated,
    index,
  }: {
    readonly rotated: readonly RosterModelId[];
    readonly index: number;
  },
): RosterModelId {
  /**
   Seat at the position, if the fixture is as sized.
   */
  const seat = rotated[index];
  if (seat === undefined)
    throw new Error(`fixture has no seat at ${String(index,)}`,);
  return seat;
}

await describe({
  name: 'refused seat refill',
  children: [
    it({
      name: 'THE GATHER HANDS A REFUSED SEAT\'S PLACE TO THE NEXT PENDING SEAT in the same round, so quorum '
        + 'closes on three prompt voices and the slow one is left to the grace window',
      fn: async () => {
        /** Call count per seat. */
        const calls: Record<string, number> = {};
        /** Rotation and roles. */
        const {
          rotated,
          roles,
        } = refusedFirstBench();
        /** Gather under test. */
        const gather = await gatherStageVoices({
          client: scriptedClient({
            roles,
            calls,
          },),
          modelIds: SIX_SEATS,
          messages: MESSAGES,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          responseFormat: PURR_FORMAT,
          validate: isPurrReply,
          stage: 'critic',
          l,
          graceMs: GRACE_MS,
        },);
        /** Seats heard. */
        const heard = gather.voices.map(function seatOf({ modelId, },): RosterModelId {
          return modelId;
        },);
        expect(gather.quorumMet,).toBe(true,);
        expect(heard,).toContain(seatAt({
          rotated,
          index: 4,
        },),);
        expect(heard,).not.toContain(seatAt({
          rotated,
          index: 1,
        },),);
        expect([...gather.unreachable,],).toEqual([seatAt({
          rotated,
          index: 0,
        },),],);
        expect(calls[seatAt({
          rotated,
          index: 5,
        },)],).toBeUndefined();
      },
    },),

    it({
      name: 'A WINDOWED STAGE HANDS A REFUSED SEAT\'S PLACE ON the same way',
      fn: async () => {
        /** Call count per seat. */
        const calls: Record<string, number> = {};
        /** Rotation and roles. */
        const {
          rotated,
          roles,
        } = refusedFirstBench();
        /** Outcomes under test. */
        const outcomes = await runWindowedRounds({
          client: scriptedClient({
            roles,
            calls,
          },),
          modelIds: SIX_SEATS,
          messages: MESSAGES,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          responseFormat: PURR_FORMAT,
          validate: isPurrReply,
          stage: 'lane-contest',
          l,
          heardNeeded: 3,
          graceMs: GRACE_MS,
        },);
        /** Seats heard. */
        const heard = outcomes
          .filter(function wasHeard({ voice, },): boolean {
            return voice.heard;
          },)
          .map(function seatOf({ modelId, },): RosterModelId {
            return modelId;
          },);
        expect(heard,).toContain(seatAt({
          rotated,
          index: 4,
        },),);
        expect(heard,).not.toContain(seatAt({
          rotated,
          index: 1,
        },),);
      },
    },),

    it({
      name: 'A WINDOWED STAGE NEVER RE-ASKS A SEAT THE ROUTER REFUSED, while a seat lost in transport is '
        + 'asked again',
      fn: async () => {
        /** Call count per seat. */
        const calls: Record<string, number> = {};
        /** Four seats: one refused, one failing, two answering. */
        const roles = new Map<RosterModelId, SeatRole>([
          [SEAT_HYPER_OPENROUTER_VISION_EDITOR, 'refused',],
          [SEAT_SYNTHETIC_VISION_NO_OPENROUTER, 'failing',],
          [SEAT_SYNTHETIC_VISION_WITHHELD, 'fast',],
          [SEAT_SYNTHETIC_TEXT_EVERYWHERE, 'fast',],
        ],);
        await runWindowedRounds({
          client: scriptedClient({
            roles,
            calls,
          },),
          modelIds: [...roles.keys(),],
          messages: MESSAGES,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          responseFormat: PURR_FORMAT,
          validate: isPurrReply,
          stage: 'consolidate-gate',
          l,
          heardNeeded: 3,
          graceMs: GRACE_MS,
        },);
        expect(calls[SEAT_HYPER_OPENROUTER_VISION_EDITOR],).toBe(1,);
        expect(calls[SEAT_SYNTHETIC_VISION_NO_OPENROUTER],).toBeGreaterThan(1,);
      },
    },),
  ],
},);
