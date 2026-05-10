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
} from "@earendil-works/pi-coding-agent";
import {
  type BatchEntry,
  type BudgetModel,
  type VerdictData,
  VERDICT_ENTRY_TYPE,
} from "./types.ts";
import { DEFAULT_DENY_GUIDANCE, } from "./system-prompt.ts";
import type { MergedConfig, } from "./signals.ts";
import { callJudge, } from "./judge.ts";
import {
  buildContext,
  getTrustDirectives,
} from "./context.ts";
import {
  updateWidget,
  askUser,
} from "./ask-user.ts";

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
    reason: string
  }[],
): Promise<{
  block: true;
  reason: string
} | undefined> {
  let judge: BudgetModel | undefined = undefined;
  try {
    judge = await resolveJudgeModel(
      ctx,
      config
    );
  }
  catch (err) {
    console.error(
      `auto-mode: judge model resolution failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return askUser(
      pi,
      ctx,
      action,
      "No judge model available; manual approval required.",
    );
  }

  if (judge === undefined) {
    return askUser(
      pi,
      ctx,
      action,
      "No judge model available; manual approval required.",
    );
  }

  const recentContext = buildContext(ctx);
  const trustDirectives = getTrustDirectives(ctx);

  try {
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

    if (verdict.verdict === "approve") {
      flowVerdicts.push({
        action,
        verdict: "approved",
        reason: verdict.reason,
      });
      updateWidget(
        ctx,
        flowVerdicts
      );
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          verdict: "approve",
          reason: verdict.reason,
        } satisfies VerdictData,
      );
      return undefined;
    }

    if (verdict.verdict === "deny") {
      flowVerdicts.push({
        action,
        verdict: "denied",
        reason: verdict.reason,
      });
      updateWidget(
        ctx,
        flowVerdicts
      );
      pi.appendEntry(
        VERDICT_ENTRY_TYPE,
        {
          action,
          verdict: "deny",
          reason: verdict.reason,
        } satisfies VerdictData,
      );
      return {
        block: true,
        reason: verdict.guidance !== "" ? verdict.guidance : DEFAULT_DENY_GUIDANCE,
      };
    }

    return askUser(
      pi,
      ctx,
      action,
      verdict.reason,
    );
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
  const { findBudgetModel, } = await import("./budget-model.ts");
  return findBudgetModel(
    ctx,
    toBudgetModelOptions(config),
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
): {
  modelOverride?: string | {
    model: string;
    auth: {
      apiKey?: string;
      headers?: Record<string, string>;
    };
  };
  strategy: "same-provider" | "any-provider";
  costRatio: number;
  majorVersions: number;
} {
  const opts: {
    modelOverride?: string | {
      model: string;
      auth: {
        apiKey?: string;
        headers?: Record<string, string>;
      };
    };
    strategy: "same-provider" | "any-provider";
    costRatio: number;
    majorVersions: number;
  } = {
    strategy: config.judgeModel.strategy,
    costRatio: config.judgeModel.costRatio,
    majorVersions: config.judgeModel.majorVersions,
  };
  if (config.judgeModel.modelOverride !== undefined) {
    opts.modelOverride = config.judgeModel.modelOverride;
  }
  return opts;
}

export { evaluate, };
