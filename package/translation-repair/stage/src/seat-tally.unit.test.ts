/**
 Tests for the seat tally: counting at the client seam and the closing report.

 THE COUNTS ARE THE EVIDENCE ONE CALIBRATION LACKED. Five of ten seats failed every
 call of a four-slice calibration and the command exited 0, because quorum was
 met on the nose by the other five and nothing read the whole run. The tally
 counts every settled call against its seat, and the report says which seats
 were asked and produced nothing usable, in the closing lines of every
 command. The cases in this file pin what "usable" means on each surface, that the
 wrapped client is otherwise untouched, and the exact lines a reader greps.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  ProviderName,
  RosterModelId,
} from '@monochromatic-dev/translation-repair-shared-contract';

import { ProviderHttpError, } from '@monochromatic-dev/translation-repair-provider-stream';
import { levelCapturingLogger, } from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  DecisionReply,
  DecisionRequest,
  ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import {
  createSeatTally,
  RUN_SEATS,
  seatReportLines,
  seatTallyClient,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_TEXT_BEDROCK,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';

//region Fixtures

/**
 Single user message reused across cases.
 */
const MESSAGES = [
  {
    role: 'user' as const,
    content: '猫猫的翻译对吗？',
  },
];

/**
 Signal reused across cases; nothing here aborts.
 */
const SIGNAL = new AbortController().signal;

/**
 Verdict shape the JSON cases validate against.
 */
type CatVerdict = { readonly verdict: string; };

/**
 Guards parsed JSON as a verdict.

 @param value - parsed candidate

 @returns Whether it carries a string verdict

 @example
 ```ts
 const ok = isCatVerdict({ verdict: 'purr', },);
 ```
 */
function isCatVerdict(value: unknown,): value is CatVerdict {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('verdict' in value)
    && ((typeof value.verdict) === 'string');
}

/**
 Failure the throwing fixture raises, kept identical so a case can assert the
 wrapper rethrew the very same value.
 */
const FAILURE = new Error('the cat unplugged the router',);

/**
 Builds an inner client that answers every text call with `text`, answers
 every JSON call with the parse of `text` run through the request's guard,
 and throws `FAILURE` on every call instead when `failing` is set.

 @param text - what the fixture says

 @param failing - whether every call throws instead

 @returns Client with the full surface

 @example
 ```ts
 const inner = innerClient({ text: '{"verdict":"purr"}', },);
 ```
 */
function innerClient(
  {
    text,
    failing = false,
  }: {
    readonly text: string;
    readonly failing?: boolean;
  },
): ModelClient {
  return {
    async chatText(): Promise<ChatTextReply> {
      if (failing)
        throw FAILURE;
      return { text, };
    },
    async chatJson<ValueT,>(
      request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
    ): Promise<ChatJsonOutcome<ValueT>> {
      if (failing)
        throw FAILURE;

      /**
       What the fixed text parses to.
       */
      const parsed: unknown = JSON.parse(text,);
      if (request.validate(parsed,))
        return {
          kind: 'ok',
          value: parsed,
          rawText: text,
        };
      return {
        kind: 'refusal-shaped',
        rawText: text,
        marker: 'cannot',
      };
    },
    async quotas(): Promise<never> {
      throw new Error('quotas is never asked here',);
    },
  };
}

/**
 Body of the refusal Bedrock gave the TianqiChen66626 pass on every ask.
 */
const EXPIRED_TOKEN_BODY = '{"error":{"code":"invalid_api_key","message":"The security token included in the request '
  + 'has expired.","param":null,"type":"permission_denied_error"}}';

/**
 Builds an inner client whose every call throws the provider status failure given.

 @param provider - provider that served, and refused, every call

 @param status - HTTP status the provider answered with

 @returns Client with the full surface, failing every call

 @example
 ```ts
 const inner = refusingClient({ provider: 'bedrock', status: 401, },);
 ```
 */
function refusingClient(
  {
    provider,
    status,
  }: {
    readonly provider: ProviderName;
    readonly status: number;
  },
): ModelClient {
  /**
   Failure every call raises.
   */
  const failure = new ProviderHttpError({ provider, status, bodyText: EXPIRED_TOKEN_BODY, },);
  return {
    async chatText(): Promise<ChatTextReply> {
      throw failure;
    },
    async chatJson<ValueT,>(): Promise<ChatJsonOutcome<ValueT>> {
      throw failure;
    },
    async quotas(): Promise<never> {
      throw new Error('quotas is never asked here',);
    },
  };
}

/**
 Runs one call and hands back what it threw, or `undefined` when it resolved.

 @param call - call to run

 @returns The thrown value, or `undefined`

 @example
 ```ts
 const thrown = await thrownBy(function ask() { return client.chatText(request,); },);
 ```
 */
async function thrownBy(call: () => Promise<unknown>,): Promise<unknown> {
  try {
    await call();
    return undefined;
  }
  catch (error) {
    return error;
  }
}

/**
 Makes one text call to a seat and hands back what it threw, or `undefined`
 when it resolved.

 @param client - client under test

 @param modelId - seat the call names

 @param signal - signal the call is made with

 @returns The thrown value, or `undefined`

 @example
 ```ts
 const thrown = await thrownByText({ client, modelId: SEAT_HYPER_VISION, signal: SIGNAL, },);
 ```
 */
async function thrownByText(
  {
    client,
    modelId,
    signal,
  }: {
    readonly client: ModelClient;
    readonly modelId: RosterModelId;
    readonly signal: AbortSignal;
  },
): Promise<unknown> {
  return await thrownBy(function ask(): Promise<unknown> {
    return client.chatText({ modelId, messages: MESSAGES, signal, },);
  },);
}

/**
 Makes four calls to the seat, alternating the text and JSON surfaces twice,
 and hands back what each one threw, in order.

 @param client - client under test

 @param signal - signal every call is made with

 @returns What each call threw

 @example
 ```ts
 const thrown = await askFourTimes({ client, signal: SIGNAL, },);
 ```
 */
async function askFourTimes(
  {
    client,
    signal,
  }: {
    readonly client: ModelClient;
    readonly signal: AbortSignal;
  },
): Promise<unknown[]> {
  /**
   One text call and one JSON call, what each threw in call order.

   @returns What the two calls threw
   */
  async function askTextAndJson(): Promise<unknown[]> {
    return await Promise.all([
      thrownBy(function askText(): Promise<unknown> {
        return client.chatText({ modelId: SEAT_HYPER_VISION, messages: MESSAGES, signal, },);
      },),
      thrownBy(function askJson(): Promise<unknown> {
        return client.chatJson({
          modelId: SEAT_HYPER_VISION,
          messages: MESSAGES,
          signal,
          validate: isCatVerdict,
        },);
      },),
    ],);
  }
  /**
   What the first pair threw.
   */
  const first = await askTextAndJson();
  /**
   What the second pair threw.
   */
  const second = await askTextAndJson();
  return [...first, ...second,];
}

//endregion Fixtures

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: createSeatTally.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS asked, usable, unusable, and threw per seat, in first-asked order',
          fn: async () => {
            /** Tally under test. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'unusable', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'usable', },);

            expect(tally.counts(),).toStrictEqual([
              {
                modelId: SEAT_HYPER_TEXT_BEDROCK,
                asked: 3,
                usable: 1,
                unusable: 1,
                threw: 1,
                abandoned: 0,
              },
              {
                modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
                asked: 1,
                usable: 1,
                unusable: 0,
                threw: 0,
                abandoned: 0,
              },
            ],);
          },
        },),

        it({
          name: 'NAMES as dark only a seat asked at least once that never produced a usable answer, '
            + 'so a seat that merely lost some rounds is not reported',
          fn: async () => {
            /** Tally with one dark seat, one mixed seat, and one clean seat. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'unusable', },);
            tally.record({ modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR, outcome: 'unusable', },);
            tally.record({ modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR, outcome: 'usable', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);

            expect(tally.dark().map(function toId(count,): string {
              return count.modelId;
            },),).toStrictEqual([SEAT_HYPER_VISION,],);
          },
        },),

        it({
          name: 'FORGETS every seat on reset, so a new command in the same process starts from nothing',
          fn: async () => {
            /** Tally under test. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.reset();

            expect(tally.counts(),).toStrictEqual([],);
            expect(tally.dark(),).toStrictEqual([],);
          },
        },),

        it({
          name: 'NAMES as withheld only a seat asked at least the given number of times that threw on every '
            + 'call, never a seat that answered once or was asked too few times to tell',
          fn: async () => {
            /** Tally with one withheld seat and three seats that are not. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'unusable', },);

            expect(tally.withheld({ minAsks: 4, },).map(function toId(count,): string {
              return count.modelId;
            },),).toStrictEqual([SEAT_HYPER_VISION,],);
          },
        },),

        it({
          name: 'COUNTS an abandoned call beside the settled ones without adding it to asked, so the withhold test '
            + 'that compares threw with asked never reads a cut-off call as a throw or as an answer',
          fn: async () => {
            /** Tally under test. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);

            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
              asked: 2,
              usable: 2,
              unusable: 0,
              threw: 0,
              abandoned: 3,
            },],);
          },
        },),

        it({
          name: 'DOES NOT NAME as dark a seat whose every call was abandoned, since a seat nobody waited for has '
            + 'not shown that it cannot answer, and does not withhold a seat that threw on every settled call '
            + 'while abandoned calls sit beside them',
          fn: async () => {
            /** Tally with one seat only abandoned and one that threw on each settled ask. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'abandoned', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'threw', },);

            expect(tally.dark().map(function toId(count,): string {
              return count.modelId;
            },),).toStrictEqual([SEAT_HYPER_VISION,],);
            expect(tally.withheld({ minAsks: 4, },).map(function toId(count,): string {
              return count.modelId;
            },),).toStrictEqual([SEAT_HYPER_VISION,],);
          },
        },),

        it({
          name: 'SHARES one run-wide tally, which every client the factory builds counts into',
          fn: async () => {
            RUN_SEATS.reset();
            RUN_SEATS.record({ modelId: SEAT_HYPER_VISION, outcome: 'usable', },);

            expect(RUN_SEATS.counts().length,).toBe(1,);

            RUN_SEATS.reset();

            expect(RUN_SEATS.counts().length,).toBe(0,);
          },
        },),
      ],
    },),

    describe({
      name: seatTallyClient.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS a text reply as usable and hands it back untouched',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test. */
            const client = seatTallyClient({
              inner: innerClient({ text: '喵。', },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            /** Reply as the caller sees it. */
            const reply = await client.chatText({
              modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
              messages: MESSAGES,
              signal: SIGNAL,
            },);

            expect(reply.text,).toBe('喵。',);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
              asked: 1,
              usable: 1,
              unusable: 0,
              threw: 0,
              abandoned: 0,
            },],);
          },
        },),

        it({
          name: 'COUNTS an ok JSON outcome as usable and hands it back untouched',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test. */
            const client = seatTallyClient({
              inner: innerClient({ text: '{"verdict":"purr"}', },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            /** Outcome as the caller sees it. */
            const outcome = await client.chatJson({
              modelId: SEAT_HYPER_VISION,
              messages: MESSAGES,
              signal: SIGNAL,
              validate: isCatVerdict,
            },);

            expect(outcome.kind,).toBe('ok',);
            expect((outcome.kind === 'ok') ? outcome.value.verdict : '',).toBe('purr',);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 1,
              usable: 1,
              unusable: 0,
              threw: 0,
              abandoned: 0,
            },],);
          },
        },),

        it({
          name: 'COUNTS a JSON outcome the guard rejected as unusable, since an answer nothing can read '
            + 'is not a voice',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test, answering JSON of the wrong shape. */
            const client = seatTallyClient({
              inner: innerClient({ text: '{"nap":"spot"}', },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            /** Outcome as the caller sees it. */
            const outcome = await client.chatJson({
              modelId: SEAT_HYPER_VISION,
              messages: MESSAGES,
              signal: SIGNAL,
              validate: isCatVerdict,
            },);

            expect(outcome.kind,).toBe('refusal-shaped',);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 1,
              usable: 0,
              unusable: 1,
              threw: 0,
              abandoned: 0,
            },],);
          },
        },),

        it({
          name: 'COUNTS a throw as threw on both surfaces and rethrows the very same value',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test, failing every call. */
            const client = seatTallyClient({
              inner: innerClient({ text: '', failing: true, },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            /** What the text surface threw. */
            let fromText: unknown;
            try {
              await client.chatText({
                modelId: SEAT_HYPER_TEXT_BEDROCK,
                messages: MESSAGES,
                signal: SIGNAL,
              },);
            }
            catch (error) {
              fromText = error;
            }

            /** What the JSON surface threw. */
            let fromJson: unknown;
            try {
              await client.chatJson({
                modelId: SEAT_HYPER_TEXT_BEDROCK,
                messages: MESSAGES,
                signal: SIGNAL,
                validate: isCatVerdict,
              },);
            }
            catch (error) {
              fromJson = error;
            }

            expect(fromText,).toBe(FAILURE,);
            expect(fromJson,).toBe(FAILURE,);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_TEXT_BEDROCK,
              asked: 2,
              usable: 0,
              unusable: 0,
              threw: 2,
              abandoned: 0,
            },],);
            expect(tally.dark().length,).toBe(1,);
          },
        },),

        it({
          name: 'REFUSES a withheld seat on every surface before any call reaches the inner client, naming it '
            + 'unreachable, and leaves its counts as they were',
          fn: async () => {
            /** Tally where one seat threw on each of its four asks. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            /** Client under test, whose inner client would answer every call. */
            const client = seatTallyClient({
              inner: innerClient({ text: '{"verdict":"purr"}', },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            /** What the text surface threw. */
            let fromText: unknown;
            try {
              await client.chatText({
                modelId: SEAT_HYPER_TEXT_BEDROCK,
                messages: MESSAGES,
                signal: SIGNAL,
              },);
            }
            catch (error) {
              fromText = error;
            }

            /** What the JSON surface threw. */
            let fromJson: unknown;
            try {
              await client.chatJson({
                modelId: SEAT_HYPER_TEXT_BEDROCK,
                messages: MESSAGES,
                signal: SIGNAL,
                validate: isCatVerdict,
              },);
            }
            catch (error) {
              fromJson = error;
            }

            expect(String(fromText,),).toBe(
              'NoProviderForModelError: no provider can take gemma-4-26b-a4b-it: the run withheld it after it '
              + 'threw on all 4 asks and does not ask it again',
            );
            expect(String(fromJson,),).toBe(String(fromText,),);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_TEXT_BEDROCK,
              asked: 4,
              usable: 0,
              unusable: 0,
              threw: 4,
              abandoned: 0,
            },],);
          },
        },),

        it({
          name: 'COUNTS four calls a caller aborted and that then threw as abandoned and nothing else, so a seat cut off '
            + 'after quorum shows in the census but is neither counted as asked nor withheld',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test, failing every call it is asked. */
            const client = seatTallyClient({
              inner: innerClient({ text: '', failing: true, },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);
            /** Signal the caller aborted before any call was made. */
            const aborted = new AbortController();
            aborted.abort();

            /** What each of the four calls threw, in order. */
            const thrown = await askFourTimes({
              client,
              signal: aborted.signal,
            },);

            expect(thrown,).toStrictEqual([FAILURE, FAILURE, FAILURE, FAILURE,],);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 0,
              usable: 0,
              unusable: 0,
              threw: 0,
              abandoned: 4,
            },],);
            expect(tally.withheld({ minAsks: 4, },),).toStrictEqual([],);
            expect(tally.dark(),).toStrictEqual([],);
          },
        },),

        it({
          name: 'COUNTS a call the caller aborted as abandoned whichever surface it went to, and a call that '
            + 'settled with an answer after the abort as usable, since the answer arrived',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Signal the caller aborted before any call was made. */
            const aborted = new AbortController();
            aborted.abort();
            /** Client whose every call throws. */
            const failing = seatTallyClient({
              inner: innerClient({ text: '', failing: true, },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);
            /** Client whose every call answers although the caller left. */
            const answering = seatTallyClient({
              inner: innerClient({ text: '喵。', },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            await thrownByText({ client: failing, modelId: SEAT_HYPER_VISION, signal: aborted.signal, },);
            await thrownBy(function askJson(): Promise<unknown> {
              return failing.chatJson({
                modelId: SEAT_HYPER_VISION,
                messages: MESSAGES,
                signal: aborted.signal,
                validate: isCatVerdict,
              },);
            },);
            await answering.chatText({ modelId: SEAT_HYPER_VISION, messages: MESSAGES, signal: aborted.signal, },);

            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 1,
              usable: 1,
              unusable: 0,
              threw: 0,
              abandoned: 2,
            },],);
          },
        },),

        it({
          name: 'WITHHOLDS a seat whose four calls all threw with the caller still waiting on each one',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test, failing every call it is asked. */
            const client = seatTallyClient({
              inner: innerClient({ text: '', failing: true, },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            /** What each of the four calls threw, in order. */
            const thrown = await askFourTimes({
              client,
              signal: SIGNAL,
            },);

            expect(thrown,).toStrictEqual([FAILURE, FAILURE, FAILURE, FAILURE,],);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 4,
              usable: 0,
              unusable: 0,
              threw: 4,
              abandoned: 0,
            },],);
            expect(tally.withheld({ minAsks: 4, },).map(function toId(count,): string {
              return count.modelId;
            },),).toStrictEqual([SEAT_HYPER_VISION,],);
          },
        },),

        it({
          name: 'SAYS ONCE PER SEAT, plainly, that the provider refused the seat\'s credential with HTTP 401, naming the '
            + 'seat, the provider that refused it, the provider\'s words, how many answers the seat had given and what '
            + 'to do before the next run, '
            + 'and says it again for no later 401 of that seat',
          fn: async () => {
            /** Lines the wrapper writes. */
            const lines: string[] = [];
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test, whose provider refuses the credential on every call. */
            const client = seatTallyClient({
              inner: refusingClient({ provider: 'bedrock', status: 401, },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines, },),
            },);

            await thrownByText({ client, modelId: SEAT_HYPER_TEXT_BEDROCK, signal: SIGNAL, },);
            await thrownByText({ client, modelId: SEAT_HYPER_TEXT_BEDROCK, signal: SIGNAL, },);

            expect(lines,).toStrictEqual([
              [
                'warn [seatTallyClient] SEAT CREDENTIAL REFUSED gemma-4-26b-a4b-it on bedrock: refused by ',
                'ProviderHttpError from bedrock with HTTP 401 (the provider said: ',
                String.raw`"{\"error\":{\"code\":\"invalid_api_key\",\"message\":\"The security token included in `,
                String.raw`the request has expired.\",\"param\":null,\"type\":\"permission_denied_error\"}}"), `,
                'after 0 usable answers this run. bedrock does not accept the credential this seat is asked ',
                'with, and a credential does not renew during a run, so asks to it are expected to keep failing. ',
                'Either renew bedrock\'s credential before the next run, or leave it: the run withholds the seat ',
                'after 4 failed asks and goes on with the other seats.',
              ].join('',),
            ],);
          },
        },),

        it({
          name: 'SAYS IT FOR EACH SEAT whose provider refused the credential, and counts the answers a seat gave '
            + 'before its credential expired',
          fn: async () => {
            /** Lines the wrapper writes. */
            const lines: string[] = [];
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'usable', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'usable', },);
            /** Client under test, whose provider refuses the credential on every call. */
            const client = seatTallyClient({
              inner: refusingClient({ provider: 'bedrock', status: 401, },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines, },),
            },);

            await thrownByText({ client, modelId: SEAT_HYPER_VISION, signal: SIGNAL, },);
            await thrownByText({ client, modelId: SEAT_HYPER_TEXT_BEDROCK, signal: SIGNAL, },);

            expect(lines.length,).toBe(2,);
            expect(lines[0],).toContain('SEAT CREDENTIAL REFUSED minimax-m3 on bedrock: ',);
            expect(lines[0],).toContain('after 2 usable answers this run.',);
            expect(lines[1],).toContain('SEAT CREDENTIAL REFUSED gemma-4-26b-a4b-it on bedrock: ',);
            expect(lines[1],).toContain('after 0 usable answers this run.',);
          },
        },),

        it({
          name: 'NAMES THE PROVIDER THAT SERVED THE REFUSED CALL, never another one, and offers both ways forward: '
            + 'renew that provider\'s credential, or leave the seat to be withheld',
          fn: async () => {
            /** Lines the wrapper writes, one wrapper per provider. */
            const lines: string[] = [];
            /** Wrapper over a Hyper credential that every call finds refused. */
            const hyper = seatTallyClient({
              inner: refusingClient({ provider: 'hyper', status: 401, },),
              tally: createSeatTally(),
              minAsks: 3,
              l: levelCapturingLogger({ lines, },),
            },);
            /** Wrapper over an OpenRouter credential that every call finds refused. */
            const openrouter = seatTallyClient({
              inner: refusingClient({ provider: 'openrouter', status: 401, },),
              tally: createSeatTally(),
              minAsks: 3,
              l: levelCapturingLogger({ lines, },),
            },);

            await thrownByText({ client: hyper, modelId: SEAT_HYPER_VISION, signal: SIGNAL, },);
            await thrownByText({ client: openrouter, modelId: SEAT_HYPER_VISION, signal: SIGNAL, },);

            expect(lines.length,).toBe(2,);
            expect(lines[0],).toContain('SEAT CREDENTIAL REFUSED minimax-m3 on hyper: refused by ProviderHttpError from hyper ',);
            expect(lines[0],).toContain(
              'Either renew hyper\'s credential before the next run, or leave it: the run withholds the seat after '
              + '3 failed asks and goes on with the other seats.',
            );
            expect(lines[0],).not.toContain('bedrock',);
            expect(lines[1],).toContain(
              'SEAT CREDENTIAL REFUSED minimax-m3 on openrouter: refused by ProviderHttpError from openrouter ',
            );
            expect(lines[1],).toContain('Either renew openrouter\'s credential before the next run, or leave it:',);
          },
        },),

        it({
          name: 'SAYS NOTHING for a refusal that is not a rejected credential: another HTTP status, a failure that '
            + 'is no HTTP answer, or a call the caller had already abandoned',
          fn: async () => {
            /** Lines the wrapper writes. */
            const lines: string[] = [];
            /** Signal the caller aborted before the call was made. */
            const aborted = new AbortController();
            aborted.abort();
            /** Wrapper over a provider answering 500. */
            const serverError = seatTallyClient({
              inner: refusingClient({ provider: 'bedrock', status: 500, },),
              tally: createSeatTally(),
              minAsks: 4,
              l: levelCapturingLogger({ lines, },),
            },);
            /** Wrapper over a client throwing a plain error. */
            const plainError = seatTallyClient({
              inner: innerClient({ text: '', failing: true, },),
              tally: createSeatTally(),
              minAsks: 4,
              l: levelCapturingLogger({ lines, },),
            },);
            /** Wrapper over a provider answering 401 to a call nobody waits for. */
            const abandoned = seatTallyClient({
              inner: refusingClient({ provider: 'bedrock', status: 401, },),
              tally: createSeatTally(),
              minAsks: 4,
              l: levelCapturingLogger({ lines, },),
            },);

            await thrownByText({ client: serverError, modelId: SEAT_HYPER_VISION, signal: SIGNAL, },);
            await thrownByText({ client: plainError, modelId: SEAT_HYPER_VISION, signal: SIGNAL, },);
            await thrownByText({ client: abandoned, modelId: SEAT_HYPER_VISION, signal: aborted.signal, },);

            expect(lines,).toStrictEqual([],);
          },
        },),

        it({
          name: 'FORWARDS quotas as the very same function, since the meter is not a seat',
          fn: async () => {
            /** Inner client whose meter identity is checked. */
            const inner = innerClient({ text: '喵。', },);
            /** Client under test. */
            const client = seatTallyClient({
              inner,
              tally: createSeatTally(),
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            expect(client.quotas,).toBe(inner.quotas,);
          },
        },),

        it({
          name: 'COUNTS THE TYPED DECISION EXCHANGE AS A SEAT ASKED, a reply usable and a throw rethrown, and offers it '
            + 'only where the wrapped client does (ledger T8)',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Reply the answering decision seat gives. */
            const reply = { answers: ['windowsill',], } as unknown as DecisionReply;
            /** Decision request naming one seat, cast past what the tally never reads. */
            const request = {
              modelId: SEAT_HYPER_VISION,
              signal: SIGNAL,
            } as unknown as DecisionRequest;
            /** Client under test, whose decision seat answers. */
            const answering = seatTallyClient({
              inner: {
                ...innerClient({ text: '喵。', },),
                decide: async function decide(): Promise<DecisionReply> {
                  return reply;
                },
              },
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);
            /** Client under test, whose decision seat throws. */
            const failing = seatTallyClient({
              inner: {
                ...innerClient({ text: '喵。', },),
                decide: async function decide(): Promise<never> {
                  throw FAILURE;
                },
              },
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },);

            expect(await answering.decide?.(request,),).toBe(reply,);
            await expect(failing.decide?.(request,),).rejects.toBe(FAILURE,);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 2,
              usable: 1,
              unusable: 0,
              threw: 1,
              abandoned: 0,
            },],);
            expect(seatTallyClient({
              inner: innerClient({ text: '喵。', },),
              tally,
              minAsks: 4,
              l: levelCapturingLogger({ lines: [], },),
            },).decide,).toBeUndefined();
          },
        },),
      ],
    },),

    describe({
      name: seatReportLines.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PRINTS nothing when no seat was asked, so a command that never built a client says nothing extra',
          fn: async () => {
            expect(seatReportLines({ tally: createSeatTally(), },),).toStrictEqual([],);
          },
        },),

        it({
          name: 'PRINTS one SEAT line per seat and no dark line when every seat answered at least once',
          fn: async () => {
            /** Tally in which every seat produced something usable. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'unusable', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'usable', },);

            expect(seatReportLines({ tally, },),).toStrictEqual([
              'SEAT hf:openai/gpt-oss-120b asked=1 usable=1 unusable=0 threw=0 abandoned=0',
              'SEAT minimax-m3 asked=2 usable=1 unusable=1 threw=0 abandoned=0',
            ],);
          },
        },),

        it({
          name: 'PRINTS THE ABANDONED COUNT on the SEAT line, so a seat whose replies were cut at the straggler '
            + 'deadline does not read as one that answered every ask',
          fn: async () => {
            /** Tally of a seat that answered twice and was cut off three times. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'abandoned', },);

            expect(seatReportLines({ tally, },),).toStrictEqual([
              'SEAT hf:openai/gpt-oss-120b asked=2 usable=2 unusable=0 threw=0 abandoned=3',
            ],);
          },
        },),

        it({
          name: 'APPENDS the SEATS DARK line naming only the dark seats with the counts that make them dark',
          fn: async () => {
            /** Tally with two dark seats among three. */
            const tally = createSeatTally();
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_HYPER_TEXT_BEDROCK, outcome: 'threw', },);
            tally.record({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, outcome: 'usable', },);
            tally.record({ modelId: SEAT_HYPER_VISION, outcome: 'unusable', },);

            /** Lines as a reader sees them. */
            const lines = seatReportLines({ tally, },);

            expect(lines.length,).toBe(4,);
            expect(lines[3],).toBe(
              'SEATS DARK: 2 of 3 seats asked produced nothing usable this run: '
                + 'gemma-4-26b-a4b-it (asked 2, unusable 0, threw 2); minimax-m3 (asked 1, unusable 1, threw 0). '
                + 'A seat that fails every call is a provider that cannot serve it, a key that was never '
                + 'injected, or a model that answers nothing readable; the run log names which, and writes each '
                + 'failed call\'s error text on a warn line "<stage> <model>: <error>, voice lost" (or "seat '
                + 'unreachable"). Do not read this run as a comparison of the roster.',
            );
          },
        },),
      ],
    },),
  ],
},);
