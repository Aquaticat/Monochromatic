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
} from "@earendil-works/pi-ai";

//region Custom entry types

/** Discriminator for trust-directive session entries. */
const TRUST_ENTRY_TYPE = "auto-mode:trust";

/** Discriminator for verdict session entries. */
const VERDICT_ENTRY_TYPE = "auto-mode:verdict";

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
    | "approve"
    | "deny"
    | "ask"
    | "user-approve"
    | "user-deny";
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
  verdict: "approve" | "deny" | "ask";
  reason: string;
  /** Guidance sent to the agent on deny. */
  guidance: string;
};

//endregion

//region Custom entry helpers

/**
 * Type-guard for custom session entries.
 *
 * Narrows a `SessionEntry` to a specific `CustomEntry<T>`
 * by checking the entry type discriminator.
 *
 * @param entry - a session branch entry
 *
 * @param entryType - the custom entry type to match
 *
 * @returns `true` if the entry matches the expected type
 *
 * @example
 * ```typescript
 * if (isCustomEntry<string>(entry, TRUST_ENTRY_TYPE)) {
 *   console.log(entry.data); // string
 * }
 * ```
 */
function isCustomEntry<T>(
  entry: {
    type: string;
    data?: unknown
  },
  entryType: string,
): entry is {
  type: string;
  data: T
} {
  return entry.type === entryType;
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
  isCustomEntry,
  TRUST_ENTRY_TYPE,
  VERDICT_ENTRY_TYPE,
};
export type {
  BashAnalysis,
  BatchEntry,
  BudgetModel,
  BudgetModelAuth,
  CommandInfo,
  SignalContext,
  Verdict,
  VerdictData,
};
