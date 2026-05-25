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

//region Custom entry types

/** Discriminator for trust-directive session entries. */
const TRUST_ENTRY_TYPE = 'auto-mode:trust';

/** Discriminator for verdict session entries. */
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
  /** Human-readable description of the action. */
  action: string;
  /** Judge or user decision. */
  verdict:
    | 'approve'
    | 'deny'
    | 'ask'
    | 'user-approve'
    | 'user-deny';
  /** Reasoning or context. */
  reason: string;
};

/**
 * Verdict returned by the judge.
 *
 * Only the judge produces this shape; user decisions
 * produce `VerdictData` directly.
 */
type Verdict = {
  verdict: 'approve' | 'deny' | 'ask';
  reason: string;
  /** Guidance sent to the agent on deny. */
  guidance: string;
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
    type: string;
    data?: unknown;
  },
): entry is {
  type: string;
  data: string | null;
} {
  return entry.type
    === TRUST_ENTRY_TYPE;
}

/**
 * Type-guard for verdict session entries.
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
    type: string;
    data?: unknown;
  },
): entry is {
  type: string;
  data: VerdictData;
} {
  return entry.type
    === VERDICT_ENTRY_TYPE;
}

//endregion

//region Signal types

/** Context needed by signal functions. */
type SignalContext = {
  /** Working directory of the agent session. */
  cwd: string;
  /** Home directory of the current user. */
  home: string;
};

//endregion

//region Command types

/** Parsed command from shell-quote. */
type CommandInfo = {
  /** Command name (e.g. "rm", "sudo"). */
  name: string;
  /** Positional arguments and flags. */
  args: string[];
  /** Redirect targets (files after > or >>). */
  redirectTargets: string[];
  /** Pre-scanned variable references from the raw command. */
  paramRefs: string[];
};

/**
 * Result of analyzing a bash command string.
 *
 * Produced by `analyzeBashCommand` in command-parser.ts.
 */
type BashAnalysis = {
  /** Whether the command could be parsed. */
  parsed: boolean;
  /** Individual commands in the pipeline. */
  commands: CommandInfo[];
  /** Whether the command is a pipeline (uses |). */
  isPipeline: boolean;
  /** All environment variable references across commands. */
  allParamRefs: string[];
  /** All file-like arguments across commands. */
  allFiles: string[];
};

//endregion

//region Budget model types

/** Authentication details for a budget model. */
type BudgetModelAuth = {
  /** API key for the model provider. */
  apiKey?: string;
  /** Custom headers for the request. */
  headers?: Record<string, string>;
};

/** A selected budget model with its auth credentials. */
type BudgetModel = {
  model: Model<Api>;
  auth: BudgetModelAuth;
};

/** Strategy for finding a budget model. */
type ModelStrategy = 'same-provider' | 'any-provider';

/**
 * Pinned-model override for the judge.
 *
 * `string` selects a model by `provider/id`; the object form allows
 * supplying explicit auth alongside the model id (used when the
 * registry can't otherwise resolve credentials).
 */
type ModelOverride =
  | string
  | {
    model: string;
    auth: BudgetModelAuth;
  };

/**
 * Configured judge-model selection.
 *
 * Carries either a pinned override or a strategy plus its tuning
 * parameters. The same shape is used by `MergedConfig.judgeModel`,
 * `BudgetModelOptions`, and the YAML/JSON config schema.
 */
type JudgeModelConfig = {
  modelOverride?: ModelOverride;
  strategy: ModelStrategy;
  /** Maximum cost ratio vs active model (0-1). */
  costRatio: number;
  /** How many major version families to search. */
  majorVersions: number;
};

/** Budget-model find options (shape used by `findBudgetModel`). */
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
  /** Human-readable action description. */
  action: string;
  /** Verdict: "approve" or "deny". */
  verdict: string;
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
  BudgetModelAuth,
  BudgetModelOptions,
  CommandInfo,
  JudgeModelConfig,
  ModelOverride,
  ModelStrategy,
  SignalContext,
  Verdict,
  VerdictData,
};
