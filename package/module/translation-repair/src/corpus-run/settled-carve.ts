import {
  access,
  readdir,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { readSettledArtifact, } from '../artifact-read.ts';
import {
  type CorpusPin,
  readCorpusFile,
} from '../corpus-source.ts';
import {
  prepareDocumentPair,
  type PreparedDocumentPair,
} from '../document-preparation.ts';
import { readRunJson, } from '../run-json-read.ts';
import {
  type PairingRecipe,
  recipeOf,
} from './artifact-two-lane-rebuild.ts';
import { ARTIFACTS_DIR, } from './published-tree-listing.ts';

//region Settled carve
// Carving a corpus entry the way the pass carved it when it settled.
//
// THE ONE ENTRY POINT FOR INSTRUMENTS. Every probe and census that measures
// slices used to call the bare `prepareDocumentPair` over the corpus, under a
// comment claiming "slices exactly as the lanes would see them". The lanes see
// slices the roster shell carved, and the only durable record of that carve is
// the settled artifact, so an instrument wanting the lanes' slices reads the
// artifact's recipe and rebuilds through it. An entry with no settled artifact
// has no such slicing to measure, and says so rather than substituting the
// deterministic carve under the same name.
//
// THE PIN COMES FROM THE ARTIFACT, as the rendering audit's does: the run pin
// can move, and a recipe recorded against one commit describes that commit's
// pair of documents, not whatever the pin now names.

/**
 * What the settled artifacts directory says about one entry's recipe.
 *
 * @example
 * ```ts
 * const recipe: SettledRecipe = { kind: 'unsettled', };
 * ```
 */
export type SettledRecipe = {
  /**
   * A two-lane artifact records this entry, and here is its recipe.
   */
  readonly kind: 'settled';

  /**
   * Corpus commit the artifact was settled against.
   */
  readonly corpusSha: string;

  /**
   * Pairing recipe the artifact records, with the halves it lacks named.
   */
  readonly recipe: PairingRecipe;
} | {
  /**
   * An artifact exists but predates the two-lane shape, so it records no
   * preparation and no recipe.
   */
  readonly kind: 'legacy';
} | {
  /**
   * No artifact records this entry.
   */
  readonly kind: 'unsettled';
};

/**
 * One entry carved through its settled recipe, or why it could not be.
 *
 * @example
 * ```ts
 * const carve: SettledCarve = await carveSettled({ entryId, runsDir, cloneDir, },);
 * ```
 */
export type SettledCarve = {
  /**
   * Carved through the artifact's recipe over the pair at its own commit.
   */
  readonly kind: 'settled';

  /**
   * Corpus commit the pair was read at.
   */
  readonly corpusSha: string;

  /**
   * Whole original at that commit.
   */
  readonly sourceText: string;

  /**
   * Whole translation at that commit.
   */
  readonly targetText: string;

  /**
   * Slicing the lanes saw, or the closest the recorded recipe reaches.
   */
  readonly prepared: PreparedDocumentPair;

  /**
   * Recipe that produced it, with any defaulted halves named.
   */
  readonly recipe: PairingRecipe;
} | {
  /**
   * An artifact exists but records no recipe.
   */
  readonly kind: 'legacy';
} | {
  /**
   * No artifact records this entry.
   */
  readonly kind: 'unsettled';
};

/**
 * Whether an error says the path does not exist.
 *
 * @param error - caught value
 *
 * @returns Whether it is the missing-path error, which is an ordinary answer
 * here rather than a fault
 *
 * @example
 * ```ts
 * if (isMissingPath({ error, },)) return [];
 * ```
 */
function isMissingPath({ error, }: { readonly error: unknown; },): boolean {
  if (!Error.isError(error,))
    return false;
  if (!('code' in error))
    return false;
  return error.code === 'ENOENT';
}

/**
 * Lists the entries a runs directory holds settled artifacts for.
 *
 * @param runsDir - runs directory whose `artifacts/` subdirectory is read
 *
 * @returns Entry ids in sorted order, empty when the directory has none
 *
 * @example
 * ```ts
 * const entryIds = await listSettledEntryIds({ runsDir, },);
 * ```
 */
export async function listSettledEntryIds(
  { runsDir, }: { readonly runsDir: string; },
): Promise<readonly string[]> {
  /**
   * Where a pass writes its artifacts.
   */
  const artifactsDir = join(
    runsDir,
    ARTIFACTS_DIR,
  );
  try {
    await access(artifactsDir,);
  }
  catch (error) {
    // A runs directory nothing has settled into yet has no artifacts
    // subdirectory, which is an ordinary state rather than a fault.
    if (isMissingPath({ error, },))
      return [];
    throw error;
  }
  return (await readdir(artifactsDir,))
    .filter(function isArtifact(name,): boolean {
      return name.endsWith('.json',);
    },)
    .map(function toEntryId(name,): string {
      return name.slice(
        0,
        -'.json'.length,
      );
    },)
    .toSorted();
}

/**
 * Reads the recipe one entry's settled artifact records, without touching
 * the corpus.
 *
 * @param entryId - corpus entry
 *
 * @param runsDir - runs directory holding `artifacts/<entryId>.json`
 *
 * @returns Recipe and commit, or the reason there is none
 *
 * @example
 * ```ts
 * const settled = await readSettledRecipe({ entryId, runsDir, },);
 * ```
 */
export async function readSettledRecipe(
  {
    entryId,
    runsDir,
  }: {
    readonly entryId: string;
    readonly runsDir: string;
  },
): Promise<SettledRecipe> {
  /**
   * Where this entry's artifact would sit.
   */
  const path = join(
    runsDir,
    ARTIFACTS_DIR,
    `${entryId}.json`,
  );
  try {
    await access(path,);
  }
  catch (error) {
    if (isMissingPath({ error, },))
      return { kind: 'unsettled', };
    throw error;
  }

  /**
   * Artifact as written, dispatched by generation.
   */
  const reading = readSettledArtifact({ value: await readRunJson({ path, },), },);
  if (reading.kind !== 'version-2')
    return { kind: 'legacy', };

  /**
   * Two-lane artifact, which is the generation that records a preparation.
   */
  const { artifact, } = reading;
  return {
    kind: 'settled',
    corpusSha: artifact.corpusSha,
    recipe: recipeOf({ artifact, },),
  };
}

/**
 * Carves one entry through its settled recipe over the pair at the
 * artifact's own commit.
 *
 * @param entryId - corpus entry
 *
 * @param runsDir - runs directory holding the artifact
 *
 * @param cloneDir - corpus clone the artifact's commit is read from
 *
 * @returns Slicing the lanes saw, or the reason there is none
 *
 * @example
 * ```ts
 * const carve = await carveSettled({ entryId, runsDir, cloneDir, },);
 * ```
 */
export async function carveSettled(
  {
    entryId,
    runsDir,
    cloneDir,
  }: {
    readonly entryId: string;
    readonly runsDir: string;
    readonly cloneDir: string;
  },
): Promise<SettledCarve> {
  /**
   * Recipe the artifact records, if any.
   */
  const settled = await readSettledRecipe({
    entryId,
    runsDir,
  },);
  if (settled.kind !== 'settled')
    return settled;

  /**
   * Pin taken from the artifact, so the pair read is the pair it describes.
   */
  const pin: CorpusPin = {
    cloneDir,
    commitSha: settled.corpusSha,
  };

  /**
   * Both sides at that commit.
   */
  const [sourceText, targetText,] = await Promise.all([
    readCorpusFile({
      pin,
      relPath: `people/${entryId}/page.md`,
    },),
    readCorpusFile({
      pin,
      relPath: `people/${entryId}/page.en.md`,
    },),
  ],);

  /**
   * Recipe halves to supply.
   */
  const {
    sectionPairing,
    blockPairings,
  } = settled.recipe;
  return {
    kind: 'settled',
    corpusSha: settled.corpusSha,
    sourceText,
    targetText,
    prepared: prepareDocumentPair({
      sourceText,
      targetText,
      ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
      ...((blockPairings === undefined) ? {} : { blockPairings, }),
    },),
    recipe: settled.recipe,
  };
}

/**
 * Names a recipe's completeness for a log line.
 *
 * @param recipe - recipe as read
 *
 * @returns `complete recipe`, or the halves the deterministic default stood in for
 *
 * @example
 * ```ts
 * log.info(`${entryId}: carved from its settled artifact (${recipeLabel({ recipe, },)})`,);
 * ```
 */
export function recipeLabel(
  { recipe, }: { readonly recipe: PairingRecipe; },
): string {
  /**
   * Halves the file did not record.
   */
  const { unrecorded, } = recipe;
  if (unrecorded.length === 0)
    return 'complete recipe';
  return `deterministic default for ${unrecorded.join(', ',)}`;
}

//endregion Settled carve
