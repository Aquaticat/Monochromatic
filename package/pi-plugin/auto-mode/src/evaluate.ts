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
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { askUser, } from './ask-user.ts';
import { findBudgetModel, } from './budget-model.ts';
import { JUDGE_TIMEOUT_MS, } from './constants.ts';
import {
  buildContext,
  getReusableApproval,
  getTrustDirectives,
} from './context.ts';
import {
  createJudgeCallHistory,
  type JudgeCallHistory,
} from './judge-call-history.ts';
import { callJudgeWithFallback, } from './judge-fallback.ts';
import { formatModelBlockReason, } from './model-feedback.ts';
import {
  type BatchEntry,
  type BudgetModel,
  type EvaluateResult,
  VERDICT_ENTRY_TYPE,
  type GuardDecision,
  type Verdict,
  type VerdictData,
} from './types.ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the evaluate module.
 */
const l = tagged({
  tag: 'evaluate',
  l: parentLogger,
},);

/**
 * Build model-facing block {@link GuardDecision} for a judge deny verdict.
 *
 * Formats the reason with {@link formatModelBlockReason}.
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
 * Reuses a latest same-session approval found by {@link getReusableApproval}
 * for the exact action when present. Otherwise resolves a judge model with
 * {@link resolveJudgeModel}, builds judge context with {@link buildContext}
 * and {@link getTrustDirectives}, calls the judge with {@link callJudge}, and
 * processes the verdict. On approve, allows and reports an `approved`
 * flow verdict. On deny, blocks via {@link decisionForDenyVerdict} and
 * reports a `denied` flow verdict. On ask, prompts the user with
 * {@link askUser} (no flow verdict; the prompt path records its own session
 * entry).
 *
 * @returns block-or-allow decision plus the flow verdict to record, if any
 *
 * @mutates pi - verdict and approval paths append Pi session entries
 *
 * @mutates ctx - context, auth, and user-prompt paths can change controlled Pi state
 *
 * @mutates batchContext - judge context construction can read caller-owned entry hooks
 *
 * @mutates judgeCallHistory - records model outcomes and supplies temporary selection exclusions
 *
 * @example
 * ```typescript
 * const result = await evaluate({
 *   pi,
 *   ctx,
 *   systemPrompt: prompt,
 *   action: "bash: sudo rm -rf /",
 *   actionInput: '{"command":"sudo rm -rf /"}',
 *   approvalFingerprint: "abc123",
 *   batchContext: [],
 * });
 * ```
 */
async function evaluate(
  {
    pi,
    ctx,
    systemPrompt,
    action,
    actionInput,
    approvalFingerprint,
    projectContext = '',
    batchContext,
    judgeCallHistory = createJudgeCallHistory(),
  }: {
    readonly pi: ForeignHostCapability<ExtensionAPI>;
    readonly ctx: ForeignHostCapability<ExtensionContext>;
    readonly systemPrompt: string;
    readonly action: string;
    readonly actionInput: string;
    readonly approvalFingerprint: string;
    readonly projectContext?: string;
    readonly batchContext: readonly BatchEntry[];
    readonly judgeCallHistory?: JudgeCallHistory;
  },
): Promise<EvaluateResult> {
  /**
   * Per-call sub-logger so log lines from this entry point carry the function name as a tag.
   */
  const innerL = tagged({
    tag: evaluate.name,
    l,
  },);
  innerL.debug(`evaluating action: ${action}`,);

  /**
   * Prior approval for the exact action, if the latest matching session verdict still allows reuse.
   */
  const reusableApproval = getReusableApproval({
    ctx,
    action,
    approvalFingerprint,
  },);
  if (reusableApproval.reusable) {
    /**
     * Audit reason recorded for this reuse decision and surfaced in the flow widget.
     */
    const reuseReason = `Previously approved in this session (${reusableApproval.source}): ${reusableApproval.reason}`;
    innerL.debug(`reuse ${reusableApproval.source}: ${action}`,);
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        approvalFingerprint,
        reusedFromVerdict: reusableApproval.source,
        verdict: 'approve',
        reason: reusableApproval.reason,
      } satisfies VerdictData,
    );
    return {
      decision: { block: false, },
      flowVerdict: {
        action,
        verdict: 'approved',
        reason: reuseReason,
      },
    };
  }

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
            excludedModelSlugs: judgeCallHistory.blocklistedModelSlugs(),
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
        caughtValueText(judgeResult.err,)
      }`,
    );
    return {
      decision: await askUser({
        pi,
        ctx,
        action,
        approvalFingerprint,
        explanation: 'No judge model available; manual approval required.',
      },),
    };
  }

  /**
   * Resolved judge after the `ok` discriminant narrowed the union.
   */
  const { judge, } = judgeResult;

  /**
   * Complete selected user-visible messages encoded as canonical JSON.
   */
  const recentContext = buildContext(ctx,);
  /**
   * Active trust directives for this session, listed in the prompt as guardrail relaxations.
   */
  const trustDirectives = getTrustDirectives(ctx,);

  try {
    /**
     * Structured verdict from the judge: `approve`/`deny`/`ask` plus rationale and guidance.
     */
    const verdict = await callJudgeWithFallback({
      firstJudge: judge,
      ctx,
      callHistory: judgeCallHistory,
      request: {
        action,
        actionInput,
        cwd: ctx.cwd,
        projectContext,
        recentContext,
        trustDirectives,
        timeoutMs: JUDGE_TIMEOUT_MS,
        systemPrompt,
        batchContext,
      },
    },);

    if (verdict.verdict
      === 'approve') {
      innerL.debug(`approve: ${verdict.reason}`,);
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          approvalFingerprint,
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
          approvalFingerprint,
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

    innerL.debug(`ask: ${verdict.reason}`,);
    return {
      decision: await askUser({
        pi,
        ctx,
        action,
        approvalFingerprint,
        explanation: verdict.reason,
        reflectExplanationOnDeny: true,
      },),
    };
  }
  catch (err) {
    /**
     * Normalised error message so both `Error` instances and non-`Error` throws produce a string.
     */
    const msg = caughtValueText(err,);
    innerL.error(`judge error: ${msg}`,);
    return {
      decision: await askUser({
        pi,
        ctx,
        action,
        approvalFingerprint,
        explanation: `Judge error: ${msg}`,
      },),
    };
  }
}

/**
 * Resolve a judge model with {@link findBudgetModel}.
 *
 * @param ctx - extension context
 *
 * @param excludedModelSlugs - judge models whose completed attempts already failed
 *
 * @returns a budget model with auth credentials
 *
 * @mutates ctx - `findBudgetModel` can invoke registry and command-backed auth capabilities
 *
 * @mutates excludedModelSlugs - model exclusion iteration can invoke caller-owned hooks
 */
function resolveJudgeModel(
  {
    ctx,
    excludedModelSlugs = [],
  }: {
    readonly ctx: ForeignHostCapability<ExtensionContext>;
    readonly excludedModelSlugs?: readonly string[];
  },
): Promise<BudgetModel> {
  return findBudgetModel({
    ctx,
    excludedModelSlugs,
  },);
}

export {
  decisionForDenyVerdict,
  evaluate,
};
