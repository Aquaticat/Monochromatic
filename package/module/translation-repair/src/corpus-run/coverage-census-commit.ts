import spawn from 'nano-spawn';

import { resolveGit, } from './git-command.ts';

//region Coverage census commit
// Ledger T8: what git says about the tree a census reads, apart from the
// entry so each question is tested against a throwaway repository: which
// commit the build came from and whether the files match it, and which
// sources have changed since an earlier census's commit.

/**
 The commit the package's files were built from, and whether they match it.

 @param packageDirectory - package directory, inside a git work tree

 @returns Nine-character hash and whether `git status` shows no change under the package

 @example
 ```ts
 const { head, clean, } = await packageCommit({ packageDirectory, },);
 ```
 */
export async function packageCommit({ packageDirectory, }: { readonly packageDirectory: string; },): Promise<{
  readonly head: string;
  readonly clean: boolean;
}> {
  /**
   Git to run.
   */
  const git = await resolveGit();
  /**
   The commit.
   */
  const { stdout: head, } = await spawn(
    git,
    [
      '-C',
      packageDirectory,
      'rev-parse',
      '--short=9',
      'HEAD',
    ],
  );
  /**
   Changes under the package.
   */
  const { stdout: changes, } = await spawn(
    git,
    [
      '-C',
      packageDirectory,
      'status',
      '--porcelain',
      '--',
      '.',
    ],
  );
  return {
    head: head.trim(),
    clean: changes.trim() === '',
  };
}

/**
 Names the sources whose files differ from an earlier commit.

 THE TREE AS IT STANDS, uncommitted edits included, against that commit, since
 the census this reads beside was taken from the tree as it stands. A file
 added since that commit counts as changed; one never committed is not listed
 by git, and no census taken at that commit can hold a stretch in it.

 @param packageDirectory - package directory, inside a git work tree

 @param head - earlier commit, as a census records it

 @param sources - package-relative sources to ask about, empty for every file
 under the package

 @returns Package-relative paths, as a census names sources, of those that
 changed

 @example
 ```ts
 const edited = await sourcesEditedSince({ packageDirectory, head: baseline.head, sources: ['src/nap.ts',], },);
 ```
 */
export async function sourcesEditedSince(
  {
    packageDirectory,
    head,
    sources,
  }: {
    readonly packageDirectory: string;
    readonly head: string;
    readonly sources: readonly string[];
  },
): Promise<ReadonlySet<string>> {
  /**
   Git to run.
   */
  const git = await resolveGit();
  /**
   Changed paths, one a line, relative to the package directory.
   */
  const { stdout: changed, } = await spawn(
    git,
    [
      '-C',
      packageDirectory,
      'diff',
      '--name-only',
      '--relative',
      head,
      '--',
      ...((sources.length === 0) ? ['.',] : sources),
    ],
  );
  return new Set(changed
    .split('\n',)
    .filter(function named(line,): boolean {
      return line !== '';
    },),);
}

//endregion Coverage census commit
