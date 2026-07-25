/**
 * Characterization tests for auto-mode adapter over shared model review.
 *
 * @module
 */

import type {
  Api,
  AssistantMessageEvent,
  Model,
} from '@earendil-works/pi-ai';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ScriptedStructuredReviewTransport, } from '@monochromatic-dev/pi-shared-model-review/ts';

import {
  toolChoiceForApi,
  VERDICT_TOOL,
} from './judge-tool.ts';
import {
  callJudge,
  extractJsonVerdict,
  parseVerdict,
} from './judge.ts';

/** Fixture context window. */
const CONTEXT_WINDOW = 128_000;

/** Fixture model output cap. */
const MAX_TOKENS = 4_096;

/** Complete adapter-test timeout. */
const JUDGE_TIMEOUT_MS = 10_000;

/** JSON tool input carrying file content that must reach judge provider context unchanged. */
const WRITE_ACTION_INPUT_FIXTURE = `{"path":"/project/src/example.ts","content":"export const judgeCanInspectThisBody = true;\\n"}`;

/** Provider API cases proving auto-mode wrapper preserves shared tool choice. */
const TOOL_CHOICE_CASES: readonly {
  readonly api: string;
  readonly expected: unknown;
}[] = [
  { api: 'anthropic-messages', expected: { type: 'tool', name: 'render_verdict', }, },
  { api: 'openai-completions', expected: 'required', },
  { api: 'openai-responses', expected: 'required', },
  { api: 'azure-openai-responses', expected: 'required', },
  { api: 'openai-codex-responses', expected: 'required', },
  { api: 'google-generative-ai', expected: 'any', },
  { api: 'google-vertex', expected: 'any', },
  { api: 'mistral-conversations', expected: 'any', },
  { api: 'bedrock-converse-stream', expected: 'any', },
  { api: 'custom-api', expected: 'any', },
];

/** Fixture model consumed by deterministic script only. */
const MODEL = {
  id: 'test-model',
  name: 'Test model',
  api: 'openai-completions',
  provider: 'openai',
  baseUrl: 'https://example.invalid',
  reasoning: false,
  input: ['text',],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: CONTEXT_WINDOW,
  maxTokens: MAX_TOKENS,
} satisfies Model<Api>;

/**
 * Build async event stream from fixed events.
 *
 * @param entries - ordered provider events
 *
 * @returns async reviewer stream
 *
 * @example
 * ```ts
 * events([]);
 * ```
 */
async function* events(
  entries: readonly AssistantMessageEvent[],
): AsyncIterable<AssistantMessageEvent> {
  for (const entry of entries)
    yield entry;
}

/**
 * Build valid render-verdict stream.
 *
 * @param verdict - fixture verdict value
 *
 * @returns one-event reviewer stream
 *
 * @example
 * ```ts
 * verdictStream('approve');
 * ```
 */
function verdictStream(
  verdict: 'approve' | 'deny' | 'ask',
): AsyncIterable<AssistantMessageEvent> {
  return events([{
    type: 'toolcall_end',
    contentIndex: 0,
    toolCall: {
      type: 'toolCall',
      id: 'verdict-1',
      name: 'render_verdict',
      arguments: {
        verdict,
        reason: verdict === 'approve' ? 'safe' : 'needs user',
        guidance: '',
      },
    },
    partial: {} as never,
  },],);
}

/**
 * Build finalized text stream.
 *
 * @param content - final provider text
 *
 * @returns one-event reviewer stream
 *
 * @example
 * ```ts
 * textStream('{}');
 * ```
 */
function textStream(content: string,): AsyncIterable<AssistantMessageEvent> {
  return events([{
    type: 'text_end',
    contentIndex: 0,
    content,
    partial: {} as never,
  },],);
}

/**
 * Build deterministic data transport.
 *
 * @param responses - ordered response streams
 *
 * @returns mutable script state
 *
 * @example
 * ```ts
 * scriptedTransport([verdictStream('approve')]);
 * ```
 */
function scriptedTransport(
  responses: readonly AsyncIterable<AssistantMessageEvent>[],
): ScriptedStructuredReviewTransport {
  return {
    nextResponseIndex: 0,
    responses,
    requests: [],
  };
}

await describe({
  name: toolChoiceForApi.name,
  children: TOOL_CHOICE_CASES.map(function toolChoiceCase(
    { api, expected, },
  ) {
    return it({
      name: `projects ${api}`,
      fn: async () => {
        expect(toolChoiceForApi(api,),).toEqual(expected,);
      },
    },);
  },),
},);

await describe({
  name: 'VERDICT_TOOL',
  children: [
    it({
      name: 'retains render_verdict contract',
      fn: async () => {
        expect(VERDICT_TOOL.name,).toBe('render_verdict',);
        expect(VERDICT_TOOL.description.length,).toBeGreaterThan(0,);
        expect(VERDICT_TOOL.parameters,).toBeDefined();
      },
    },),
  ],
},);

await describe({
  name: extractJsonVerdict.name,
  children: [
    it({
      name: 'parses whole and balanced JSON with quoted braces',
      fn: async () => {
        /** Whole-output JSON parse. */
        const whole = extractJsonVerdict('{"verdict":"approve","reason":"safe"}',);
        /** Balanced-object JSON parse. */
        const embedded = extractJsonVerdict(
          'prefix {"verdict":"deny","reason":"contains } literal","guidance":"{escape}"} suffix',
        );
        expect(whole.verdict,).toBe('approve',);
        expect(embedded.reason,).toBe('contains } literal',);
        expect(embedded.guidance,).toBe('{escape}',);
      },
    },),
    it({
      name: 'rejects output without JSON',
      fn: async () => {
        expect(() => extractJsonVerdict('no json here',),).toThrow();
      },
    },),
  ],
},);

await describe({
  name: parseVerdict.name,
  children: [
    it({
      name: 'retains valid, missing, and unknown verdict behavior',
      fn: async () => {
        expect(parseVerdict({
          verdict: 'deny',
          reason: 'dangerous',
          guidance: 'use dry run',
        },),).toEqual({
          verdict: 'deny',
          reason: 'dangerous',
          guidance: 'use dry run',
        },);
        expect(parseVerdict({},),).toEqual({ verdict: 'ask', reason: '', guidance: '', },);
        expect(parseVerdict({ verdict: 'permit', reason: 'n/a', guidance: '', },).reason,).toContain('permit',);
      },
    },),
  ],
},);

await describe({
  name: callJudge.name,
  children: [
    it({
      name: 'preserves forced-tool verdict path',
      fn: async () => {
        /** Deterministic forced-tool transport. */
        const transport = scriptedTransport([verdictStream('approve',),],);
        /** Adapter verdict from forced-tool transport. */
        const verdict = await callJudge({
          model: MODEL,
          auth: { apiKey: 'test-key', },
          action: 'bash: echo hi',
          actionInput: '{"command":"echo hi"}',
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: JUDGE_TIMEOUT_MS,
          systemPrompt: 'Use render_verdict.',
          batchContext: [],
          testTransport: transport,
        },);
        expect(verdict,).toEqual({ verdict: 'approve', reason: 'safe', guidance: '', },);
      },
    },),
    it({
      name: 'includes complete write input in final provider request context',
      fn: async () => {
        /** Deterministic provider seam capturing isolated request snapshot. */
        const transport = scriptedTransport([verdictStream('approve',),],);
        await callJudge({
          model: MODEL,
          auth: { apiKey: 'test-key', },
          action: 'write /project/src/example.ts',
          actionInput: WRITE_ACTION_INPUT_FIXTURE,
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: JUDGE_TIMEOUT_MS,
          systemPrompt: 'Use render_verdict.',
          batchContext: [],
          testTransport: transport,
        },);
        /** Final reviewer request snapshot captured immediately before dispatch. */
        const [request,] = transport.requests;
        if (request === undefined)
          throw new Error('Expected reviewer provider request snapshot.',);
        /** Exact user message sent to reviewer provider. */
        const [message,] = request.context.messages;
        if (message === undefined)
          throw new Error('Expected reviewer user message.',);
        expect(message.content,).toContain(WRITE_ACTION_INPUT_FIXTURE,);
      },
    },),
    it({
      name: 'preserves omitted-tool direct-JSON retry prompts and options',
      fn: async () => {
        /** Omitted-tool then direct-JSON provider script. */
        const transport = scriptedTransport([
          textStream('I did not use the tool.',),
          textStream('{"verdict":"ask","reason":"needs user","guidance":""}',),
        ],);
        /** Adapter verdict from direct-JSON retry transport. */
        const verdict = await callJudge({
          model: MODEL,
          auth: {
            apiKey: 'test-key',
            headers: { 'x-test': 'yes', },
          },
          action: 'bash: echo hi',
          actionInput: '{"command":"echo hi"}',
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: JUDGE_TIMEOUT_MS,
          systemPrompt: 'You MUST call the render_verdict tool to submit your evaluation. Do not respond with text; use the tool.',
          batchContext: [],
          testTransport: transport,
        },);
        expect(verdict.verdict,).toBe('ask',);
        expect(transport.requests,).toHaveLength(2,);
        /** Forced-tool and direct-JSON retry request snapshots. */
        const [first, retry,] = transport.requests;
        if ((first === undefined) || (retry === undefined))
          throw new Error('Expected forced and retry request snapshots.',);
        expect(first.context.toolNames,).toEqual(['render_verdict',],);
        expect(first.options.toolChoiceType,).toBe('required',);
        expect(first.options.apiKey,).toBe('test-key',);
        expect(retry.context.toolNames,).toEqual([],);
        expect(retry.options.toolChoiceType,).toBeUndefined();
        expect(retry.context.systemPrompt,).toContain('Retry mode:',);
        expect(retry.context.systemPrompt,).not.toContain('Do not respond with text; use the tool.',);
      },
    },),
  ],
},);
