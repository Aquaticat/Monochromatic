/**
 * Canary probe definitions for detecting inference degradation.
 *
 * Two tiers:
 * - **Simple** (disabled by default): cheap text-only checks for basic sanity
 * - **Code-gen** (default): the model writes a TypeScript CLI, which is executed
 *   in a throwaway locked-down container and scored by output correctness
 */

//region Probe type

/**
 * Context passed to score and buildFixPrompt so generated artifacts
 * can be organized by model and pass (initial vs fix).
 */
export type ScoreContext = {
  /** Full OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6") */
  readonly modelId: string;
  /** Which pass produced this response */
  readonly pass: 'initial' | 'fix';
};

/** Single canary probe with prompt, expected behavior, and scoring function */
export type Probe = {
  /** Human-readable label for reporting */
  readonly name: string;
  /** Which degradation axis this probe targets */
  readonly category: 'simple' | 'code-gen';
  /** System prompt sent alongside the user message */
  readonly system: string;
  /** User message that forms the probe */
  readonly prompt: string;
  /**
   * Scores the model response on a 0-1 scale.
   * Async to support container execution for code-gen probes.
   * @param response - raw model output text
   * @param context - model identity and pass info for artifact organization
   * @returns score between 0 (complete failure) and 1 (perfect)
   */
  readonly score: (response: string, context: ScoreContext) => number | Promise<number>;
  /**
   * Generates a follow-up prompt for a second pass where the model gets its
   * code back with linter/type-checker output and tries to fix issues.
   * Returns undefined to skip the second pass (e.g. when there's nothing to fix).
   * @param response - raw model output from the first pass
   * @param context - model identity and pass info for artifact organization
   * @returns follow-up user message, or undefined to skip
   */
  readonly buildFixPrompt?: (response: string, context: ScoreContext) => string | undefined | Promise<string | undefined>;
  /**
   * Whether this probe involves long-running execution (e.g. real async delays).
   * Slow probes are excluded by default; pass --slow to include them.
   */
  readonly slow?: boolean;
};

//endregion Probe type

//region Simple probes -- cheap text-only checks, disabled by default

/** Checks basic arithmetic that should never fail */
const simpleArithmetic: Probe = {
  name: 'arithmetic',
  category: 'simple',
  system: 'Answer with only the number, nothing else.',
  prompt: 'What is 7 * 8?',
  score: (response, _context) => response.trim() === '56' ? 1 : 0,
};

/** Checks if the model follows an exact output format */
const simpleFormat: Probe = {
  name: 'exact-format',
  category: 'simple',
  system: 'Follow the formatting instruction exactly. Output nothing else.',
  prompt: 'Output exactly this text with no changes: <<CANARY_OK>>',
  score: (response, _context) => response.trim() === '<<CANARY_OK>>' ? 1 : 0,
};

/** Checks JSON output compliance -- degraded models often break structure */
const simpleJson: Probe = {
  name: 'json-output',
  category: 'simple',
  system: 'Respond with valid JSON only. No markdown fences, no explanation.',
  prompt: 'Return a JSON object with keys "status" (string "ok") and "value" (number 42).',
  score: (response, _context) => {
    try {
      const parsed = JSON.parse(response.trim()) as Record<string, unknown>;
      if (parsed['status'] === 'ok' && parsed['value'] === 42) return 1;
      return 0.5;
    } catch {
      return 0;
    }
  },
};

//endregion Simple probes

/** Simple probes, disabled by default to save money */
export const simpleProbes: readonly Probe[] = [
  simpleArithmetic,
  simpleFormat,
  simpleJson,
];

export { codeGenProbes, codeGenProbesAll, } from './probes-codegen.ts';
