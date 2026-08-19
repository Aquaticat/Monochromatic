/**
 * Tests for the runaway watch.
 *
 * This is the piece the drain calls, so it is tested the way the drain drives
 * it: chunk by chunk, stopping at the first runaway verdict rather than reading
 * the whole stream and asking afterwards. A watch that only reached the right
 * answer at the end would be useless, since the streams it exists to end never
 * reach an end.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  StreamDegenerateError,
  watchRunaway,
} from '../dist/final/node/index.mjs';

/**
 * Builds one server-sent event frame carrying text on one channel.
 *
 * @param channel - which channel the text arrives on
 *
 * @param text - text the frame carries
 *
 * @returns Frame as the wire sends it
 *
 * @example
 * ```ts
 * const raw = frameOf({ channel: 'reasoning', text: 'I will output. ', },);
 * ```
 */
function frameOf(
  {
    channel,
    text,
  }: {
    readonly channel: 'content' | 'reasoning';
    readonly text: string;
  },
): string {
  /**
   * Delta object, whose field name distinguishes the channels.
   */
  const delta = (channel === 'content') ? { content: text, } : { reasoning_content: text, };

  return `data: ${
    JSON.stringify({
      choices: [{
        index: 0,
        delta,
        finish_reason: null,
      },],
    },)
  }\n\n`;
}

/**
 * Feeds a raw stream chunk by chunk, stopping at the first runaway verdict.
 *
 * @param raw - whole stream body
 *
 * @returns Verdict reached, and how much of the stream had been read
 *
 * @example
 * ```ts
 * const { verdict, readBytes, } = drive({ raw, },);
 * ```
 */
function drive({ raw, }: { readonly raw: string; },): {
  readonly verdict: ReturnType<ReturnType<typeof watchRunaway>['notifyChunk']>;
  readonly readBytes: number;
} {
  /**
   * Watch under test.
   */
  const watch = watchRunaway();

  /**
   * Chunk width, near what a socket actually delivers.
   */
  const width = 4_096;

  /**
   * Where the read stopped, and what it concluded.
   */
  const outcome = Array.from(
    { length: Math.ceil(raw.length / width,), },
    function at(
      _unused,
      index,
    ): number {
      return index;
    },
  ).reduce(
    function step(
      carried: {
        readonly verdict: ReturnType<ReturnType<typeof watchRunaway>['notifyChunk']>;
        readonly readBytes: number;
      },
      index,
    ) {
      if (carried.verdict.kind === 'runaway')
        return carried;

      return {
        verdict: watch.notifyChunk({
          chunk: raw.slice(
            index * width,
            (index + 1) * width,
          ),
        },),
        readBytes: Math.min(
          (index + 1) * width,
          raw.length,
        ),
      };
    },
    {
      verdict: { kind: 'continuing', } as ReturnType<ReturnType<typeof watchRunaway>['notifyChunk']>,
      readBytes: 0,
    },
  );

  return outcome;
}

await describe({
  name: watchRunaway.name,
  children: [
    it({
      name: 'ENDS A THINKING RUNAWAY BEFORE THE STREAM DOES, naming the reasoning channel: this '
        + 'is the case that produces no answer at all, so nothing downstream would ever notice it',
      fn: async () => {
        /**
         * A model that thinks the same sentence forever.
         */
        const raw = Array.from(
          { length: 30_000, },
          function think(): string {
            return frameOf({
              channel: 'reasoning',
              text: 'I will output. ',
            },);
          },
        ).join('',);

        const {
          verdict,
          readBytes,
        } = drive({ raw, },);

        expect(verdict.kind,).toBe('runaway',);
        if (verdict.kind !== 'runaway')
          throw new Error('runaway by construction',);
        expect(verdict.channel,).toBe('reasoning',);
        expect(verdict.distinctRatio,).toBeLessThan(0.1,);

        // Stopped rather than merely diagnosed: the point is to end the call
        // early, so reading the whole body would be a failure even with the
        // right verdict at the end of it.
        expect(readBytes,).toBeLessThan(raw.length,);
      },
    },),

    it({
      name: 'LETS A HEALTHY LONG CALL FINISH, thinking and answer alike, so a model that simply '
        + 'writes a great deal is never cut off for it',
      fn: async () => {
        /**
         * Long, varied thinking followed by a long, varied answer.
         */
        const raw = Array.from(
          { length: 6_000, },
          function think(
            _unused,
            at,
          ): string {
            return frameOf({
              channel: 'reasoning',
              text: `Weighing option ${String(at,)} for shelf ${String(at * 3,)} at hour ${String(at % 24,)}. `,
            },);
          },
        ).join('',) + Array.from(
          { length: 6_000, },
          function answer(
            _unused,
            at,
          ): string {
            return frameOf({
              channel: 'content',
              text: `Sentence ${String(at,)} concerning an entirely separate cat, noted at ${String(at % 60,)}. `,
            },);
          },
        ).join('',);

        expect(drive({ raw, },).verdict.kind,).toBe('continuing',);
      },
    },),

    it({
      name: 'NAMES THE ANSWER CHANNEL when that is the one repeating, since the two failures call '
        + 'for different reading and pooling them would let either excuse the other',
      fn: async () => {
        const raw = Array.from(
          { length: 30_000, },
          function repeat(): string {
            return frameOf({
              channel: 'content',
              text: 'The cat sat on the mat. ',
            },);
          },
        ).join('',);

        /**
         * What the watch concluded.
         */
        const { verdict, } = drive({ raw, },);
        expect(verdict.kind,).toBe('runaway',);
        if (verdict.kind !== 'runaway')
          throw new Error('runaway by construction',);
        expect(verdict.channel,).toBe('content',);
      },
    },),

    it({
      name: 'CARRIES WHAT A LOG LINE NEEDS in its error: which channel, how repetitive, what '
        + 'the call had already cost when it was ended, and which model ran away',
      fn: async () => {
        /**
         * Error as the drain would raise it.
         */
        const error = new StreamDegenerateError({
          label: 'critic hf:zai-org/GLM-5.2',
          channel: 'reasoning',
          distinctRatio: 0.0021,
          charsSeen: 412_000,
        },);

        expect(error.name,).toBe('StreamDegenerateError',);
        expect(error.channel,).toBe('reasoning',);
        expect(error.message.includes('reasoning',),).toBe(true,);
        expect(error.message.includes('0.0021',),).toBe(true,);
        expect(error.message.includes('412000',),).toBe(true,);

        // Carried as a property, not only baked into the message: a per-model
        // figure has to read `.label` off every error in a batch, and the
        // message is prose meant for one line of a log rather than for that.
        expect(error.label,).toBe('critic hf:zai-org/GLM-5.2',);
      },
    },),
  ],
},);
