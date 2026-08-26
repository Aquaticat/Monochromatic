/**
 * Tests for the seat tally: counting at the client seam and the closing report.
 *
 * THE COUNTS ARE THE EVIDENCE `#235` LACKED. Five of ten seats failed every
 * call of a four-slice calibration and the command exited 0, because quorum was
 * met on the nose by the other five and nothing read the whole run. The tally
 * counts every settled call against its seat, and the report says which seats
 * were asked and produced nothing usable, in the closing lines of every
 * command. The cases below pin what "usable" means on each surface, that the
 * wrapped client is otherwise untouched, and the exact lines a reader greps.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChatTextReply,
  createSeatTally,
  RUN_SEATS,
  seatReportLines,
  seatTallyClient,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Single user message reused across cases.
 */
const MESSAGES = [
  {
    role: 'user' as const,
    content: '猫猫的翻译对吗？',
  },
];

/**
 * Signal reused across cases; nothing here aborts.
 */
const SIGNAL = new AbortController().signal;

/**
 * Verdict shape the JSON cases validate against.
 */
type CatVerdict = { readonly verdict: string; };

/**
 * Guards parsed JSON as a verdict.
 *
 * @param value - parsed candidate
 *
 * @returns Whether it carries a string verdict
 *
 * @example
 * ```ts
 * const ok = isCatVerdict({ verdict: 'purr', },);
 * ```
 */
function isCatVerdict(value: unknown,): value is CatVerdict {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('verdict' in value)
    && ((typeof value.verdict) === 'string');
}

/**
 * Failure the throwing fixture raises, kept identical so a case can assert the
 * wrapper rethrew the very same value.
 */
const FAILURE = new Error('the cat unplugged the router',);

/**
 * Builds an inner client that answers every text call with `text`, answers
 * every JSON call with the parse of `text` run through the request's guard,
 * and throws `FAILURE` on every call instead when `failing` is set.
 *
 * @param text - what the fixture says
 *
 * @param failing - whether every call throws instead
 *
 * @returns Client with the full surface
 *
 * @example
 * ```ts
 * const inner = innerClient({ text: '{"verdict":"purr"}', },);
 * ```
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
       * What the fixed text parses to.
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

//endregion Fixtures

await describe({
  name: createSeatTally.name,
  children: [
    it({
      name: 'COUNTS asked, usable, unusable, and threw per seat, in first-asked order',
      fn: async () => {
        /** Tally under test. */
        const tally = createSeatTally();
        tally.record({ modelId: 'qwen3.8-max', outcome: 'threw', },);
        tally.record({ modelId: 'hf:openai/gpt-oss-120b', outcome: 'usable', },);
        tally.record({ modelId: 'qwen3.8-max', outcome: 'unusable', },);
        tally.record({ modelId: 'qwen3.8-max', outcome: 'usable', },);

        expect(tally.counts(),).toStrictEqual([
          {
            modelId: 'qwen3.8-max',
            asked: 3,
            usable: 1,
            unusable: 1,
            threw: 1,
          },
          {
            modelId: 'hf:openai/gpt-oss-120b',
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
        tally.record({ modelId: 'minimax-m3', outcome: 'threw', },);
        tally.record({ modelId: 'minimax-m3', outcome: 'unusable', },);
        tally.record({ modelId: 'hf:zai-org/GLM-5.2', outcome: 'unusable', },);
        tally.record({ modelId: 'hf:zai-org/GLM-5.2', outcome: 'usable', },);
        tally.record({ modelId: 'hf:openai/gpt-oss-120b', outcome: 'usable', },);

        expect(tally.dark().map(function toId(count,): string {
          return count.modelId;
        },),).toStrictEqual(['minimax-m3',],);
      },
    },),

    it({
      name: 'FORGETS every seat on reset, so a new command in the same process starts from nothing',
      fn: async () => {
        /** Tally under test. */
        const tally = createSeatTally();
        tally.record({ modelId: 'minimax-m3', outcome: 'threw', },);
        tally.reset();

        expect(tally.counts(),).toStrictEqual([],);
        expect(tally.dark(),).toStrictEqual([],);
      },
    },),

    it({
      name: 'SHARES one run-wide tally, which every client the factory builds counts into',
      fn: async () => {
        RUN_SEATS.reset();
        RUN_SEATS.record({ modelId: 'minimax-m3', outcome: 'usable', },);

        expect(RUN_SEATS.counts().length,).toBe(1,);

        RUN_SEATS.reset();

        expect(RUN_SEATS.counts().length,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: seatTallyClient.name,
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
        },);

        /** Reply as the caller sees it. */
        const reply = await client.chatText({
          modelId: 'hf:openai/gpt-oss-120b',
          messages: MESSAGES,
          signal: SIGNAL,
        },);

        expect(reply.text,).toBe('喵。',);
        expect(tally.counts(),).toStrictEqual([{
          modelId: 'hf:openai/gpt-oss-120b',
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
        },);

        /** Outcome as the caller sees it. */
        const outcome = await client.chatJson({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isCatVerdict,
        },);

        expect(outcome.kind,).toBe('ok',);
        expect((outcome.kind === 'ok') ? outcome.value.verdict : '',).toBe('purr',);
        expect(tally.counts(),).toStrictEqual([{
          modelId: 'minimax-m3',
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
        },);

        /** Outcome as the caller sees it. */
        const outcome = await client.chatJson({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isCatVerdict,
        },);

        expect(outcome.kind,).toBe('refusal-shaped',);
        expect(tally.counts(),).toStrictEqual([{
          modelId: 'minimax-m3',
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
        },);

        /** What the text surface threw. */
        let fromText: unknown;
        try {
          await client.chatText({
            modelId: 'qwen3.8-max',
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
            modelId: 'qwen3.8-max',
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
          modelId: 'qwen3.8-max',
          asked: 2,
          usable: 0,
          unusable: 0,
          threw: 2,
        },],);
        expect(tally.dark().length,).toBe(1,);
      },
    },),

    it({
      name: 'PASSES quotas through as the very same function, since the meter is not a seat',
      fn: async () => {
        /** Inner client whose meter identity is checked. */
        const inner = innerClient({ text: '喵。', },);
        /** Client under test. */
        const client = seatTallyClient({
          inner,
          tally: createSeatTally(),
        },);

        expect(client.quotas,).toBe(inner.quotas,);
      },
    },),
  ],
},);

await describe({
  name: seatReportLines.name,
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
        tally.record({ modelId: 'hf:openai/gpt-oss-120b', outcome: 'usable', },);
        tally.record({ modelId: 'minimax-m3', outcome: 'unusable', },);
        tally.record({ modelId: 'minimax-m3', outcome: 'usable', },);

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
        tally.record({ modelId: 'qwen3.8-max', outcome: 'threw', },);
        tally.record({ modelId: 'qwen3.8-max', outcome: 'threw', },);
        tally.record({ modelId: 'hf:openai/gpt-oss-120b', outcome: 'usable', },);
        tally.record({ modelId: 'minimax-m3', outcome: 'unusable', },);

        /** Lines as a reader sees them. */
        const lines = seatReportLines({ tally, },);

        expect(lines.length,).toBe(4,);
        expect(lines[3],).toBe(
          'SEATS DARK: 2 of 3 seats asked produced nothing usable this run: '
            + 'qwen3.8-max (asked 2, unusable 0, threw 2); minimax-m3 (asked 1, unusable 1, threw 0). '
            + 'A seat that fails every call is a provider that cannot serve it, a key that was never '
            + 'injected, or a model that answers nothing readable; the run log names which. '
            + 'Do not read this run as a comparison of the roster.',
        );
      },
    },),
  ],
},);
