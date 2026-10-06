/**
 Tests for the question the model health command asks one model, and for the
 lines it logs about the answer.

 THE PROBE EXISTS TO TELL TWO FAULTS APART: a model that answered badly and a
 model that could not be asked. This file pins the first half, the lines an
 answer of every kind leaves, and that a call which fails is not answered here
 but handed to the caller to report.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { askModelHealth, } from '../../dist/final/node/index.mjs';
import { capturingLoggerPair, } from '../capturing-logger.test-fixture.ts';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import {
  modelReplyScriptedClient,
  type ScriptedModelReply,
} from './model-reply-scripted-client.test-fixture.ts';

/**
 Model every case asks.
 */
const MODEL = 'hf:Qwen/Qwen3.8-27B' as const;

/**
 Timeout every case hands the probe, which it must pass on to the call.
 */
const TIMEOUT_MS = 4_321;

/**
 Units the raw reply opening is cut to.
 */
const PREVIEW_UNITS = 300;

/**
 Reply in the shape asked for.
 */
const HEALTHY: ScriptedModelReply = {
  kind: 'ok',
  text: '{"count":2,"first":"Mittens"}',
};

/**
 Asks the probe about the scripted model.

 @param reply - what the model is scripted to do

 @returns Lines logged and requests the client saw

 @example
 ```ts
 const { lines, requests, } = await askWith({ reply: HEALTHY, },);
 ```
 */
async function askWith(
  { reply, }: { readonly reply: ScriptedModelReply; },
): Promise<{
  readonly lines: readonly string[];
  readonly requests: ReturnType<typeof modelReplyScriptedClient>['requests'];
}> {
  const { client, requests, } = modelReplyScriptedClient({ replies: new Map([[MODEL, reply,],],), },);
  const { logger, lines, } = capturingLoggerPair();
  await askModelHealth({
    client,
    modelId: MODEL,
    timeoutMs: TIMEOUT_MS,
    l: logger,
  },);
  return {
    lines,
    requests,
  };
}

await describe({
  name: askModelHealth.name,
  children: [
    it({
      name: 'LOGS the outcome kind and the whole raw reply for an answer in the shape asked for',
      fn: async () => {
        const { lines, } = await askWith({ reply: HEALTHY, },);

        expect(lines,).toEqual([
          `${MODEL}: ok`,
          `${MODEL}: raw reply opening (at most 300 UTF-16 units): "{\\"count\\":2,\\"first\\":\\"Mittens\\"}"`,
        ],);
      },
    },),
    it({
      name: 'ASKS the model it was given the cat question, in the schema and with the timeout it was handed',
      fn: async () => {
        const { requests, } = await askWith({ reply: HEALTHY, },);

        expect(requests.length,).toBe(1,);
        expect(requests[0]?.modelId,).toBe(MODEL,);
        expect(requests[0]?.exchangeTimeoutMs,).toBe(TIMEOUT_MS,);
        expect(requests[0]?.messages,).toEqual([
          {
            role: 'user',
            content: 'Reply with JSON matching the schema: how many cats are named in this sentence, '
              + 'and what is the first one called? "Mittens and Tabby sat on the windowsill."',
          },
        ],);
        expect(requests[0]?.responseFormat,).toEqual({
          type: 'json_schema',
          json_schema: {
            name: 'cat_count',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: [
                'count',
                'first',
              ],
              properties: {
                count: { type: 'number', },
                first: { type: 'string', },
              },
            },
          },
        },);
      },
    },),
    it({
      name: 'ADMITS a reply carrying both fields whatever their values, and refuses one missing a field or not a record',
      fn: async () => {
        const { requests, } = await askWith({ reply: HEALTHY, },);
        const validate = requests[0]?.validate;

        expect(validate?.({
          count: 2,
          first: 'Mittens',
        },),).toBe(true,);
        expect(validate?.({
          count: 'two',
          first: 7,
        },),).toBe(true,);
        expect(validate?.({ count: 2, },),).toBe(false,);
        expect(validate?.({ first: 'Mittens', },),).toBe(false,);
        expect(validate?.(['count', 'first',],),).toBe(false,);
        expect(validate?.(null,),).toBe(false,);
        expect(validate?.('Mittens',),).toBe(false,);
      },
    },),
    it({
      name: 'LOGS the detail beside the kind of a reply the client found unreadable, then its raw opening',
      fn: async () => {
        const { lines, } = await askWith({
          reply: {
            kind: 'schema-mismatch',
            rawText: 'Here you go: {"count":2}',
            detail: 'reply is not JSON',
          },
        },);

        expect(lines,).toEqual([
          `${MODEL}: schema-mismatch -- reply is not JSON`,
          `${MODEL}: raw reply opening (at most 300 UTF-16 units): "Here you go: {\\"count\\":2}"`,
        ],);
      },
    },),
    it({
      name: 'LOGS the kind alone, with no detail, and the raw opening for a reply that reads as a refusal',
      fn: async () => {
        const { lines, } = await askWith({
          reply: {
            kind: 'refusal-shaped',
            rawText: 'The cat declines.',
          },
        },);

        expect(lines,).toEqual([
          `${MODEL}: refusal-shaped`,
          `${MODEL}: raw reply opening (at most 300 UTF-16 units): "The cat declines."`,
        ],);
      },
    },),
    it({
      name: 'CUTS a raw reply longer than the preview to its first 300 units',
      fn: async () => {
        const { lines, } = await askWith({
          reply: {
            kind: 'schema-mismatch',
            rawText: `${'a'.repeat(PREVIEW_UNITS,)}${'b'.repeat(PREVIEW_UNITS,)}`,
            detail: 'reply is not JSON',
          },
        },);

        expect(lines[1],).toBe(
          `${MODEL}: raw reply opening (at most 300 UTF-16 units): "${'a'.repeat(PREVIEW_UNITS,)}"`,
        );
      },
    },),
    it({
      name: 'LEAVES a raw reply of exactly 300 units whole',
      fn: async () => {
        const { lines, } = await askWith({
          reply: {
            kind: 'schema-mismatch',
            rawText: 'a'.repeat(PREVIEW_UNITS,),
            detail: 'reply is not JSON',
          },
        },);

        expect(lines[1],).toBe(
          `${MODEL}: raw reply opening (at most 300 UTF-16 units): "${'a'.repeat(PREVIEW_UNITS,)}"`,
        );
      },
    },),
    it({
      name: 'CUTS before a cat emoji whose two halves the 300-unit limit would separate',
      fn: async () => {
        const { lines, } = await askWith({
          reply: {
            kind: 'schema-mismatch',
            rawText: `${'a'.repeat(PREVIEW_UNITS - 1,)}\u{1F431}tail`,
            detail: 'reply is not JSON',
          },
        },);

        expect(lines[1],).toBe(
          `${MODEL}: raw reply opening (at most 300 UTF-16 units): "${'a'.repeat(PREVIEW_UNITS - 1,)}"`,
        );
      },
    },),
    it({
      name: 'REJECTS with the very value the call threw and logs nothing, leaving the report to the caller',
      fn: async () => {
        const failure = new TypeError('the cat flap is shut',);
        const { client, } = modelReplyScriptedClient({
          replies: new Map([[
            MODEL,
            {
              kind: 'throws',
              error: failure,
            },
          ],],),
        },);
        const { logger, lines, } = capturingLoggerPair();

        const refusal = await rejectionOf(async function askThrowingModel(): Promise<void> {
          await askModelHealth({
            client,
            modelId: MODEL,
            timeoutMs: TIMEOUT_MS,
            l: logger,
          },);
        },);

        expect(refusal,).toBe(failure,);
        expect(lines,).toEqual([],);
      },
    },),
  ],
},);
