import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Pairing electorate integrity
// An ordered subsequence proves that every recorded outcome belongs to one distinct configured seat.

/**
 * Configuration or recorded-seat identity cannot represent independent pairing evidence.
 * Unlike a model's unusable block indexes, this failure aborts interpretation or dispatch.
 *
 * @example
 * ```ts
 * throw new PairingEvidenceError({ detail: 'configured electorate is empty' });
 * ```
 */
export class PairingEvidenceError extends Error {
  /** Stable operation name for safe diagnostics. */
  public override readonly name = 'PairingEvidenceError';

  /**
   * Names the input that cannot establish independent seats.
   *
   * @param detail - failed configuration or recorded-seat invariant
   * @example
   * ```ts
   * const error = new PairingEvidenceError({ detail: 'configured electorate repeats a model' });
   * ```
   */
  public constructor({ detail, }: { readonly detail: string; },) {
    super(`pairing evidence: ${detail}`,);
  }
}

/**
 * Refuses invalid electorates and recorded identities before they become calls or endorsements.
 * Empty recorded outcomes and sparse ordered subsets are valid; skipped seats are not invented.
 * A single configured identity is allowed but cannot satisfy the separate two-voice relation rule.
 *
 * @param modelIds - configured electorate in its original order
 * @param askedModelIds - final recorded seat identities, omitted before live dispatch
 * @param l - caller logger preserving operation identity
 * @throws PairingEvidenceError when the electorate is empty or duplicated, or outcomes are not an ordered subset
 * @example
 * ```ts
 * assertPairingSeats({ modelIds, askedModelIds: outcomes.map(outcome => outcome.modelId), l });
 * ```
 */
export function assertPairingSeats(
  {
    modelIds,
    askedModelIds = [],
    l,
  }: {
    readonly modelIds: readonly RosterModelId[];
    readonly askedModelIds?: readonly RosterModelId[];
    readonly l: Logger;
  },
): void {
  /** Logger for identity validation rather than wire interpretation. */
  const pl = tagged({ tag: assertPairingSeats.name, l, },);
  pl.debug(`validating ${String(modelIds.length,)} configured and ${String(askedModelIds.length,)} recorded pairing identities`,);
  if (modelIds.length === 0)
    throw new PairingEvidenceError({ detail: 'configured modelIds is empty; retain the electorate used by the pairing stage', },);
  /** Configured positions also expose duplicated electorate identities through cardinality. */
  const positions = new Map(modelIds.map(function indexed(modelId, index): readonly [RosterModelId, number] {
    return [modelId, index,];
  },),);
  if (positions.size !== modelIds.length)
    throw new PairingEvidenceError({ detail: 'configured modelIds repeats an identity; each model must hold exactly one configured seat', },);
  /** Position preceding the first configured seat. */
  let previous = -1;
  for (const [index, modelId,] of askedModelIds.entries()) {
    /** Missing members cannot advance from the initial or any later configured position. */
    const position = positions.get(modelId,) ?? -1;
    if (position <= previous)
      throw new PairingEvidenceError({
        detail: `askedModelIds[${String(index,)}] (${modelId}) is not a unique ordered member of configured modelIds; retain only actual final seat outcomes in configured order`,
      },);
    previous = position;
  }
}

//endregion Pairing electorate integrity
