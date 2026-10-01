import { dirname, } from 'node:path';

import { wordForCount, } from '../count-word.ts';
import { contextRoot, } from '../log-context.ts';
import {
  MS_PER_SECOND,
  utcMinutes,
  type VersionSetting,
} from './cache-account-commits.ts';
import {
  type RunsDirSearch,
  runsDirsIn,
  runsDirsUnder,
  type SliceCacheAccount,
  sliceCacheAccount,
  type UnlistedDir,
} from './cache-account-slices.ts';
import { resolveRunsDir, } from './run-config.ts';
import { defaultRunsDirIn, } from './runs-layout.ts';

//region Slice cache report
// THE SLICE CACHES' PART OF THE PRE-LAUNCH CACHE CHECK (ledger M57, M81): the
// runs directories read, how many records they hold, the directories the
// search could not list, the newest record and how many versions were set
// after it, which every account stated from a hand-written `find` until then.
// The entry (`cache-account-audit.ts`) prints the version accounts first and
// hands this the settings it read.

/**
 Logger for the report's progress lines, apart from the report on stdout.
 */
const sliceReportLog = contextRoot({ tag: 'cache-account-slice-report', },);

/**
 Prints the slice caches' account: the runs directories read, how many
 records they hold (the control), the directories the search could not list,
 the newest record, and how many versions were set after it.

 @param account - what the slice caches hold

 @param searched - where runs directories were looked for, so a reader sees
 which runs the count can include

 @param unlisted - directories the search could not list, whose runs the
 count leaves out

 @param settings - every version with the commit that set it

 @example
 ```ts
 printSliceCacheAccount({ account, searched, unlisted, settings, },);
 ```
 */
function printSliceCacheAccount(
  {
    account,
    searched,
    unlisted,
    settings,
  }: {
    readonly account: SliceCacheAccount;
    readonly searched: readonly string[];
    readonly unlisted: readonly UnlistedDir[];
    readonly settings: readonly VersionSetting[];
  },
): void {
  /**
   Runs directories read, records read, and the one written last.
   */
  const {
    runsDirs,
    count,
    newest,
  } = account;
  console.log(
    `slice-cache records under ${String(runsDirs.length,)} ${wordForCount({
      count: runsDirs.length,
      one: 'runs directory',
      many: 'runs directories',
    },)} found in ${searched.join(', ',)}: ${String(count,)}`,
  );
  console.log(
    `directories the search could not list, whose runs the count leaves out: ${String(unlisted.length,)}`,
  );
  for (const {
    dir,
    reason,
  } of unlisted)
    console.log(`  ${dir} (${reason})`,);
  if (newest.kind === 'none') {
    console.log('newest slice-cache record: none',);
    return;
  }
  /**
   The record written last.
   */
  const { record, } = newest;
  /**
   Its time in whole seconds, as commit times are kept.
   */
  const newestSeconds = Math.floor(record.modifiedMs / MS_PER_SECOND,);
  /**
   Versions whose current value was set after it.
   */
  const setAfter = settings.filter(function laterThanNewest({ commit, },): boolean {
    return commit.seconds > newestSeconds;
  },);
  console.log(`newest slice-cache record: ${utcMinutes({ seconds: newestSeconds, },)} ${record.path}`,);
  console.log(`cache versions set after it: ${String(setAfter.length,)} of ${String(settings.length,)}`,);
}

/**
 Reads the slice caches under every runs directory the audit can name and
 prints their account.

 Returns nothing: the report on stdout IS the output.

 @param root - repository's top directory, whose dependency tree holds the
 default runs directory

 @param searched - directories named on the command line to search for runs
 directories beside the worktree's own

 @param settings - every version with the commit that set it

 @throws What a listing or `stat` raises inside a runs directory for any
 failure but an absent path

 @example
 ```ts
 await reportSliceCaches({ root, searched: line.list('runs-under',), settings, },);
 ```
 */
export async function reportSliceCaches(
  {
    root,
    searched,
    settings,
  }: {
    readonly root: string;
    readonly searched: readonly string[];
    readonly settings: readonly VersionSetting[];
  },
): Promise<void> {
  /**
   Directory the default runs directory sits in, where hand-set ones beside
   it carry its name as a prefix.
   */
  const runsParent = dirname(defaultRunsDirIn({ worktreeRoot: root, },),);
  /**
   The runs directory a pass would use now, which `TRANSLATION_REPAIR_RUNS_DIR`
   may set anywhere.
   */
  const configured = await resolveRunsDir();
  /**
   What the search found under each searched directory.
   */
  const searches = await Promise.all(searched.map(async function runsUnder(searchRoot,): Promise<RunsDirSearch> {
    return await runsDirsUnder({ root: searchRoot, },);
  },),);
  /**
   Runs directories found under them, beside the worktree's own and the
   configured one, each once.
   */
  const runsDirs = [...new Set([
    ...await runsDirsIn({ parent: runsParent, },),
    configured,
    ...searches.flatMap(function foundIn({ found, },): readonly string[] {
      return found;
    },),
  ],),];
  /**
   Directories the searches could not list.
   */
  const unlisted = searches.flatMap(function unlistedIn({ unlisted: skipped, },): readonly UnlistedDir[] {
    return skipped;
  },);
  sliceReportLog.info(
    `runs directories to read: ${String(runsDirs.length,)}; directories not listed: ${String(unlisted.length,)}`,
  );
  /**
   What their slice caches hold.
   */
  const account = await sliceCacheAccount({ runsDirs, },);
  sliceReportLog.info(`slice-cache records read: ${String(account.count,)}`,);
  printSliceCacheAccount({
    account,
    searched: [
      runsParent,
      configured,
      ...searched,
    ],
    unlisted,
    settings,
  },);
}

//endregion Slice cache report
