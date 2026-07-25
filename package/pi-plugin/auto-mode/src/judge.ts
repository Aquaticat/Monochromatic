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
  runStructuredReviewAttempt,
  type StructuredReviewStream,
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
 * @param streamSimpleFn - injected provider stream for tests
 *
 * @returns auto-mode verdict
 *
 * @mutates model - shared provider transport may inspect or retain model data
 *
 * @mutates auth - shared provider transport may inspect resolved auth headers
 *
 * @mutates streamSimpleFn - injected provider capability may change captured state
 *
 * @example
 * ```ts
 * const verdict = await callJudge({ model, auth, action, actionInput: '{"path":"src/index.ts"}', cwd, recentContext, trustDirectives: [], timeoutMs: 10_000, systemPrompt, batchContext: [] });
 * ```
 */
function callJudge(
  {
    model,
    auth,
    action,
    actionInput = '',
    cwd,
    recentContext,
    trustDirectives,
    timeoutMs,
    systemPrompt,
    batchContext,
    streamSimpleFn,
  }: {
    readonly model: ForeignBorrowed<Model<Api>>;
    readonly auth: ForeignBorrowed<BudgetModelAuth>;
    readonly action: string;
    readonly actionInput?: string;
    readonly cwd: string;
    readonly recentContext: string;
    readonly trustDirectives: readonly string[];
    readonly timeoutMs: number;
    readonly systemPrompt: string;
    readonly batchContext: readonly BatchEntry[];
    readonly streamSimpleFn?: ForeignBorrowed<StructuredReviewStream>;
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
  return runStructuredReviewAttempt({
    model,
    auth,
    prompt: {
      systemPrompt,
      userContent,
    },
    contract: {
      toolName: VERDICT_TOOL.name,
      tool: VERDICT_TOOL,
      parse: parseVerdict,
      buildJsonRetryPrompt({
        initialPrompt,
        firstAttemptTextContent,
      },) {
        return {
          systemPrompt: buildJsonRetrySystemPrompt({
            systemPrompt: initialPrompt.systemPrompt,
          },),
          userContent: buildJsonRetryUserContent({
            userContent: initialPrompt.userContent,
            firstAttemptTextContent,
          },),
        };
      },
    },
    timeoutMs,
    ...(streamSimpleFn === undefined ? {} : { stream: streamSimpleFn, }),
  },);
}

export { callJudge, };
export {
  extractJsonVerdict,
  parseVerdict,
} from './judge-json.ts';
