/**
 Tests for the stream drain, at the boundary where a call is actually ended.

 The composition layer is tested in `stream-runaway-watch.unit.test.ts`. What
 is tested here is the thing that matters to a running pipeline: that a
 degenerating call STOPS, rather than that something correctly formed an
 opinion about it. A verdict nobody acts on ends nothing, and the provider
 ends nothing either.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  armIdleGuard,
  drainBody,
  refusalText,
  StreamCutShortError,
  StreamDegenerateError,
  StreamOverrunError,
  StreamStalledError,
} from '../dist/final/node/index.mjs';
import {
  anthropicBlockDelta,
  anthropicBlockStart,
} from './anthropic-frames.test-fixture.ts';
import { warnLinesDuring, } from './console-warn-lines.test-fixture.ts';
import { quotingFailure, } from './quoting-failure.test-fixture.ts';
import {
  frameOf,
  longVariedStream,
} from './sse-frame.test-fixture.ts';

/**
 Roomy window, so nothing in these tests trips the silence guard: what is
 under test here is the other guard entirely.
 */
const ROOMY_MS = 600_000;

/**
 Characters in each piece `streamOf` hands over; every fixture here is ASCII,
 so a piece decodes to exactly this many characters.
 */
const PIECE_CHARS = 4_096;

/**
 Wraps text in a response whose body arrives in pieces, counting how many
 pieces were actually pulled.

 THE COUNT IS THE POINT. A drain that read the whole body and then complained
 would pass every assertion about the error while leaving the socket open for
 the entire runaway, which is the cost this guard exists to avoid.

 @param raw - whole body

 @returns Response, and a reader of how much of it was consumed

 @example
 ```ts
 const { response, pulled, } = streamOf({ raw, },);
 ```
 */
function streamOf({ raw, }: { readonly raw: string; },): {
  readonly response: Response;
  readonly pulled: () => number;
} {
  /**
   Piece width, near what a socket delivers.
   */
  const width = 4_096;

  /**
   Pieces the body is delivered in.
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
   How many pieces the drain asked for.
   */
  const taken = { count: 0, };

  /**
   Encoder, since a body carries bytes rather than text.
   */
  const encoder = new TextEncoder();

  /**
   Body that hands over one piece per pull.
   */
  const body = new ReadableStream<Uint8Array>({
    pull(controller,): void {
      /**
       Next piece, absent once they run out.
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
 What one drain did, as a value.

 @example
 ```ts
 const outcome: DrainOutcome = { kind: 'drained', };
 ```
 */
type DrainOutcome = {
  readonly kind: 'drained';

  /**
   Body it handed back.
   */
  readonly body: string;
} | {
  readonly kind: 'raised';

  /**
   What it threw.
   */
  readonly error: unknown;
};

/**
 Drains a response, reporting a throw as a value so the assertion reads as an
 expectation rather than as control flow.

 @param response - response to drain

 @param guard - silence guard to pass through

 @param wireFormat - event grammar to name to the drain, absent for the
 module's own default

 @mutates response - its body is drained and cannot be read again

 @mutates guard - the drain notifies it per chunk

 @returns What the drain did

 @example
 ```ts
 const outcome = await drainOutcome({ response, guard, },);
 ```
 */
async function drainOutcome(
  {
    response,
    guard,
    callerSignal = new AbortController().signal,
    wireFormat,
  }: {
    readonly response: Response;
    readonly guard: Parameters<typeof drainBody>[0]['guard'];
    readonly callerSignal?: AbortSignal;
    readonly wireFormat?: Parameters<typeof drainBody>[0]['wireFormat'];
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
        // Conditional spread keeps the knob absent instead of undefined.
        ...(wireFormat === undefined ? {} : { wireFormat, }),
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
  // ONE AT A TIME: a case diverts the process-wide `console.warn` across an await.
  concurrency: 1,
  children: [
    it({
      name: 'CARRIES THE RAW CHARACTERS DELIVERED on both errors it ends a call with (ledger P7): the '
        + 'abandoned-spend reckoning divides raw wire characters by a raw-characters-per-token ratio, and '
        + 'an overrun or a degenerate ending carried only one channel\'s decoded count, about a '
        + 'hundredth of the raw figure',
      fn: async () => {
        /**
         Varied answer text, so the overrun bound ends the call and repetition does not.
         */
        const answering = streamOf({
          raw: Array.from(
            { length: 30_000, },
            function answer(_unused, at,): string {
              return frameOf({
                channel: 'content',
                text: `Cat ${String(at,)} sat on mat ${String(at * 7,)}. `,
              },);
            },
          ).join('',),
        },);

        using overrunGuard = armIdleGuard({
          label: 'hf:whiskers',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         Drain of the varied answer under a small content bound.
         */
        const overrun = await (async function drainUnderBound(): Promise<unknown> {
          try {
            return await drainBody({
              response: answering.response,
              guard: overrunGuard,
              callerSignal: new AbortController().signal,
              label: 'hf:whiskers',
              maxAnswerChars: 2_000,
            },);
          }
          catch (error) {
            return error;
          }
        })();
        if (!(overrun instanceof StreamOverrunError))
          throw new Error('an overrun by construction',);

        /**
         A model thinking the same sentence forever.
         */
        const repeating = streamOf({
          raw: frameOf({
            channel: 'reasoning',
            text: 'I will output. ',
          },)
            .repeat(30_000,),
        },);

        using degenerateGuard = armIdleGuard({
          label: 'hf:whiskers',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         What the drain did with the repetition.
         */
        const outcome = await drainOutcome({
          response: repeating.response,
          guard: degenerateGuard,
        },);
        if ((outcome.kind !== 'raised') || (!(outcome.error instanceof StreamDegenerateError)))
          throw new Error('a degeneration error by construction',);

        expect({
          overrunRaw: overrun.rawChars,
          degenerateRaw: outcome.error.rawChars,
        },).toEqual({
          overrunRaw: answering.pulled() * PIECE_CHARS,
          degenerateRaw: repeating.pulled() * PIECE_CHARS,
        },);
      },
    },),

    it({
      name: 'ENDS A RUNAWAY CALL rather than draining it, which is the whole point: the provider '
        + 'does not end these and no token cap bounds them, so this is the only place the call can '
        + 'stop. Asserting only the error would pass for a drain that read every byte first',
      fn: async () => {
        /**
         A model thinking the same sentence forever.
         */
        const {
          response,
          pulled,
        } = streamOf({
          raw: frameOf({
            channel: 'reasoning',
            text: 'I will output. ',
          },)
            .repeat(30_000,),
        },);

        using guard = armIdleGuard({
          label: 'hf:whiskers',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         What the drain did, as a value, since the throw is what is asserted.
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
         Pieces the whole runaway would have taken, had it been drained.
         */
        const whole = Math.ceil((30_000 * 60) / 4_096,);
        expect(pulled(),).toBeLessThan(whole,);
      },
    },),

    it({
      name: 'SWALLOWS A FAILED CANCEL rather than reporting it in place of the runaway diagnosis: '
        + 'the socket is released before the error is thrown, and releasing it failing must not '
        + 'replace the reason the call was ended with a reason it could not be torn down',
      fn: async () => {
        /**
         A model thinking the same sentence forever, same shape as the other
         runaway cases, so the ending is reached the same way.
         */
        const raw = frameOf({
          channel: 'reasoning',
          text: 'I will output. ',
        },)
          .repeat(30_000,);

        /**
         Pieces the body hands over one at a time.
         */
        const width = 4_096;
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
         How many times the underlying source's own `cancel` ran.
         */
        const cancelled = { count: 0, };

        /**
         Encoder, since a body carries bytes.
         */
        const encoder = new TextEncoder();

        /**
         A body whose own cancellation always fails, the way a socket that
         will not tear down cleanly behaves.
         */
        const body = new ReadableStream<Uint8Array>({
          pull(controller,): void {
            const next = pieces.shift();
            if (next === undefined) {
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(next,),);
          },
          cancel(): never {
            cancelled.count += 1;
            throw quotingFailure();
          },
        },);

        using guard = armIdleGuard({
          label: 'hf:whiskers',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        const {
          result: outcome,
          warned,
        } = await warnLinesDuring({
          run: async () =>
            drainOutcome({
              response: new Response(body, { headers: { 'content-type': 'text/event-stream', }, },),
              guard,
            },),
        },);

        // THE FAILED CANCEL IS NAMED BY CLASS: the failure's message quotes a header value.
        expect(warned,).toEqual(['[translation-repair] [drainBody] could not cancel : refused by TypeError',],);
        expect(outcome.kind,).toBe('raised',);
        if (outcome.kind !== 'raised')
          throw new Error('raised by construction',);

        // The runaway diagnosis survives the cancel failure: had the catch at
        // `stopReading` not swallowed it, this would have surfaced as a
        // StreamCutShortError wrapping the cancel's own error instead.
        if (!(outcome.error instanceof StreamDegenerateError))
          throw new Error('a degeneration error by construction',);
        expect(outcome.error.channel,).toBe('reasoning',);
        expect(cancelled.count,).toBe(1,);
      },
    },),

    it({
      name: 'KEEPS WHAT THE STREAM ALREADY DELIVERED when a call is cut, which used to be dropped '
        + 'on the floor. This is the whole point: a call that never got a first byte leaves an '
        + 'empty string and one cut off mid-reasoning leaves a truncated thinking block, and those '
        + 'want opposite remedies. Nothing on disk could tell them apart before',
      fn: async () => {
        /**
         What the model manages to say before the plug is pulled.
         */
        const said = 'It is a cat. It did a backflip. It cras';

        /**
         That much, framed as the wire carries it.
         */
        const delivered = frameOf({
          channel: 'reasoning',
          text: said,
        },);

        /**
         Caller's own steering.
         */
        const steering = new AbortController();

        /**
         How many pieces have gone out.
         */
        const sent = { count: 0, };

        /**
         Encoder, since a body carries bytes.
         */
        const encoder = new TextEncoder();

        /**
         A body that delivers once and is then torn down, which is what an
         abort does to a fetch in production.
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
         What the drain did.
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
      name: 'STATES A CUT STREAM\'S CAUSE BY CLASS in its message, which the error declares safe to repeat, and '
        + 'repeats the sentence of a cause that declares the same',
      fn: async () => {
        /**
         What the stream did before the cut, plain numbers.
         */
        const progress = {
          firstByteMs: 40,
          maxGapMs: 4,
          chars: 512,
          elapsedMs: 830,
        };

        /**
         Cut whose cause is a runtime failure quoting a header value.
         */
        const quoting = new StreamCutShortError({
          label: 'hf:whiskers',
          partialText: 'It is a cat.',
          progress,
          cause: quotingFailure(),
        },);

        /**
         Cut whose cause is a stall, a class that writes its own sentence.
         */
        const stalled = new StreamCutShortError({
          label: 'hf:whiskers',
          partialText: 'It is a cat.',
          progress,
          cause: new StreamStalledError({
            label: 'hf:whiskers',
            idleMs: 60_000,
            phase: 'body',
          },),
        },);

        expect(refusalText({ error: quoting, },),).toBe(
          'hf:whiskers: stream cut after 12 characters (refused by TypeError)',
        );
        expect(refusalText({ error: stalled, },),).toBe(
          'hf:whiskers: stream cut after 12 characters (Stalled: hf:whiskers emitted nothing for 60000ms (body))',
        );
      },
    },),

    it({
      name: 'RETURNS A HEALTHY BODY WHOLE, so the guard costs nothing to an ordinary call and no '
        + 'parser above the transport seam sees anything different',
      fn: async () => {
        /**
         An ordinary reply.
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
         What the drain did.
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
         Long, varied thinking followed by a long, varied answer.
         */
        const raw = longVariedStream();

        const { response, } = streamOf({ raw, },);

        using guard = armIdleGuard({
          label: 'hf:sable',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        /**
         What the drain did.
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
      name: 'READS AN ANTHROPIC-SHAPED STREAM WHEN TOLD ITS WIRE FORMAT, ending a thinking-trace '
        + 'runaway the default OpenAI-shaped scanner could never read a single character of: an '
        + 'Anthropic frame carries no `choices` key at all, so left unset the same body yields no '
        + 'delta and the call simply completes',
      fn: async () => {
        /**
         A model thinking the same sentence forever, spelled the way the
         Anthropic Messages wire spells a thinking delta.
         */
        const raw = anthropicBlockStart({
          index: 0,
          type: 'thinking',
        },) + anthropicBlockDelta({
          index: 0,
          deltaType: 'thinking_delta',
          field: 'thinking',
          text: 'I will output. ',
        },)
          .repeat(30_000,);

        const { response, } = streamOf({ raw, },);

        using guard = armIdleGuard({
          label: 'hf:sable',
          firstByteMs: ROOMY_MS,
          idleMs: ROOMY_MS,
        },);

        const outcome = await drainOutcome({
          response,
          guard,
          wireFormat: 'anthropic',
        },);

        expect(outcome.kind,).toBe('raised',);
        if (outcome.kind !== 'raised')
          throw new Error('raised by construction',);
        if (!(outcome.error instanceof StreamDegenerateError))
          throw new Error('a degeneration error by construction',);
        expect(outcome.error.channel,).toBe('reasoning',);
      },
    },),
  ],
},);
