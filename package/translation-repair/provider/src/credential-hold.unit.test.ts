/**
 Tests the credential holds a router keeps (zheermao19, 2026-10-20): a provider
 whose credential was refused is held out for every model for the rest of the
 run, the hold is said once, and the line names where the seat goes. The
 routed behaviour is in `provider-router-credential-hold.unit.test.ts`. Cat-
 themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  exchangeFailureLogText,
  ProviderHttpError,
} from '@monochromatic-dev/translation-repair-provider-stream';
import type { ProviderName, } from '@monochromatic-dev/translation-repair-shared-contract';
import { levelCapturingLogger, } from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import { SEAT_HYPER_TEXT_BEDROCK, } from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';
import {
  createCredentialHolds,
  credentialRefusalLine,
  holdOnCredentialRefusal,
  reachPastCredentialHolds,
} from '../dist/final/node/index.mjs';

/**
 Status a provider answers with when it rejects the request's credential.
 */
const HTTP_UNAUTHORIZED = 401;

/**
 The refusal a provider raises when it rejects the credential.

 @param provider - provider that refused

 @returns The failure the router catches

 @example
 ```ts
 const error = refusalFrom({ provider: 'bedrock', },);
 ```
 */
function refusalFrom({ provider, }: { readonly provider: ProviderName; },): ProviderHttpError {
  return new ProviderHttpError({
    provider,
    status: HTTP_UNAUTHORIZED,
    bodyText: 'the security token has expired',
  },);
}

/**
 Reach of a model Bedrock, Hyper and OpenRouter serve.
 */
const BEDROCK_HYPER_OPENROUTER = {
  neuralwatt: false,
  synthetic: false,
  hyper: true,
  bedrock: true,
  openrouter: true,
};

await describe({
  name: 'the credential holds a router keeps (zheermao19)',
  children: [
    describe({
      name: createCredentialHolds.name,
      children: [
        it({
          name: 'HOLDS A PROVIDER once and says so only to the call that began the hold, for every model',
          fn: async () => {
            const holds = createCredentialHolds();

            expect(holds.isHeld({ provider: 'bedrock', },),).toBe(false,);
            expect(holds.hold({ provider: 'bedrock', },),).toBe(true,);
            expect(holds.hold({ provider: 'bedrock', },),).toBe(false,);
            expect(holds.isHeld({ provider: 'bedrock', },),).toBe(true,);
            expect(holds.isHeld({ provider: 'hyper', },),).toBe(false,);
          },
        },),
      ],
    },),

    describe({
      name: reachPastCredentialHolds.name,
      children: [
        it({
          name: 'TAKES OUT A HELD PROVIDER THAT SERVES THE MODEL and lists it, and lists none that does not serve it',
          fn: async () => {
            const holds = createCredentialHolds();
            holds.hold({ provider: 'bedrock', },);
            holds.hold({ provider: 'synthetic', },);

            expect(reachPastCredentialHolds({ reach: BEDROCK_HYPER_OPENROUTER, holds, },),).toEqual({
              reach: {
                neuralwatt: false,
                synthetic: false,
                hyper: true,
                bedrock: false,
                openrouter: true,
              },
              refused: ['bedrock',],
            },);
          },
        },),
        it({
          name: 'LEAVES THE REACH AS IT STANDS where no serving provider is held',
          fn: async () => {
            expect(reachPastCredentialHolds({ reach: BEDROCK_HYPER_OPENROUTER, holds: createCredentialHolds(), },),).toEqual({
              reach: BEDROCK_HYPER_OPENROUTER,
              refused: [],
            },);
          },
        },),
      ],
    },),

    describe({
      name: credentialRefusalLine.name,
      children: [
        it({
          name: 'NAMES THE PROVIDERS THE SEAT MOVES TO in the order they are tried, and says the seat is withheld where none is left',
          fn: async () => {
            const error = refusalFrom({ provider: 'bedrock', },);
            const said = exchangeFailureLogText({ error, },);

            expect(credentialRefusalLine({
              modelId: SEAT_HYPER_TEXT_BEDROCK,
              provider: 'bedrock',
              error,
              movesTo: ['hyper', 'openrouter',],
            },),).toBe(
              `SEAT CREDENTIAL REFUSED ${SEAT_HYPER_TEXT_BEDROCK} on bedrock: ${said}. `
                + 'bedrock is held out for every model for the rest of the run, because one credential serves them all. '
                + `${SEAT_HYPER_TEXT_BEDROCK} moves to hyper, then openrouter. `
                + 'Renew bedrock\'s credential before the next run, or leave it.',
            );
            expect(credentialRefusalLine({
              modelId: SEAT_HYPER_TEXT_BEDROCK,
              provider: 'bedrock',
              error,
              movesTo: [],
            },),).toContain(`No provider that serves ${SEAT_HYPER_TEXT_BEDROCK} is left, so the seat is withheld for the rest of the run.`,);
          },
        },),
      ],
    },),

    describe({
      name: holdOnCredentialRefusal.name,
      children: [
        it({
          name: 'WARNS ONCE PER PROVIDER, leaving out of the seat\'s next providers the one refused and one the model\'s '
            + 'stream bound holds out',
          fn: async () => {
            const holds = createCredentialHolds();
            const lines: string[] = [];
            const rl = levelCapturingLogger({ lines, },);
            const error = refusalFrom({ provider: 'bedrock', },);
            const boundHolds = {
              hold: function holdNothing(): void {
                return undefined;
              },
              remainingMs: function hyperHeldForThisModel(
                { provider, modelId, }: { readonly provider: ProviderName; readonly modelId: string; },
              ): number {
                return ((provider === 'hyper') && (modelId === SEAT_HYPER_TEXT_BEDROCK)) ? 1_000 : 0;
              },
            };

            holdOnCredentialRefusal({
              rl,
              provider: 'bedrock',
              modelId: SEAT_HYPER_TEXT_BEDROCK,
              error,
              reach: BEDROCK_HYPER_OPENROUTER,
              holds,
              boundHolds,
            },);
            holdOnCredentialRefusal({
              rl,
              provider: 'bedrock',
              modelId: SEAT_HYPER_TEXT_BEDROCK,
              error,
              reach: BEDROCK_HYPER_OPENROUTER,
              holds,
              boundHolds,
            },);

            expect(lines.length,).toBe(1,);
            expect(lines[0],).toContain(`${SEAT_HYPER_TEXT_BEDROCK} moves to openrouter. `,);
            expect(holds.isHeld({ provider: 'bedrock', },),).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);
