import { textsInCodePointOrder, } from '../code-points.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import {
  type BundleMaps,
  requireMapFor,
} from './coverage-bundle-maps.ts';
import type { UnloadedSource, } from './coverage-census-print.ts';
import {
  type CensusStretch,
  censusStretchesOf,
  requirePlacedFunctions,
} from './coverage-census-report.ts';
import {
  readBundle,
  unloadedSourcesOf,
} from './coverage-census-steps.ts';
import {
  type BundleLines,
  mapFunction,
  type MappedFunction,
} from './coverage-lines.ts';
import { mapStretch, } from './coverage-pieces.ts';
import type { CoverageTally, } from './coverage-tally.ts';

//region Coverage census placement
// Ledger T8: the census's reading of a painted tally against the build, split
// from the entry (`coverage-census.ts`) at its line budget: each cold stretch
// and uncalled function placed on its source lines through the bundle maps,
// the sources the loaded bundles carry, and the bundles no test loaded with
// the sources only they carry. A bundle with no map is read only where code
// must be placed in it, and refused by name there (`coverage-bundle-maps.ts`).

/**
 A painted tally placed on source lines.
 */
export type PlacedTally = {
  /**
   Cold stretches as the census records them, one per piece.
   */
  readonly stretches: readonly CensusStretch[];

  /**
   Uncalled functions with their lines.
   */
  readonly uncalled: readonly MappedFunction[];

  /**
   Sources the loaded bundles carry.
   */
  readonly loadedSources: ReadonlySet<string>;

  /**
   Bundles no process loaded, sorted.
   */
  readonly unloadedBundles: readonly string[];

  /**
   Sources only those bundles carry, with their physical lines.
   */
  readonly unloadedSources: readonly UnloadedSource[];
};

/**
 Places a painted tally on source lines through the build's maps.

 @param packageDirectory - package directory the sources are named from

 @param distDirectory - build directory

 @param bundleMaps - bundles the build holds, split by whether a map stands
 beside each

 @param tally - painted tally

 @param entryFiles - sources the build names as runner entries

 @returns The stretches, uncalled functions and sources, placed

 @throws StatedRefusalError where the coverage names a bundle the build
 does not hold, finds code no test ran in a bundle with no map, or finds a
 bundle no test loaded that has no map to say which sources it carries, or
 where the census places an uncalled function outside its own source's
 stretches

 @example
 ```ts
 const placed = await placeTally({ packageDirectory, distDirectory, bundleMaps, tally, entryFiles, },);
 ```
 */
export async function placeTally(
  {
    packageDirectory,
    distDirectory,
    bundleMaps,
    tally,
    entryFiles,
  }: {
    readonly packageDirectory: string;
    readonly distDirectory: string;
    readonly bundleMaps: BundleMaps;
    readonly tally: CoverageTally;
    readonly entryFiles: ReadonlySet<string>;
  },
): Promise<PlacedTally> {
  /**
   Bundles with a map, which the census reads, and those without.
   */
  const {
    mapped,
    unmapped,
  } = bundleMaps;
  /**
   Every mapped bundle's lines and sources, by name.
   */
  const read = new Map(
    await Promise.all(mapped.map(async function readOne(bundle,) {
    return [
      bundle,
      await readBundle({
        distDirectory,
        packageDirectory,
        bundle,
      },),
    ] as const;
  },),),
  );
  /**
   Bundles some process loaded.
   */
  const loaded = new Set(tally.loadedBundles(),);
  /**
   Lines of a loaded bundle.

   @param bundle - bundle the coverage names

   @returns Its positions and map
   */
  function linesOf(bundle: string,): BundleLines {
    /**
     Its reading.
     */
    const reading = read.get(bundle,);
    requireMapFor({
      bundle,
      need: 'cold-code',
      unmapped,
      distDirectory,
    },);
    if (reading === undefined)
      throw new StatedRefusalError({ says: `coverage names ${bundle}, which ${distDirectory} does not hold; rebuild and run again`, },);
    return reading.lines;
  }
  /**
   Cold stretches as the census records them, one per piece.
   */
  const stretches = tally.coldStretches()
    .flatMap(function recorded(stretch,) {
    return censusStretchesOf({
      stretch: mapStretch({
        lines: linesOf(stretch.bundle,),
        stretch,
      },),
    },);
  },);
  /**
   Uncalled functions with their lines.
   */
  const uncalled = tally.uncalledFunctions()
    .map(function placed(fn,) {
    return mapFunction({
      lines: linesOf(fn.bundle,),
      uncalled: fn,
    },);
  },);
  requirePlacedFunctions({
    stretches,
    uncalled,
  },);
  /**
   Sources the loaded bundles carry.
   */
  const loadedSources = new Set([...read,].flatMap(function carried([bundle, reading,],): readonly string[] {
    return loaded.has(bundle,) ? reading.sources : [];
  },),);
  /**
   Bundles no process loaded.
   */
  const unloadedBundles = textsInCodePointOrder({ texts: [
    ...mapped,
    ...unmapped,
  ]
    .filter(function unloaded(bundle,): boolean {
      return !loaded.has(bundle,);
    },), },);
  for (const bundle of unloadedBundles) {
    requireMapFor({
      bundle,
      need: 'unloaded-sources',
      unmapped,
      distDirectory,
    },);
  }
  return {
    stretches,
    uncalled,
    loadedSources,
    unloadedBundles,
    unloadedSources: await unloadedSourcesOf({
      packageDirectory,
      // Every unloaded bundle has a map by now, so the mapped readings hold
      // each one's sources.
      carried: [...read,].flatMap(function carried([bundle, reading,],): readonly string[] {
        return loaded.has(bundle,) ? [] : reading.sources;
      },),
      loadedSources,
      entryFiles,
    },),
  };
}

//endregion Coverage census placement
