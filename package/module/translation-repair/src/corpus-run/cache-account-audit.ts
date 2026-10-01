import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import spawn from 'nano-spawn';

import { contextRoot, } from '../log-context.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import {
  type SourceCommit,
  settingCommit,
  sourceCommitOf,
  unaccountedCommits,
  utcMinutes,
  type VersionSetting,
} from './cache-account-commits.ts';
import {
  type CacheVersion,
  cacheVersionsIn,
  citedHash,
  declarationLineCounts,
} from './cache-account-read.ts';
import { reportSliceCaches, } from './cache-account-slice-report.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { resolveGit, } from './git-command.ts';

//region Cache account audit
// THE PRE-LAUNCH CACHE VERSION CHECK (ledger M28), read-only: git log, git
// show and file reads, no write and no model. For every cache version constant
// the source declares, it finds the commit that set the current value, then
// lists every non-test source commit since the earliest of those that no
// version's account names, with the versions each one postdates. Each such
// commit rides inside those versions, and the check reads it and either says
// so in the account or moves the version.
//
// THEN THE SLICE CACHES (ledger M57, M81), in `cache-account-slice-report.ts`:
// the runs directories read, how many records they hold, the newest record and
// how many versions were set after it, which every account stated from a
// hand-written `find` until then.
//
// MOVED IN FROM A SCRATCH SCRIPT the accounts cited and nobody else could run.
// That script walked a list of seven constants typed in by hand, which is
// the M28 mistake waiting to recur, and named the worktree by an absolute
// path; this reads the constants out of the source and finds the repository
// from where it is run.
//
// RUN FROM THE PACKAGE DIRECTORY, which the mise task does:
// `mise run //package/module/translation-repair:cache-account-audit`.
// Prints hashes, times and commit subjects, which are this package's own.

/**
 Logger for the audit's progress lines, apart from the report on stdout.
 */
const auditLog = contextRoot({ tag: 'cache-account-audit', },);

/**
 Log format of one source commit: hash, committer time, subject.
 */
const COMMIT_FORMAT = '--format=%H%x09%ct%x09%s';

/**
 Runs one read-only git command and returns what it printed.

 @param args - arguments after the git command

 @returns Standard output

 @example
 ```ts
 const top = await gitOutput({ args: ['rev-parse', '--show-toplevel',], },);
 ```
 */
async function gitOutput({ args, }: { readonly args: readonly string[]; },): Promise<string> {
  /**
   Git's answer.
   */
  const { stdout, } = await spawn(
    await resolveGit(),
    [...args,],
  );
  return stdout;
}

/**
 Reads non-empty log lines into commits.

 @param output - `git log` output in {@link COMMIT_FORMAT}

 @returns Commits in the order git printed them

 @example
 ```ts
 commitsOf({ output, },);
 ```
 */
function commitsOf({ output, }: { readonly output: string; },): readonly SourceCommit[] {
  return output
    .split('\n',)
    .filter(function written(line,): boolean {
      return line !== '';
    },)
    .map(function commitOf(line,): SourceCommit {
      return sourceCommitOf({ line, },);
    },);
}

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
 const commit = await versionSetting({ root, sources, version, },);
 ```
 */
async function versionSetting(
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
  const commits = commitsOf({
    output: await gitOutput({
      args: [
        '-C',
        root,
        'log',
        COMMIT_FORMAT,
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
  const candidates = await Promise.all(commits.map(async function counted(commit,) {
    /**
     The commit's changes to the source, without context lines.
     */
    const diff = await gitOutput({
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
  },),);
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
      + `${String(commits.length,)} pickaxe candidates`,
  );
  return setAt;
}

/**
 Prints the report: each version's setting, then the commits no account
 names.

 @param sources - pathspec of the package's source

 @param settings - every version with the commit that set it

 @param earliest - setting furthest back

 @param commits - non-test source commits since it

 @example
 ```ts
 printAudit({ sources, settings, earliest, commits, },);
 ```
 */
function printAudit(
  {
    sources,
    settings,
    earliest,
    commits,
  }: {
    readonly sources: string;
    readonly settings: readonly VersionSetting[];
    readonly earliest: VersionSetting;
    readonly commits: readonly SourceCommit[];
  },
): void {
  /**
   Commits no account names.
   */
  const unnamed = unaccountedCommits({
    settings,
    commits,
  },);
  /**
   Commit the earliest setting was made in.
   */
  const { commit: earliestCommit, } = earliest;
  console.log(`cache-account-audit: ${String(settings.length,)} cache versions under ${sources}`,);
  for (const {
    version,
    commit,
  } of settings) {
    console.log(
      `  ${version.declaration} (${version.path}): set in ${citedHash({ hash: commit.hash, },)} `
        + `at ${utcMinutes({ seconds: commit.seconds, },)}`,
    );
  }
  console.log(
    `source commits since ${citedHash({ hash: earliestCommit.hash, },)}: ${String(commits.length,)}, `
      + `named by an account: ${String(commits.length - unnamed.length,)}, by none: ${String(unnamed.length,)}`,
  );
  for (const {
    commit,
    setBefore,
  } of unnamed) {
    console.log(
      `  ${citedHash({ hash: commit.hash, },)} ${utcMinutes({ seconds: commit.seconds, },)} `
        + `[rides inside: ${setBefore.join(', ',)}] ${commit.subject}`,
    );
  }
}

/**
 Reads every cache version the package's source declares and prints the
 source commits no version account names, then the slice caches' account.

 Returns nothing: the report on stdout IS the output.

 @param line - the command line, whose `--runs-under` names directories to
 search for runs directories beside the worktree's own

 @throws StatedRefusalError where the working directory holds no cache
 version, or a value is uncommitted

 @example
 ```ts
 await auditCacheAccounts({ line, },);
 ```
 */
async function auditCacheAccounts(
  { line, }: { readonly line: CommandLineOf<'cache-account-audit'>; },
): Promise<void> {
  /**
   Package directory, where the mise task runs.
   */
  const packageDirectory = process.cwd();
  /**
   Repository's top directory.
   */
  const root = (await gitOutput({
    args: [
      '-C',
      packageDirectory,
      'rev-parse',
      '--show-toplevel',
    ],
  },)).trim();
  /**
   Package's directory from the repository's top.
   */
  const prefix = (await gitOutput({
    args: [
      '-C',
      packageDirectory,
      'rev-parse',
      '--show-prefix',
    ],
  },)).trim();
  /**
   Pathspec of the package's source.
   */
  const sources = `${prefix}src`;
  /**
   Pathspec leaving the source's tests out.
   */
  const withoutTests = `:(exclude,glob)${sources}/**/*.test.ts`;
  /**
   Tracked source files other than tests.
   */
  const files = (await gitOutput({
    args: [
      '-C',
      root,
      'ls-files',
      '--',
      sources,
      withoutTests,
    ],
  },))
    .split('\n',)
    .filter(function listed(path,): boolean {
      return path !== '';
    },);
  /**
   Each file's text, by path.
   */
  const entries = await Promise.all(files.map(async function read(path,): Promise<readonly [
    string,
    string,
  ]> {
    return [
      path,
      await readFile(
        join(
          root,
          path,
        ),
        'utf8',
      ),
    ] as const;
  },),);
  /**
   The same, looked up by path.
   */
  const texts = new Map(entries,);
  /**
   Every cache version constant the source declares.
   */
  const versions = [...texts,].flatMap(function declared([
    path,
    text,
  ],): readonly CacheVersion[] {
    return cacheVersionsIn({
      path,
      text,
    },);
  },);
  auditLog.info(`${String(files.length,)} source files under ${sources}, ${String(versions.length,)} cache versions`,);
  if (versions.length === 0) {
    throw new StatedRefusalError({
      says: `no cache version is declared under ${sources}; run this from the package directory, as `
        + 'mise run //package/module/translation-repair:cache-account-audit does.',
    },);
  }

  /**
   Every version with the commit that set it and the text its account is in.
   */
  const settings: readonly VersionSetting[] = await Promise.all(versions.map(async function set(version,): Promise<VersionSetting> {
    return {
      version,
      commit: await versionSetting({
        root,
        sources,
        version,
      },),
      account: nonNullishOrThrow(texts.get(version.path,),),
    };
  },),);
  /**
   The setting furthest back, from which every later source commit is read;
   there is one, since a version was declared.
   */
  const earliest = nonNullishOrThrow(settings.toSorted(function older(
    { commit: left, },
    { commit: right, },
  ): number {
    return left.seconds - right.seconds;
  },)[0],);
  /**
   Commit it was made in.
   */
  const { commit: earliestCommit, } = earliest;
  /**
   Non-test source commits since the earliest setting, newest first.
   */
  const commits = commitsOf({
    output: await gitOutput({
      args: [
        '-C',
        root,
        'log',
        COMMIT_FORMAT,
        `${earliestCommit.hash}..HEAD`,
        '--',
        sources,
        withoutTests,
      ],
    },),
  },);
  printAudit({
    sources,
    settings,
    earliest,
    commits,
  },);
  await reportSliceCaches({
    root,
    searched: line.list('runs-under',),
    settings,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'cache-account-audit',
    argv: process.argv,
    run: auditCacheAccounts,
  },);

//endregion Cache account audit
