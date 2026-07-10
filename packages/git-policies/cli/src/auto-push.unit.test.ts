import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';

import {
  autoPush,
  filterPushOutput,
} from './auto-push.ts';
import { resolveGit, } from './resolve-git.ts';

//region Test fixtures: disposable repos, bare remotes, and a remote-line hook

/** Absolute path to the real git binary used to build fixtures and to push. */
const realGitPath = await resolveGit();

/** File mode that makes the bare-remote receive hook executable. */
const EXECUTABLE_MODE = 0o755;

/** Git author email used in disposable repositories. */
const TEST_USER_EMAIL = 'cli-git@example.invalid';

/** Git author name used in disposable repositories. */
const TEST_USER_NAME = 'cli-git auto-push test';

/** Marker the bare remote echoes so git relays it to the client as `remote: <marker>`. */
const REMOTE_HOOK_MARKER = 'marker-from-receive-hook';

/** Disposable temporary directory used by auto-push tests. */
type TempDirectory = {
  /** Absolute path to the temporary directory. */
  readonly path: string;
  /** Deletes the temporary directory after the test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable temporary directory for fixtures.
 *
 * @returns Temporary directory that removes itself when disposed.
 *
 * @example
 * ```ts
 * await using tempDirectory = await createTempDirectory();
 * console.log(tempDirectory.path);
 * ```
 */
async function createTempDirectory(): Promise<TempDirectory> {
  /** Absolute temporary directory path for one test case. */
  const path = await mkdtemp(join(
    tmpdir(),
    'cli-git-auto-push-',
  ),);

  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Runs the real git binary in a fixture directory, bypassing the wrapper.
 *
 * @param options - Working directory and git argv.
 *
 * @returns Nothing once git exits zero.
 *
 * @example
 * ```ts
 * await runGit({ cwd: '/repo', args: ['init', '--quiet'] });
 * ```
 */
async function runGit({
  cwd,
  args,
}: {
  /** Directory the command runs in. */
  readonly cwd: string;
  /** Arguments passed after the git binary. */
  readonly args: readonly string[];
},): Promise<void> {
  await nanoSpawn(
    realGitPath,
    [...args,],
    { cwd, },
  );
}

/**
 * Initializes a working repository with a commit identity and one commit.
 *
 * @param options - Repository path to create and seed.
 *
 * @returns Nothing once the repository holds an initial commit.
 *
 * @example
 * ```ts
 * await initRepoWithCommit({ repoPath: '/repo' });
 * ```
 */
async function initRepoWithCommit({
  repoPath,
}: {
  /** Absolute repository root. */
  readonly repoPath: string;
},): Promise<void> {
  await mkdir(
    repoPath,
    { recursive: true, },
  );
  await runGit({
    cwd: repoPath,
    args: [
      'init',
      '--quiet',
    ],
  },);
  await runGit({
    cwd: repoPath,
    args: [
      'config',
      'user.email',
      TEST_USER_EMAIL,
    ],
  },);
  await runGit({
    cwd: repoPath,
    args: [
      'config',
      'user.name',
      TEST_USER_NAME,
    ],
  },);
  await writeFile(
    join(
      repoPath,
      'tracked.txt',
    ),
    'initial\n',
  );
  await runGit({
    cwd: repoPath,
    args: [
      'add',
      'tracked.txt',
    ],
  },);
  await runGit({
    cwd: repoPath,
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
      'tracked.txt',
    ],
  },);
}

/**
 * Creates a bare remote whose `post-receive` hook echoes a marker, which git
 * relays back to the client as a `remote: <marker>` line on a successful push.
 *
 * @param options - Path the bare remote is created at.
 *
 * @returns Nothing once the bare remote and its hook exist.
 *
 * @example
 * ```ts
 * await initBareRemoteWithHook({ remotePath: '/remote.git' });
 * ```
 */
async function initBareRemoteWithHook({
  remotePath,
}: {
  /** Absolute path to the bare remote repository. */
  readonly remotePath: string;
},): Promise<void> {
  await runGit({
    cwd: tmpdir(),
    args: [
      'init',
      '--bare',
      '--quiet',
      remotePath,
    ],
  },);
  await writeFile(
    join(
      remotePath,
      'hooks',
      'post-receive',
    ),
    `#!/bin/sh\necho "${REMOTE_HOOK_MARKER}"\n`,
    { mode: EXECUTABLE_MODE, },
  );
}

//endregion Test fixtures

await describe({
  name: filterPushOutput.name,
  children: [
    it({
      name: 'keeps only remote lines on a clean push',
      fn: async function testKeepsRemoteLines(): Promise<void> {
        expect(filterPushOutput({
          output: 'remote: hello\nTo origin\nremote: world\nbranch set up',
          exitCode: 0,
        },),)
          .toBe('remote: hello\nremote: world',);
      },
    },),
    it({
      name: 'returns empty string when a clean push has no remote lines',
      fn: async function testNoRemoteLines(): Promise<void> {
        expect(filterPushOutput({
          output: 'To origin\nbranch main set up to track origin/main',
          exitCode: 0,
        },),)
          .toBe('',);
      },
    },),
    it({
      name: 'returns the full output on a failed push',
      fn: async function testFailedKeepsAll(): Promise<void> {
        /** Mixed push output that must survive verbatim on failure. */
        const output = 'remote: rejected\nTo origin\n! [remote rejected] HEAD -> main';

        expect(filterPushOutput({
          output,
          exitCode: 1,
        },),)
          .toBe(output,);
      },
    },),
  ],
},);

await describe({
  name: autoPush.name,
  children: [
    it({
      name: 'skips when no origin remote exists',
      fn: async function testSkipsWithoutOrigin(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initRepoWithCommit({ repoPath: tempDirectory.path, },);

        /** Auto-push result for a repository with no origin. */
        const result = await autoPush({
          gitPath: realGitPath,
          cwd: tempDirectory.path,
        },);

        expect(result.outcome,).toBe('skipped',);
        expect(result.exitCode,).toBe(0,);
        expect(result.shown,).toBe('',);
      },
    },),
    it({
      name: 'pushes and surfaces only remote lines on success',
      fn: async function testPushesAndFilters(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Working repository that owns the commit being backed up. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Bare remote whose receive hook emits the marker line. */
        const remotePath = join(
          tempDirectory.path,
          'remote.git',
        );

        await initBareRemoteWithHook({ remotePath, },);
        await initRepoWithCommit({ repoPath, },);
        await runGit({
          cwd: repoPath,
          args: [
            'remote',
            'add',
            'origin',
            remotePath,
          ],
        },);

        /** Auto-push result for a clean push to the bare remote. */
        const result = await autoPush({
          gitPath: realGitPath,
          cwd: repoPath,
        },);

        expect(result.outcome,).toBe('pushed',);
        expect(result.exitCode,).toBe(0,);
        expect(result.shown,).toContain(REMOTE_HOOK_MARKER,);

        /** Non-empty surfaced lines, each of which must be a remote line. */
        const shownLines = result.shown
          .split('\n',)
          .filter(function isNonEmpty(line,): boolean {
            return line !== '';
          },);

        expect(shownLines.every(function isRemoteLine(line,): boolean {
          return line.startsWith('remote: ',);
        },),)
          .toBe(true,);
      },
    },),
    it({
      name: 'skips with a note when HEAD is detached',
      fn: async function testSkipsWhenDetached(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Working repository committed to while detached. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Bare origin remote that must stay untouched. */
        const remotePath = join(
          tempDirectory.path,
          'remote.git',
        );

        await initBareRemoteWithHook({ remotePath, },);
        await initRepoWithCommit({ repoPath, },);
        await runGit({
          cwd: repoPath,
          args: [
            'remote',
            'add',
            'origin',
            remotePath,
          ],
        },);
        await runGit({
          cwd: repoPath,
          args: [
            'checkout',
            '--quiet',
            '--detach',
            'HEAD',
          ],
        },);

        /** Auto-push result for a repository with detached HEAD. */
        const result = await autoPush({
          gitPath: realGitPath,
          cwd: repoPath,
        },);

        expect(result.outcome,).toBe('skipped',);
        expect(result.exitCode,).toBe(0,);
        expect(result.shown,).toContain('HEAD is detached',);
      },
    },),
    it({
      name: 'pushes to an existing upstream without re-pointing it to origin',
      fn: async function testRespectsExistingUpstream(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Working repository whose branch tracks a non-origin remote. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Bare remote the branch upstream points at. */
        const upstreamRemotePath = join(
          tempDirectory.path,
          'alt.git',
        );

        await initBareRemoteWithHook({ remotePath: upstreamRemotePath, },);
        await initRepoWithCommit({ repoPath, },);
        // Deliberately no origin remote: the upstream alone must be enough.
        await runGit({
          cwd: repoPath,
          args: [
            'remote',
            'add',
            'alt',
            upstreamRemotePath,
          ],
        },);
        await runGit({
          cwd: repoPath,
          args: [
            'push',
            '--quiet',
            '--set-upstream',
            'alt',
            'HEAD',
          ],
        },);
        await writeFile(
          join(
            repoPath,
            'tracked.txt',
          ),
          'second\n',
        );
        await runGit({
          cwd: repoPath,
          args: [
            'commit',
            '--quiet',
            '-m',
            'second',
            'tracked.txt',
          ],
        },);

        /** Auto-push result for a branch tracking the alt remote. */
        const result = await autoPush({
          gitPath: realGitPath,
          cwd: repoPath,
        },);

        expect(result.outcome,).toBe('pushed',);

        /** Branch the repository is on, whose tracking config must be untouched. */
        const branchName = (await nanoSpawn(
          realGitPath,
          [
            'branch',
            '--show-current',
          ],
          { cwd: repoPath, },
        )).stdout;
        /** Remote the branch tracks after auto-push; must still be alt. */
        const trackedRemote = (await nanoSpawn(
          realGitPath,
          [
            'config',
            `branch.${branchName}.remote`,
          ],
          { cwd: repoPath, },
        )).stdout;

        expect(trackedRemote,).toBe('alt',);

        /** Local HEAD that the plain push must have delivered to the upstream remote. */
        const localHead = (await nanoSpawn(
          realGitPath,
          [
            'rev-parse',
            'HEAD',
          ],
          { cwd: repoPath, },
        )).stdout;
        /** Tip of the tracked branch on the upstream remote. */
        const upstreamHead = (await nanoSpawn(
          realGitPath,
          [
            'rev-parse',
            branchName,
          ],
          { cwd: upstreamRemotePath, },
        )).stdout;

        expect(upstreamHead,).toBe(localHead,);
      },
    },),
    it({
      name: 'reports failure and surfaces full output when the push is rejected',
      fn: async function testReportsFailure(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Working repository whose origin points nowhere reachable. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Origin URL that resolves to a path with no repository. */
        const missingRemotePath = join(
          tempDirectory.path,
          'missing.git',
        );

        await initRepoWithCommit({ repoPath, },);
        await runGit({
          cwd: repoPath,
          args: [
            'remote',
            'add',
            'origin',
            missingRemotePath,
          ],
        },);

        /** Auto-push result for a push to an unreachable origin. */
        const result = await autoPush({
          gitPath: realGitPath,
          cwd: repoPath,
        },);

        expect(result.outcome,).toBe('failed',);
        expect(result.exitCode,).not.toBe(0,);
        expect(result.shown
          .length,).toBeGreaterThan(0,);
      },
    },),
  ],
},);
