import type { CorpusPin, } from './corpus-source.ts';
import { readCorpusFile, } from './corpus-source.ts';
import { buildReviewedFidelityReference, } from './fidelity-reference-build.ts';
import { FidelityReferenceError, } from './fidelity-reference-error.ts';
import { REVIEWED_FIDELITY_REFERENCES, } from './fidelity-reference-manifest.ts';
import type {
  FidelityReferenceSpec,
  ReviewedFidelityReference,
} from './fidelity-reference-model.ts';
import { selectReviewedFidelitySpecs, } from './fidelity-reference-select.ts';
import { mapOverlapped, } from './overlapped-map.ts';

//region Pinned reviewed-reference acquisition
// Calibration owns a fixed reviewed manifest, not an opportunistic first-long-archive selection.

/**
 * Reads reviewed reference inputs from their immutable corpus pin.
 * Custom manifests are explicit caller-owned review evidence; this loader proves byte identity,
 * not semantic correctness of arbitrary supplied prose.
 *
 * @param pin - local clone and immutable review revision
 *
 * @param specs - reviewed manifest, defaulting to the checked-in source-reviewed set
 *
 * @param onlyEntryIds - optional filter that may name only reviewed entries
 *
 * @param signal - caller cancellation
 *
 * @returns References in manifest order with all reviewed variants verified
 *
 * @throws {@link FidelityReferenceError} for unreviewed filters, pin drift or invalid metadata
 *
 * @throws {@link CorpusReadError} when a pinned file is unavailable
 *
 * @example
 * ```ts
 * const references = await readReviewedFidelityReferences({ pin });
 * ```
 */
export async function readReviewedFidelityReferences({ pin, specs = REVIEWED_FIDELITY_REFERENCES,
  onlyEntryIds = [], signal, }: {
  readonly pin: CorpusPin;
  readonly specs?: readonly FidelityReferenceSpec[];
  readonly onlyEntryIds?: readonly string[];
  readonly signal?: AbortSignal;
},): Promise<readonly ReviewedFidelityReference[]> {
  signal?.throwIfAborted();
  /**
   * Own and validate metadata selection before any pinned-file reads.
   */
  const selected = selectReviewedFidelitySpecs({ specs, onlyEntryIds, },);
  /**
   * Pin fields cannot be redirected while the reads are in flight.
   */
  const fixedPin = { ...pin, };
  return await mapOverlapped({
    items: selected,
    overlap: 1,
    oneItem: async function readReference({ item: spec, },): Promise<ReviewedFidelityReference> {
      signal?.throwIfAborted();
      if (fixedPin.commitSha !== spec.corpusSha)
        throw new FidelityReferenceError({ referenceId: spec.id, operation: 'pin', },);
      if (spec.entryId === '' || spec.entryId === '.' || spec.entryId === '..'
        || spec.entryId.includes('/',) || spec.entryId.includes('\\',) || spec.entryId.includes('\0',)) {
        throw new FidelityReferenceError({ referenceId: spec.id, operation: 'request', },);
      }
      /**
       * Both files use the same intrinsic, no-fetch corpus read boundary.
       */
      const [sourceFile, archiveFile,] = await Promise.all([
        readCorpusFile({ pin: fixedPin, relPath: `people/${spec.entryId}/page.md`, },),
        readCorpusFile({ pin: fixedPin, relPath: `people/${spec.entryId}/page.en.md`, },),
      ],);
      signal?.throwIfAborted();
      return buildReviewedFidelityReference({ sourceFile, archiveFile, spec, },);
    },
  },);
}

//endregion Pinned reviewed-reference acquisition
