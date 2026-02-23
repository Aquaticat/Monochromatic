/**
 * Model registry for the inference canary.
 *
 * Each model has an OpenRouter ID and per-model configuration overrides.
 * All listed models support the OpenRouter `reasoning` parameter.
 */

import type { VerbosityLevel, } from './runner.ts';

//region Model config type

/** Per-model configuration for canary probes */
export type ModelConfig = {
  /** OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6") */
  readonly id: string;
  /** Short human-readable label for reports */
  readonly label: string;
  /**
   * OpenRouter verbosity override.
   * Only Anthropic models support "max"; others should use "low" or omit.
   */
  readonly verbosity: VerbosityLevel;
};

//endregion Model config type

//region Model registry

/** All models to test in parallel */
export const models: readonly ModelConfig[] = [
  { id: 'anthropic/claude-opus-4.6', label: 'Opus 4.6', verbosity: 'low', },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Sonnet 4.6', verbosity: 'low', },
  { id: 'anthropic/claude-haiku-4.5', label: 'Haiku 4.5', verbosity: 'low', },
  { id: 'minimax/minimax-m2.5', label: 'MiniMax M2.5', verbosity: 'low', },
  { id: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', verbosity: 'low', },
  { id: 'z-ai/glm-5', label: 'GLM 5', verbosity: 'low', },
  { id: 'qwen/qwen3.5-397b-a17b', label: 'Qwen 3.5 OSS', verbosity: 'low', },
  { id: 'openai/gpt-5.2', label: 'GPT 5.2', verbosity: 'low', },
] as const;

//endregion Model registry
