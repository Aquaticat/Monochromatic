/**
 * Tests process-local model and substantive prompt uniqueness.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatTextRequest,
  MalformedCompletionError,
  modelPromptDigest,
  promptUniqueClient,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Exact prompt reused across boundary cases.
 */
const REQUEST: ChatTextRequest = {
  modelId: 'hf:moonshotai/Kimi-K3',
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
        try {
          await client.chatText(REQUEST,);
        }
        catch (error) {
          expect(error,).toBeInstanceOf(Error,);
        }
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
        try {
          await client.chatText(REQUEST,);
        }
        catch (error) {
          expect(error,).toBeInstanceOf(MalformedCompletionError,);
        }
        let repeated: unknown;
        try {
          await client.chatText(REQUEST,);
        }
        catch (error) {
          repeated = error;
        }
        expect(repeated,).toBeInstanceOf(MalformedCompletionError,);
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
  ],
},);
