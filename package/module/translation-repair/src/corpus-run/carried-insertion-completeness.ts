import type { ChunkPair, } from '../chunk-document.ts';
import type { CarriedInsertion, } from '../insertion-admission.ts';
import { spliceSlices, } from '../splice-slices.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';
import { shippableReplacements, } from './publish-fixed.ts';
import type { WouldShipSource, } from './would-ship-text.ts';

//region Carried insertion completeness

/**
 * Verifies final would-ship page retains exact regions proving carried passages.
 *
 * @param artifact - final stage decisions used for publication
 *
 * @param slices - preparation defining replacement spans
 *
 * @param targetText - archive text replacement spans address
 *
 * @param carried - source-only passages proven rendered elsewhere before lanes
 *
 * @throws {@link TranslationRepairInterruptedError} when final stages remove
 * any region supporting carried-complete decision
 *
 * @example
 * ```ts
 * assertCarriedInsertionsRemain({ artifact, slices, targetText, carried: [], });
 * ```
 */
export function assertCarriedInsertionsRemain(
  {
    artifact,
    slices,
    targetText,
    carried,
  }: {
    readonly artifact: WouldShipSource;
    readonly slices: readonly ChunkPair[];
    readonly targetText: string;
    readonly carried: readonly CarriedInsertion[];
  },
): void {
  if (carried.length === 0)
    return;
  /**
   * Exact page final stage decisions would publish.
   */
  const finalText = spliceSlices({
    targetText,
    slices,
    replacements: shippableReplacements({ artifact, },),
  },);
  /**
   * Carried passages whose every anchored region did not survive exactly.
   */
  const lost = carried.filter(function lostEvidence(candidate,): boolean {
    /**
     * Count of anchored regions admission supplied.
     */
    const evidenceCount = candidate
      .evidence
      .length;
    /**
     * Whether admission supplied no anchored region at all.
     */
    const hasNoEvidence = evidenceCount === 0;
    /**
     * Whether final text no longer contains one admitted region.
     */
    const missesRegion = candidate
      .evidence
      .some(function regionMissing(region,): boolean {
        return !finalText.includes(region,);
      },);
    return hasNoEvidence || missesRegion;
  },);
  if (lost.length === 0)
    return;
  throw new TranslationRepairInterruptedError({
    reason: 'carried-evidence-lost',
    findings: [`carried-insertion-evidence-lost (count ${String(lost.length,)})`,],
  },);
}

//endregion Carried insertion completeness
