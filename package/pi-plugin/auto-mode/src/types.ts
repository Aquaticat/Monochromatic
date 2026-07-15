/**
 * Shared types for the auto-mode extension.
 *
 * All types use `type` (not `interface`) per oxlint rules.
 * Branded types for custom session entries ensure type-safe
 * data retrieval.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type {
  BudgetModel as SharedBudgetModel,
  BudgetModelOverride,
  BudgetModelStrategy,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
import type {
  ShellCommandAnalysis,
  ShellCommandInfo,
  ShellEnvAssignment,
} from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';

//region Custom entry types

/**
 * Discriminator for trust-directive session entries.
 */
const TRUST_ENTRY_TYPE = 'auto-mode:trust';

/**
 * Discriminator for verdict session entries.
 */
const VERDICT_ENTRY_TYPE = 'auto-mode:verdict';

//endregion

//region Verdict types

/**
 * Structured verdict data written to the session log.
 *
 * Written by the judge pipeline for audit/replay and by
 * propose_trust for user-initiated overrides.
 */
type VerdictData = {
  /**
   * Human-readable description of the action.
   */
  readonly action: string;
  /**
   * Stable fingerprint of the exact tool call approved or denied.
   */
  readonly approvalFingerprint?: string;
  /**
   * Original approval verdict when this entry was produced by reuse.
   */
  readonly reusedFromVerdict?: 'approve' | 'user-approve';
  /**
   * Judge or user decision.
   */
  readonly verdict:
    | 'approve'
    | 'deny'
    | 'ask'
    | 'user-approve'
    | 'user-deny';
  /**
   * Reasoning or context.
   */
  readonly reason: string;
};

/**
 * Verdict returned by the judge.
 *
 * Only the judge produces this shape; user decisions
 * produce `VerdictData` directly.
 */
type Verdict = {
  readonly verdict: 'approve' | 'deny' | 'ask';
  readonly reason: string;
  /**
   * Guidance sent to the agent on deny.
   */
  readonly guidance: string;
};

//endregion

//region Custom entry helpers

/**
 * Type-guard for trust-directive session entries.
 *
 * Type predicates must use a single positional parameter so call-site
 * narrowing works; the two custom entry types each get their own guard
 * rather than a parameterised helper.
 *
 * @param entry - a session branch entry
 *
 * @returns `true` if the entry is a trust-directive entry
 *
 * @example
 * ```typescript
 * if (isTrustEntry(entry)) {
 *   console.log(entry.data); // string | null
 * }
 * ```
 */
function isTrustEntry(
  entry: {
    readonly type: string;
    readonly customType?: unknown;
    readonly data?: unknown;
  },
): entry is {
  type: 'custom';
  customType: typeof TRUST_ENTRY_TYPE;
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- external boundary: trust-directive session entries persist `data` as `string | null` via pi.appendEntry, where `null` is the protocol's clear-all-directives signal; the predicate mirrors that stored shape.
  data: string | null;
} {
  /**
   * Whether entry carries Pi's custom-entry discriminator for trust directives.
   */
  const hasTrustCustomType = (entry.type === 'custom')
    && (entry.customType === TRUST_ENTRY_TYPE);
  if (!hasTrustCustomType)
    return false;
  if ((typeof entry.data)
    === 'string') {
    return true;
  }
  return entry.data
    === null;
}

/**
 * Type-guard for verdict session entries, validated with {@link isVerdictData}.
 *
 * @param entry - a session branch entry
 *
 * @returns `true` if the entry is a verdict entry
 *
 * @example
 * ```typescript
 * if (isVerdictEntry(entry)) {
 *   console.log(entry.data.verdict);
 * }
 * ```
 */
function isVerdictEntry(
  entry: {
    readonly type: string;
    readonly customType?: unknown;
    readonly data?: unknown;
  },
): entry is {
  type: 'custom';
  customType: typeof VERDICT_ENTRY_TYPE;
  data: VerdictData;
} {
  /**
   * Whether entry carries Pi's custom-entry discriminator for verdict data.
   */
  const hasVerdictCustomType = (entry.type === 'custom')
    && (entry.customType === VERDICT_ENTRY_TYPE);
  if (!hasVerdictCustomType)
    return false;
  return isVerdictData(entry.data,);
}

/**
 * Check whether unknown custom-entry payload has verdict-data shape.
 *
 * Validates the record with {@link isRecord}, the verdict discriminant with
 * {@link isVerdictValue}, and the optional fields with
 * {@link isUndefinedOrString} and {@link isUndefinedOrReusableVerdictSource}.
 *
 * @param data - custom entry payload read from session history
 *
 * @returns whether payload can be safely consumed as verdict data
 *
 * @example
 * ```typescript
 * isVerdictData({ action: 'read .env', verdict: 'approve', reason: 'Allowed' });
 * ```
 */
function isVerdictData(
  data: unknown,
): data is VerdictData {
  if (!isRecord(data,))
    return false;
  if ((typeof data.action)
    !== 'string') {
    return false;
  }
  if ((typeof data.reason)
    !== 'string') {
    return false;
  }
  if (!isVerdictValue(data.verdict,))
    return false;
  if (!isUndefinedOrString(data.approvalFingerprint,))
    return false;
  return isUndefinedOrReusableVerdictSource(data.reusedFromVerdict,);
}

/**
 * Check whether unknown value is undefined or string.
 *
 * @param value - candidate optional string value
 *
 * @returns whether value can populate optional string fields
 *
 * @example
 * ```typescript
 * isUndefinedOrString('fingerprint');
 * ```
 */
function isUndefinedOrString(
  value: unknown,
): boolean {
  if (value === undefined)
    return true;
  return (typeof value)
    === 'string';
}

/**
 * Check whether unknown value is undefined or reusable source discriminator.
 *
 * @param value - candidate optional reusable source value
 *
 * @returns whether value can populate reusedFromVerdict
 *
 * @example
 * ```typescript
 * isUndefinedOrReusableVerdictSource('user-approve');
 * ```
 */
function isUndefinedOrReusableVerdictSource(
  value: unknown,
): boolean {
  if (value === undefined)
    return true;
  if (value === 'approve')
    return true;
  return value === 'user-approve';
}

/**
 * Check whether unknown value is one of allowed verdict strings.
 *
 * @param value - candidate verdict value
 *
 * @returns whether value is a verdict discriminator
 *
 * @example
 * ```typescript
 * isVerdictValue('user-approve');
 * ```
 */
function isVerdictValue(
  value: unknown,
): value is VerdictData['verdict'] {
  if (value === 'approve')
    return true;
  if (value === 'deny')
    return true;
  if (value === 'ask')
    return true;
  if (value === 'user-approve')
    return true;
  return value === 'user-deny';
}

/**
 * Check whether unknown value is a non-null object record.
 *
 * @param value - candidate object value
 *
 * @returns whether value can be accessed by string keys
 *
 * @example
 * ```typescript
 * isRecord({ ok: true });
 * ```
 */
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  if ((typeof value)
    !== 'object') {
    return false;
  }
  return value !== null;
}

//endregion

//region Signal types

/**
 * Context needed by signal functions.
 */
type SignalContext = {
  /**
   * Working directory of the agent session.
   */
  readonly cwd: string;
  /**
   * Home directory of the current user.
   */
  readonly home: string;
};

//endregion

//region Command types

/**
 * Environment assignment prefix parsed before shell command name.
 */
type EnvAssignment = ShellEnvAssignment;

/**
 * Parsed shell command used by bash signal checks.
 */
type CommandInfo = ShellCommandInfo;

/**
 * Result of analyzing a bash command string.
 *
 * Produced by {@link analyzeBashCommand} in command-parser.ts.
 */
type BashAnalysis = ShellCommandAnalysis;

//endregion

//region Budget model types

/**
 * A selected budget model with pi-ai model shape.
 */
type BudgetModel = SharedBudgetModel<Model<Api>>;

/**
 * Strategy for finding a budget model.
 */
type ModelStrategy = BudgetModelStrategy;

/**
 * Pinned-model override for the judge.
 */
type ModelOverride = BudgetModelOverride;

/**
 * Configured judge-model selection.
 *
 * Carries either a pinned override or a strategy plus its tuning
 * parameters. The same shape is used by {@link MergedConfig}'s `judgeModel`,
 * {@link BudgetModelOptions}, and the YAML/JSON config schema.
 */
type JudgeModelConfig = {
  readonly modelOverride?: ModelOverride;
  readonly strategy: ModelStrategy;
  /**
   * How many major version families to search.
   */
  readonly majorVersions: number;
};

/**
 * Budget-model find options (shape used by {@link findBudgetModel}).
 */
type BudgetModelOptions = JudgeModelConfig;

//endregion

//region Batch types

/**
 * Entry in a tool-call batch.
 *
 * Tracks the action description and its verdict
 * for circumvention detection across a single turn.
 */
type BatchEntry = {
  /**
   * Human-readable action description.
   */
  readonly action: string;
  /**
   * Verdict: "approve" or "deny".
   */
  readonly verdict: string;
};

//endregion

//region Evaluation types

/**
 * Outcome of guarding a flagged action: block the tool call with guidance,
 * or allow it.
 *
 * A discriminated union on `block` rather than an optional/absent result, so
 * "allow" is a distinct, meaningful value rather than a missing one. Both
 * {@link evaluate} and {@link askUser} resolve to this shape; the entry-point
 * handler maps it onto the host SDK's {@link ToolCallEventResult} (block) or
 * no result (allow).
 */
type GuardDecision =
  | {
    readonly block: true;
    /**
     * Guidance returned to the agent explaining the block.
     */
    readonly reason: string;
  }
  | { readonly block: false };

/**
 * One entry in the per-flow verdict log surfaced in the auto-mode widget.
 *
 * Recorded only for judge `approve`/`deny` outcomes; user-driven `ask`
 * resolutions are logged via `pi.appendEntry` instead of the flow widget.
 */
type FlowVerdict = {
  /**
   * Human-readable description of the guarded action.
   */
  readonly action: string;
  /**
   * Widget verdict label: `approved` or `denied`.
   */
  readonly verdict: string;
  /**
   * Judge reasoning for the verdict.
   */
  readonly reason: string;
};

/**
 * Result of {@link evaluate}: the block/allow decision plus the flow verdict to
 * record, when the judge produced one.
 *
 * `flowVerdict` is absent for the user-prompt (`ask`) path, which records its
 * own session entry and does not contribute to the flow widget.
 */
type EvaluateResult = {
  /**
   * Block-or-allow decision handed back to the host SDK.
   */
  readonly decision: GuardDecision;
  /**
   * Verdict to append to the flow log, when the judge approved or denied.
   */
  readonly flowVerdict?: FlowVerdict;
};

//endregion

export {
  isTrustEntry,
  isVerdictEntry,
  TRUST_ENTRY_TYPE,
  VERDICT_ENTRY_TYPE,
};
export type {
  BashAnalysis,
  BatchEntry,
  BudgetModel,
  BudgetModelOptions,
  CommandInfo,
  EnvAssignment,
  EvaluateResult,
  FlowVerdict,
  GuardDecision,
  JudgeModelConfig,
  ModelOverride,
  ModelStrategy,
  SignalContext,
  Verdict,
  VerdictData,
};
export type { BudgetModelAuth, } from '@monochromatic-dev/pi-shared-model-selection/ts';
