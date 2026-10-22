/**
 Tests for the gate that ends a pass when every provider reads dry: a dry refusal on any call of the guarded
 client trips the pass's own abort with that refusal as the reason, once, and every other failure goes by
 untouched.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  EveryProviderDryError,
  type ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import { createPassDryStop, } from '../../dist/final/node/index.mjs';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import { SEAT_HYPER_OPENROUTER_VISION_EDITOR, } from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';

/**
 Client whose chat calls all throw one scripted failure.

 @param thrown - what each call throws

 @returns The client

 @example
 ```ts
 const client = throwingClient({ thrown: new Error('cat nap', ), },);
 ```
 */
function throwingClient({ thrown, }: { readonly thrown: Error; },): ModelClient {
  return {
    chatText: async () => {
      throw thrown;
    },
    chatJson: async () => {
      throw thrown;
    },
    decide: async () => {
      throw thrown;
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 Request every chat call here sends.

 @param signal - the call's abort handle

 @returns A request over no messages

 @example
 ```ts
 await client.chatText(requestWith({ signal, },),);
 ```
 */
function requestWith({ signal, }: { readonly signal: AbortSignal; },): Parameters<ModelClient['chatText']>[0] {
  return {
    modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
    messages: [],
    signal,
  };
}

await describe({
  name: createPassDryStop.name,
  children: [
    it({
      name: 'STARTS UNTRIPPED: the signal is live and no stop is asked for',
      fn: async () => {
        const dryStop = createPassDryStop();

        expect(dryStop.signal.aborted,).toBe(false,);
        expect(dryStop.tripped(),).toBe(false,);
      },
    },),

    it({
      name: 'TRIPS ON A DRY REFUSAL from chat text, rethrowing that very object and aborting the signal with it as '
        + 'the reason, so every call in flight under the signal ends with the cause rather than a timeout',
      fn: async () => {
        const dryStop = createPassDryStop();
        const dry = new EveryProviderDryError({ measured: 'meters read every provider dry', },);
        const client = dryStop.guard({ client: throwingClient({ thrown: dry, },), },);

        expect(await rejectionOf(async function call(): Promise<unknown> {
          return await client.chatText(requestWith({ signal: dryStop.signal, },),);
        },),).toBe(dry,);
        expect(dryStop.signal.aborted,).toBe(true,);
        expect(dryStop.signal.reason,).toBe(dry,);
      },
    },),

    it({
      name: 'TRIPS ON A DRY REFUSAL from the typed JSON exchange and from a decision seat as well',
      fn: async () => {
        const viaJson = createPassDryStop();
        const dryJson = new EveryProviderDryError({ measured: 'json path', },);
        await rejectionOf(async function call(): Promise<unknown> {
          return await viaJson.guard({ client: throwingClient({ thrown: dryJson, },), },).chatJson({
            ...requestWith({ signal: viaJson.signal, },),
            responseFormat: {
              type: 'json_schema',
              json_schema: { name: 'cat', schema: { type: 'object', }, },
            },
            validate: (value: unknown): value is object => (typeof value) === 'object',
          },);
        },);
        expect(viaJson.signal.reason,).toBe(dryJson,);

        const viaDecide = createPassDryStop();
        const dryDecide = new EveryProviderDryError({ measured: 'decide path', },);
        await rejectionOf(async function call(): Promise<unknown> {
          return await viaDecide.guard({ client: throwingClient({ thrown: dryDecide, },), },).decide?.({
            modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            state: {},
            questions: {},
            signal: viaDecide.signal,
          } as never,);
        },);
        expect(viaDecide.signal.reason,).toBe(dryDecide,);
      },
    },),

    it({
      name: 'KEEPS THE FIRST CAUSE when a second call meets the dry router after the stop, and names it in one note '
        + 'that says what the run does next',
      fn: async () => {
        const dryStop = createPassDryStop();
        const first = new EveryProviderDryError({ measured: 'first reading', },);
        const second = new EveryProviderDryError({ measured: 'second reading', },);
        await rejectionOf(async function call(): Promise<unknown> {
          return await dryStop.guard({ client: throwingClient({ thrown: first, },), },).chatText(
            requestWith({ signal: dryStop.signal, },),
          );
        },);
        await rejectionOf(async function call(): Promise<unknown> {
          return await dryStop.guard({ client: throwingClient({ thrown: second, },), },).chatText(
            requestWith({ signal: dryStop.signal, },),
          );
        },);

        expect(dryStop.signal.reason,).toBe(first,);
        expect(dryStop.tripped(),).toBe(true,);
        const note = dryStop.stopNote();
        expect(note.startsWith('STOP ',),).toBe(true,);
        expect(note,).toContain('every provider',);
        expect(note,).toContain('first reading',);
        expect(note,).not.toContain('second reading',);
        expect(note,).toContain('no further entry starts',);
      },
    },),

    it({
      name: 'LEAVES EVERY OTHER FAILURE ALONE: it propagates unchanged and the stop is not tripped',
      fn: async () => {
        const dryStop = createPassDryStop();
        const other = new Error('connection reset',);
        const client = dryStop.guard({ client: throwingClient({ thrown: other, },), },);

        expect(await rejectionOf(async function call(): Promise<unknown> {
          return await client.chatText(requestWith({ signal: dryStop.signal, },),);
        },),).toBe(other,);
        expect(dryStop.signal.aborted,).toBe(false,);
        expect(dryStop.tripped(),).toBe(false,);
      },
    },),

    it({
      name: 'KEEPS WHAT THE CLIENT CARRIES BESIDE THE CALLS, and a client without decisions stays without them',
      fn: async () => {
        const dryStop = createPassDryStop();
        const marked = {
          chatText: async () => {
            throw new Error('unused',);
          },
          chatJson: async () => {
            throw new Error('unused',);
          },
          quotas: async () => {
            throw new Error('unused',);
          },
          providerHolds: 'kept',
        };
        const guarded = dryStop.guard({ client: marked as unknown as ModelClient & { readonly providerHolds: string; }, },);

        expect(guarded.providerHolds,).toBe('kept',);
        expect(guarded.decide,).toBeUndefined();
      },
    },),
  ],
},);
