import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
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
import nanoSpawn, { SubprocessError, } from 'nano-spawn';

/** Absolute built cli-git artifact exercised at consumer boundary. */
const WRAPPER_PATH = join(
  import.meta.dirname,
  '..',
  'dist',
  'final',
  'node',
  'index.mjs',
);

/** Executable mode for fake real-Git fixture. */
const EXECUTABLE_MODE = 0o755;

/** Disposable fixture root with automatic cleanup. */
type TempDirectory = Readonly<{
  /** Absolute disposable root. */
  path: string;
  /** Removes fixture state after test. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates isolated repository and executable fixtures.
 *
 * @returns Disposable temporary root.
 *
 * @example
 * ```ts
 * await using fixture = await createTempDirectory();
 * ```
 */
async function createTempDirectory(): Promise<TempDirectory> {
  /** Unique fixture root. */
  const path = await mkdtemp(join(
    tmpdir(),
    'cli-git-read-only-',
  ),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          force: true,
          recursive: true,
        },
      );
    },
  };
}

/**
 * Produces fake real-Git source that records every wrapper-owned invocation.
 *
 * @param repository - Main-worktree root reported by metadata requests.
 *
 * @returns Executable Node source.
 *
 * @example
 * ```ts
 * fakeGitSource('/tmp/repository');
 * ```
 */
function fakeGitSource(repository: string,): string {
  /** Canonical fake Git directory. */
  const gitDirectory = join(repository, '.git',);
  return `#!${process.execPath}
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
const capturePath = process.env.CLI_GIT_TEST_CAPTURE;
if (capturePath === undefined)
  throw new Error('Missing Git invocation capture path.');
const record = value => appendFileSync(capturePath, value + '\\n');
if (args.includes('--is-inside-work-tree')) {
  record('recovery-membership');
  console.log('true');
}
else if (args.includes('--git-path')) {
  record('recovery-path');
  console.log(${JSON.stringify(join(gitDirectory, 'cli-git-transaction',),)});
}
else if (args.includes('--is-bare-repository')) {
  record('identity');
  console.log(${JSON.stringify(`false\n${gitDirectory}\n${gitDirectory}`,)});
}
else if (args.includes('--show-toplevel')) {
  record('worktree-root');
  console.log(${JSON.stringify(repository,)});
}
else if (args.includes('for-each-ref')) {
  record('forward');
  console.log('refs/remotes/origin/main');
}
else {
  record('unexpected');
  process.exitCode = 3;
}
`;
}

await describe({
  name: 'read-only forwarding',
  children: [
    it({
      name: 'uses one metadata request before exact Starship Git forwarding',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /** Disposable main-worktree root. */
        const repository = join(fixture.path, 'repository',);
        /** PATH directory exposing only fake real Git. */
        const binDirectory = join(fixture.path, 'bin',);
        /** Fake real-Git executable selected by cli-git. */
        const gitPath = join(binDirectory, 'git',);
        /** Invocation-order capture file. */
        const capturePath = join(fixture.path, 'git-invocations.txt',);
        await Promise.all([
          mkdir(join(repository, '.git',), { recursive: true, },),
          mkdir(binDirectory, { recursive: true, },),
        ],);
        await writeFile(
          gitPath,
          fakeGitSource(repository,),
          { mode: EXECUTABLE_MODE, },
        );
        await chmod(gitPath, EXECUTABLE_MODE,);

        /** Wrapper result for Starship 1.26.0 git-status request. */
        const result = await nanoSpawn(
          process.execPath,
          [
            WRAPPER_PATH,
            '-C',
            repository,
            '--git-dir',
            join(repository, '.git',),
            '-c',
            'core.fsmonitor=',
            '--work-tree',
            repository,
            'for-each-ref',
            '--format',
            '%(upstream) %(upstream:track)',
            'refs/heads/main',
          ],
          {
            cwd: repository,
            env: {
              ...process.env,
              CLI_GIT_TEST_CAPTURE: capturePath,
              PATH: binDirectory,
            },
          },
        );
        /** Ordered real-Git roles reached through wrapper. */
        const invocations = (await readFile(capturePath, 'utf8',))
          .trim()
          .split('\n');

        expect(result.stdout,).toBe('refs/remotes/origin/main',);
        expect(invocations,).toEqual([
          'identity',
          'forward',
        ],);
      },
    },),
    it({
      name: 'blocks forwarding to recover a retained-identity transaction',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /** Disposable main-worktree root. */
        const repository = join(fixture.path, 'repository',);
        /** PATH directory exposing only fake real Git. */
        const binDirectory = join(fixture.path, 'bin',);
        /** Fake real-Git executable selected by cli-git. */
        const gitPath = join(binDirectory, 'git',);
        /** Invocation-order capture file. */
        const capturePath = join(fixture.path, 'git-invocations.txt',);
        await Promise.all([
          mkdir(
            join(
              repository,
              '.git',
              'cli-git-transaction',
            ),
            { recursive: true, },
          ),
          mkdir(binDirectory, { recursive: true, },),
        ],);
        await writeFile(
          gitPath,
          fakeGitSource(repository,),
          { mode: EXECUTABLE_MODE, },
        );
        await chmod(gitPath, EXECUTABLE_MODE,);

        /** Captured recovery failure before real Git forwarding. */
        let caught: unknown;
        try {
          await nanoSpawn(
            process.execPath,
            [
              WRAPPER_PATH,
              '-C',
              repository,
              '--git-dir',
              join(repository, '.git',),
              '-c',
              'core.fsmonitor=',
              '--work-tree',
              repository,
              'for-each-ref',
              '--format',
              '%(upstream) %(upstream:track)',
              'refs/heads/main',
            ],
            {
              cwd: repository,
              env: {
                ...process.env,
                CLI_GIT_TEST_CAPTURE: capturePath,
                PATH: binDirectory,
              },
            },
          );
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(SubprocessError,);
        if (!(caught instanceof SubprocessError))
          throw new Error('Expected retained-identity recovery failure.',);
        expect(caught.stderr,).toContain('Incomplete transaction recovery artifacts',);
        /** Ordered real-Git roles reached before recovery blocked forwarding. */
        const invocations = (await readFile(capturePath, 'utf8',))
          .trim()
          .split('\n');
        expect(invocations,).toEqual(['identity',],);
      },
    },),
  ],
},);
