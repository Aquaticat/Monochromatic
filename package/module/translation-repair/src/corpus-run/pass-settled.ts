import { readdirArtifacts, } from './artifact-placement.ts';

//region Pass settled
// What the SCHEDULER counts as already done, read the same way the census reads
// it.
//
// These two answers had drifted apart, and the drift was invisible in both
// directions. The scheduler took any `*.json` NAME, so a directory or a symlink
// called `Mittens.json` marked Mittens settled and the entry was never run
// again; the census skips non-regular files, so no guard ever reported it. The
// entry silently ceased to exist, exactly as an unplaceable artifact does,
// without even an unplaceable artifact to name.
//
// Split from `corpus-pass.ts` at its line cap, and this is the seam worth
// splitting on: the scheduler asks a different question from every rate-
// producing reader, sees every generation on purpose, and now shares one
// listing with the reader that judges those files.

/**
 * Whether a directory entry name is one of our artifact files.
 *
 * Applied to names already known to be REGULAR FILES, since the listing filters
 * directory entries by type first.
 *
 * @param name - regular file name
 *
 * @returns True for `*.json` artifacts
 *
 * @example
 * ```ts
 * const artifacts = names.filter(isArtifactFile,);
 * ```
 */
function isArtifactFile(name: string,): boolean {
  return name.endsWith('.json',);
}

/**
 * Artifact file names a directory actually holds as regular files.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Artifact names, unsorted
 *
 * @example
 * ```ts
 * const names = await settledArtifactNames({ artifactsDir, },);
 * ```
 */
async function settledArtifactNames(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<readonly string[]> {
  return (await readdirArtifacts({ artifactsDir, },))
    .filter(isArtifactFile,);
}

/**
 * Entry ids this directory already carries an artifact for.
 *
 * Unfiltered by generation ON PURPOSE. A scheduler that skipped entries settled
 * by another pipeline would re-run them into the same directory and mix
 * generations, which is the failure the resume guard refuses outright.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Ids already settled, whatever produced them
 *
 * @example
 * ```ts
 * const done = await settledEntryIds({ artifactsDir, },);
 * ```
 */
export async function settledEntryIds(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<ReadonlySet<string>> {
  return new Set(
    (await settledArtifactNames({ artifactsDir, },))
      .map(function toId(name,): string {
        return name.slice(
          0,
          -'.json'.length,
        );
      },),
  );
}

/**
 * How many entries this directory holds, for the against-target line.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Count of artifacts present
 *
 * @example
 * ```ts
 * const total = await countSettled({ artifactsDir, },);
 * ```
 */
export async function countSettled(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<number> {
  return (await settledArtifactNames({ artifactsDir, },))
    .length;
}

//endregion Pass settled
