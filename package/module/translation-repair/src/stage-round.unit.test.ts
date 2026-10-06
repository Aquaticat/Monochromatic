/**
 Tests for the round boundary line, the only place a log says how long a
 fan-out took and how much of that was spent waiting after quorum already
 stood.

 THE TIMING WORK OPENED ON A LOG THAT COULD NOT ANSWER ITS OWN QUESTION.
 `doc/audit/every-volume-guard-is-blind-to-one-model.md` had to bound the
 straggler cost from above, at the grace window times the number of cut
 events, and recorded that confirming it "needs the dispatch timestamps the
 run does not currently record". These cases pin the line that records them.

 BOTH DIRECTIONS ARE COVERED, because only the pair shows the grace figure is
 a measurement rather than a constant: a round that loses a voice spends the
 whole window, and a round whose roster all answers spends almost none of it.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  runGatherRound,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import { capturingLogger, } from './capturing-logger.test-fixture.ts';
import { refusalOrder, } from './refusal-order.test-fixture.ts';
import { rejectionOf, } from './rejecting-call.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';
import {
  HOUR_MS,
  stubWallClock,
  WALL_START_MS,
} from './wall-clock-stub.test-fixture.ts';
import {
  isMeowReply,
  MEOW_FORMAT,
  untilAborted,
} from './stage-trivial-reply.test-fixture.ts';

//region Fixtures

/**
 Grace short enough to finish a test in well under a second, standing in for
 the three real minutes.
 */
const GRACE_MS = 250;

/**
 Delay a slow-but-working voice takes, comfortably inside the grace.
 */
const SLOW_MS = 40;

/**
 Milliseconds a measured wait may fall short of the delay that produced it.

 NOT A TOLERANCE ON THE BEHAVIOUR, a tolerance on the CLOCK. `stage-round.ts`
 reads both ends of every figure with `monotonicMs`, which floors to whole
 milliseconds, and Node's timer list may fire a delay fractionally early. The
 two together let a 40 ms wait report 39, which this suite did on 2026-08-25
 under load while the rest of the package was building.

 Two rather than one, because each end can lose a fraction and the early fire
 is its own. It leaves every floor here far above the figure it has to be
 distinguished from, which is a round that did not wait at all.
 */
const CLOCK_SLACK_MS = 2;

/**
 Exchange deadline the rounds are given; the scripted client arms none.
 */
const EXCHANGE_TIMEOUT_MS = 10_000;

/**
 How far past the first real answer a round's quorum mark may land.
 Half the grace: scheduling between the answer's return and the round's mark
 stays far under it even at 0.2 CPU, while a round that spent a grace's worth
 of waiting before quorum lands a whole grace past it.
 */
const QUORUM_MARK_SLACK_MS = GRACE_MS / 2;

/**
 Roster the rounds ask, named from the catalog because model identifiers are
 never invented.
 */
const ROSTER: readonly RosterModelId[] = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
];

/**
 Client answering each model on its own schedule: at once, after a delay, or
 never until the round cuts it.

 The never-answering arm has NO TIMER OF ITS OWN, deliberately. A stub that
 also gave up after some duration would report a grace window whether or not
 the cut ever reached the call, which is the one thing these cases measure.

 @param slowModelId - model that answers after {@link SLOW_MS}

 @param hangingModelId - model that answers only when the round abandons it

 @param answeredAt - clock readings of each answer as it is returned, in
 answer order, so a case can anchor the round's figures on when voices really
 answered rather than on a delay a loaded machine stretches

 @returns Client the round can drive

 @example
 ```ts
 const client = scheduledClient({ slowModelId, hangingModelId, },);
 ```
 */
function scheduledClient(
  {
    slowModelId,
    hangingModelId,
    answeredAt = [],
  }: {
    readonly slowModelId?: RosterModelId;
    readonly hangingModelId?: RosterModelId;
    readonly answeredAt?: number[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      if (request.modelId === hangingModelId) {
        await untilAborted({ signal: request.signal, },);
        throw new Error('cut by the round',);
      }
      if (request.modelId === slowModelId)
        await wait(SLOW_MS,);

      /**
       Scripted payload for the answering call.
       */
      const scripted: unknown = { meow: request.modelId, };
      if (!request.validate(scripted,))
        throw new Error('scripted payload failed the guard',);
      answeredAt.push(performance.now(),);
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
 Client answering every seat at once but one, whose call fails at once.

 @param failingModelId - seat whose call fails before any answer, a voice the
 round loses without waiting

 @returns Client the round can drive

 @example
 ```ts
 const client = clientFailingOne({ failingModelId: SEAT_SYNTHETIC_VISION_WITHHELD, },);
 ```
 */
function clientFailingOne({ failingModelId, }: { readonly failingModelId: RosterModelId; },): SyntheticClient {
  /**
   Client answering every seat at once.
   */
  const answering = scheduledClient({},);
  return {
    ...answering,
    chatJson: async function failingOne<ValueT,>(
      request: Parameters<typeof answering.chatJson>[0],
    ): Promise<Awaited<ReturnType<typeof answering.chatJson<ValueT>>>> {
      if (request.modelId === failingModelId)
        throw new Error('refused at once',);
      return await answering.chatJson(request as Parameters<typeof answering.chatJson<ValueT>>[0],);
    },
  };
}

/**
 Client whose first two seats wait for the caller's abort and then each fail,
 the way a call whose own deadline or transport failure lands as the caller
 aborts does; the third seat answers at once.

 @param failFirst - ends the first seat's call once the abort reached it,
 handed that call's signal so a case can fail it with the reason it carries

 @param failSecond - ends the second seat's call the same way, so a case
 chooses which of the two failures the round meets first

 @returns Client the round can drive

 @example
 ```ts
 const client = clientFailingAfterTheStop({ failFirst: refuseLate, failSecond: refuseSoon, },);
 ```
 */
function clientFailingAfterTheStop(
  {
    failFirst,
    failSecond,
  }: {
    readonly failFirst: (signal: AbortSignal,) => Promise<never>;
    readonly failSecond: (signal: AbortSignal,) => Promise<never>;
  },
): SyntheticClient {
  /**
   Client answering every seat at once.
   */
  const answering = scheduledClient({},);
  return {
    ...answering,
    chatJson: async function failingAfterTheStop<ValueT,>(
      request: Parameters<typeof answering.chatJson>[0],
    ): Promise<Awaited<ReturnType<typeof answering.chatJson<ValueT>>>> {
      if (request.modelId === SEAT_HYPER_OPENROUTER_VISION_EDITOR) {
        await untilAborted({ signal: request.signal, },);
        return await failFirst(request.signal,);
      }
      if (request.modelId === SEAT_SYNTHETIC_VISION_NO_OPENROUTER) {
        await untilAborted({ signal: request.signal, },);
        return await failSecond(request.signal,);
      }
      return await answering.chatJson(request as Parameters<typeof answering.chatJson<ValueT>>[0],);
    },
  };
}

/**
 Ends a call with the reason its own signal carries, which is the caller's
 forwarded reason when the caller stopped the round.

 @param signal - signal of the call, aborted by the time this runs

 @returns Never; it rejects with the signal's reason

 @throws The signal's reason, the very value the caller aborted with

 @example
 ```ts
 const client = clientFailingAfterTheStop({ failFirst: withTheCallersReason, failSecond: withTheCallersReason, },);
 ```
 */
async function withTheCallersReason(signal: AbortSignal,): Promise<never> {
  signal.throwIfAborted();
  throw new Error('unreachable: a call that waited for its abort was handed a signal that had not aborted',);
}

/**
 Numbers the round line carries, pulled back out of it.
 */
type RoundTimings = {
  readonly heard: number;
  readonly asked: number;
  readonly totalMs: number;
  readonly toQuorumMs: number;
  readonly inGraceMs: number;
};

/**
 Reads the round line back into its numbers.

 SCANNED RATHER THAN MATCHED. A pattern would accept a line whose fields had
 drifted into a different order and would say nothing useful when the line is
 absent, while splitting on the separators names the missing field.

 @param said - every message the logger kept

 @returns Numbers the single round line carried

 @throws Error when no round line was logged, or its fields are not readable

 @example
 ```ts
 const timings = readRoundLine({ said, },);
 ```
 */
function readRoundLine({ said, }: { readonly said: readonly string[]; },): RoundTimings {
  /**
   Lines that look like a round report.
   */
  const rounds = said.filter(function isRound(message,): boolean {
    return message.includes(' round: ',) && message.includes('ms in grace',);
  },);
  if (rounds.length !== 1)
    throw new Error(`expected exactly one round line, got ${String(rounds.length,)}`,);

  /**
   Fields of that line, in the order it writes them.
   */
  const fields = (rounds[0] ?? '')
    .split(', ',)
    .map(function trim(field,): string {
      return field.trim();
    },);

  /**
   Reads one field's leading number, so a renamed field fails loudly.
   */
  const numberIn = (
    { index, expect: expected, }: { readonly index: number; readonly expect: string; },
  ): number => {
    /**
     Field text at that position.
     */
    const field = fields[index] ?? '';
    if (!field.includes(expected,))
      throw new Error(`field ${String(index,)} should mention ${expected}, reads "${field}"`,);
    // Every field but the first reads `<number>ms <name>`, so splitting on the
    // unit yields the digits alone and the parse needs neither a pattern nor
    // `parseInt`'s habit of stopping wherever the digits run out.
    return Number((field.split('ms ',)[0] ?? ''),);
  };

  /**
   First field with its stage label removed, leaving the ratio.
   */
  const afterStage = (fields[0] ?? '')
    .split(' round: ',)
    .at(-1,) ?? '';

  /**
   Heard and asked counts, which the first field carries as a ratio.
   */
  const counts = afterStage
    .split(' ',)[0]
    ?.split('/',) ?? [];

  return {
    heard: Number(counts[0],),
    asked: Number(counts[1],),
    totalMs: numberIn({ index: 1, expect: 'ms total', },),
    toQuorumMs: numberIn({ index: 2, expect: 'ms to quorum', },),
    inGraceMs: numberIn({ index: 3, expect: 'ms in grace', },),
  };
}

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: runGatherRound.name,
      children: [
        it({
          name: 'SEPARATES THE TIME A ROUND WORKED FROM THE TIME IT WAITED, so a straggler cost is '
            + 'read off the log instead of bounded above at the whole grace window times the number '
            + 'of cut events, which is all the old log was found able to support',
          fn: async () => {
            /**
             Every message the round logged.
             */
            const said: string[] = [];
            /**
             When each voice really answered.
             */
            const answeredAt: number[] = [];
            /**
             Clock before the round starts, at or before its own start mark.
             */
            const startedAt = performance.now();

            await runGatherRound({
              client: scheduledClient({
                slowModelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
                hangingModelId: SEAT_SYNTHETIC_VISION_WITHHELD,
                answeredAt,
              },),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: new AbortController().signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: said, },),
              heardNeeded: 1,
              graceMs: GRACE_MS,
            },);

            /**
             What the round said about itself.
             */
            const timings = readRoundLine({ said, },);

            expect(timings.heard,).toBe(2,);
            expect(timings.asked,).toBe(ROSTER.length,);
            // The window really was spent: the hanging voice never answered, so
            // the round waited it out rather than finishing at quorum.
            expect(timings.inGraceMs,).toBeGreaterThanOrEqual(GRACE_MS - CLOCK_SLACK_MS,);
            // Quorum stood on the first voice that answered, so the round did no
            // waiting before it. Anchored on when that voice really answered
            // rather than compared with the grace: time to the first answer grows
            // with load (398 ms against a 250 ms grace at 0.2 CPU, 2026-09-27).
            /**
             Milliseconds from before the round started to the first answer, never
             shorter than the round's own reading of that instant.
             */
            const firstAnswerMs = nonNullishOrThrow(answeredAt[0],) - startedAt;
            expect(timings.toQuorumMs,).toBeLessThan(firstAnswerMs + QUORUM_MARK_SLACK_MS,);
            // The three numbers describe one round rather than three measurements.
            expect(timings.totalMs,).toBe(timings.toQuorumMs + timings.inGraceMs,);
          },
        },),

        it({
          name: 'REPORTS A GRACE OF NEARLY NOTHING WHEN THE WHOLE ROSTER ANSWERS, which is what makes '
            + 'the other case evidence: a figure that read as the full window either way would be a '
            + 'constant wearing a measurement\'s name',
          fn: async () => {
            /**
             Every message the round logged.
             */
            const said: string[] = [];

            await runGatherRound({
              client: scheduledClient({ slowModelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER, },),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: new AbortController().signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: said, },),
              heardNeeded: ROSTER.length,
              graceMs: GRACE_MS,
            },);

            /**
             What the round said about itself.
             */
            const timings = readRoundLine({ said, },);

            expect(timings.heard,).toBe(ROSTER.length,);
            expect(timings.inGraceMs,).toBeLessThan(GRACE_MS,);
            // The slow voice is what the round waited on, and it waited before
            // quorum rather than after it.
            expect(timings.toQuorumMs,).toBeGreaterThanOrEqual(SLOW_MS - CLOCK_SLACK_MS,);
            expect(timings.totalMs,).toBe(timings.toQuorumMs + timings.inGraceMs,);
          },
        },),

        it({
          name: 'REJECTS WITH THE CALLER\'S OWN ABORT REASON before quorum when two asks rethrow failures of their own '
            + 'after the abort and the later-listed ask ends first',
          fn: async () => {
            /**
             The caller's steering, aborted once every ask is in flight.
             */
            const steering = new AbortController();
            /**
             Why the caller stopped the round.
             */
            const reason = new Error('the owner called the cats in',);
            /**
             The two failures the asks end in, the later-listed one first.
             */
            const { refuseAtOnce, refuseAfterThat, } = refusalOrder();
            /**
             The round, started and left waiting on the first two seats.
             */
            const round = runGatherRound({
              client: clientFailingAfterTheStop({
                failFirst: async function timedOut(): Promise<never> {
                  return await refuseAfterThat(new Error('the first seat timed out as the stop arrived',),);
                },
                failSecond: async function disconnected(): Promise<never> {
                  return await refuseAtOnce(new Error('the second seat lost its connection as the stop arrived',),);
                },
              },),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: steering.signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: [], },),
              heardNeeded: ROSTER.length,
              graceMs: GRACE_MS,
            },);
            steering.abort(reason,);
            expect(await rejectionOf(async function stopped(): Promise<unknown> {
              return await round;
            },),).toBe(reason,);
          },
        },),

        it({
          name: 'LOGS THE FAILURE AN ASK ENDED IN AFTER THE CALLER\'S ABORT, whole as its refusal text names it, on a '
            + 'line tagged nextSettled, before the round rejects with the caller\'s own reason in its place',
          fn: async () => {
            /**
             Every message the round logged.
             */
            const said: string[] = [];
            /**
             The caller's steering, aborted once every ask is in flight.
             */
            const steering = new AbortController();
            /**
             Why the caller stopped the round.
             */
            const reason = new Error('the owner called the cats in',);
            /**
             The two failures the asks end in, the later-listed one first.
             */
            const { refuseAtOnce, refuseAfterThat, } = refusalOrder();
            /**
             The round, started and left waiting on the first two seats.
             */
            const round = runGatherRound({
              client: clientFailingAfterTheStop({
                failFirst: async function outOfTime(): Promise<never> {
                  return await refuseAfterThat(new Error('the first seat ran out of time as the owner called',),);
                },
                failSecond: async function dropped(): Promise<never> {
                  return await refuseAtOnce(new RangeError('the second seat dropped its line as the owner called',),);
                },
              },),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: steering.signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: said, },),
              heardNeeded: ROSTER.length,
              graceMs: GRACE_MS,
            },);
            steering.abort(reason,);
            expect(await rejectionOf(async function stopped(): Promise<unknown> {
              return await round;
            },),).toBe(reason,);
            expect(said,).toEqual([
              '[nextSettled] cat-stage: an ask failed as the caller stopped the round, which reports the caller\'s '
                + 'reason in its place: refused by RangeError',
            ],);
          },
        },),

        it({
          name: 'LOGS NOTHING when the asks end in the caller\'s own abort reason itself, which the round rejects with, '
            + 'so no failure is dropped',
          fn: async () => {
            /**
             Every message the round logged.
             */
            const said: string[] = [];
            /**
             The caller's steering, aborted once every ask is in flight.
             */
            const steering = new AbortController();
            /**
             Why the caller stopped the round.
             */
            const reason = new Error('the owner called the cats in',);
            /**
             The round, started and left waiting on the first two seats.
             */
            const round = runGatherRound({
              client: clientFailingAfterTheStop({
                failFirst: withTheCallersReason,
                failSecond: withTheCallersReason,
              },),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: steering.signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: said, },),
              heardNeeded: ROSTER.length,
              graceMs: GRACE_MS,
            },);
            steering.abort(reason,);
            expect(await rejectionOf(async function stopped(): Promise<unknown> {
              return await round;
            },),).toBe(reason,);
            expect(said,).toEqual([],);
          },
        },),

        it({
          name: 'REJECTS WITH A LOGGER\'S OWN FAILURE, unchanged, when no abort is in play and a lost voice cannot be '
            + 'logged',
          fn: async () => {
            /**
             What the logger raises on every warning.
             */
            const logFailure = new Error('the cat sat on the log',);
            expect(await rejectionOf(async function unlogged(): Promise<unknown> {
              return await runGatherRound({
                client: clientFailingOne({ failingModelId: SEAT_SYNTHETIC_VISION_WITHHELD, },),
                modelIds: ROSTER,
                messages: [{ role: 'user', content: 'meow', },],
                signal: new AbortController().signal,
                exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
                responseFormat: MEOW_FORMAT,
                validate: isMeowReply,
                stage: 'cat-stage',
                l: {
                  ...capturingLogger({ messages: [], },),
                  warn: function refusesToWarn(): void {
                    throw logFailure;
                  },
                },
                heardNeeded: ROSTER.length,
                graceMs: GRACE_MS,
              },);
            },),).toBe(logFailure,);
          },
        },),
      ],
    },),

    describe({
      name: 'the round line when quorum never stood (ledger P12)',
      children: [
        it({
          name: 'SAYS NO QUORUM STOOD rather than timing a quorum that never did: "select round: 3/5 heard, 18766ms '
            + 'total, 18766ms to quorum" was logged for a round that needed four voices',
          fn: async () => {
            /**
             Every message the round logged.
             */
            const said: string[] = [];
            await runGatherRound({
              client: clientFailingOne({ failingModelId: SEAT_SYNTHETIC_VISION_WITHHELD, },),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: new AbortController().signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: said, },),
              heardNeeded: ROSTER.length,
              graceMs: GRACE_MS,
            },);
            /**
             The round's own line.
             */
            const lines = said.filter(function isRound(message,): boolean {
              return message.includes(' round: ',);
            },);
            expect({
              lines: lines.length,
              noQuorum: lines.some(function says(line,): boolean {
                return line.includes(`no quorum (${String(ROSTER.length - 1,)} of ${String(ROSTER.length,)} needed)`,);
              },),
              claimsQuorum: lines.some(function claims(line,): boolean {
                return line.includes('to quorum',);
              },),
            },).toEqual({
              lines: 1,
              noQuorum: true,
              claimsQuorum: false,
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'the round line on a clock the system time cannot move (ledger B78)',
      children: [
        it({
          name: 'TIMES THE ROUND\'S OWN MILLISECONDS when the system clock is set forward two hours as the round '
            + 'starts, where the line said the round took two hours',
          fn: async ctx => {
            /**
             Every message the round logged.
             */
            const said: string[] = [];
            const wall = stubWallClock({ sinon: ctx.sinon, atMs: WALL_START_MS, },);

            /**
             The round, its start already read: nothing in it waits before that.
             */
            const round = runGatherRound({
              client: scheduledClient({},),
              modelIds: ROSTER,
              messages: [{ role: 'user', content: 'meow', },],
              signal: new AbortController().signal,
              exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
              responseFormat: MEOW_FORMAT,
              validate: isMeowReply,
              stage: 'cat-stage',
              l: capturingLogger({ messages: said, },),
              heardNeeded: ROSTER.length,
              graceMs: GRACE_MS,
            },);
            wall.step({ byMs: 2 * HOUR_MS, },);
            await round;

            /**
             What the round said about itself.
             */
            const timings = readRoundLine({ said, },);
            expect(timings.totalMs,).toBeLessThan(HOUR_MS,);
            expect(timings.totalMs,).toBe(timings.toQuorumMs + timings.inGraceMs,);
          },
        },),
      ],
    },),
  ],
},);
