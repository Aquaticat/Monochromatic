/**
 * Evaluate pipeline: judge call, verdict handling, user interaction.
 *
 * Sits between the flagger (`signals.ts`/`tool-helpers.ts`) and the
 * UI (`ask-user.ts`). Resolves a budget judge model, calls the judge,
 * and translates the structured verdict into either an allow, a
 * block, or a user prompt. Records each verdict as a session entry
 * and updates the auto-mode widget.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import {
  askUser,
  updateWidget,
} from './ask-user.ts';
import {
  buildContext,
  getTrustDirectives,
} from './context.ts';
import { callJudge, } from './judge.ts';
import { l as parentLogger, } from './log.ts';
import type { MergedConfig, } from './signals.ts';
import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';
import {
  type BatchEntry,
  type BudgetModel,
  type BudgetModelOptions,
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

/** Tagged logger for the evaluate module. */
const l = tagged({
  tag: 'evaluate',
  l: parentLogger,
},);

/**
 * Evaluate a flagged action through the judge pipeline.
 *
 * Resolves a judge model, calls the judge, and processes
 * the verdict. On approve, returns `undefined` (allow).
 * On deny, returns a block result with guidance.
 * On ask, prompts the user.
 *
 * @param pi - the extension API
 *
 * @param ctx - the extension context
 *
 * @param config - the merged runtime config
 *
 * @param systemPrompt - the judge system prompt
 *
 * @param action - description of the action being evaluated
 *
 * @param batchContext - other tool calls in the same batch
 *
 * @param flowVerdicts - accumulated verdicts for the widget
 *
 * @returns a block result, or `undefined` to allow
 *
 * @example
 * ```typescript
 * const result = await evaluate(pi, ctx, config, prompt, "bash: sudo rm -rf /", undefined, verdicts);
 * ```
 */
async function evaluate(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: MergedConfig,
  systemPrompt: string,
  action: string,
  batchContext: BatchEntry[] | undefined,
  flowVerdicts: {
    action: string;
    verdict: string;
    reason: string;
  }[],
): Promise<{
  block: true;
  reason: string;
} | undefined> {
  /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
  const innerL = tagged({
    tag: evaluate.name,
    l,
  },);
  innerL.debug(`evaluating action: ${action}`,);

  /**
   * Resolved judge model handed to {@link callJudge}.
   *
   * Declared with `let` so the catch branch can leave it undefined and the
   * downstream `if (judge === undefined)` falls through to manual approval.
   */
  let judge: BudgetModel | undefined = undefined;
  try {
    judge = await resolveJudgeModel(
      ctx,
      config,
    );
  }
  catch (err) {
    innerL.error(
      `judge model resolution failed: ${
        err instanceof Error ? err.message : String(err,)
      }`,
    );
    return askUser(
      pi,
      ctx,
      action,
      'No judge model available; manual approval required.',
    );
  }

  if (judge === undefined) {
    return askUser(
      pi,
      ctx,
      action,
      'No judge model available; manual approval required.',
    );
  }

  /** Recent session activity rendered as a string for the judge prompt. */
  const recentContext = buildContext(ctx,);
  /** Active trust directives for this session, listed in the prompt as guardrail relaxations. */
  const trustDirectives = getTrustDirectives(ctx,);

  try {
    /** Structured verdict from the judge: `approve`/`deny`/`ask` plus rationale and guidance. */
    const verdict = await callJudge(
      judge.model,
      judge.auth,
      action,
      ctx.cwd,
      recentContext,
      trustDirectives,
      config.judgeTimeoutMs,
      systemPrompt,
      batchContext,
    );

    if (verdict.verdict === 'approve') {
      innerL.info(`approve: ${verdict.reason}`,);
      flowVerdicts.push({
        action,
        verdict: 'approved',
        reason: verdict.reason,
      },);
      updateWidget(
        ctx,
        flowVerdicts,
      );
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          verdict: 'approve',
          reason: verdict.reason,
        } satisfies VerdictData,
      );
      return undefined;
    }

    if (verdict.verdict === 'deny') {
      innerL.warn(`deny: ${verdict.reason}`,);
      flowVerdicts.push({
        action,
        verdict: 'denied',
        reason: verdict.reason,
      },);
      updateWidget(
        ctx,
        flowVerdicts,
      );
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          verdict: 'deny',
          reason: verdict.reason,
        } satisfies VerdictData,
      );
      return {
        block: true,
        reason: verdict.guidance !== '' ? verdict.guidance : DEFAULT_DENY_GUIDANCE,
      };
    }

    innerL.info(`ask: ${verdict.reason}`,);
    return askUser(
      pi,
      ctx,
      action,
      verdict.reason,
    );
  }
  catch (err) {
    /** Normalised error message so both `Error` instances and non-`Error` throws produce a string. */
    const msg = err instanceof Error ? err.message : String(err,);
    innerL.error(`judge error: ${msg}`,);
    return askUser(
      pi,
      ctx,
      action,
      `Judge error: ${msg}`,
    );
  }
}

/**
 * Resolve a judge model from the budget model options.
 *
 * @param ctx - extension context
 *
 * @param config - the merged runtime config
 *
 * @returns a budget model with auth credentials
 */
async function resolveJudgeModel(
  ctx: ExtensionContext,
  config: MergedConfig,
): Promise<BudgetModel> {
  /** Dynamically imported budget-model finder; lazy to keep startup cost low when judging is rare. */
  const { findBudgetModel, } = await import('./budget-model.ts');
  return findBudgetModel(
    ctx,
    toBudgetModelOptions(config,),
  );
}

/**
 * Extract budget model options from config.
 *
 * @param config - the merged runtime config
 *
 * @returns budget model options
 */
function toBudgetModelOptions(
  config: MergedConfig,
): BudgetModelOptions {
  /** Cleaned budget-model options that drop `modelOverride` so it can be re-attached conditionally below. */
  const opts: BudgetModelOptions = {
    strategy: config.judgeModel.strategy,
    costRatio: config.judgeModel.costRatio,
    majorVersions: config.judgeModel.majorVersions,
  };
  if (config.judgeModel.modelOverride !== undefined)
    opts.modelOverride = config.judgeModel.modelOverride;
  return opts;
}

export { evaluate, };
