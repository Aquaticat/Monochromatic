import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { errorName, } from '../error-name.ts';
import { artifactFileNameOf, } from './artifact-file-name.ts';
import { parseSettledTwoLaneArtifact, } from './artifact-two-lane-read.ts';
import {
  ENGLISH_PAGE_FILE,
  FIXED_TREE_DIR,
  PEOPLE_DIR,
} from './publish-fixed.ts';
import {
  type EntryAgreement,
  pageAgreement,
} from './page-agreement.ts';
import {
  type PageLengthCheck,
  pairPublishedPages,
} from './published-page-check.ts';
import {
  ARTIFACTS_DIR,
  publishedEntryIds,
  settledEntryIds,
  whatThereIsToVerify,
} from './published-tree-listing.ts';
import {
  digestPipeline,
  type PipelineDigest,
} from './pipeline-digest.ts';
import { resolveRunsDir, } from './run-config.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import {
  DECLINED_DIR,
  declinedEntryIds,
} from './declined-entries.ts';

//region Verify published
// Checks a run's PUBLISHED TREE against the artifacts that produced it, which
// until now nothing did. Spends no quota and touches no model.
//
// Two questions, and a pass answers neither about itself:
//
//   Does every entry the run settled have a page? `pass-entry-persist.ts`
//   publishes BEFORE it writes the artifact precisely so that "an artifact
//   exists" implies "a page was written", and a resumed pass builds its skip
//   set from the artifacts on disk. An artifact with no page is therefore an
//   entry no pass settles again; the next pass started in the runs directory
//   writes its page from the artifact (`pass-republish.ts`, ledger A16c).
//
//   Does every page carry the wording its artifact says would ship, and is it
//   as long as the archive plus every change the slices made? That is the
//   question a past failure turned on: the publisher handed the assembler a blank
//   rendering, and only a guard inside the splice noticed.
//
// THE SECOND HALF OF THAT QUESTION WAS ADDED AFTER A CONTROL FAILED. Checking
// only the wordings passed a real page with two hundred characters cut out of
// the middle of it, because the wordings cover the slices and a page is mostly
// the text between them. `published-page-check.ts` carries the arithmetic.
//
// A RUN ALWAYS SHIPS (the owner, 2026-09-27; ledger A16b). Every finding is
// printed and the exit is 0; only a run that could not be read at all exits
// otherwise, since that run was never examined.
//
// PRINTS IDS, INDICES AND COUNTS. Never a passage, never a parse-refusal
// message, because those quote the text they disagree about and a run directory
// holds unlicensed corpus wording.

/**
 Exit code a run that could not be checked at all leaves behind.

 THE ONE NONZERO EXIT. A finding says what the run ships and what the next
 pass repairs, and a run always ships; this says the run was never examined,
 which no printed finding can stand in for.
 */
const NOTHING_WAS_VERIFIED = 2;

/**
 Reads one entry's artifact and page, or names the class that refused them.
 
 @param runsDir - run directory both halves live under
 
 @param entryId - person entry to read
 
 @returns Both halves, or the refusal
 
 @example
 ```ts
 const read = await readEntry({ runsDir, entryId, },);
 ```
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
     Class that refused this entry, named rather than quoted: a refusal
     message quotes the passage it disagrees about.
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
            artifactFileNameOf({ entryId, },),
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
 Renders the length column, which says three different things.
 
 NAMES AN UNWEIGHED ENTRY RATHER THAN PRINTING ITS SIZE, so a run of
 artifacts written before the archive text was stored cannot be read as a run
 that was checked and agreed.
 
 @param weight - what `pageWeighsWhatItShould` returned
 
 @returns Column text for the entry line
 
 @example
 ```ts
 console.log(weighedAs({ weight, },),);
 ```
 */
function weighedAs(
  { weight, }: { readonly weight: PageLengthCheck; },
): string {
  if (weight.kind === 'unweighable')
    return 'chars=UNWEIGHED(artifact predates stored archive text)';

  /**
   Expected length, or a mark saying the page already matches it.
   */
  const against = (weight.actual === weight.expected)
    ? '=expected'
    : `/expected ${String(weight.expected,)}`;

  /**
   Note that a filled anchor makes the expectation a floor.
   */
  const floor = weight.exact ? '' : '+separators';

  return `chars=${String(weight.actual,)}${against}${floor}`;
}

/**
 Reports one entry, returning whether its page agreed with its artifact.
 
 @param runsDir - run directory both halves live under
 
 @param entryId - person entry to read

 @param thisBuild - build doing the reading, so a disagreement over an
 artifact another build settled says the reading moved

 @returns Whether the page carries everything the artifact promised

 @example
 ```ts
 const agreed = await reportEntry({ runsDir, entryId, thisBuild, },);
 ```
 */
async function reportEntry(
  {
    runsDir,
    entryId,
    thisBuild,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
    readonly thisBuild: PipelineDigest;
  },
): Promise<EntryAgreement> {
  /**
   Artifact and page as they sit on disk, or the class that refused them.
   */
  const read = await readEntry({
    runsDir,
    entryId,
  },);

  if (read.kind === 'refused') {
    console.log(`${entryId}: REFUSED by ${read.refusedBy}`,);
    return 'disagreed';
  }

  /**
   The page judged against its artifact, by the one definition a pass also
   republishes on (`page-agreement.ts`).
   */
  const {
    agreement,
    wording: {
      wordings,
      silentSlices,
      missing,
    },
    weight,
    wrongLength,
  } = pageAgreement({
    artifact: read.artifact,
    pageText: read.pageText,
  },);

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
  // A PAGE ANOTHER BUILD SETTLED AGREED WITH THAT BUILD, since each publish
  // refuses a page that disagrees; this build reads the artifact through its own
  // typography, so a disagreement here can be the reading that moved (77 of 214
  // stored pages on 2026-09-27, 69 by the class 181 and 147 fixes alone).
  /**
   Build that settled the artifact.
   */
  const { pipelineDigest: settledBy, } = read.artifact;
  if ((agreement === 'disagreed') && (settledBy !== thisBuild))
    console.log(
      `  READ BY ANOTHER BUILD: settled by ${settledBy}, read by ${thisBuild}; a pass `
        + 'started here on this build rewrites the page to this reading',
    );

  return agreement;
}

/**
 Reads a run's published tree back and reports whether it agrees with its
 artifacts.
 
 Returns nothing: the report on stdout and the exit code ARE the output.
 
 @example
 ```ts
 await verifyPublished();
 ```
 */
async function verifyPublished(): Promise<void> {
  /**
   Run directory to read, from the environment or the default.
   */
  const runsDir = await resolveRunsDir();

  /**
   What the run left on disk, or why each half could not be read.
   */
  const [
    settled,
    published,
  ] = await Promise.all([
    settledEntryIds({ runsDir, },),
    publishedEntryIds({ runsDir, },),
  ],);

  /**
   Ids to check, or why this run leaves nothing to check.
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
   Entries the run settled, which is what an absent tree loses all of.
   */
  const settledCount = toVerify
    .settled
    .length;

  if (published.kind === 'unreadable')
    console.log(
      `verify-published: NO PUBLISHED TREE (${published.reason}). All `
        + `${String(settledCount,)} entries the run settled are unpublished, and the next pass `
        + 'started in this runs directory writes each from its artifact',
    );

  /**
   Which entries were settled and which were published.
   */
  const {
    matched,
    unpublished,
    unsettled,
  } = pairPublishedPages({
    settled: toVerify.settled,
    published: toVerify.published,
  },);

  /**
   Entries the pipeline declined to repair (the archive's note says the page
   is the author's own English), which carry no artifact and must carry no
   page: the archive stands.
   */
  const declined = await declinedEntryIds({
    declinedDir: join(
      runsDir,
      DECLINED_DIR,
    ),
  },);

  console.log(
    `verify-published: matched=${String(matched.length,)} `
      + `settledWithNoPage=${String(unpublished.length,)} `
      + `pageWithNoArtifact=${String(unsettled.length,)} `
      + `declined=${String(declined.size,)}`,
  );

  for (const id of unpublished) {
    console.log(
      `  SETTLED AND NEVER PUBLISHED: ${id}. The archive ships for it until the next pass started in `
        + 'this runs directory writes it from its artifact',
    );
  }
  for (const id of unsettled) {
    console.log(
      declined.has(id,)
        ? `  DECLINED AND PUBLISHED ANYWAY: ${id}. The archive's note says the page is the author's own `
          + 'English, so no page should stand here; the next pass started in this runs directory removes it'
        : `  PUBLISHED AND NOT SETTLED: ${id}. It ships as it stands, with no artifact to check it against, `
          + 'until a pass settles the entry again and overwrites it',
    );
  }

  /**
   This build, which reads every artifact this check compares; an artifact another build
   settled can read differently here (ledger A16b).
   */
  const { digest: thisBuild, } = await digestPipeline({ dir: import.meta.dirname, },);

  /**
   Whether every matched entry's page carried what its artifact promised.

   EVERY ENTRY IS READ before the verdict, rather than stopping at the first
   disagreement, because the report is what an operator reads to know what
   ships and what the next pass rewrites, and a partial answer tells neither.
   */
  const agreements = await Promise.all(matched.map(function one(entryId,): Promise<EntryAgreement> {
    return reportEntry({
      runsDir,
      entryId,
      thisBuild,
    },);
  },),);

  /**
   Entries whose page disagreed with their artifact, or could not be read.
   */
  const disagreed = agreements
    .filter(function isBad(agreed,): boolean {
      return agreed === 'disagreed';
    },)
    .length;

  /**
   Entries whose page carried every wording but could not be weighed, because
   the artifact predates the stored archive text. Counted apart so the closing
   line claims a length check only for the pages that had one.
   */
  const unweighed = agreements
    .filter(function wasUnweighed(agreed,): boolean {
      return agreed === 'agreed-unweighed';
    },)
    .length;

  /**
   Pages that carried every wording, weighed or not.
   */
  const agreed = agreements.length - disagreed;

  /**
   Pages that carried every wording and weighed what the artifact implies.
   */
  const weighed = agreed - unweighed;

  console.log(
    `verify-published: ${String(agreed,)} of ${String(agreements.length,)} `
      + `pages carry every wording their artifact promised; ${String(weighed,)} of those at the length `
      + `it implies, ${String(unweighed,)} UNWEIGHED because the artifact predates the stored archive text`,
  );
}

if (import.meta.main)
  await reportingRefusals({
    what: 'verify-published',
    run: verifyPublished,
  },);

//endregion Verify published
