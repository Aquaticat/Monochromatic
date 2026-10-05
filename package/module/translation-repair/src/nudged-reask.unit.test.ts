/**
 Tests for the nudged re-ask.

 THE FIRST ANSWER STANDS when the re-ask brings nothing usable: it came from
 the provider the policy preferred, and the caller's handling is written
 against it. The re-ask's log names the provider that answered, or another
 provider where the reply named none.

 FIXTURES ARE CAT-THEMED.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  reaskElsewhereNudged,
} from '../dist/final/node/index.mjs';

//region Nudged reask tests

/**
 Request under test, asking one question of one seat.
 */
const REQUEST = {
  modelId: 'whiskers/reader-a',
  messages: [{ role: 'user', content: 'the sheet', },],
  signal: new AbortController().signal,
  responseFormat: {
    type: 'json_schema',
    json_schema: { name: 'cat', schema: { type: 'object', }, },
  },
  validate: function isCat(value: unknown,): value is { readonly spot: string; } {
    return (typeof (value as { readonly spot?: unknown; }).spot) === 'string';
  },
};

await describe({
  name: 'nudged re-ask',
  children: [
    it({
      name: 'RETURNS the second answer where it is usable, and the FIRST answer where both fail',
      fn: async () => {
        const usable = await reaskElsewhereNudged({
          request: REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request'],
          first: {
            reply: { text: '{"spot":"windowsill"}', },
            outcome: { kind: 'ok', value: { spot: 'windowsill', }, },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => ({ text: '{"spot":"radiator"}', }),
        },);
        expect(usable.kind,).toBe('ok',);

        const bothFail = await reaskElsewhereNudged({
          request: REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request'],
          first: {
            reply: { text: '{"spot":"windowsill"}', },
            outcome: { kind: 'ok', value: { spot: 'windowsill', }, },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => ({ text: 'not json at all', }),
        },);
        expect(bothFail.kind,).toBe('ok',);
      },
    },),
  ],
},);

//endregion Nudged reask tests
