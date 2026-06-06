/**
 * Model registry for the inference canary.
 *
 * Each model has an OpenRouter ID and per-model configuration overrides.
 * All listed models support the OpenRouter `reasoning` parameter.
 */

import type { OpenRouterModelId, } from './runner-types.ts';
import type { VerbosityLevel, } from './runner.ts';

//region Model config type: per-model overrides for verbosity and display label

/**
 * Per-model configuration for canary probes
 */
export type ModelConfig = {
  /**
   * OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6")
   */
  readonly openrouterId: OpenRouterModelId;
  /**
   * Short human-readable label for reports.
   * Must be unique across all models; used as the dedup key and artifact directory name.
   */
  readonly label: string;
  /**
   * OpenRouter verbosity override.
   * Only Anthropic models support "max"; others should use "low" or omit.
   */
  readonly verbosity: VerbosityLevel;
};

//endregion Model config type

//region Model registry: the canonical list of models tested by default; add/remove models here

/**
 * All models to test in parallel
 */
export const models: readonly ModelConfig[] = [
  // Claude 4.6 models use adaptive effort: even at "low", the model decides how much to
  // think based on problem difficulty. Scoring poorly on hard probes at low effort is the
  // model's own calibration failure, not a testing artifact.
  {
    openrouterId: 'anthropic/claude-opus-4.6',
    label: 'Opus 4.6',
    verbosity: 'low',
  },
  {
    openrouterId: 'anthropic/claude-sonnet-4.6',
    label: 'Sonnet 4.6',
    verbosity: 'low',
  },

  // Add the best model + highest effort possible just to see what frontier looks like now.
  // Update: Opus 4.6 max effort constantly times out.
  // { openrouterId: 'anthropic/claude-opus-4.6', label: 'Opus 4.6 max', verbosity: 'max', },
  // Update: Opus 4.6 high effort also constantly times out.
  // { openrouterId: 'anthropic/claude-opus-4.6', label: 'Opus 4.6 high', verbosity: 'high', },
  {
    openrouterId: 'anthropic/claude-opus-4.6',
    label: 'Opus 4.6 medium',
    verbosity: 'medium',
  },

  // Constantly times out.
  // { openrouterId: 'anthropic/claude-sonnet-4.6', label: 'Sonnet 4.6 medium', verbosity: 'medium', },

  {
    openrouterId: 'anthropic/claude-haiku-4.5',
    label: 'Haiku 4.5',
    verbosity: 'low',
  },

  // Scores too low, useless:
  //   [FAIL] Nvidia Nemotron 3 Super: 0.08
  // csv-rfc4180           0.00   fix: 0.00 (0.00)
  // expr-eval             0.00   fix: 0.00 (0.00)
  // css-mixin-transpiler  0.00   fix: 0.00 (0.00)
  // sudoku-solver         0.00   fix: 0.00 (0.00)
  // stak-interpreter      0.00   fix: 0.00 (0.00)
  // stak-simulation       0.50
  // { openrouterId: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nvidia Nemotron 3 Super', verbosity: 'low', },

  // Superseded by MiniMax M2.7
  // { openrouterId: 'minimax/minimax-m2.5', label: 'MiniMax M2.5', verbosity: 'low', },
  {
    openrouterId: 'minimax/minimax-m2.7',
    label: 'MiniMax M2.7',
    verbosity: 'low',
  },

  // Keeps timing out.
  // { openrouterId: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', verbosity: 'low', },
  // Keeps timing out.
  // { openrouterId: 'z-ai/glm-5', label: 'GLM 5', verbosity: 'low', },

  // Keeps timing out.
  // { openrouterId: 'qwen/qwen3.5-397b-a17b', label: 'Qwen 3.5 OSS', verbosity: 'low', },

  {
    openrouterId: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite Preview',
    verbosity: 'low',
  },
  // Keeps timing out.
  // { openrouterId: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview',
  // verbosity: 'low', },

  // OpenAI models dropped 2026-02-28. OpenAI signed a classified-network contract with the
  // Pentagon hours after Anthropic was designated a supply chain risk for refusing to allow
  // its models to be used for mass surveillance and autonomous weapons. OpenAI claims its
  // contract includes similar red lines, but the opportunistic timing (stepping in as a
  // replacement the same day a competitor was punished for holding firm) does not inspire
  // confidence in those commitments. Not spending money on their API until this shakes out.
  // { openrouterId: 'openai/gpt-5.2', label: 'GPT 5.2', verbosity: 'low', },
] as const;

//endregion Model registry
