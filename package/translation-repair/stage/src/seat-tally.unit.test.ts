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

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChatTextReply,
  type DecisionReply,
  type DecisionRequest,
  type SyntheticClient,
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
): SyntheticClient {
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
    readonly client: SyntheticClient;
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
              },
              {
                modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
                asked: 1,
                usable: 1,
                unusable: 0,
                threw: 0,
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
            },],);
          },
        },),

        it({
          name: 'RECORDS NOTHING for four calls a caller aborted and that then threw, so a seat cut off after quorum '
            + 'is not counted as asked and is not withheld',
          fn: async () => {
            /** Tally the wrapper counts into. */
            const tally = createSeatTally();
            /** Client under test, failing every call it is asked. */
            const client = seatTallyClient({
              inner: innerClient({ text: '', failing: true, },),
              tally,
              minAsks: 4,
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
            expect(tally.counts(),).toStrictEqual([],);
            expect(tally.withheld({ minAsks: 4, },),).toStrictEqual([],);
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
            },],);
            expect(tally.withheld({ minAsks: 4, },).map(function toId(count,): string {
              return count.modelId;
            },),).toStrictEqual([SEAT_HYPER_VISION,],);
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
            },);

            expect(await answering.decide?.(request,),).toBe(reply,);
            await expect(failing.decide?.(request,),).rejects.toBe(FAILURE,);
            expect(tally.counts(),).toStrictEqual([{
              modelId: SEAT_HYPER_VISION,
              asked: 2,
              usable: 1,
              unusable: 0,
              threw: 1,
            },],);
            expect(seatTallyClient({
              inner: innerClient({ text: '喵。', },),
              tally,
              minAsks: 4,
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
              'SEAT hf:openai/gpt-oss-120b asked=1 usable=1 unusable=0 threw=0',
              'SEAT minimax-m3 asked=2 usable=1 unusable=1 threw=0',
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
