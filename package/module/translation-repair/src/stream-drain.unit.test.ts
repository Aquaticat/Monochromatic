/**
 * Tests for the stream drain, at the boundary where a call is actually ended.
 *
 * The composition layer is tested in `stream-runaway-watch.unit.test.ts`. What
 * is tested here is the thing that matters to a running pipeline: that a
 * degenerating call STOPS, rather than that something correctly formed an
 * opinion about it. A verdict nobody acts on ends nothing, and the provider
 * ends nothing either.
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
  armIdleGuard,
  drainBody,
  StreamCutShortError,
  StreamDegenerateError,
} from '../dist/final/node/index.mjs';

/**
 * Roomy window, so nothing in these tests trips the silence guard: what is
 * under test here is the other guard entirely.
 */
const ROOMY_MS = 600_000;

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
 * Wraps text in a response whose body arrives in pieces, counting how many
 * pieces were actually pulled.
 *
 * THE COUNT IS THE POINT. A drain that read the whole body and then complained
 * would pass every assertion about the error while leaving the socket open for
 * the entire runaway, which is the cost this guard exists to avoid.
 *
 * @param raw - whole body
 *
 * @returns Response, and a reader of how much of it was consumed
 *
 * @example
 * ```ts
 * const { response, pulled, } = streamOf({ raw, },);
 * ```
 */
function streamOf({ raw, }: { readonly raw: string; },): {
  readonly response: Response;
  readonly pulled: () => number;
} {
  /**
   * Piece width, near what a socket delivers.
   */
  const width = 4_096;

  /**
   * Pieces the body is delivered in.
   */
  const pieces = Array.from(
    { length: Math.ceil(raw.length / width,), },
    function piece(
      _unused,
      at,
    ): string {
      return raw.slice(
        at * width,
        (at + 1) * width,
      );
    },
  );

  /**
   * How many pieces the drain asked for.
   */
  const taken = { count: 0, };

  /**
   * Encoder, since a body carries bytes rather than text.
   */
  const encoder = new TextEncoder();

  /**
   * Body that hands over one piece per pull.
   */
  const body = new ReadableStream<Uint8Array>({
    pull(controller,): void {
      /**
       * Next piece, absent once they run out.
       */
      const next = pieces[taken.count];
      if (next === undefined) {
        controller.close();
        return;
      }
      taken.count += 1;
      controller.enqueue(encoder.encode(next,),);
    },
  },);

  return {
    response: new Response(
      body,
      { headers: { 'content-type': 'text/event-stream', }, },
    ),
    pulled(): number {
      return taken.count;
    },
  };
}

/**
 * What one drain did, as a value.
 *
 * @example
 * ```ts
 * const outcome: DrainOutcome = { kind: 'drained', };
 * ```
 */
type DrainOutcome = {
  readonly kind: 'drained';

  /**
   * Body it handed back.
   */
  readonly body: string;
} | {
  readonly kind: 'raised';

  /**
   * What it threw.
   */
  readonly error: unknown;
};

/**
 * Drains a response, reporting a throw as a value so the assertion reads as an
 * expectation rather than as control flow.
 *
 * @param response - response to drain
 *
 * @param guard - silence guard to pass through
 *
 * @mutates response - its body is drained and cannot be read again
 *
 * @mutates guard - the drain notifies it per chunk
 *
 * @returns What the drain did
 *
 * @example
 * ```ts
 * const outcome = await drainOutcome({ response, guard, },);
 * ```
 */
async function drainOutcome(
  {
    response,
    guard,
    callerSignal = new AbortController().signal,
  }: {
    readonly response: Response;
    readonly guard: Parameters<typeof drainBody>[0]['guard'];
    readonly callerSignal?: AbortSignal;
  },
): Promise<DrainOutcome> {
  try {
    return {
      kind: 'drained',
      body: await drainBody({
        response,
        guard,
        callerSignal,
        label: 'hf:whiskers',
      },),
    };
  }
  catch (error) {
    return {
      kind: 'raised',
      error,
    };
  }
}

await describe({
  name: drainBody.name,
  children: [
    it({
      name: 'ENDS A RUNAWAY CALL rather than draining it, which is the whole point: the provider '
        + 'does not end these and no token cap bounds them, so this is the only place the call can '
        + 'stop. Asserting only the error would pass for a drain that read every byte first',
      fn: async () => {
        /**
         * A model thinking the same sentence forever.
         */
        const {
          response,
          pulled,
        } = streamOf({
          raw: Array.from(
            { length: 30_000, },
            function think(): string {
              return frameOf({
                channel: 'reasoning',
                text: 'I will output. ',
              },);
            },
          ).join('',),
        },);

        using guard = armIdleGuard({
          label: 'hf:whiskers',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         * What the drain did, as a value, since the throw is what is asserted.
         */
        const outcome = await drainOutcome({
          response,
          guard,
        },);

        expect(outcome.kind,).toBe('raised',);
        if (outcome.kind !== 'raised')
          throw new Error('raised by construction',);
        if (!(outcome.error instanceof StreamDegenerateError))
          throw new Error('a degeneration error by construction',);
        expect(outcome.error.channel,).toBe('reasoning',);

        // Attributed to the model rather than to the endpoint: every
        // chat-completions call shares one URL across the whole roster, and a
        // constructed Response's `url` is the empty string, so a per-model
        // latency figure would be unreadable if this fell back to it.
        expect(outcome.error.label,).toBe('hf:whiskers',);

        // Stopped early rather than after the fact. Reading every piece would
        // mean the socket stayed open for the whole runaway.
        /**
         * Pieces the whole runaway would have taken, had it been drained.
         */
        const whole = Math.ceil((30_000 * 60) / 4_096,);
        expect(pulled(),).toBeLessThan(whole,);
      },
    },),

    it({
      name: 'KEEPS WHAT THE STREAM ALREADY DELIVERED when a call is cut, which used to be dropped '
        + 'on the floor. This is the whole point: a call that never got a first byte leaves an '
        + 'empty string and one cut off mid-reasoning leaves a truncated thinking block, and those '
        + 'want opposite remedies. Nothing on disk could tell them apart before',
      fn: async () => {
        /**
         * What the model manages to say before the plug is pulled.
         */
        const said = 'It is a cat. It did a backflip. It cras';

        /**
         * That much, framed as the wire carries it.
         */
        const delivered = frameOf({
          channel: 'reasoning',
          text: said,
        },);

        /**
         * Caller's own steering.
         */
        const steering = new AbortController();

        /**
         * How many pieces have gone out.
         */
        const sent = { count: 0, };

        /**
         * Encoder, since a body carries bytes.
         */
        const encoder = new TextEncoder();

        /**
         * A body that delivers once and is then torn down, which is what an
         * abort does to a fetch in production.
         */
        const body = new ReadableStream<Uint8Array>({
          pull(controller,): void {
            if (sent.count === 0) {
              sent.count += 1;
              controller.enqueue(encoder.encode(delivered,),);
              return;
            }
            steering.abort();
            controller.error(new Error('exchange torn down by abort',),);
          },
        },);

        using guard = armIdleGuard({
          label: 'hf:whiskers',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         * What the drain did.
         */
        const outcome = await drainOutcome({
          response: new Response(body,),
          guard,
          callerSignal: steering.signal,
        },);

        expect(outcome.kind,).toBe('raised',);
        if (outcome.kind !== 'raised')
          throw new Error('raised by construction',);
        if (!(outcome.error instanceof StreamCutShortError))
          throw new Error('a cut by construction',);

        // The text survives the cut, which is the entire fix.
        expect(outcome.error.partialText,).toBe(delivered,);
        expect(outcome.error.partialText.includes(said,),).toBe(true,);

        // And it is attributed to the model rather than to the endpoint, so a
        // per-model latency figure is readable at all.
        expect(outcome.error.label,).toBe('hf:whiskers',);

        // The original failure is preserved rather than replaced.
        expect(outcome.error.cause,).toBeInstanceOf(Error,);
      },
    },),

    it({
      name: 'RETURNS A HEALTHY BODY WHOLE, so the guard costs nothing to an ordinary call and no '
        + 'parser above the transport seam sees anything different',
      fn: async () => {
        /**
         * An ordinary reply.
         */
        const raw = `${
          frameOf({
            channel: 'content',
            text: 'A tabby naps in the window. ',
          },)
        }${
          frameOf({
            channel: 'content',
            text: 'It wakes at dusk. ',
          },)
        }data: [DONE]\n\n`;

        const { response, } = streamOf({ raw, },);

        using guard = armIdleGuard({
          label: 'hf:mittens',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         * What the drain did.
         */
        const outcome = await drainOutcome({
          response,
          guard,
        },);
        if (outcome.kind !== 'drained')
          throw new Error('drained by construction',);
        expect(outcome.body,).toBe(raw,);
      },
    },),

    it({
      name: 'LETS A LONG BUT VARIED CALL FINISH, because some models write a great deal and being '
        + 'verbose is not being broken',
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

        const { response, } = streamOf({ raw, },);

        using guard = armIdleGuard({
          label: 'hf:sable',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         * What the drain did.
         */
        const outcome = await drainOutcome({
          response,
          guard,
        },);
        if (outcome.kind !== 'drained')
          throw new Error('drained by construction',);
        expect(outcome.body,).toBe(raw,);
      },
    },),
  ],
},);
