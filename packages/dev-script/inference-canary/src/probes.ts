/**
 * Canary probe registry.
 *
 * Three tiers:
 * - **Simple** (disabled by default): cheap text-only checks for basic sanity
 * - **Code-gen** (default): the model writes a TypeScript CLI, scored by correctness + lint + types
 * - **Simulation** (default): the model reads an interpreter source file and traces execution
 */
import type { Probe, } from './probe-types.ts';

export type { Probe, ScoreContext, } from './probe-types.ts';

//region Simple probes -- cheap text-only checks, disabled by default

/** Checks basic arithmetic that should never fail */
const simpleArithmetic: Probe = {
  name: 'arithmetic',
  category: 'simple',
  system: 'Answer with only the number, nothing else.',
  prompt: 'What is 7 * 8?',
  score: function scoreArithmetic(response, _context): number { return response.trim() === '56' ? 1 : 0; },
};

/** Checks if the model follows an exact output format */
const simpleFormat: Probe = {
  name: 'exact-format',
  category: 'simple',
  system: 'Follow the formatting instruction exactly. Output nothing else.',
  prompt: 'Output exactly this text with no changes: <<CANARY_OK>>',
  score: function scoreFormat(response, _context): number { return response.trim() === '<<CANARY_OK>>' ? 1 : 0; },
};

/** Checks JSON output compliance -- degraded models often break structure */
const simpleJson: Probe = {
  name: 'json-output',
  category: 'simple',
  system: 'Respond with valid JSON only. No markdown fences, no explanation.',
  prompt: 'Return a JSON object with keys "status" (string "ok") and "value" (number 42).',
  score: function scoreJson(response, _context): number {
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse result checked structurally below
      const parsed = JSON.parse(response.trim()) as Record<string, unknown>;
      /** Expected value in the JSON output */
      const EXPECTED_VALUE = 42;
      /** Partial credit for valid JSON with wrong content */
      const PARTIAL_SCORE = 0.5;
      if (parsed['status'] === 'ok' && parsed['value'] === EXPECTED_VALUE) return 1;
      return PARTIAL_SCORE;
    } catch (parseError) {
      console.log(`[probe:json-output] response was not valid JSON: ${String(parseError)}`);
      return 0;
    }
  },
};

//endregion Simple probes

/** Simple probes, disabled by default to save money */
export const simpleProbes: readonly Probe[] = [simpleArithmetic, simpleFormat, simpleJson];

export { codeGenProbes, codeGenProbesAll, } from './probes-codegen.ts';
export { simulationProbes, } from './probes-simulation.ts';
