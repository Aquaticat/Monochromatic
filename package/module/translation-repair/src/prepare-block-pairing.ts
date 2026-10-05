import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { blockPairingQuestion, } from './block-pairing-question.ts';
import type { PairedReading, } from './image-reading-pair.ts';
import { pairingPictureContext, } from './pairing-pictures.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { wordForCount, } from './count-word.ts';
import {
  pairBlocksWithRoster,
  type PairedSectionRecord,
} from './pair-blocks-stage.ts';
import {
  assertPairsNameBlocks,
  type BlockPairingError,
  requireBlockPairingRefusal,
} from './pair-blocks-wire.ts';
import { claimMediaAdjacentTargets, } from './pair-media-adjacency.ts';
import { finishPreparedBlockPairing, } from './prepare-block-pairing-finish.ts';
import type { PreparedBlockPairing, } from './prepare-block-pairing-model.ts';
import { queriedBlockPairingDetails, } from './queried-block-pairing-details.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import type { ContainerSpan, } from './unwrap-container.ts';

//region One indexed parent through existing block preparation
// One aligned section's pairing: settled by structure, resumed from the cache, or asked of the roster.
//
// A CACHED PAIRING IS READ AGAINST THE BLOCKS BEFORE ANYTHING USES IT. The
// cache reader checks a record's shape only (`isPairList`), and the key names
// the blocks' text, so a record that names a block its section lacks was not
// written by this pipeline for this question: a damaged or hand-edited file.
// It is a miss, said on a warning, and the section is bought again; used as
// it stood, it reached the media and definition readers, which stopped the
// run with a missing-value error naming nothing.

/**
 The refusal of a cached pairing read against the section's blocks, or
 nothing when every pair names a block the section carries.

 @param pairs - pairs the cached record holds

 @param sourceCount - original blocks of the section

 @param targetCount - translation blocks of the section

 @returns The refusal in a one-element list, or an empty list when the
 record fits

 @throws The caught value unchanged when the check fails other than by
 refusing the pairing

 @example
 ```ts
 const [misfit,] = cachedPairingMisfit({ pairs: cached.pairs, sourceCount: 2, targetCount: 2, },);
 ```
 */
function cachedPairingMisfit(
  {
    pairs,
    sourceCount,
    targetCount,
  }: {
    readonly pairs: PairedSectionRecord['pairs'];
    readonly sourceCount: number;
    readonly targetCount: number;
  },
): readonly BlockPairingError[] {
  try {
    assertPairsNameBlocks({
      pairs,
      sourceCount,
      targetCount,
    },);
    return [];
  }
  catch (error) {
    return [requireBlockPairingRefusal({ error, },),];
  }
}

/**
 Prepares one already-aligned parent without buying unrelated section or block questions.
 Singletons and empty sides retain their zero-call paths.
 A cached section reuses its stored relations and findings without asking again.
 A cached record that names a block the section lacks is a miss: a warning
 says so in the refusal's words, and the roster is asked as for a section
 never cached.

 @param client - existing production model client

 @param modelIds - configured preparation electorate, unchanged by this operation

 @param pair - complete aligned source and target parent

 @param pairIndex - original alignment index used for findings and map identity

 @param targetContainers - complete target parser containers for media-adjacency ownership

 @param signal - caller cancellation

 @param exchangeTimeoutMs - existing per-call ceiling

 @param l - caller logger preserving entry identity

 @param pairingCache - existing versioned block cache, absent for an uncached probe

 @returns Explicit slicer pairing or the existing implicit, empty or fallback state

 @throws Error when acquisition, cancellation or cache persistence fails unexpectedly

 @example
 ```ts
 const result = await prepareBlockPairing({ client, modelIds, pair, pairIndex: 2, targetContainers, signal, exchangeTimeoutMs, l });
 ```
 */
export async function prepareBlockPairing(
  {
    client,
    modelIds,
    pair,
    pairIndex,
    targetContainers,
    signal,
    exchangeTimeoutMs,
    l,
    pairingCache,
    pictureReadings,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly pair: ChunkPair;
    readonly pairIndex: number;
    readonly targetContainers: readonly ContainerSpan[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly pairingCache?: SliceCache<PairedSectionRecord>;
    readonly pictureReadings?: ReadonlyMap<string, PairedReading>;
  }>,
): Promise<PreparedBlockPairing> {
  /**
   Logger naming this parent's shared preparation operation.
   */
  const pl = tagged({
    tag: prepareBlockPairing.name,
    l,
  },);
  /**
   Parsed source blocks whose local indexes the question uses.
   */
  const sourceNodes = pair.source
    .nodes;
  /**
   Parsed incumbent blocks under the same local-index convention.
   */
  const targetNodes = pair.target
    .nodes;
  if ((sourceNodes.length === 0) || (targetNodes.length === 0)) {
    pl.debug(`section ${String(pairIndex,)} has an empty side; no pairing question`,);
    return {
      kind: 'empty',
      findings: [],
      definitionPairs: [],
    };
  }
  if ((sourceNodes.length < 2) && (targetNodes.length < 2)) {
    pl.debug(`section ${String(pairIndex,)} is a structural singleton; no pairing question`,);
    return {
      kind: 'implicit',
      findings: [],
      definitionPairs: [],
    };
  }
  /**
   What the sheet is shown about this section's pictures, empty when nobody
   read any (class thirty-four).
   */
  const pictureContext = (pictureReadings === undefined)
    ? ''
    : pairingPictureContext({
      pair,
      pictureReadings,
    },);
  if (pictureContext !== '')
    pl.info(`section ${String(pairIndex,)} pairs with ${String(pictureContext.length,)} ${
      wordForCount({
        count: pictureContext.length,
        one: 'character',
        many: 'characters',
      },)
    } of picture transcript in the sheet`,);
  /**
   Shared current numbering, definition exemptions and unchanged cache identity.
   */
  const {
    sourceBlocks,
    targetBlocks,
    freeOrder,
    key,
  } = blockPairingQuestion({
    pair,
    pictureContext,
    modelIds,
  },);
  /**
   Relations and findings a past round stored under this question's key.
   */
  const cached = pairingCache?.resumed
    .get(key,);
  /**
   Why the cached record does not fit this section's blocks, absent when it
   fits or nothing was cached.
   */
  const [misfit,] = (cached === undefined)
    ? []
    : cachedPairingMisfit({
      pairs: cached.pairs,
      sourceCount: sourceNodes.length,
      targetCount: targetNodes.length,
    },);
  if (misfit !== undefined)
    pl.warn(`section ${String(pairIndex,)} misses the block-pairing cache: the record under ${key} does not fit its `
      + `blocks (${misfit.message}), so the roster is asked again`,);
  if ((cached !== undefined) && (misfit === undefined)) {
    pl.debug(`section ${String(pairIndex,)} resumes block pairing ${key}`,);
    /**
     Current media ownership applied to the cached relations, as on the cold path.
     */
    const media = claimMediaAdjacentTargets({
      pairs: cached.pairs,
      sourceBlocks: sourceNodes,
      targetBlocks: targetNodes,
      targetContainers,
    },);
    return finishPreparedBlockPairing({
      pairs: media.pairs,
      findings: [
        ...cached.findings,
        ...media.findings
          .map(function prefix(finding,): string {
        return `block-pairing ${finding}`;
      },),
      ],
      pair,
      pairIndex,
      l: pl,
    },);
  }
  /**
   What the roster agreed on when asked now.
   */
  const outcome = await pairBlocksWithRoster({
    client,
    modelIds,
    sourceBlocks,
    targetBlocks,
    pictureContext,
    freeOrder,
    signal,
    exchangeTimeoutMs,
    l: pl,
  },);
  /**
   Shared normalization retains the exact findings and cache gate before persistence.
   */
  const {
    pairs,
    findings,
    canPersistPairing,
  } = queriedBlockPairingDetails({
    outcome,
    pair,
    pairIndex,
    targetContainers,
  },);
  // Persistence precedes definition separation, preserving the historical cache's relabel evidence.
  if ((outcome.usable > 0) && canPersistPairing)
    await pairingCache?.persist({
      key,
      serialized: JSON.stringify({
        pairs,
        findings,
      },),
    },);
  return finishPreparedBlockPairing({
    pairs,
    findings,
    pair,
    pairIndex,
    l: pl,
  },);
}

//endregion One indexed parent through existing block preparation
