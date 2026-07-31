/**
 * Run-level context-boundary tests for Advisor.
 *
 * @module
 */

import {
  fauxAssistantMessage,
  fauxProvider,
  type Context,
} from '@earendil-works/pi-ai';
import type {
  ExtensionContext,
  SessionEntry,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AdvisorConfig,
  DEFAULT_CONFIG,
  runAdvisor,
} from '../dist/final/node/index.mjs';

//region Fixtures

/** Retained user message passed through compaction-aware context. */
const retainedEntry: SessionEntry = {
  type: 'message',
  id: 'retained-entry',
  parentId: null,
  timestamp: '2026-07-31T00:00:00.000Z',
  message: {
    role: 'user',
    content: 'retained task evidence',
    timestamp: 0,
  },
};

/** Stale user message exposed only by full branch fixture. */
const staleEntry: SessionEntry = {
  type: 'message',
  id: 'stale-entry',
  parentId: null,
  timestamp: '2026-07-30T00:00:00.000Z',
  message: {
    role: 'user',
    content: 'stale pre-compaction evidence',
    timestamp: 0,
  },
};

/** Advisor config fixture. */
const advisorConfig: AdvisorConfig = {
  ...DEFAULT_CONFIG,
  timeoutMs: 1_000,
  maxAdvisorOutputTokens: 100,
  source: {
    globalPath: '/home/test/.pi/agent/extensions/pi-advisor.json',
    projectPath: '/repo/.pi/extensions/pi-advisor.json',
    globalLoaded: false,
    projectLoaded: false,
  },
};

/**
 * Extract text from provider user message.
 *
 * @param context - captured provider context
 *
 * @returns joined user text blocks
 */
function providerUserText(context: Readonly<Context>,): string {
  /** First provider message containing serialized Advisor request. */
  const [message,] = context.messages;
  if ((message === undefined) || (message.role !== 'user'))
    throw new Error('provider user message missing',);
  if (!Array.isArray(message.content,))
    return message.content;
  return message.content
    .filter(function keepText(block,) {
      return block.type === 'text';
    },)
    .map(function textFromBlock(block,) {
      return block.type === 'text' ? block.text : '';
    },)
    .join('\n',);
}

//endregion Fixtures

await describe({
  name: runAdvisor.name,
  children: [
    it({
      name: 'uses compaction-aware session entries instead of full branch',
      fn: async function testCompactionAwareBoundary() {
        /** Faux provider and selected model. */
        const providerFixture = fauxProvider({
          api: 'faux',
          provider: 'faux-provider',
          models: [{
            id: 'reviewer',
            reasoning: false,
          },],
        },);
        /** Provider contexts captured by response callback. */
        const providerContexts: Context[] = [];
        providerFixture.setResponses([
          function providerResponse(context,) {
            providerContexts.push(context,);
            return fauxAssistantMessage('advisor answer',);
          },
        ],);
        /** Compaction-aware context method calls. */
        const contextCalls: string[] = [];
        /** Full-branch method calls, which must remain empty. */
        const branchCalls: string[] = [];
        /** Extension context exposing both session methods. */
        const ctx = {
          cwd: '/repo',
          scopedModels: [providerFixture.getModel(),],
          modelRegistry: {
            async getApiKeyAndHeaders() {
              return {
                ok: true,
                apiKey: 'test-key',
              };
            },
            getProvider() {
              return providerFixture.provider;
            },
          },
          sessionManager: {
            buildContextEntries() {
              contextCalls.push('buildContextEntries',);
              return [retainedEntry,];
            },
            getBranch() {
              branchCalls.push('getBranch',);
              return [staleEntry, retainedEntry,];
            },
          },
        } as unknown as ExtensionContext;

        await runAdvisor({
          ctx,
          config: advisorConfig,
        },);

        expect(contextCalls,).toEqual(['buildContextEntries',],);
        expect(branchCalls,).toEqual([],);
        const [providerContext,] = providerContexts;
        if (providerContext === undefined)
          throw new Error('provider context not captured',);
        const requestText = providerUserText(providerContext,);
        expect(requestText,).toContain('retained task evidence',);
        expect(requestText,).not.toContain('stale pre-compaction evidence',);
      },
    },),
  ],
},);
