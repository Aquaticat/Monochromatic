/**
 * Shared types for pi guardrail configuration and tool-call decisions.
 *
 * @module
 */

//region Configuration types

/**
 * One gitignore-style protected-path rule with its refusal message.
 */
type PathRule = {
  /**
   * Gitignore-style pattern evaluated relative to pi's current working directory.
   */
  readonly pattern: string;
  /**
   * Message returned to pi when a matching edit or write tool call is blocked.
   */
  readonly message: string;
};

/**
 * Parsed source metadata for guardrail configuration.
 */
type GuardrailConfigSource = {
  /**
   * Absolute config file path that was attempted.
   */
  readonly path: string;
  /**
   * Whether config file existed and was parsed.
   */
  readonly loaded: boolean;
};

/**
 * Runtime guardrail configuration after defaults and global config merge.
 */
type GuardrailConfig = {
  /**
   * Ordered protected-path rules; later rules can unignore earlier rules.
   */
  readonly pathRules: readonly PathRule[];
  /**
   * Whether Bash tool calls invoking `bun test` are refused.
   */
  readonly blockBunTest: boolean;
  /**
   * Config source metadata for diagnostics.
   */
  readonly source: GuardrailConfigSource;
};

/**
 * Advanced object config shape accepted by `pi-guardrail.json`.
 */
type GuardrailObjectConfigFile = {
  /**
   * Optional protected-path rule map keyed by gitignore-style pattern.
   */
  readonly pathRules?: Record<string, string>;
  /**
   * Optional override for the default `bun test` Bash guard.
   */
  readonly blockBunTest?: boolean;
};

/**
 * Normalized config file content before built-in defaults are merged.
 */
type NormalizedConfigFile = {
  /**
   * User-specified protected-path rules.
   */
  readonly pathRules: readonly PathRule[];
  /**
   * Optional user override for `bun test` blocking.
   */
  readonly blockBunTest?: boolean;
};

//endregion Configuration types

//region Tool input types

/**
 * Minimal file-mutation tool input shape used by pi `edit` and `write`.
 */
type FileMutationToolInput = {
  /**
   * Target file path passed to pi file-mutation tools.
   */
  readonly path?: unknown;
};

/**
 * Minimal Bash tool input shape used by pi `bash`.
 */
type BashToolInput = {
  /**
   * Shell command passed to pi's Bash tool.
   */
  readonly command?: unknown;
};

/**
 * Tool-call block decision returned from guardrail checks.
 */
type GuardrailBlockDecision = {
  /**
   * Whether pi should block the tool call.
   */
  readonly block: true;
  /**
   * Refusal reason shown to the model and user.
   */
  readonly reason: string;
};

//endregion Tool input types

export type {
  BashToolInput,
  FileMutationToolInput,
  GuardrailBlockDecision,
  GuardrailConfig,
  GuardrailConfigSource,
  GuardrailObjectConfigFile,
  NormalizedConfigFile,
  PathRule,
};
