import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { prepareDocumentPair, } from './document-preparation.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';
import type { RepairTranslationResult, } from './repair-result.ts';
import { repairPreparedDocument, } from './repair-translation.ts';
import type { SliceCache, } from './slice-cache.ts';
import { SLICE_CHAR_BUDGET, } from './slice-pair.ts';

//region Repair entry
// The text-in entry point for the repair lane, kept apart from the driver it
// delegates to.
//
// SPLIT OUT rather than shrunk: `repair-translation.ts` reached its 300 line
// budget, and the two halves divide on a real boundary. This one takes two
// documents and decides how to slice them; the driver takes slices already
// decided and runs the roster over them. A caller running BOTH lanes must not
// come through here, because preparing twice is how the lanes come to disagree
// about what a slice is.

/**
 * Repairs one translation against its original, preparing the pair first.
 *
 * The entry point for a caller running the repair lane ALONE. A caller running
 * both lanes prepares once and calls {@link repairPreparedDocument} directly,
 * so the two lanes cannot disagree about what a slice is.
 *
 * @param client - injected model client
 *
 * @param sourceText - original document, front matter included
 *
 * @param targetText - translation under repair, front matter included
 *
 * @param models - role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sliceCharBudget - target-side characters one paragraph-bound
 * slice aims for; defaults to {@link SLICE_CHAR_BUDGET}
 *
 * @param sliceCache - optional cross-run cache; resumes finished slices
 * and persists newly finished ones so a large document survives aborts
 *
 * @returns Repaired candidate plus adjudicated issues and completion status
 *
 * @example
 * ```ts
 * const result = await repairTranslation({
 *   client,
 *   sourceText,
 *   targetText,
 *   models,
 *   signal,
 * },);
 * ```
 */
export async function repairTranslation(
  {
    client,
    sourceText,
    targetText,
    models,
    adjudicationConfig,
    signal,
    perCallTimeoutMs,
    sliceCharBudget = SLICE_CHAR_BUDGET,
    sliceCache,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly sourceText: string;
    readonly targetText: string;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
    readonly sliceCharBudget?: number;
    readonly sliceCache?: SliceCache<ChunkRepairOutcome>;
  }>,
): Promise<RepairTranslationResult> {
  return await repairPreparedDocument({
    client,
    prepared: prepareDocumentPair({
      sourceText,
      targetText,
      sliceCharBudget,
    },),
    models,
    ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
    signal,
    ...(perCallTimeoutMs === undefined ? {} : { perCallTimeoutMs, }),
    ...(sliceCache === undefined ? {} : { sliceCache, }),
  },);
}

//endregion Repair entry
