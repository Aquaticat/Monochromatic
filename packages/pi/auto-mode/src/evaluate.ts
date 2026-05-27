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
import { askUser, } from './ask-user.ts';
import {
  buildContext,
  getTrustDirectives,
} from './context.ts';
import { callJudge, } from './judge.ts';
import { l as parentLogger, } from './log.ts';
import { formatModelBlockReason, } from './model-feedback.ts';
import type { MergedConfig, } from './signals.ts';
import {
  type BatchEntry,
  type BudgetModel,
  type BudgetModelOptions,
  type EvaluateResult,
  VERDICT_ENTRY_TYPE,
  type GuardDecision,
  type Verdict,
  type VerdictData,
} from './types.ts';

/** Tagged logger for the evaluate module. */
const l = tagged({
  tag: 'evaluate',
  l: parentLogger,
},);

/**
 * Build model-facing block decision for a judge deny verdict.
 *
 * @param verdict - preserves judge rationale and guidance for agent self-correction
 *
 * @returns blocked decision carrying both rationale and safer next step
 *
 * @example
 * ```typescript
 * decisionForDenyVerdict({
 *   verdict: { verdict: 'deny', reason: 'Risky command.', guidance: 'Use dry-run.' },
 * });
 * ```
 */
function decisionForDenyVerdict(
  {
    verdict,
  }: {
    readonly verdict: Verdict;
  },
): GuardDecision {
  return {
    block: true,
    reason: formatModelBlockReason({
      guardrailReason: verdict.reason,
      guidance: verdict.guidance,
    },),
  };
}

/**
 * Evaluate a flagged action through the judge pipeline.
 *
 * Resolves a judge model, calls the judge, and processes
 * the verdict. On approve, allows and reports an `approved`
 * flow verdict. On deny, blocks with reason plus guidance and reports a
 * `denied` flow verdict. On ask, prompts the user (no flow
 * verdict; the prompt path records its own session entry).
 *
 * @returns block-or-allow decision plus the flow verdict to record, if any
 *
 * @example
 * ```typescript
 * const result = await evaluate({ pi, ctx, config, systemPrompt: prompt, action: "bash: sudo rm -rf /", batchContext: [] });
 * ```
 */
async function evaluate(
  {
    pi,
    ctx,
    config,
    systemPrompt,
    action,
    batchContext,
  }: {
    readonly pi: ExtensionAPI;
    readonly ctx: ExtensionContext;
    readonly config: MergedConfig;
    readonly systemPrompt: string;
    readonly action: string;
    readonly batchContext: readonly BatchEntry[];
  },
): Promise<EvaluateResult> {
  /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
  const innerL = tagged({
    tag: evaluate.name,
    l,
  },);
  innerL.debug(`evaluating action: ${action}`,);

  /**
   * Resolved judge model handed to {@link callJudge}, or a recoverable failure marker.
   */
  const judgeResult = await (
    async function tryResolveJudge(): Promise<
      | {
        ok: true;
        judge: BudgetModel;
      }
      | {
        ok: false;
        err: unknown;
      }
    > {
      try {
        return {
          ok: true,
          judge: await resolveJudgeModel({
            ctx,
            config,
          },),
        };
      }
      catch (err) {
        return {
          ok: false,
          err,
        };
      }
    }
  )();

  if (!judgeResult.ok) {
    innerL.error(
      `judge model resolution failed: ${
        judgeResult.err
          instanceof Error
          ? judgeResult.err
            .message
          : String(judgeResult.err,)
      }`,
    );
    return {
      decision: await askUser({
        pi,
        ctx,
        action,
        explanation: 'No judge model available; manual approval required.',
      },),
    };
  }

  /** Resolved judge after the `ok` discriminant narrowed the union. */
  const { judge, } = judgeResult;

  /** Recent session activity rendered as a string for the judge prompt. */
  const recentContext = buildContext(ctx,);
  /** Active trust directives for this session, listed in the prompt as guardrail relaxations. */
  const trustDirectives = getTrustDirectives(ctx,);

  try {
    /** Structured verdict from the judge: `approve`/`deny`/`ask` plus rationale and guidance. */
    const verdict = await callJudge({
      model: judge.model,
      auth: judge.auth,
      action,
      cwd: ctx.cwd,
      recentContext,
      trustDirectives,
      timeoutMs: config.judgeTimeoutMs,
      systemPrompt,
      batchContext,
    },);

    if (verdict.verdict
      === 'approve') {
      innerL.info(`approve: ${verdict.reason}`,);
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          verdict: 'approve',
          reason: verdict.reason,
        } satisfies VerdictData,
      );
      return {
        decision: { block: false, },
        flowVerdict: {
          action,
          verdict: 'approved',
          reason: verdict.reason,
        },
      };
    }

    if (verdict.verdict
      === 'deny') {
      innerL.warn(`deny: ${verdict.reason}`,);
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          verdict: 'deny',
          reason: verdict.reason,
        } satisfies VerdictData,
      );
      return {
        decision: decisionForDenyVerdict({ verdict, },),
        flowVerdict: {
          action,
          verdict: 'denied',
          reason: verdict.reason,
        },
      };
    }

    innerL.info(`ask: ${verdict.reason}`,);
    return {
      decision: await askUser({
        pi,
        ctx,
        action,
        explanation: verdict.reason,
        reflectExplanationOnDeny: true,
      },),
    };
  }
  catch (err) {
    /** Normalised error message so both `Error` instances and non-`Error` throws produce a string. */
    const msg = err instanceof Error ? err.message : String(err,);
    innerL.error(`judge error: ${msg}`,);
    return {
      decision: await askUser({
        pi,
        ctx,
        action,
        explanation: `Judge error: ${msg}`,
      },),
    };
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
  {
    ctx,
    config,
  }: {
    readonly ctx: ExtensionContext;
    readonly config: MergedConfig;
  },
): Promise<BudgetModel> {
  /** Dynamically imported budget-model finder; lazy to keep startup cost low when judging is rare. */
  const { findBudgetModel, } = await import('./budget-model.ts');
  return findBudgetModel({
    ctx,
    options: toBudgetModelOptions(config,),
  },);
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
  /** Judge-model block destructured so the per-field reads below stay single-identifier. */
  const {
    strategy,
    costRatio,
    majorVersions,
    modelOverride,
  } = config.judgeModel;
  /** Budget-model options, with `modelOverride` re-attached only when the judge config pinned one. */
  const opts: BudgetModelOptions = {
    strategy,
    costRatio,
    majorVersions,
    ...(modelOverride !== undefined
      ? { modelOverride, }
      : {}),
  };
  return opts;
}

export {
  decisionForDenyVerdict,
  evaluate,
};
