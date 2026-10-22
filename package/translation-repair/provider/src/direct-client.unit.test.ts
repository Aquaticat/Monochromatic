/**
 Tests for the chat body DeepSeek's and Xiaomi's clients share, run over both routes: the stream that stops before its
 terminator and the measured completion cap.

 NOTHING HERE REACHES A PROVIDER: every transport is an in-memory script, and every key is invented. The route-specific
 cases sit beside their clients in `deepseek-client.unit.test.ts` and `xiaomi-client.unit.test.ts`. Fixtures are
 cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createDeepSeekClient,
  createXiaomiClient,
  type ModelCaller,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_OPENROUTER_ONLY_CHECKER,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';
import {
  askCat,
  DEEPSEEK_USAGE_CHUNK,
  firstBodyOf,
  ONE_QUICK_RETRY,
  scripted,
  streamOf,
  XIAOMI_USAGE_CHUNK,
} from './direct-client.test-fixture.ts';

/**
 One route's client over a script, and the model it is granted for.

 @example
 ```ts
 const route: RouteUnderTest = { name: 'deepseek', make, modelId, usageChunk, };
 ```
 */
type RouteUnderTest = {
  /**
   Route's name, for the failure message.
   */
  readonly name: string;

  /**
   Builds the route's client over a recorded transport.
   */
  readonly make: (transport: Parameters<typeof createXiaomiClient>[0]['transport']) => Pick<ModelCaller, 'chatText'>;

  /**
   The one roster model the route's key is granted for.
   */
  readonly modelId: typeof SEAT_HYPER_OPENROUTER_UNMEASURED | typeof SEAT_OPENROUTER_ONLY_CHECKER;

  /**
   The closing usage chunk the route's provider writes.
   */
  readonly usageChunk: string;
};

/**
 Both direct routes, each over a client that retries once a millisecond later.
 */
const ROUTES: readonly RouteUnderTest[] = [
  {
    name: 'deepseek',
    make: (transport,) => createDeepSeekClient({ apiKey: 'cat-key-deepseek', transport, retryPolicy: ONE_QUICK_RETRY, },),
    modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
    usageChunk: DEEPSEEK_USAGE_CHUNK,
  },
  {
    name: 'xiaomi',
    make: (transport,) => createXiaomiClient({ apiKey: 'cat-key-xiaomi', transport, retryPolicy: ONE_QUICK_RETRY, },),
    modelId: SEAT_OPENROUTER_ONLY_CHECKER,
    usageChunk: XIAOMI_USAGE_CHUNK,
  },
];

await describe({
  name: 'the chat body both direct routes share',
  // SEQUENTIAL: the run spend meter is process-wide, so cases that read its change must not overlap.
  concurrency: 1,
  children: ROUTES.map((route,) =>
    describe({
      name: route.name,
      concurrency: 1,
      children: [
        it({
          name: 'RETRIES a stream that stopped before [DONE] as the transport failure it is, and answers from the whole one',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [
                { status: 200, bodyText: streamOf({ usageChunk: route.usageChunk, done: false, }), },
                { status: 200, bodyText: streamOf({ usageChunk: route.usageChunk, done: true, }), },
              ],
            },);

            const reply = await askCat({ client: route.make(transport,), modelId: route.modelId, },);

            expect(reply.text,).toBe('{"spot":"sunbeam"}',);
            expect(exchanges.length,).toBe(2,);
          },
        },),

        it({
          name: 'SENDS the measured completion cap as a whole number of tokens on every call',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [{ status: 200, bodyText: streamOf({ usageChunk: route.usageChunk, done: true, }), },],
            },);

            await askCat({ client: route.make(transport,), modelId: route.modelId, },);

            const { max_tokens: cap, } = firstBodyOf({ exchanges, },);
            expect(Number.isSafeInteger(cap,),).toBe(true,);
            expect(cap as number,).toBeGreaterThan(0,);
          },
        },),
      ],
    },)
  ),
},);
