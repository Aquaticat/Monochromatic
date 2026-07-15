/**
 * Model selection for the inference canary CLI.
 *
 * Resolves which models to test based on the `--model` flag.
 * Only registered model labels are accepted; ad-hoc OpenRouter IDs are not
 * supported because they bypass per-model configuration (verbosity, label).
 * Matching by `openrouterId` within the registry is intentionally not
 * supported because multiple models can share the same `openrouterId`
 * with different settings (e.g. "Opus 4.6" vs "Opus 4.6 medium").
 */
import { modelOverride, } from './index-cli.ts';
import {
  type ModelConfig,
  models,
} from './models.ts';

/**
 * Determines which models to test based on CLI flags.
 *
 * @returns models to test
 *
 * @throws when `--model` value matches no registered label
 *
 * @example
 * ```bash
 * inference-canary --model "Opus 4.6 medium"
 * ```
 */
export function selectModels(): readonly ModelConfig[] {
  if (modelOverride === '')
    return models;

  /**
   * Registered model whose `label` matches the override; undefined when the override matches none.
   */
  const byLabel = models.find(function matchLabel(model,): boolean {
    return model.label
      === modelOverride;
  },);
  if (byLabel !== undefined)
    return [byLabel,];

  /**
   * Indented list of every registered label; embedded into the error so the user sees the valid options.
   */
  const availableLabels = models
    .map(function getLabel(model,): string {
      return `  - ${model.label}`;
    },)
    .join('\n',);

  throw new Error(
    `Unknown model "${modelOverride}". Available models:\n${availableLabels}`,
  );
}
