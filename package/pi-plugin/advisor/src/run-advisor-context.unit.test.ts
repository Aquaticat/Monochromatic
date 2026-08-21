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

/**
 * Capture rejection from async test action.
 *
 * @param action - async operation expected to reject
 *
 * @returns caught rejection value
 *
 * @example
 * ```typescript
 * const error = await captureAsyncError(async function fail() { throw new Error('x'); });
 * ```
 */
async function captureAsyncError(
  action: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await action();
  }
  catch (error) {
    return error;
  }
  throw new Error('expected async action to throw',);
}

//endregion Fixtures

await describe({
  name: runAdvisor.name,
  children: [
    it({
      name: 'refuses insufficient endpoint capacity before provider dispatch',
      fn: async function testOutputCapacityBeforeProviderDispatch() {
        /** Faux provider whose endpoint advertises less than configured requirement. */
        const providerFixture = fauxProvider({
          api: 'faux',
          provider: 'limited-provider',
          models: [{
            id: 'limited-reviewer',
            reasoning: false,
            maxTokens: advisorConfig.maxAdvisorOutputTokens - 1,
          },],
        },);
        providerFixture.setResponses([
          fauxAssistantMessage('unexpected advisor answer',),
        ],);
        /** Extension context whose only scoped model lacks required output capacity. */
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
              return [];
            },
          },
        } as unknown as ExtensionContext;
        /** Eligibility error returned before provider invocation. */
        const caught = await captureAsyncError(
          async function runIneligibleAdvisor() {
            return await runAdvisor({
              ctx,
              config: advisorConfig,
            },);
          },
        );

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          `no scoped models advertise at least ${String(advisorConfig.maxAdvisorOutputTokens,)} output tokens`,
        );
        expect(providerFixture.state.callCount,).toBe(0,);
      },
    },),
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
