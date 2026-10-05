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
      name: 'RE-ASKS only where the first answer failed, returning the second where it is usable and the '
        + 'FIRST where both fail, each path distinguished by the value it returns',
      fn: async () => {
        const usable = await reaskElsewhereNudged({
          request: REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request'],
          first: {
            reply: { text: 'not json at all', servedBy: 'provider-a', },
            outcome: { kind: 'schema-mismatch', rawText: 'not json at all', detail: 'fixture', },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => ({ text: '{"spot":"radiator"}', }),
        },);
        if (usable.kind !== 'ok')
          throw new Error('the re-ask answer was usable and must come back ok',);
        expect(JSON.stringify(usable.value,),).toContain('radiator',);

        const bothFail = await reaskElsewhereNudged({
          request: REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request'],
          first: {
            reply: { text: 'still not json', servedBy: 'provider-a', },
            outcome: { kind: 'schema-mismatch', rawText: 'still not json', detail: 'fixture', },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => ({ text: 'not json either', }),
        },);
        expect(bothFail.kind,).toBe('schema-mismatch',);
        expect(JSON.stringify(bothFail,),).not.toContain('radiator',);
      },
    },),

    it({
      name: 'ANSWERS FROM AN UNTAGGED FIRST REPLY with no re-ask, since no provider names where else to '
        + 'look',
      fn: async () => {
        let asked = false;
        const untagged = await reaskElsewhereNudged({
          request: REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request'],
          first: {
            reply: { text: 'not json at all', },
            outcome: { kind: 'schema-mismatch', rawText: 'not json at all', detail: 'fixture', },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => {
            asked = true;
            throw new Error('the untagged reply must not buy a re-ask',);
          },
        },);
        expect(asked,).toBe(false,);
        expect(untagged.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'KEEPS THE FIRST ANSWER where the re-ask exchange fails and the caller stands, naming the '
        + 'failure and answering from the first',
      fn: async () => {
        const kept = await reaskElsewhereNudged({
          request: REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request'],
          first: {
            reply: { text: 'not json at all', servedBy: 'provider-a', },
            outcome: { kind: 'schema-mismatch', rawText: 'not json at all', detail: 'fixture', },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => {
            throw new Error('the cat swatted the cable',);
          },
        },);
        expect(kept.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'THROWS the re-ask error where the caller aborted, so steering stops the second chance',
      fn: async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(reaskElsewhereNudged({
          request: {
            ...(REQUEST as Parameters<typeof reaskElsewhereNudged>[0]['request']),
            signal: controller.signal,
          },
          first: {
            reply: { text: 'not json at all', servedBy: 'provider-a', },
            outcome: { kind: 'schema-mismatch', rawText: 'not json at all', detail: 'fixture', },
          } as unknown as Parameters<typeof reaskElsewhereNudged>[0]['first'],
          ask: async () => {
            throw new Error('the cat swatted the cable',);
          },
        },),).rejects.toThrow('the cat swatted the cable',);
      },
    },),
  ],
},);

//endregion Nudged reask tests
