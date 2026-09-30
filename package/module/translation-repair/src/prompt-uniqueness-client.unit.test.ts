/**
 Tests process-local model and substantive prompt uniqueness.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  MalformedCompletionError,
  modelPromptDigest,
  NoProviderForModelError,
  promptUniqueClient,
  CUT_SHORT_RECOVERY_NUDGE,
  OFF_SHAPE_RECOVERY_NUDGE,
  type ChatTextRequest,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import { SEAT_SYNTHETIC_VISION_WITHHELD, } from './roster-seats.test-fixture.ts';

/**
 Guard accepting any string, so a quoted JSON string is a usable answer and
 anything that is not JSON is not.

 @param value - parsed reply

 @returns Whether it is a string

 @example
 ```ts
 isStringAnswer('windowsill',);
 ```
 */
function isStringAnswer(value: unknown,): value is string {
  return (typeof value) === 'string';
}

/**
 Exact prompt reused across boundary cases.
 */
const REQUEST: ChatTextRequest = {
  modelId: SEAT_SYNTHETIC_VISION_WITHHELD,
  messages: [{ role: 'user', content: 'Judge this one cat sentence.', },],
  signal: AbortSignal.timeout(5_000,),
};

await describe({
  name: promptUniqueClient.name,
  children: [
    it({
      name: 'REUSES COMPLETED PAYLOAD instead of second provider call',
      fn: async () => {
        /** Provider calls crossing wrapper. */
        let providerCalls = 0;
        const inner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            return { text: 'first payload', };
          },
          chatJson: async () => {
            throw new Error('chatJson unused by text fixture',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        expect(await client.chatText(REQUEST,),).toEqual({ text: 'first payload', },);
        expect(await client.chatText(REQUEST,),).toEqual({ text: 'first payload', },);
        expect(providerCalls,).toBe(1,);
      },
    },),

    it({
      name: 'REUSES JSON PAYLOAD when only response schema metadata changes',
      fn: async () => {
        /** Provider calls crossing wrapper. */
        let providerCalls = 0;
        const inner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            return { text: 'not-json', };
          },
          chatJson: async () => {
            throw new Error('chatJson bypassed by prompt payload reader',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        const first = await client.chatJson({
          ...REQUEST,
          responseFormat: {
            type: 'json_schema',
            json_schema: {
              name: 'first_shape',
              schema: { type: 'object', },
            },
          },
          validate: function acceptsString(value: unknown,): value is string {
            return (typeof value) === 'string';
          },
        },);

        const second = await client.chatJson({
          ...REQUEST,
          responseFormat: {
            type: 'json_schema',
            json_schema: {
              name: 'second_shape',
              schema: { type: 'string', },
            },
          },
          validate: function acceptsString(value: unknown,): value is string {
            return (typeof value) === 'string';
          },
        },);
        expect(first.kind,).toBe('schema-mismatch',);
        expect(second.kind,).toBe('schema-mismatch',);
        expect(providerCalls,).toBe(1,);
      },
    },),

    it({
      name: 'RELEASES IDENTITY after transport throws without payload',
      fn: async () => {
        /** Provider calls crossing wrapper. */
        let providerCalls = 0;
        const inner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            if (providerCalls === 1)
              throw new Error('connection reset before payload',);
            return { text: 'recovered payload', };
          },
          chatJson: async () => {
            throw new Error('chatJson unused by text fixture',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        // ASSERTED OUTSIDE A CATCH: a first call that did not throw would
        // otherwise pass untested (ledger T2).
        await expect(client.chatText(REQUEST,),).rejects.toThrow('connection reset before payload',);
        expect(await client.chatText(REQUEST,),).toEqual({ text: 'recovered payload', },);
        expect(providerCalls,).toBe(2,);
      },
    },),

    it({
      name: 'KEEPS IDENTITY CLAIMED after malformed completed payload throws',
      fn: async () => {
        /** Provider calls crossing wrapper. */
        let providerCalls = 0;
        const inner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            throw new MalformedCompletionError({
              detail: 'completed payload lacked choices',
            },);
          },
          chatJson: async () => {
            throw new Error('chatJson unused by malformed fixture',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        await expect(client.chatText(REQUEST,),).rejects.toThrow(MalformedCompletionError,);
        await expect(client.chatText(REQUEST,),).rejects.toThrow(MalformedCompletionError,);
        expect(providerCalls,).toBe(1,);
      },
    },),

    it({
      name: 'CANONICALIZES MESSAGE KEYS while preserving changed content',
      fn: async () => {
        /** Digest from role-first message construction. */
        const roleFirst = modelPromptDigest({
          request: {
            ...REQUEST,
            messages: [{ role: 'user', content: 'same content', },],
          },
        },);
        /** Digest from content-first message construction. */
        const contentFirst = modelPromptDigest({
          request: {
            ...REQUEST,
            messages: [{ content: 'same content', role: 'user', },],
          },
        },);
        /** Digest after substantive message change. */
        const changed = modelPromptDigest({
          request: {
            ...REQUEST,
            messages: [{ role: 'user', content: 'different content', },],
          },
        },);
        expect(contentFirst,).toBe(roleFirst,);
        expect(changed,).not.toBe(roleFirst,);
      },
    },),

    it({
      name: 'SHARES IN-FLIGHT PAYLOAD before second provider call',
      fn: async () => {
        /** Provider calls crossing wrapper. */
        let providerCalls = 0;
        const inner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            return { text: 'single payload', };
          },
          chatJson: async () => {
            throw new Error('chatJson unused by text fixture',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        const first = client.chatText(REQUEST,);
        const second = client.chatText(REQUEST,);
        expect(await second,).toEqual({ text: 'single payload', },);
        expect(await first,).toEqual({ text: 'single payload', },);
        expect(providerCalls,).toBe(1,);
      },
    },),

    it({
      name: 'RE-ASKS ANOTHER PROVIDER WITH A NUDGE when the reply could not be used (ledger P9, owner '
        + '2026-09-28 "Enable with the nudge"): the nudged prompt is a new digest routed away from the '
        + 'provider that served the first, and both exchanges stay claimed',
      fn: async () => {
        /** Every request that crossed the wrapper, in order. */
        const asked: ChatTextRequest[] = [];
        const inner: SyntheticClient = {
          chatText: async (request,) => {
            asked.push(request,);
            return (asked.length === 1)
              ? { text: 'not-json', servedBy: 'synthetic', }
              : { text: '"windowsill"', servedBy: 'hyper', };
          },
          chatJson: async () => {
            throw new Error('chatJson bypassed by prompt payload reader',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        const outcome = await client.chatJson({ ...REQUEST, validate: isStringAnswer, },);
        expect(outcome.kind,).toBe('ok',);
        expect(asked,).toHaveLength(2,);
        expect(asked[1]?.otherThan,).toBe('synthetic',);
        expect(asked[1]?.messages.slice(0, -1,),).toStrictEqual(REQUEST.messages,);

        // A WORDING OF ITS OWN, so either of the stage recovery round's nudged
        // prompts is still a new digest rather than a replay of this re-ask.
        expect(asked[1]?.messages.at(-1,),).not.toStrictEqual(OFF_SHAPE_RECOVERY_NUDGE,);
        expect(asked[1]?.messages.at(-1,),).not.toStrictEqual(CUT_SHORT_RECOVERY_NUDGE,);

        // Asked again, both answers come from the claims.
        const again = await client.chatJson({ ...REQUEST, validate: isStringAnswer, },);
        expect(again.kind,).toBe('ok',);
        expect(asked,).toHaveLength(2,);
      },
    },),

    it({
      name: 'KEEPS THE FIRST ANSWER when no other provider can take the re-ask, and releases the nudged '
        + 'prompt, so a later ask of the same question may still buy it',
      fn: async () => {
        /** Every request that crossed the wrapper, in order. */
        const asked: ChatTextRequest[] = [];
        const inner: SyntheticClient = {
          chatText: async (request,) => {
            asked.push(request,);
            if (asked.length === 2)
              throw new NoProviderForModelError({ modelId: request.modelId, reason: 'no other provider', },);
            return (asked.length === 1)
              ? { text: 'not-json', servedBy: 'synthetic', }
              : { text: '"windowsill"', servedBy: 'hyper', };
          },
          chatJson: async () => {
            throw new Error('chatJson bypassed by prompt payload reader',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt uniqueness fixture',);
          },
        };
        const client = promptUniqueClient({ inner, },);
        const first = await client.chatJson({ ...REQUEST, validate: isStringAnswer, },);
        expect(first.kind,).toBe('schema-mismatch',);
        expect(asked,).toHaveLength(2,);

        const later = await client.chatJson({ ...REQUEST, validate: isStringAnswer, },);
        expect(later.kind,).toBe('ok',);
        expect(asked,).toHaveLength(3,);
      },
    },),
  ],
},);
