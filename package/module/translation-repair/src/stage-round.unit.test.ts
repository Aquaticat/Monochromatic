/**
 Tests for the round boundary line, the only place a log says how long a
 fan-out took and how much of that was spent waiting after quorum already
 stood.
 
 `#215` OPENED ON A LOG THAT COULD NOT ANSWER ITS OWN QUESTION.
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
import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  runGatherRound,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type JsonSchemaResponseFormat,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

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
 reads both ends of every figure with `Date.now()`, which truncates to whole
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
 Trivial reply payload the scripted client emits.
 */
type MeowReply = {
  readonly meow: string;
};

/**
 Guards the trivial payload.
 */
function isMeowReply(value: unknown,): value is MeowReply {
  return ((typeof value) === 'object') && (value !== null)
    && ((typeof (value as MeowReply).meow) === 'string');
}

/**
 Response format naming the test stage.
 */
const MEOW_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'meow_reply',
    schema: { type: 'object', },
  },
};

/**
 Logger that keeps every message it was handed, so a case can assert on the
 line rather than on whatever a sink did with it.
 
 @param said - array every level appends to, newest last
 
 @returns Logger writing into that array
 
 @example
 ```ts
 const said: string[] = [];
 const l = capturingLogger({ said, },);
 ```
 */
function capturingLogger({ said, }: { readonly said: string[]; },): Logger {
  /**
   One level's writer, all seven sharing the same array.
   */
  const keep = (message: string,): void => {
    said.push(message,);
  };

  return {
    debug: keep,
    error: keep,
    fatal: keep,
    flush: async () => undefined,
    info: keep,
    trace: keep,
    warn: keep,
  };
}

/**
 Resolves when a signal aborts, and never otherwise.
 
 @param signal - call signal the round owns
 
 @returns Nothing, once the call is cut
 
 @example
 ```ts
 await untilAborted({ signal, },);
 ```
 */
async function untilAborted({ signal, }: { readonly signal: AbortSignal; },): Promise<void> {
  if (signal.aborted)
    return;

  /**
   Capability resolved by the abort listener.
   */
  const {
    promise,
    resolve,
  } = Promise.withResolvers<undefined>();
  signal.addEventListener(
    'abort',
    function onAbort(): void {
      resolve(undefined,);
    },
    { once: true, },
  );
  await promise;
}

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
      answeredAt.push(Date.now(),);
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
  name: runGatherRound.name,
  children: [
    it({
      name: 'SEPARATES THE TIME A ROUND WORKED FROM THE TIME IT WAITED, so a straggler cost is '
        + 'read off the log instead of bounded above at the whole grace window times the number '
        + 'of cut events, which is all `#215` found the log able to support',
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
        const startedAt = Date.now();

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
          l: capturingLogger({ said, },),
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
          l: capturingLogger({ said, },),
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
  ],
},);
