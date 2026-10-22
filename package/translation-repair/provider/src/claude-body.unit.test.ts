/**
 Tests for the body the Claude client puts on the wire (`claude-body.ts`), read off the exchange a recorded transport
 saw. The rules come from the owner's brief of 2026-10-22 and the probes it cites: Sonnet 5.5 answers
 `output_config.format` with adaptive thinking and refuses a forced tool with HTTP 400, Haiku 5.5 under a forced tool
 returned no thinking and the wrong answer on every hard call, thinking can be neither disabled nor given a budget on
 either model, sampling knobs and an assistant prefill are refused with 400.

 NOTHING HERE REACHES A PROVIDER: every transport is an in-memory script, and every key is invented. Fixtures are
 cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ANTHROPIC_SERVED_IDS,
  type RosterModelId,
} from '@monochromatic-dev/translation-repair-shared-contract';
import { createClaudeClient, } from '../dist/final/node/index.mjs';
import {
  firstBodyOf,
  NAP_SCHEMA,
  ONE_QUICK_RETRY,
  scripted,
  SIGNAL,
} from './direct-client.test-fixture.ts';
import {
  CLAUDE_CAT_KEY,
  claudeStreamOf,
  PLAIN_USAGE,
} from './claude-client.test-fixture.ts';

/**
 Asks one question of one Claude card over a recorded transport and hands back the body it sent.

 @param modelId - roster card addressed

 @param messages - conversation to send

 @param withSchema - whether the call states the nap schema

 @param extra - loose members the request carries beyond its declared ones, as a caller might add

 @returns The first exchange's body, parsed

 @example
 ```ts
 const body = await bodySentFor({ modelId: 'claude-haiku-5-5', withSchema: true, },);
 ```
 */
async function bodySentFor(
  {
    modelId,
    messages = [
      { role: 'system', content: 'You find the cat.', },
      { role: 'user', content: 'Where does the cat sleep?', },
    ],
    withSchema = false,
    extra = {},
  }: {
    readonly modelId: RosterModelId;
    readonly messages?: Parameters<ReturnType<typeof createClaudeClient>['chatText']>[0]['messages'];
    readonly withSchema?: boolean;
    readonly extra?: Readonly<Record<string, unknown>>;
  },
): Promise<Record<string, unknown>> {
  const { transport, exchanges, } = scripted({
    replies: [{
      status: 200,
      bodyText: claudeStreamOf({ text: '{"spot":"sunbeam"}', stopReason: 'end_turn', usage: PLAIN_USAGE, }),
    },],
  },);
  await createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },)
    .chatText({
      modelId,
      messages,
      signal: SIGNAL,
      ...(withSchema ? { responseFormat: NAP_SCHEMA, } : {}),
      ...extra,
    },);
  return firstBodyOf({ exchanges, },);
}

await describe({
  name: 'the Claude body',
  concurrency: 1,
  children: [
    it({
      name: 'ASKS FOR STRUCTURED OUTPUT BY output_config.format AND NEVER BY A FORCED TOOL, on all eight cards: Sonnet '
        + '5.5 refuses a forced tool with HTTP 400 and Haiku 5.5 under one answered 6 of 6 hard questions wrong with no '
        + 'thinking',
      fn: async () => {
        for (const modelId of ANTHROPIC_SERVED_IDS) {
          const body = await bodySentFor({ modelId, withSchema: true, },);
          expect(body['tools'],).toBeUndefined();
          expect(body['tool_choice'],).toBeUndefined();
          expect(body['output_config'],).toMatchObject({
            format: { type: 'json_schema', schema: NAP_SCHEMA.json_schema.schema, },
          },);
        }
      },
    },),

    it({
      name: 'ASKS FOR NO FORMAT on a free-text call, and offers no tool then either',
      fn: async () => {
        const body = await bodySentFor({ modelId: 'claude-haiku-5-5', },);
        expect(JSON.stringify(body,),).not.toContain('json_schema',);
        expect(body['tools'],).toBeUndefined();
        expect(body['tool_choice'],).toBeUndefined();
      },
    },),
  ],
},);
