import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ChunkPair, } from './chunk-document.ts';
import { assertPairingSeats, } from './pair-blocks-evidence-identity.ts';
import type { PreparedBlockPairing, } from './prepare-block-pairing-model.ts';
import { PreparationQualificationError, } from './preparation-qualification-error.ts';
import type { QualifiedBlockPairing, } from './qualified-block-pairing-model.ts';
import { qualifyQueriedBlockPairing, } from './qualify-queried-block-pairing.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import type { ContainerSpan, } from './unwrap-container.ts';

//region Calibration preparation qualification
// Production keeps its existing fallback and cache rules; only a reviewed calibration recipe needs this certificate.

/**
 * Verifies one current production preparation result without buying or replacing any question.
 * Empty and singleton dispatch remain explicit zero-question states, not invented semantic votes.
 * Queried parents need the configured usable quorum and the existing independently endorsed relations.
 * Current full-document reconstruction and acquisition provenance belong to the owning recipe.
 *
 * @param pair - complete current parser-owned parent, never unchecked serialized nodes
 *
 * @param prepared - result returned by the shared production preparation
 *
 * @param modelIds - frozen configured electorate, not the heard subset
 *
 * @param targetContainers - complete current target parser's ownership spans
 *
 * @param l - caller logger retaining entry and parent identity
 *
 * @returns Owned replay evidence without changing production placement policy
 *
 * @throws PreparationQualificationError when the parent needs unqualified fallback or inconsistent evidence
 *
 * @throws Error when existing identity, wire or structural ownership validation fails
 *
 * @example
 * ```ts
 * const prepared = await prepareBlockPairing(input);
 * const qualified = qualifyPreparedBlockPairing({ ...input, prepared });
 * ```
 */
export function qualifyPreparedBlockPairing({ pair, prepared, modelIds, targetContainers, l, }: {
  readonly pair: ChunkPair;
  readonly prepared: PreparedBlockPairing;
  readonly modelIds: readonly RosterModelId[];
  readonly targetContainers: readonly ContainerSpan[];
  readonly l: Logger;
},): QualifiedBlockPairing {
  /** Logger keeps qualification separate from acquisition and production fallback. */
  const pl = tagged({ tag: qualifyPreparedBlockPairing.name, l, },);
  assertPairingSeats({ modelIds, l: pl, },);
  /** Existing production empty-side dispatch takes precedence over singleton dispatch. */
  const empty = (pair.source.nodes.length === 0) || (pair.target.nodes.length === 0);
  /** Both sides must be nonempty singletons to avoid a question on this path. */
  const singleton = (pair.source.nodes.length === 1) && (pair.target.nodes.length === 1);
  if ((prepared.kind === 'empty') || (prepared.kind === 'implicit')) {
    if ((prepared.kind !== (empty ? 'empty' : 'implicit'))
      || (!empty && !singleton)
      || (prepared.findings.length !== 0)
      || (prepared.definitionPairs.length !== 0)
      || ('evidence' in prepared))
      throw new PreparationQualificationError({ kind: 'fast-path', },);
    pl.debug(`retaining ${prepared.kind} production dispatch without model endorsement`,);
    return structuredClone({ kind: prepared.kind, prepared, },);
  }
  if (empty || singleton)
    throw new PreparationQualificationError({ kind: 'fast-path', },);
  return qualifyQueriedBlockPairing({ pair, prepared, modelIds, targetContainers, l: pl, },);
}

//endregion Calibration preparation qualification
