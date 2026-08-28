import type { PreparedDocumentPair, } from './document-preparation.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import { parseDocument, } from './parse-document.ts';
import { collectDefinitions, } from './refine-envelope.ts';
import type { RepairModels, } from './repair-contract.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation polish configuration

/**
 * Configured final polish or supported disabled state.
 *
 * @example
 * ```ts
 * const configured = consolidationPolishConfiguration({ prepared, models, gateModelIds, });
 * ```
 */
export type ConsolidationPolishConfiguration =
  | {
    /**
     * Naturalness lane has no configured writers.
     */
    readonly kind: 'disabled';
  }
  | {
    /**
     * Naturalness lane is configured.
     */
    readonly kind: 'configured';

    /**
     * Final polish roles and document facts.
     */
    readonly config: ConsolidationPolishConfig;
  };

/**
 * Builds final body polish configuration from prepared document and run roles.
 *
 * @param prepared - shared source-target preparation
 *
 * @param models - repair role configuration carrying measured refiners
 *
 * @param gateModelIds - whole roster running final fidelity gate
 *
 * @returns Configured polish or explicit disabled state
 *
 * @example
 * ```ts
 * const configured = consolidationPolishConfiguration({ prepared, models, gateModelIds, });
 * ```
 */
export function consolidationPolishConfiguration(
  {
    prepared,
    models,
    gateModelIds,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly models: RepairModels;
    readonly gateModelIds: readonly RosterModelId[];
  },
): ConsolidationPolishConfiguration {
  /**
   * Configured naturalness writers, absent when lane is disabled.
   */
  const { refinerModelIds, } = models;
  if (refinerModelIds === undefined)
    return { kind: 'disabled', };
  return {
    kind: 'configured',
    config: {
      refinerModelIds,
      judgeModelIds: models.judgeModelIds,
      gateModelIds,
      declaredNames: prepared.declaredNames,
      definitions: collectDefinitions({
        document: parseDocument({ text: prepared.targetText, },),
      },),
    },
  };
}

//endregion Consolidation polish configuration
