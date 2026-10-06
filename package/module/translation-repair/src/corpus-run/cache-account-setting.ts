import { allInInputOrder, } from '../all-in-input-order.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { wordForCount, } from '../count-word.ts';
import { contextRoot, } from '../log-context.ts';
import {
  type SourceCommit,
  settingCommit,
} from './cache-account-commits.ts';
import {
  type CacheVersion,
  citedHash,
  declarationLineCounts,
} from './cache-account-read.ts';
import {
  CACHE_ACCOUNT_COMMIT_FORMAT,
  cacheAccountCommitsOf,
  cacheAccountGitOutput,
} from './cache-account-git.ts';

//region Cache account setting
// WHICH COMMIT SET A CACHE VERSION'S CURRENT VALUE (ledger M28): the newest
// commit that added its declaration on balance, found by git's pickaxe and
// then read against each candidate's diff.

/**
 Logger for the audit's progress lines, apart from the report on stdout.
 */
const auditLog = contextRoot({ tag: 'cache-account-audit', },);


/**
 Finds the commit that set one version's current value.

 @param root - repository's top directory

 @param sources - pathspec of the package's source

 @param version - constant as the source declares it

 @returns That commit

 @throws StatedRefusalError where no commit adds the current declaration,
 which is an uncommitted value

 @example
 ```ts
 const commit = await cacheVersionSetting({ root, sources, version, },);
 ```
 */
export async function cacheVersionSetting(
  {
    root,
    sources,
    version,
  }: {
    readonly root: string;
    readonly sources: string;
    readonly version: CacheVersion;
  },
): Promise<SourceCommit> {
  /**
   Commits whose diffs change how often the declaration appears, newest first;
   a longer name or value holding it as a substring is sorted out by `declarationLineCounts` and `settingCommit`.
   */
  const commits = cacheAccountCommitsOf({
    output: await cacheAccountGitOutput({
      args: [
        '-C',
        root,
        'log',
        CACHE_ACCOUNT_COMMIT_FORMAT,
        '-S',
        version.declaration,
        '--',
        sources,
      ],
    },),
  },);
  /**
   Each with the declarations of this value it added and removed.
   */
  const candidates = await allInInputOrder({
    members: commits.map(async function counted(commit,) {
      /**
       The commit's changes to the source, without context lines.
       */
      const diff = await cacheAccountGitOutput({
        args: [
          '-C',
          root,
          'show',
          '--format=',
          '--unified=0',
          commit.hash,
          '--',
          sources,
        ],
      },);
      return {
        commit,
        ...declarationLineCounts({
          diff,
          version,
        },),
      };
    },),
  },);
  /**
   Newest commit that added the declaration on balance.
   */
  const setting = settingCommit({ candidates, },);
  if (setting.kind === 'uncommitted') {
    throw new StatedRefusalError({
      says: `${version.declaration} in ${version.path} is not in any commit; commit it, then run the audit again.`,
    },);
  }
  /**
   That commit.
   */
  const { commit: setAt, } = setting;
  auditLog.info(
    `${version.declaration}: set in ${citedHash({ hash: setAt.hash, },)}, `
      + `${String(commits.length,)} pickaxe ${
        wordForCount({
          count: commits.length,
          one: 'candidate',
          many: 'candidates',
        },)
      }`,
  );
  return setAt;
}

//endregion Cache account setting
