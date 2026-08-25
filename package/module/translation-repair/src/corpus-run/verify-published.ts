import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { errorName, } from '../error-name.ts';
import { parseSettledTwoLaneArtifact, } from './artifact-two-lane-read.ts';
import {
  ENGLISH_PAGE_FILE,
  FIXED_TREE_DIR,
  PEOPLE_DIR,
} from './publish-fixed.ts';
import {
  type PageLengthCheck,
  pageCarriesEveryWording,
  pageWeighsWhatItShould,
  pageWeightRefutes,
  pairPublishedPages,
} from './published-page-check.ts';
import {
  ARTIFACT_SUFFIX,
  ARTIFACTS_DIR,
  publishedEntryIds,
  settledEntryIds,
  whatThereIsToVerify,
} from './published-tree-listing.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Verify published
// Checks a run's PUBLISHED TREE against the artifacts that produced it, which
// until now nothing did. Spends no quota and touches no model.
//
// Two questions, and a pass answers neither about itself:
//
//   Does every entry the run settled have a page? `pass-entry.ts` publishes
//   BEFORE it writes the artifact precisely so that "an artifact exists" implies
//   "a page was written", and a resumed pass builds its skip set from the
//   artifacts on disk. An artifact with no page is therefore an entry no future
//   pass will ever attempt again and no reader will ever find a rendering for.
//
//   Does every page carry the wording its artifact says would ship, and is it
//   as long as the archive plus every change the slices made? That is the
//   question `#194` was a failure of: the publisher handed the assembler a blank
//   rendering, and only a guard inside the splice noticed.
//
// THE SECOND HALF OF THAT QUESTION WAS ADDED AFTER A CONTROL FAILED. Checking
// only the wordings passed a real page with two hundred characters cut out of
// the middle of it, because the wordings cover the slices and a page is mostly
// the text between them. `published-page-check.ts` carries the arithmetic.
//
// PRINTS IDS, INDICES AND COUNTS. Never a passage, never a parse-refusal
// message, because those quote the text they disagree about and a run directory
// holds unlicensed corpus wording.

/**
 * Exit code a run with something wrong in its published tree leaves behind.
 */
const PUBLISHED_TREE_DISAGREES = 1;

/**
 * Exit code a run that could not be checked at all leaves behind.
 *
 * SEPARATE FROM DISAGREEMENT, because the two ask different things of whoever
 * reads it. A disagreement says the run shipped something wrong. This says the
 * run was never examined, and a gate that treats the two alike either ships an
 * unchecked run or refuses a good one.
 */
const NOTHING_WAS_VERIFIED = 2;

/**
 * Reads one entry's artifact and page, or names the class that refused them.
 *
 * @param runsDir - run directory both halves live under
 *
 * @param entryId - person entry to read
 *
 * @returns Both halves, or the refusal
 *
 * @example
 * ```ts
 * const read = await readEntry({ runsDir, entryId, },);
 * ```
 */
async function readEntry(
  {
    runsDir,
    entryId,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
  },
): Promise<
  | {
    readonly kind: 'read';
    readonly artifact: ReturnType<typeof parseSettledTwoLaneArtifact>;
    readonly pageText: string;
  }
  | {
    readonly kind: 'refused';

    /**
     * Class that refused this entry, named rather than quoted: a refusal
     * message quotes the passage it disagrees about.
     */
    readonly refusedBy: string;
  }
> {
  try {
    return {
      kind: 'read',
      artifact: parseSettledTwoLaneArtifact({
        value: JSON.parse(await readFile(
          join(
            runsDir,
            ARTIFACTS_DIR,
            `${entryId}${ARTIFACT_SUFFIX}`,
          ),
          'utf8',
        ),) as unknown,
      },),
      pageText: await readFile(
        join(
          runsDir,
          FIXED_TREE_DIR,
          PEOPLE_DIR,
          entryId,
          ENGLISH_PAGE_FILE,
        ),
        'utf8',
      ),
    };
  } catch (error) {
    return {
      kind: 'refused',
      refusedBy: errorName({ error, },),
    };
  }
}

/**
 * Renders the length column, which says three different things.
 *
 * NAMES AN UNWEIGHED ENTRY RATHER THAN PRINTING ITS SIZE, so a run of
 * artifacts written before the archive text was stored cannot be read as a run
 * that was checked and agreed.
 *
 * @param weight - what `pageWeighsWhatItShould` returned
 *
 * @returns Column text for the entry line
 *
 * @example
 * ```ts
 * console.log(weighedAs({ weight, },),);
 * ```
 */
function weighedAs(
  { weight, }: { readonly weight: PageLengthCheck; },
): string {
  if (weight.kind === 'unweighable')
    return 'chars=UNWEIGHED(artifact predates stored archive text)';

  /**
   * Expected length, or a mark saying the page already matches it.
   */
  const against = (weight.actual === weight.expected)
    ? '=expected'
    : `/expected ${String(weight.expected,)}`;

  /**
   * Note that a filled anchor makes the expectation a floor.
   */
  const floor = weight.exact ? '' : '+separators';

  return `chars=${String(weight.actual,)}${against}${floor}`;
}

/**
 * Reports one entry, returning whether its page agreed with its artifact.
 *
 * @param runsDir - run directory both halves live under
 *
 * @param entryId - person entry to read
 *
 * @returns Whether the page carries everything the artifact promised
 *
 * @example
 * ```ts
 * const agreed = await reportEntry({ runsDir, entryId, },);
 * ```
 */
async function reportEntry(
  {
    runsDir,
    entryId,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
  },
): Promise<boolean> {
  /**
   * Artifact and page as they sit on disk, or the class that refused them.
   */
  const read = await readEntry({
    runsDir,
    entryId,
  },);

  if (read.kind === 'refused') {
    console.log(`${entryId}: REFUSED by ${read.refusedBy}`,);
    return false;
  }

  /**
   * What the page turned out to carry.
   */
  const {
    wordings,
    silentSlices,
    missing,
  } = pageCarriesEveryWording({
    artifact: read.artifact,
    pageText: read.pageText,
  },);

  /**
   * What the page should weigh against what it does, or that the artifact
   * predates the stored archive text and nothing can be weighed.
   */
  const weight = pageWeighsWhatItShould({
    artifact: read.artifact,
    archive: read.artifact
      .preparation
      .archiveText,
    pageText: read.pageText,
  },);

  /**
   * Whether the length says the page lost or gained text nobody decided on.
   */
  const wrongLength = pageWeightRefutes({ weight, },);

  console.log(
    `${entryId}: wordings=${String(wordings,)} silent=${String(silentSlices,)} `
      + `${weighedAs({ weight, },)} missing=${String(missing.length,)}`,
  );
  if (wrongLength && (weight.kind === 'weighed'))
    console.log(
      `  WRONG LENGTH: page is ${String(weight.actual - weight.expected,)} characters off what the `
        + 'archive plus every slice change comes to. Text no slice decided on was lost or added',
    );
  for (const gone of missing) {
    console.log(
      `  MISSING slice ${String(gone.sliceIndex,)}, ${String(gone.characters,)} characters the page `
        + 'does not carry in order',
    );
  }

  if (wrongLength)
    return false;

  return missing.length === 0;
}

/**
 * Reads a run's published tree back and reports whether it agrees with its
 * artifacts.
 *
 * Returns nothing: the report on stdout and the exit code ARE the output.
 *
 * @example
 * ```ts
 * await verifyPublished();
 * ```
 */
async function verifyPublished(): Promise<void> {
  /**
   * Run directory to read, from the environment or the default.
   */
  const runsDir = await resolveRunsDir();

  /**
   * What the run left on disk, or why each half could not be read.
   */
  const [
    settled,
    published,
  ] = await Promise.all([
    settledEntryIds({ runsDir, },),
    publishedEntryIds({ runsDir, },),
  ],);

  /**
   * Ids to check, or why this run leaves nothing to check.
   */
  const toVerify = whatThereIsToVerify({
    settled,
    published,
  },);

  if (toVerify.kind === 'nothing-verified') {
    console.log(
      `verify-published: NOTHING VERIFIED, ${toVerify.why}. No page was read and no artifact was `
        + 'compared, so this is not a clean run',
    );
    process.exitCode = NOTHING_WAS_VERIFIED;
    return;
  }

  // Reported only once there are settled entries to report it ABOUT: an absent
  // tree beside no artifacts at all says nothing, and phrasing it as "every
  // settled entry" when none was settled is a claim about an empty set that
  // reads as a finding.
  /**
   * Entries the run settled, which is what an absent tree loses all of.
   */
  const settledCount = toVerify
    .settled
    .length;

  if (published.kind === 'unreadable')
    console.log(
      `verify-published: NO PUBLISHED TREE (${published.reason}). All `
        + `${String(settledCount,)} entries the run settled are unpublished, and a resumed `
        + 'pass skips exactly those entries',
    );

  /**
   * Which entries were settled and which were published.
   */
  const {
    matched,
    unpublished,
    unsettled,
  } = pairPublishedPages({
    settled: toVerify.settled,
    published: toVerify.published,
  },);

  console.log(
    `verify-published: matched=${String(matched.length,)} `
      + `settledWithNoPage=${String(unpublished.length,)} `
      + `pageWithNoArtifact=${String(unsettled.length,)}`,
  );

  for (const id of unpublished) {
    console.log(
      `  SETTLED AND NEVER PUBLISHED: ${id}. A resumed pass skips it, so no reader will find a page`,
    );
  }
  for (const id of unsettled) {
    console.log(
      `  PUBLISHED AND NOT SETTLED: ${id}. A resumed pass re-settles it and overwrites the page`,
    );
  }

  /**
   * Whether every matched entry's page carried what its artifact promised.
   *
   * EVERY ENTRY IS READ before the verdict, rather than stopping at the first
   * disagreement, because a run is verified to decide whether to ship it and a
   * partial answer decides nothing.
   */
  const agreements = await Promise.all(matched.map(function one(entryId,): Promise<boolean> {
    return reportEntry({
      runsDir,
      entryId,
    },);
  },),);

  /**
   * Entries whose page disagreed with their artifact, or could not be read.
   */
  const disagreed = agreements
    .filter(function isBad(agreed,): boolean {
      return !agreed;
    },)
    .length;

  console.log(
    `verify-published: ${String(agreements.length - disagreed,)} of ${String(agreements.length,)} `
      + 'pages carry every wording their artifact promised, at the length it implies',
  );

  if ((disagreed > 0) || (unpublished.length > 0))
    process.exitCode = PUBLISHED_TREE_DISAGREES;
}

await verifyPublished();

//endregion Verify published
