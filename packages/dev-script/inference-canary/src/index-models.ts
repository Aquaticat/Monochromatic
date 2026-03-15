/**
 * Model selection for the inference canary CLI.
 *
 * Resolves which models to test based on the `--model` flag, supporting both
 * known model labels and arbitrary OpenRouter model IDs.
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
 */
export function selectModels(): readonly ModelConfig[] {
  if (modelOverride !== undefined) {
    const found = models.find(function matchModel(model,): boolean {
      return model.openrouterId === modelOverride || model.label === modelOverride;
    },);
    if (found !== undefined)
      return [found,];
    if (!modelOverride.includes('/',)) {
      throw new Error(
        `Invalid model ID "${modelOverride}": must be in "provider/name" format`,
      );
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- includes('/') ensures provider/model format
    const modelId = modelOverride as `${string}/${string}`;
    return [{ openrouterId: modelId, label: modelId, verbosity: 'low', },];
  }
  return models;
}
