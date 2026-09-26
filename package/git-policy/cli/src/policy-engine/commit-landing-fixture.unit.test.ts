/**
 Disposable real-Git repositories driven through the built wrapper for concurrent-commit tests.

 Hooks and editors are Node programs;
 barriers use a readiness marker and a release file,
 never shell scripts.

 @module
 */
import type { ChildProcess, } from 'node:child_process';
import { once, } from 'node:events';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import {
  createProcessGroups,
  type ProcessGroups,
} from './process-group-fixture.unit.test.ts';

/**
 Absolute real Git executable.
 */
export const REAL_GIT: string = await resolveRealGit();

/**
 Built wrapper entry under test.
 */
export const WRAPPER_PATH: string = join(
  import.meta.dirname,
  '..',
  '..',
  'dist',
  'final',
  'node',
  'index.mjs',
);

/**
 Fixed identity and dates, so native and wrapper commits of the same content are byte-identical.
 */
export const FIXED_IDENTITY: Readonly<Record<string, string>> = {
  GIT_AUTHOR_NAME: 'cli-git landing fixture',
  GIT_AUTHOR_EMAIL: 'landing@example.invalid',
  GIT_AUTHOR_DATE: '1700000000 +0000',
  GIT_COMMITTER_NAME: 'cli-git landing fixture',
  GIT_COMMITTER_EMAIL: 'landing@example.invalid',
  GIT_COMMITTER_DATE: '1700000000 +0000',
};

/**
 Disposable repository.
 */
export type LandingRepository = Readonly<{
  /**
   Worktree root.
   */
  path: string;
  /**
   Git directory.
   */
  gitDir: string;
  /**
   Isolated environment every fixture Git and wrapper run uses.
   */
  env: NodeJS.ProcessEnv;
  /**
   Scratch directory outside the worktree for markers and programs.
   */
  scratch: string;
  /**
   Process groups of the wrapper runs, native Git, and other programs started against this repository.
   */
  processGroups: ProcessGroups;
  /**
   Kills every started process group, then removes everything.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Finished process outcome.
 */
export type ProcessOutcome = Readonly<{
  /**
   Exit code.
   */
  exitCode: number;
  /**
   Standard output.
   */
  stdout: string;
  /**
   Standard error.
   */
  stderr: string;
}>;

/**
 Runs real Git in a fixture repository.

 @param repository - fixture repository

 @param args - Git arguments

 @param env - extra environment

 @returns trimmed standard output

 @example
 ```ts
 await git({ repository, args: ['rev-parse', 'HEAD'] });
 ```
 */
export async function git({
  repository,
  args,
  env = {},
}: Readonly<{
  repository: LandingRepository;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
}>,): Promise<string> {
  return (await nanoSpawn(
    REAL_GIT,
    [...args,],
    {
      cwd: repository.path,
      env: {
        ...repository.env,
        ...env,
      },
    },
  )).stdout.trim();
}

/**
 Runs real Git in a fixture repository and reports failure instead of throwing.

 @param repository - fixture repository

 @param args - Git arguments

 @returns exit code and trimmed standard output

 @example
 ```ts
 await gitOutcome({ repository, args: ['merge', 'side'] });
 ```
 */
export async function gitOutcome({
  repository,
  args,
}: Readonly<{
  repository: LandingRepository;
  args: readonly string[];
}>,): Promise<Readonly<{
  exitCode: number;
  stdout: string;
}>> {
  try {
    return {
      exitCode: 0,
      stdout: await git({
        repository,
        args,
      },),
    };
  }
  catch (error: unknown) {
    if (!(error instanceof SubprocessError))
      throw error;
    return {
      exitCode: error.exitCode ?? (-1),
      stdout: error.stdout.trim(),
    };
  }
}

/**
 Creates a repository on `main` with one baseline commit.

 @param setup - optional extra Git configuration applied before the baseline

 @returns disposable repository

 @example
 ```ts
 await using repository = await createLandingRepository();
 ```
 */
export async function createLandingRepository(setup: readonly (readonly [string, string])[] = [],): Promise<LandingRepository> {
  /**
   Scratch root holding the repository and fixture programs.
   */
  const root = await mkdtemp(join(
    tmpdir(),
    'cli-git-landing-',
  ),);
  /**
   Worktree root.
   */
  const path = join(
    root,
    'repo',
  );
  /**
   Scratch directory.
   */
  const scratch = join(
    root,
    'scratch',
  );
  await mkdir(
    scratch,
    { recursive: true, },
  );
  /**
   Isolated environment.
   */
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...FIXED_IDENTITY,
    HOME: scratch,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_EDITOR: ':',
  };
  await nanoSpawn(
    REAL_GIT,
    ['init', '--quiet', '--initial-branch=main', path,],
    { env, },
  );
  /**
   Process groups started against the repository.
   */
  const processGroups = createProcessGroups();
  /**
   Repository handle.
   */
  const repository: LandingRepository = {
    path,
    gitDir: join(
      path,
      '.git',
    ),
    env,
    scratch,
    processGroups,
    async [Symbol.asyncDispose](): Promise<void> {
      /**
       Removes the scratch root even when a process group outlives its kill.
       */
      await using _removed = {
        [Symbol.asyncDispose]: async function removeRoot(): Promise<void> {
          await rm(
            root,
            {
              recursive: true,
              force: true,
            },
          );
        },
      };
      await processGroups[Symbol.asyncDispose]();
    },
  };
  for (const [key, value,] of setup) {
    // oxlint-disable-next-line no-await-in-loop -- Config writes to one file are ordered.
    await git({
      repository,
      args: ['config', key, value,],
    },);
  }
  await writeFile(
    join(
      path,
      'base.txt',
    ),
    'base\n',
  );
  await git({
    repository,
    args: ['add', 'base.txt',],
  },);
  await git({
    repository,
    args: ['commit', '--quiet', '--message=baseline',],
  },);
  return repository;
}

/**
 Writes a worktree file.

 @param repository - fixture repository

 @param name - repository-relative path

 @param content - file content

 @example
 ```ts
 await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n' });
 ```
 */
export async function writeWorktreeFile({
  repository,
  name,
  content,
}: Readonly<{
  repository: LandingRepository;
  name: string;
  content: string;
}>,): Promise<void> {
  await writeFile(
    join(
      repository.path,
      name,
    ),
    content,
  );
}

/**
 Writes an executable CommonJS Node program with a shebang.

 @param path - program path

 @param source - program body

 @example
 ```ts
 await writeNodeProgram({ path: '/tmp/x', source: 'process.exit(0);' });
 ```
 */
export async function writeNodeProgram({
  path,
  source,
}: Readonly<{
  path: string;
  source: string;
}>,): Promise<void> {
  await writeFile(
    path,
    `#!${process.execPath}\n${source}\n`,
  );
  await chmod(
    path,
    0o755,
  );
}

/**
 Writes a hookdir hook as a Node program.

 @param repository - fixture repository

 @param event - hook event

 @param source - program body

 @example
 ```ts
 await writeHook({ repository, event: 'pre-commit', source: 'process.exit(1);' });
 ```
 */
export async function writeHook({
  repository,
  event,
  source,
}: Readonly<{
  repository: LandingRepository;
  event: string;
  source: string;
}>,): Promise<void> {
  /**
   Hooks directory.
   */
  const hooks = join(
    repository.gitDir,
    'hooks',
  );
  await mkdir(
    hooks,
    { recursive: true, },
  );
  await writeNodeProgram({
    path: join(
      hooks,
      event,
    ),
    source,
  },);
}

/**
 Program body that writes a readiness marker and waits until a release file exists.

 @param ready - marker written when the barrier is reached

 @param release - file whose existence releases the barrier

 @returns CommonJS statements

 @example
 ```ts
 barrierSource({ ready: '/tmp/ready', release: '/tmp/release' });
 ```
 */
export function barrierSource({
  ready,
  release,
}: Readonly<{
  ready: string;
  release: string;
}>,): string {
  return [
    'const barrierFs = require("node:fs");',
    `barrierFs.writeFileSync(${JSON.stringify(ready,)}, String(process.pid));`,
    'const barrierCell = new Int32Array(new SharedArrayBuffer(4));',
    `while (!barrierFs.existsSync(${JSON.stringify(release,)})) Atomics.wait(barrierCell, 0, 0, 20);`,
  ].join('\n',);
}

/**
 Runs the wrapper to completion.

 @param repository - fixture repository

 @param args - wrapper arguments

 @param env - extra environment

 @returns outcome

 @example
 ```ts
 await runWrapper({ repository, args: ['commit', '-m', 'x', 'a.txt'] });
 ```
 */
export async function runWrapper({
  repository,
  args,
  env = {},
}: Readonly<{
  repository: LandingRepository;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
}>,): Promise<ProcessOutcome> {
  return finish(startWrapper({
    repository,
    args,
    env,
  },),);
}

/**
 Starts the wrapper without waiting, as the leader of a process group the repository kills on disposal.

 @param repository - fixture repository

 @param args - wrapper arguments

 @param env - extra environment

 @returns child process with captured output

 @example
 ```ts
 const child = startWrapper({ repository, args: ['commit', '-m', 'x', 'a.txt'] });
 ```
 */
export function startWrapper({
  repository,
  args,
  env = {},
}: Readonly<{
  repository: LandingRepository;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
}>,): ChildProcess {
  return repository.processGroups.spawn({
    command: process.execPath,
    args: [WRAPPER_PATH, ...args,],
    options: {
      cwd: repository.path,
      env: {
        ...repository.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe',],
    },
  },);
}

/**
 Waits for a started process and collects its output.

 @param child - started process

 @returns outcome

 @example
 ```ts
 await finish(startWrapper({ repository, args }));
 ```
 */
export async function finish(child: ChildProcess,): Promise<ProcessOutcome> {
  /**
   Output chunks.
   */
  const output = {
    stdout: '',
    stderr: '',
  };
  child.stdout?.setEncoding('utf8',);
  child.stderr?.setEncoding('utf8',);
  child.stdout?.on(
    'data',
    function collectStdout(chunk: string,): void {
      output.stdout += chunk;
    },
  );
  child.stderr?.on(
    'data',
    function collectStderr(chunk: string,): void {
      output.stderr += chunk;
    },
  );
  /**
   Exit code and signal.
   */
  const closed: readonly unknown[] = await once(
    child,
    'close',
  );
  return {
    exitCode: (typeof closed[0]) === 'number' ? closed[0] : -1,
    stdout: output.stdout,
    stderr: output.stderr,
  };
}

/**
 Waits until a file exists.

 @param path - file path

 @param timeoutMs - failure deadline

 @example
 ```ts
 await waitForFile({ path: '/tmp/ready' });
 ```
 */
export async function waitForFile({
  path,
  timeoutMs = 20_000,
}: Readonly<{
  path: string;
  timeoutMs?: number;
}>,): Promise<void> {
  /**
   Deadline.
   */
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Polling observes the barrier in order.
      await access(path,);
      return;
    }
    catch (error: unknown) {
      if (Date.now() > deadline)
        throw error;
    }
    // oxlint-disable-next-line no-await-in-loop -- Polling delay.
    await wait(20,);
  }
}

/**
 Lists everything a finished transaction must not leave behind.

 @param repository - fixture repository

 @returns leftover paths relative to the Git directory

 @example
 ```ts
 await leftovers(repository); // []
 ```
 */
export async function leftovers(repository: LandingRepository,): Promise<readonly string[]> {
  /**
   Directory entries, empty when absent.

   @param directory - directory relative to the Git directory

   @returns entries prefixed with the directory
   */
  async function entries(directory: string,): Promise<readonly string[]> {
    try {
      return (await readdir(join(
        repository.gitDir,
        directory,
      ),))
        .map(function prefixed(name,): string {
          return `${directory}/${name}`;
        },);
    }
    catch (error: unknown) {
      if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
        return [];
      throw error;
    }
  }
  /**
   Every candidate location.
   */
  const [shadows, transactions, packs, top, captures, landed,] = await Promise.all([
    entries('cli-git/shadow',),
    entries('cli-git-transactions',),
    entries('objects/pack',),
    readdir(repository.gitDir,),
    entries('cli-git-captures',),
    entries('cli-git-captures/landed',),
  ],);
  return [
    ...shadows,
    ...transactions,
    // The capture store keeps its identity, its sequence, and the landed-record directory; records are pruned.
    ...captures.filter(function isTransient(name,): boolean {
      return !['cli-git-captures/worktree-id', 'cli-git-captures/sequence', 'cli-git-captures/landed',].includes(name,);
    },),
    ...landed,
    ...packs.filter(function isKeep(name,): boolean {
      return name.endsWith('.keep',);
    },),
    ...top.filter(function isLock(name,): boolean {
      return name.endsWith('.lock',);
    },),
  ];
}

/**
 Reads the JSONL policy events a wrapper run printed on stderr.

 @param stderr - wrapper stderr

 @returns parsed event objects

 @example
 ```ts
 jsonlEvents(outcome.stderr);
 ```
 */
export function jsonlEvents(stderr: string,): readonly Readonly<Record<string, unknown>>[] {
  return stderr
    .split('\n',)
    .filter(function isEvent(line,): boolean {
      return line.startsWith('{"schemaVersion":',);
    },)
    .map(function parseEvent(line,): Readonly<Record<string, unknown>> {
      /**
       Parsed event.
       */
      const value: unknown = JSON.parse(line,);
      if (((typeof value) !== 'object') || (value === null))
        throw new Error(`Malformed event line: ${line}`,);
      return Object.fromEntries(Object.entries(value,),);
    },);
}

/**
 Reads a file as text.

 @param path - file path

 @returns text, empty when absent

 @example
 ```ts
 await readText('/tmp/log');
 ```
 */
export async function readText(path: string,): Promise<string> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return '';
    throw error;
  }
}
