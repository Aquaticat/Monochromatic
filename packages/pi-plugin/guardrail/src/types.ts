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

//region Guardrail decision types

/**
 * Sentinel returned when a guardrail allows a tool call.
 *
 * @example
 * ```typescript
 * if (decision === GUARDRAIL_NOT_BLOCKED) return undefined;
 * ```
 */
const GUARDRAIL_NOT_BLOCKED: unique symbol = Symbol(
  'pi guardrail tool call not blocked by any rule',
);

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

/**
 * Internal guardrail decision that avoids nullish absence modeling.
 */
type GuardrailDecision = GuardrailBlockDecision | typeof GUARDRAIL_NOT_BLOCKED;

//endregion Guardrail decision types

export {
  GUARDRAIL_NOT_BLOCKED,
};
export type {
  GuardrailBlockDecision,
  GuardrailConfig,
  GuardrailDecision,
  GuardrailConfigSource,
  NormalizedConfigFile,
  PathRule,
};
