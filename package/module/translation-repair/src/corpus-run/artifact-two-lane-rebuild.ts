import {
  prepareDocumentPair,
  type PreparedDocumentPair,
} from '../document-preparation.ts';
import type { BlockPair, } from '../pair-blocks-wire.ts';
import type { SectionPair, } from '../pair-sections-wire.ts';
import type { ParsedTwoLaneArtifact, } from './artifact-two-lane-read-contract.ts';

//region Preparation rebuilt from a settled artifact
// Carving a document pair the way the run that settled it carved it.
//
// WHY A REBUILD EXISTS. The pass carves through the roster shell, whose section
// round and block rounds move slices the deterministic aligner would place
// elsewhere, and the caches that held those answers retire at settlement. An
// instrument that calls the bare `prepareDocumentPair` over the corpus is
// therefore measuring a pipeline that no longer runs. The artifact records
// both halves of the pairing recipe, and this is the one place they are
// turned back into the map and list `prepareDocumentPair` consumed.
//
// A GAP IS NAMED, NOT PAPERED OVER. An artifact written before a recipe half
// existed rebuilds with the deterministic default for that half, and says so.
// Whether that default was what the run actually used is then a question the
// identity check answers: a match proves the slicing is reproduced, and a
// mismatch beside a named gap is not evidence that the slicing moved.

/**
 * One half of the pairing recipe a settled artifact may fail to record.
 *
 * @example
 * ```ts
 * const gap: RecipeHalf = 'sectionPairing';
 * ```
 */
export type RecipeHalf = 'sectionPairing' | 'blockPairing';

/**
 * The pairing recipe an artifact records, as the inputs `prepareDocumentPair`
 * consumes, beside the halves the file does not record.
 *
 * @example
 * ```ts
 * const { sectionPairing, blockPairings, unrecorded, } = recipeOf({ artifact, },);
 * ```
 */
export type PairingRecipe = {
  /**
   * Section pairing to supply, present only when the file records one as
   * supplied.
   */
  readonly sectionPairing?: readonly SectionPair[];

  /**
   * Block pairings keyed by aligned section index, present only when the file
   * records them.
   */
  readonly blockPairings?: ReadonlyMap<number, readonly BlockPair[]>;

  /**
   * Recipe halves the artifact does not record, each to be rebuilt as the
   * deterministic default; empty when the recipe is complete.
   */
  readonly unrecorded: readonly RecipeHalf[];
};

/**
 * A preparation carved from an artifact's recorded recipe, beside what the
 * recipe was missing.
 *
 * @example
 * ```ts
 * const { prepared, unrecorded, } = rebuildPreparation({ artifact, sourceText, targetText, },);
 * ```
 */
export type RebuiltPreparation = {
  /**
   * Slicing carved over the two texts with every recorded recipe half applied.
   */
  readonly prepared: PreparedDocumentPair;

  /**
   * Recipe halves the artifact does not record, each rebuilt as the
   * deterministic default; empty when the recipe is complete and the rebuild
   * is the run's own carve.
   */
  readonly unrecorded: readonly RecipeHalf[];
};

/**
 * Turns a recorded section decider back into the list preparation consumed.
 *
 * @param artifact - parsed artifact
 *
 * @returns Pairs to supply, in a one-element list, or nothing when the
 * deterministic aligner decided or the file does not say
 *
 * @example
 * ```ts
 * const [sectionPairing,] = sectionPairingOf({ artifact, },);
 * ```
 */
function sectionPairingOf(
  { artifact, }: { readonly artifact: ParsedTwoLaneArtifact; },
): readonly (readonly SectionPair[])[] {
  /**
   * What the artifact says about its sections.
   */
  const { sectionPairing, } = artifact.preparation;
  if (sectionPairing.kind !== 'supplied')
    return [];
  return [
    sectionPairing.pairs
      .map(function live(pair,): SectionPair {
        return {
          source: pair.source,
          target: pair.target,
        };
      },),
  ];
}

/**
 * Turns a recorded block pairing back into the map preparation consumed.
 *
 * @param artifact - parsed artifact
 *
 * @returns Map keyed by aligned section index, in a one-element list, or
 * nothing when the file records no block pairing
 *
 * @example
 * ```ts
 * const [blockPairings,] = blockPairingsOf({ artifact, },);
 * ```
 */
function blockPairingsOf(
  { artifact, }: { readonly artifact: ParsedTwoLaneArtifact; },
): readonly ReadonlyMap<number, readonly BlockPair[]>[] {
  /**
   * What the artifact says about its blocks.
   */
  const { blockPairing, } = artifact.preparation;
  if (blockPairing.kind !== 'stored')
    return [];
  return [
    new Map(blockPairing.sections
      .map(function entry(section,): readonly [
        number,
        readonly BlockPair[],
      ] {
        return [
          section.sectionIndex,
          section.pairs
            .map(function live(pair,): BlockPair {
              return {
                source: pair.source,
                target: pair.target,
              };
            },),
        ];
      },),),
  ];
}

/**
 * Reads the pairing recipe an artifact records, as preparation inputs.
 *
 * SEPARATE FROM THE REBUILD because the slice census walks alignment and
 * subdivision itself, for its section-level accounting, and needs the recipe
 * pieces rather than a finished preparation.
 *
 * @param artifact - parsed artifact naming the recipe
 *
 * @returns Recipe halves the file records, and the names of those it lacks
 *
 * @example
 * ```ts
 * const recipe = recipeOf({ artifact, },);
 * ```
 */
export function recipeOf(
  { artifact, }: { readonly artifact: ParsedTwoLaneArtifact; },
): PairingRecipe {
  /**
   * Section pairing to supply, when one was recorded as supplied.
   */
  const [sectionPairing,] = sectionPairingOf({ artifact, },);

  /**
   * Block pairings to supply, when the file records them.
   */
  const [blockPairings,] = blockPairingsOf({ artifact, },);

  /**
   * Halves the file does not say anything about.
   */
  const unrecorded: RecipeHalf[] = [];

  /**
   * What the artifact says about both halves, read once for the gap list.
   */
  const {
    sectionPairing: recordedSections,
    blockPairing: recordedBlocks,
  } = artifact.preparation;
  if (recordedSections.kind === 'unrecorded')
    unrecorded.push('sectionPairing',);
  if (recordedBlocks.kind === 'unrecorded')
    unrecorded.push('blockPairing',);
  return {
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
    ...((blockPairings === undefined) ? {} : { blockPairings, }),
    unrecorded,
  };
}

/**
 * Carves a document pair with the recipe a settled artifact records.
 *
 * @param artifact - parsed artifact naming the recipe
 *
 * @param sourceText - whole original, as read at the artifact's own commit
 *
 * @param targetText - whole translation, likewise
 *
 * @returns Preparation and the recipe halves that had to be defaulted
 *
 * @example
 * ```ts
 * const rebuilt = rebuildPreparation({ artifact, sourceText, targetText, },);
 * ```
 */
export function rebuildPreparation(
  {
    artifact,
    sourceText,
    targetText,
  }: {
    readonly artifact: ParsedTwoLaneArtifact;
    readonly sourceText: string;
    readonly targetText: string;
  },
): RebuiltPreparation {
  /**
   * Recipe the file records, and what it lacks.
   */
  const {
    sectionPairing,
    blockPairings,
    unrecorded,
  } = recipeOf({ artifact, },);
  return {
    prepared: prepareDocumentPair({
      sourceText,
      targetText,
      ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
      ...((blockPairings === undefined) ? {} : { blockPairings, }),
    },),
    unrecorded,
  };
}

//endregion Preparation rebuilt from a settled artifact
