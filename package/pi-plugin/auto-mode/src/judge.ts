/**
 * Auto-mode structured judge adapter over shared model-review infrastructure.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  runStructuredJsonRetries,
  runStructuredToolRequest,
  type ScriptedStructuredReviewTransport,
  structuredReviewSignal,
} from '@monochromatic-dev/pi-shared-model-review/ts';

import {
  buildJsonRetrySystemPrompt,
  buildJsonRetryUserContent,
  buildUserContent,
} from './judge-messages.ts';
import { parseVerdict, } from './judge-json.ts';
import { VERDICT_TOOL, } from './judge-tool.ts';
import type {
  BatchEntry,
  BudgetModelAuth,
  Verdict,
} from './types.ts';

/**
 * Logger root for auto-mode judge adapter.
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for judge adapter.
 */
const l = tagged({
  tag: 'judge',
  l: parentLogger,
},);

/**
 * Call selected judge through shared forced-tool and direct-JSON transport.
 *
 * @param model - selected judge model
 *
 * @param auth - resolved judge credentials
 *
 * @param action - human-readable action under review
 *
 * @param actionInput - complete current tool input encoded as JSON
 *
 * @param cwd - agent working directory
 *
 * @param recentContext - recent session activity
 *
 * @param trustDirectives - active approved trust directives
 *
 * @param timeoutMs - complete judge-attempt timeout
 *
 * @param systemPrompt - auto-mode safety rubric
 *
 * @param batchContext - sibling actions evaluated in current turn
 *
 * @param testTransport - optional data-only deterministic provider seam
 *
 * @returns auto-mode verdict
 *
 * @mutates model - shared provider transport may inspect or retain model data
 *
 * @mutates auth - shared provider transport may inspect resolved auth headers
 *
 * @mutates testTransport - deterministic seam advances script and records request snapshots
 *
 * @example
 * ```ts
 * const verdict = await callJudge({ model, auth, action, actionInput: '{"path":"src/index.ts"}', cwd, recentContext, trustDirectives: [], timeoutMs: 10_000, systemPrompt, batchContext: [] });
 * ```
 */
async function callJudge(
  {
    model,
    auth,
    action,
    actionInput,
    cwd,
    recentContext,
    trustDirectives,
    timeoutMs,
    systemPrompt,
    batchContext,
    testTransport,
  }: {
    readonly model: ForeignBorrowed<Model<Api>>;
    readonly auth: ForeignBorrowed<BudgetModelAuth>;
    readonly action: string;
    readonly actionInput: string;
    readonly cwd: string;
    readonly recentContext: string;
    readonly trustDirectives: readonly string[];
    readonly timeoutMs: number;
    readonly systemPrompt: string;
    readonly batchContext: readonly BatchEntry[];
    readonly testTransport?: ForeignBorrowed<ScriptedStructuredReviewTransport>;
  },
): Promise<Verdict> {
  /**
   * Per-call logger carrying selected model identity.
   */
  const innerL = tagged({
    tag: callJudge.name,
    l,
  },);
  innerL.debug(`calling ${model.provider}/${model.id} for action length ${action.length}`,);
  /**
   * Auto-mode reviewer user message.
   */
  const userContent = buildUserContent({
    action,
    actionInput,
    cwd,
    recentContext,
    trustDirectives,
    batchContext,
  },);
  /**
   * Cancellation deadline shared by initial request and every JSON retry.
   */
  const signal = structuredReviewSignal({ timeoutMs, },);
  /** Initial forced-tool provider response. */
  const initial = await runStructuredToolRequest({
    model,
    auth,
    prompt: {
      systemPrompt,
      userContent,
    },
    signal,
    toolName: VERDICT_TOOL.name,
    tool: VERDICT_TOOL,
    ...(testTransport === undefined ? {} : { testTransport, }),
  },);
  if (initial.kind === 'toolCall')
    return parseVerdict(initial.arguments,);
  /** Caller-specific direct-JSON retry prompt. */
  const retryPrompt = {
    systemPrompt: buildJsonRetrySystemPrompt({ systemPrompt, },),
    userContent: buildJsonRetryUserContent({
      userContent,
      firstAttemptTextContent: initial.textContent,
    },),
  };
  /** Unknown retry value retained only until strict verdict parsing. */
  const value = await runStructuredJsonRetries({
    model,
    auth,
    prompt: retryPrompt,
    signal,
    expectedToolName: VERDICT_TOOL.name,
    ...(testTransport === undefined ? {} : { testTransport, }),
  },);
  return parseVerdict(value,);
}

export { callJudge, };
export {
  extractJsonVerdict,
  parseVerdict,
} from './judge-json.ts';
