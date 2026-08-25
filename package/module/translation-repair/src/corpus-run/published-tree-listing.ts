import { join, } from 'node:path';

import {
  type DirectoryReading,
  namesIn,
} from './directory-listing.ts';
import {
  FIXED_TREE_DIR,
  PEOPLE_DIR,
} from './publish-fixed.ts';

//region Published tree listing
// What a run left on disk, and whether it left anything worth checking.
//
// SPLIT OUT OF `verify-published.ts` FOR `#217`, which is the defect this
// module exists to make impossible. The listing used to answer an absent
// directory with an empty array and print the absence on STDERR, so a run with
// no artifacts directory at all printed the same stdout summary as a run whose
// every page agreed with its artifact, and left the same exit code behind. A
// verification that verified nothing has to be readable as one, both by a
// person reading the report and by whatever runs it as a gate.
//
// THE TWO ABSENCES ARE NOT THE SAME ANSWER, which is why the verdict is a
// function rather than a pair of guards at the call site. No artifacts
// directory is nothing to check. No published tree BESIDE REAL ARTIFACTS is
// every settled entry unpublished, which is the most serious finding this
// check can make, so it must stay a finding rather than collapse into silence.
//
// PRINTS AND RETURNS IDS, NAMES AND COUNTS. Never a passage, because a run
// directory holds unlicensed corpus wording.

/**
 * Directory under a runs dir holding one settled artifact per entry.
 */
export const ARTIFACTS_DIR = 'artifacts';

/**
 * Suffix every settled artifact file carries.
 */
export const ARTIFACT_SUFFIX = '.json';

/**
 * What a run leaves to verify, or why it leaves nothing.
 *
 * @example
 * ```ts
 * const run: VerifiableRun = { kind: 'nothing-verified', why: 'no run', };
 * ```
 */
export type VerifiableRun =
  | {
    readonly kind: 'checkable';

    /**
     * Entry ids the run settled, sorted.
     */
    readonly settled: readonly string[];

    /**
     * Entry ids the run published, sorted, empty where the tree is absent.
     */
    readonly published: readonly string[];
  }
  | {
    readonly kind: 'nothing-verified';

    /**
     * Why nothing could be checked, phrased as a clause a report can carry.
     */
    readonly why: string;
  };

/**
 * Lists the entries a run settled, by the artifacts it wrote.
 *
 * @param runsDir - run directory holding the artifacts
 *
 * @returns Entry ids, sorted, or why the artifacts directory could not be read
 *
 * @example
 * ```ts
 * const settled = await settledEntryIds({ runsDir, },);
 * ```
 */
export async function settledEntryIds(
  { runsDir, }: { readonly runsDir: string; },
): Promise<DirectoryReading> {
  /**
   * Everything the artifacts directory holds, or why it holds nothing here.
   */
  const reading = await namesIn({
    dir: join(
      runsDir,
      ARTIFACTS_DIR,
    ),
  },);

  if (reading.kind === 'unreadable')
    return reading;

  return {
    kind: 'read',
    names: reading
      .names
      .filter(function isArtifact(name,): boolean {
        return name.endsWith(ARTIFACT_SUFFIX,);
      },)
      .map(function toId(name,): string {
        return name.slice(
          0,
          -ARTIFACT_SUFFIX.length,
        );
      },)
      .toSorted(),
  };
}

/**
 * Lists the entries a run published, by the pages it wrote.
 *
 * @param runsDir - run directory holding the fixed tree
 *
 * @returns Entry ids, sorted, or why the published tree could not be read
 *
 * @example
 * ```ts
 * const published = await publishedEntryIds({ runsDir, },);
 * ```
 */
export async function publishedEntryIds(
  { runsDir, }: { readonly runsDir: string; },
): Promise<DirectoryReading> {
  /**
   * Everything the people directory of the fixed tree holds.
   */
  const reading = await namesIn({
    dir: join(
      runsDir,
      FIXED_TREE_DIR,
      PEOPLE_DIR,
    ),
  },);

  if (reading.kind === 'unreadable')
    return reading;

  return {
    kind: 'read',
    names: reading
      .names
      .toSorted(),
  };
}

/**
 * Decides whether a run has anything to verify at all.
 *
 * TWO WAYS TO VERIFY NOTHING, and both have to leave a verdict a gate can
 * refuse on. An artifacts directory that is not there means the caller is
 * pointed at something that is not a run. An artifacts directory holding no
 * artifact means the run settled no entry. Neither is a clean run, and before
 * `#217` both read as one.
 *
 * AN ABSENT PUBLISHED TREE IS DELIBERATELY NOT ONE OF THEM. Beside real
 * artifacts it means every settled entry was never published, and a resumed
 * pass skips exactly those entries, so no reader will ever find a page for
 * them. Reporting that as an empty tree keeps it a finding the caller counts,
 * rather than a silence that ends the report.
 *
 * @param settled - what the artifacts directory listed
 *
 * @param published - what the published tree listed
 *
 * @returns Ids to check, or why there are none
 *
 * @example
 * ```ts
 * const run = whatThereIsToVerify({ settled, published, },);
 * ```
 */
export function whatThereIsToVerify(
  {
    settled,
    published,
  }: {
    readonly settled: DirectoryReading;
    readonly published: DirectoryReading;
  },
): VerifiableRun {
  if (settled.kind === 'unreadable')
    return {
      kind: 'nothing-verified',
      why: `no artifacts directory under the run (${settled.reason})`,
    };

  /**
   * How many artifacts the directory turned out to hold.
   */
  const settledCount = settled
    .names
    .length;

  if (settledCount === 0)
    return {
      kind: 'nothing-verified',
      why: 'the artifacts directory holds no settled artifact',
    };

  return {
    kind: 'checkable',
    settled: settled.names,
    published: (published.kind === 'read')
      ? published.names
      : [],
  };
}

//endregion Published tree listing
