/**
 The non-commit Git commands that the end-to-end scenarios send through the wrapper,
 plus a few the wrapper refuses,
 in the order the wrapper surface probe runs them.

 @module
 */

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { realGit, } from './real-git-fixture.ts';
import type { ScenarioRepository, } from './repository-model-fixture.ts';

/**
 Runs one wrapper command and returns its trimmed standard output.
 */
export type WrappedRunner = (step: Readonly<{
  label: string;
  args: readonly string[];
}>,) => Promise<string>;

/**
 Runs every probed command.

 @param repository - disposable linked-worktree repository with `a.txt` and `b.txt` committed

 @param wrapped - runs one command through the selected wrapper and prints its result

 @param patchPath - file the `apply` step reads

 @example
 ```ts
 await runSurfaceSteps({ repository, wrapped, patchPath: '/work/probe/probe.patch' });
 ```
 */
export async function runSurfaceSteps({
  repository,
  wrapped,
  patchPath,
}: Readonly<{
  repository: ScenarioRepository;
  wrapped: WrappedRunner;
  patchPath: string;
}>,): Promise<void> {
  await wrapped({
    label: 'status clean',
    args: [
      'status',
      '--short',
    ],
  },);
  await writeFile(
    join(
      repository.worktree,
      'a.txt',
    ),
    'a\nchanged\n',
  );
  await wrapped({
    label: 'status modified',
    args: [
      'status',
      '--short',
    ],
  },);
  await wrapped({
    label: 'add',
    args: [
      'add',
      '--',
      'a.txt',
    ],
  },);
  await wrapped({
    label: 'diff staged names',
    args: [
      'diff',
      '--staged',
      '--name-only',
      '-z',
      '--diff-filter=ACMR',
    ],
  },);
  await wrapped({
    label: 'diff binary patch',
    args: [
      'diff',
      '--binary',
      '--unified=0',
      '--no-color',
      '--no-ext-diff',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      '--staged',
    ],
  },);
  await writeFile(
    patchPath,
    await realGit({
      repository,
      args: [
        'diff',
        '--staged',
        '--binary',
      ],
    },),
  );
  /**
   Backup commit object the stash steps store.
   */
  const backup = await wrapped({
    label: 'stash create',
    args: [
      'stash',
      'create',
    ],
  },);
  await wrapped({
    label: 'stash store',
    args: [
      'stash',
      'store',
      '--quiet',
      '--message',
      'probe backup',
      backup,
    ],
  },);
  await wrapped({
    label: 'stash list',
    args: [
      'stash',
      'list',
      '--format=%gd %gs',
    ],
  },);
  await wrapped({
    label: 'stash drop',
    args: [
      'stash',
      'drop',
      '--quiet',
      'stash@{0}',
    ],
  },);
  await wrapped({
    label: 'checkout force',
    args: [
      'checkout',
      '--force',
      '--',
      'a.txt',
    ],
  },);
  await wrapped({
    label: 'status after checkout',
    args: [
      'status',
      '--short',
    ],
  },);
  await wrapped({
    label: 'apply',
    args: [
      'apply',
      '-v',
      '--whitespace=nowarn',
      '--recount',
      '--unidiff-zero',
      patchPath,
    ],
  },);
  await wrapped({
    label: 'status after apply',
    args: [
      'status',
      '--short',
    ],
  },);
  await realGit({
    repository,
    args: [
      'branch',
      'side',
    ],
  },);
  await wrapped({
    label: 'switch side',
    args: [
      'switch',
      'side',
    ],
  },);
  await wrapped({
    label: 'switch back',
    args: [
      'switch',
      repository.branch,
    ],
  },);
  await wrapped({
    label: 'gc prune now',
    args: [
      'gc',
      '--quiet',
      '--prune=now',
    ],
  },);
  await wrapped({
    label: 'push',
    args: ['push',],
  },);
  await wrapped({
    label: 'rev-parse',
    args: [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ],
  },);
  await wrapped({
    label: 'log',
    args: [
      'log',
      '--oneline',
      '--max-count=1',
    ],
  },);
  await wrapped({
    label: 'branch list',
    args: [
      'branch',
      '--list',
    ],
  },);
  await wrapped({
    label: 'config get',
    args: [
      'config',
      '--get',
      'user.name',
    ],
  },);
  await wrapped({
    label: 'commit dry run',
    args: [
      'commit',
      '--dry-run',
      '--short',
      '--',
      'a.txt',
    ],
  },);
  await wrapped({
    label: 'refused add all',
    args: [
      'add',
      '--all',
    ],
  },);
  await wrapped({
    label: 'refused reset hard',
    args: [
      'reset',
      '--hard',
    ],
  },);
  await wrapped({
    label: 'refused clean',
    args: [
      'clean',
      '--force',
    ],
  },);
}
