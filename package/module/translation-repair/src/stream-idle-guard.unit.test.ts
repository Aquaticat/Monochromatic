import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  armIdleGuard,
  drainBody,
  STREAM_FIRST_BYTE_MS,
  STREAM_IDLE_MS,
  StreamCutShortError,
  StreamStalledError,
} from '../dist/final/node/index.mjs';

//region Fixtures
// Cat-themed invention throughout: no corpus text ever reaches a committed
// fixture, because the corpus is unlicensed.

/**
 * Tiny window so a stall test finishes in milliseconds rather than minutes.
 */
const TINY_MS = 20;

/**
 * Window long enough that it never trips during a test that is not about
 * tripping.
 */
const ROOMY_MS = 10_000;

/**
 * Waits for a stall to trip, by polling the guard's own signal rather than
 * sleeping a fixed span, so the test does not race a slow machine.
 *
 * @param signal - guard signal expected to abort
 *
 * @returns Nothing; resolves once aborted
 */
async function untilAborted(signal: AbortSignal,): Promise<void> {
  const spin = { done: signal.aborted, };
  while (!spin.done) {
    // oxlint-disable-next-line no-await-in-loop -- polling is inherently sequential
    await new Promise(function tick(resolve,) {
      setTimeout(resolve, TINY_MS,);
    },);
    spin.done = signal.aborted;
  }
}

/**
 * Builds a Response whose body emits the given chunks, so the drain sees a
 * real ReadableStream rather than a whole-body string.
 *
 * @param chunks - byte chunks to emit in order
 *
 * @returns Response carrying those chunks as its body
 */
function streamingResponse(chunks: readonly Uint8Array[],): Response {
  return new Response(
    new ReadableStream({
      start(controller,) {
        for (const chunk of chunks)
          controller.enqueue(chunk,);
        controller.close();
      },
    },),
  );
}

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: 'idle window constants',
      children: [
        it({
          name: 'keeps both windows above the per-call deadline so the guard measures without killing',
          fn: async () => {
            // 360_000 is RUN_PER_CALL_TIMEOUT_MS in
            // corpus-run/run-config.ts (raised from 240_000 once that value
            // was measured to clip real work), not imported here because it
            // is not re-exported through the package barrel this test
            // builds against. Both windows must stay above it so the total
            // deadline is what ends a genuinely dead call, never this
            // guard.
            expect(STREAM_FIRST_BYTE_MS,).toBeGreaterThan(360_000,);
            expect(STREAM_IDLE_MS,).toBeGreaterThan(360_000,);
          },
        },),

        it({
          name: 'keeps both windows above the highest first-byte wait and mid-stream gap observed in production so far',
          fn: async () => {
            // 347_099 is PASS 7 RUN 014's uncensored first-byte maximum
            // (doc/handover/translation-repair.md), a completed call within
            // 3.6 percent of the current deadline. 124_992 is the largest
            // mid-stream gap `#121` found pooling
            // doc/audit/stream-guards-first-production-traffic.md's three
            // logs (7079 streams); also a completed hf:zai-org/GLM-5.2 call
            // rather than a stall. A future re-arming attempt that lowers
            // either constant below its own history would silently start
            // killing healthy calls; see
            // doc/decision/translation-repair-runaway-call-termination.md
            // for the full arithmetic.
            expect(STREAM_FIRST_BYTE_MS,).toBeGreaterThan(347_099,);
            expect(STREAM_IDLE_MS,).toBeGreaterThan(124_992,);
          },
        },),
      ],
    },),

    describe({
      name: StreamStalledError.name,
      children: [
        it({
          name: 'names the call, the window, and which phase went silent',
          fn: async () => {
            const error = new StreamStalledError({
              label: 'hf:whiskers',
              idleMs: 1_500,
              phase: 'body',
            },);
            expect(error.name,).toBe('StreamStalledError',);
            expect(error.message,).toContain('hf:whiskers',);
            expect(error.message,).toContain('1500',);
            expect(error.message,).toContain('body',);
          },
        },),
      ],
    },),

    describe({
      name: armIdleGuard.name,
      children: [
        //region Tripping

        it({
          name: 'trips on first-byte silence and carries the stall as the abort reason',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:whiskers',
              firstByteMs: TINY_MS,
              idleMs: ROOMY_MS,
            },);
            await untilAborted(guard.signal,);
            expect(guard.signal.aborted,).toBe(true,);
            expect(guard.signal.reason,).toBeInstanceOf(StreamStalledError,);
            expect((guard.signal.reason as Error).message,).toContain(
              'first-byte',
            );
          },
        },),

        it({
          name: 'trips on body silence once the stream has started',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:mittens',
              firstByteMs: ROOMY_MS,
              idleMs: TINY_MS,
            },);
            guard.notify(5,);
            await untilAborted(guard.signal,);
            expect((guard.signal.reason as Error).message,).toContain('body',);
          },
        },),

        it({
          name: 'does not trip while chunks keep arriving',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:mittens',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);
            guard.notify(3,);
            guard.notify(4,);
            expect(guard.signal.aborted,).toBe(false,);
          },
        },),

        //endregion Tripping

        //region Progress

        it({
          name: 'reports no first byte before anything arrives',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:mittens',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);
            expect(guard.progress().firstByteMs,).toBeLessThan(0,);
            expect(guard.progress().chars,).toBe(0,);
          },
        },),

        it({
          name: 'accumulates characters and times the first byte',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:mittens',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);
            guard.notify(7,);
            guard.notify(11,);
            const progress = guard.progress();
            expect(progress.chars,).toBe(18,);
            expect(progress.firstByteMs,).toBeGreaterThanOrEqual(0,);
            expect(progress.maxGapMs,).toBeGreaterThanOrEqual(0,);
          },
        },),

        //endregion Progress

        //region Disposal

        it({
          name: 'stops tripping once disposed',
          fn: async () => {
            const guard = armIdleGuard({
              label: 'hf:mittens',
              firstByteMs: TINY_MS,
              idleMs: TINY_MS,
            },);
            guard[Symbol.dispose]();
            await new Promise(function settle(resolve,) {
              setTimeout(resolve, TINY_MS * 5,);
            },);
            expect(guard.signal.aborted,).toBe(false,);
          },
        },),

        //endregion Disposal
      ],
    },),

    describe({
      name: drainBody.name,
      children: [
        it({
          name: 'concatenates every chunk into the whole body',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:whiskers',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);
            const encoder = new TextEncoder();
            const bodyText = await drainBody({
              response: streamingResponse([
                encoder.encode('data: one\n',),
                encoder.encode('data: two\n',),
              ],),
              guard,
            label: 'hf:whiskers',
              callerSignal: new AbortController().signal,
            },);
            expect(bodyText,).toBe('data: one\ndata: two\n',);
            expect(guard.progress().chars,).toBe(20,);
          },
        },),

        it({
          name: 'decodes a multi-byte character split across two chunks',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:whiskers',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);
            // U+732B in UTF-8 is e7 8c ab; splitting it proves the decoder is
            // incremental rather than per-chunk.
            const bodyText = await drainBody({
              response: streamingResponse([
                new Uint8Array([0xE7, 0x8C,],),
                new Uint8Array([0xAB,],),
              ],),
              guard,
            label: 'hf:whiskers',
              callerSignal: new AbortController().signal,
            },);
            expect(bodyText,).toBe('猫',);
          },
        },),

        it({
          name: 'reads an empty body as the empty string',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:whiskers',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);
            const bodyText = await drainBody({
              response: new Response(null,),
              guard,
            label: 'hf:whiskers',
              callerSignal: new AbortController().signal,
            },);
            expect(bodyText,).toBe('',);
          },
        },),

        it({
          name: 'surfaces the stall rather than the platform abort when the guard trips',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:whiskers',
              firstByteMs: TINY_MS,
              idleMs: TINY_MS,
            },);

            /**
             * Body that never emits, so only the guard can end the read.
             */
            const stalled = new Response(
              new ReadableStream({
                start(controller,) {
                  guard.signal
                    .addEventListener(
                      'abort',
                      function tearDown() {
                        controller.error(guard.signal.reason,);
                      },
                      { once: true, },
                    );
                },
              },),
            );

            let caught: unknown;
            try {
              await drainBody({
                response: stalled,
                guard,
            label: 'hf:whiskers',
                callerSignal: new AbortController().signal,
              },);
            }
            catch (error) {
              caught = error;
            }
            // The stall is now the CAUSE of a cut rather than the thrown value
        // itself, because the drain also has to hand back whatever the stream
        // delivered before it stopped. The distinction this case exists for is
        // unchanged: a stall must still be identifiable as a stall rather than
        // as the platform abort that carried it out.
        expect(caught,).toBeInstanceOf(StreamCutShortError,);
        expect((caught as StreamCutShortError).cause,).toBeInstanceOf(StreamStalledError,);
          },
        },),

        it({
          name: 'reports caller steering as itself, not as a stall',
          fn: async () => {
            using guard = armIdleGuard({
              label: 'hf:whiskers',
              firstByteMs: ROOMY_MS,
              idleMs: ROOMY_MS,
            },);

            /**
             * Caller's own controller, aborted mid-read to imitate steering.
             */
            const caller = new AbortController();

            /**
             * Failure the caller's abort raises, distinct from a stall.
             */
            const steering = new Error('caller stopped the run',);

            const steered = new Response(
              new ReadableStream({
                start(controller,) {
                  caller.signal
                    .addEventListener(
                      'abort',
                      function tearDown() {
                        controller.error(steering,);
                      },
                      { once: true, },
                    );
                },
              },),
            );
            caller.abort(steering,);

            let caught: unknown;
            try {
              await drainBody({
                response: steered,
                guard,
            label: 'hf:whiskers',
                callerSignal: caller.signal,
              },);
            }
            catch (error) {
              caught = error;
            }
            expect(caught,).not.toBeInstanceOf(StreamStalledError,);
            expect((caught as Error).message,).toContain('caller stopped',);
          },
        },),
      ],
    },),
  ],
},);
