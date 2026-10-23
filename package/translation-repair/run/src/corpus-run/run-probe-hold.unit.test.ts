/**
 Tests that a probe's run client cuts a hold a refusal states for itself (N6 of the re-check of fix rounds 3 and 4).

 A probe command has no hard cap, so the budgets its client builds once held a provider out for as long as a refusal
 stated: a body saying "try again in 99999999h" kept Synthetic out of routing for about eleven thousand years while the
 wait for the hold polled once a second. Every case here builds a client on an environment it hands over and a transport
 that refuses every call with that body, so nothing reaches a provider.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { HOLD_POLL_MS, } from '@monochromatic-dev/translation-repair-provider';
import { runClientFrom, } from '../../dist/final/node/index.mjs';
import { SEAT_SYNTHETIC_VISION_NO_OPENROUTER, } from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';
import { withFreshRunSeats, } from '@monochromatic-dev/translation-repair-stage/ts/corpus-run/fresh-run-seats.test-fixture.ts';

/**
 One day, in milliseconds: far longer than any probe waits, far shorter than the wait the refusals here state.
 */
const ONE_DAY_MS = 86_400_000;

/**
 Environment holding the first provider's key and nothing else. Invented.
 */
const ONE_KEY = { TRANSLATION_REPAIR_SYNTHETIC_API_KEY: 'whiskers-not-a-real-key', };

/**
 Transport that refuses every call with a body stating a wait of 99,999,999 hours.

 @returns Reply with HTTP 429 and the stated wait

 @example
 ```ts
 const client = runClientFrom({ env: ONE_KEY, transport: refusingWithAHugeWait, },);
 ```
 */
async function refusingWithAHugeWait(): Promise<{ readonly status: number; readonly bodyText: string; }> {
  return { status: 429, bodyText: 'Rate limit reached. Please try again in 99999999h', };
}

await describe({
  name: runClientFrom.name,
  children: [
    it({
      name: 'CUTS A HOLD A REFUSAL STATES AT THE CAP THE CLIENT IS BUILT WITH, so a probe never waits out a stated '
        + 'wait of 99,999,999 hours (N6 of the re-check of fix rounds 3 and 4)',
      fn: async (ctx) => {
        using _fresh = withFreshRunSeats();

        // THE WAIT FOR A HOLD IS ON THE TIMER, so a fake clock stands in for it and the call is abandoned by its signal
        // once the hold is read; a client that holds the provider out for the whole stated wait would otherwise never
        // let the call end.
        /**
         The fake clock the wait for the hold sleeps on.
         */
        const clock = ctx.sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout',], },);
        /**
         Abort the call is abandoned by.
         */
        const abandon = new AbortController();
        /**
         Client built with no cap, as a probe command builds it.
         */
        const client = runClientFrom({ env: ONE_KEY, transport: refusingWithAHugeWait, },);

        /**
         Asks the seat and notes how the call ended, in a list of none or one.
         */
        async function askSeat(): Promise<readonly unknown[]> {
          try {
            await client.chatText({
              modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
              messages: [{ role: 'user', content: 'Where does the cat nap?', },],
              signal: abandon.signal,
            },);
            return [];
          }
          catch (error) {
            return [error,];
          }
        }

        /**
         The call, started on the fake clock.
         */
        const asking = askSeat();
        await clock.tickAsync(1,);
        /**
         Hold the refusal left on Synthetic.
         */
        const held = client.providerHolds().synthetic;
        abandon.abort();
        await clock.tickAsync(HOLD_POLL_MS,);
        await asking;

        expect(held,).toBeGreaterThan(0,);
        expect(held,).toBeLessThanOrEqual(ONE_DAY_MS,);
      },
    },),
  ],
},);
