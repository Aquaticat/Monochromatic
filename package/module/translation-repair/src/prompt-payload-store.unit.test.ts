/**
 * Tests durable prompt payload validation and cross-client replay.
 *
 * @module
 */

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatTextRequest,
  modelPromptDigest,
  promptPayloadStore,
  PromptPayloadStoreError,
  promptUniqueClient,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Disposable temporary directory fixture.
 */
type TemporaryDirectory = AsyncDisposable & {
  /**
   * Absolute fixture path.
   */
  readonly path: string;
};

/**
 * Creates disposable private prompt-store directory.
 *
 * @returns Fixture removed after test scope
 *
 * @example
 * ```ts
 * await using dir = await temporaryDirectory();
 * ```
 */
async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(
    tmpdir(),
    'prompt-payload-store-',
  ),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        { recursive: true, force: true, },
      );
    },
  };
}

/**
 * Exact request replayed across separate client instances.
 */
const REQUEST: ChatTextRequest = {
  modelId: 'hf:moonshotai/Kimi-K3',
  messages: [{ role: 'user', content: 'Read one cat sentence.', },],
  signal: AbortSignal.timeout(5_000,),
};

await describe({
  name: promptPayloadStore.name,
  children: [
    it({
      name: 'REPLAYS COMPLETED PAYLOAD across client instances without provider call',
      fn: async () => {
        await using dir = await temporaryDirectory();
        const store = promptPayloadStore({ dir: dir.path, },);
        /** Provider calls across both client instances. */
        let providerCalls = 0;
        const firstInner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            return {
              text: 'The cat slept.',
              finishReason: 'stop',
              usage: {
                prompt_tokens: 4,
                completion_tokens: 5,
              },
            };
          },
          chatJson: async () => {
            throw new Error('chatJson bypassed by prompt payload reader',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt payload fixture',);
          },
        };
        const first = promptUniqueClient({
          inner: firstInner,
          store,
        },);
        const initial = await first.chatText(REQUEST,);

        const resumedInner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            throw new Error('resumed client must not call provider',);
          },
          chatJson: async () => {
            throw new Error('chatJson bypassed by prompt payload reader',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt payload fixture',);
          },
        };
        const resumed = promptUniqueClient({
          inner: resumedInner,
          store,
        },);
        expect(await resumed.chatText(REQUEST,),).toEqual(initial,);
        expect(providerCalls,).toBe(1,);
      },
    },),

    it({
      name: 'REFUSES CORRUPTED DURABLE PAYLOAD rather than recalling provider',
      fn: async () => {
        await using dir = await temporaryDirectory();
        const promptDigest = modelPromptDigest({ request: REQUEST, },);
        await writeFile(
          join(
            dir.path,
            `${promptDigest}.json`,
          ),
          '{"version":1,"reply":{"text":7}}\n',
        );
        const store = promptPayloadStore({ dir: dir.path, },);
        let providerCalls = 0;
        const inner: SyntheticClient = {
          chatText: async () => {
            providerCalls += 1;
            return { text: 'must not run', };
          },
          chatJson: async () => {
            throw new Error('chatJson bypassed by prompt payload reader',);
          },
          quotas: async () => {
            throw new Error('quotas unused by prompt payload fixture',);
          },
        };
        const client = promptUniqueClient({ inner, store, },);
        let caught: unknown;
        try {
          await client.chatText(REQUEST,);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(PromptPayloadStoreError,);
        expect(providerCalls,).toBe(0,);
      },
    },),
  ],
},);
