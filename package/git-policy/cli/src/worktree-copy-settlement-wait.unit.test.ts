/**
 Worktree-copy settlement waits by owner evidence:
 a proven-live owner is waited for without a time limit,
 a dead owner's lock is retired,
 and an owner without evidence gets a bounded wait and a diagnostic.

 @module
 */
import { once, } from 'node:events';
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import {
  barrierSource,
  waitForFile,
  writeNodeProgram,
} from './policy-engine/commit-landing-fixture.unit.test.ts';
import { createProcessGroups, } from './policy-engine/process-group-fixture.unit.test.ts';
import {
  captureWrapper,
  commitPaths,
  copySummaryLines,
  createTempDirectory,
  initializeRepository,
  requireFailure,
  requireSuccess,
  resolveFixtureCommonDir,
  WRAPPER_PATH,
} from './worktree-copy-fixture.unit.test.ts';

/**
 How long the second creation must keep waiting; the former bounded wait gave up after about one second.
 */
const LIVE_WAIT_OBSERVATION_MS = 2_500;

/**
 Upper bound for the evidence-free wait to end with a diagnostic.
 */
const UNPROVEN_WAIT_LIMIT_MS = 10_000;

/**
 Private directory mode for hand-built journal and lock directories.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Creates a linked source whose ignored `state.txt` every created worktree must receive.

 @param fixturePath - disposable fixture root

 @returns linked source root

 @example
 ```ts
 await sourceWithIgnoredState('/tmp/fixture');
 ```
 */
async function sourceWithIgnoredState(fixturePath: string,): Promise<string> {
  /** Linked source worktree. */
  const repositoryRoot = join(fixturePath, 'repository',);
  await initializeRepository(repositoryRoot,);
  await writeFile(join(repositoryRoot, '.gitignore',), 'state.txt\n',);
  await commitPaths({ repositoryRoot, message: 'ignore state', paths: ['.gitignore',], },);
  await writeFile(join(repositoryRoot, 'state.txt',), 'ignored state\n',);
  return repositoryRoot;
}

/**
 Publishes a hand-built settlement lock directory holding the given owner text.

 @param repositoryRoot - linked source worktree

 @param ownerText - exact `owner.json` content

 @returns published lock directory

 @example
 ```ts
 await publishSettlementLock({ repositoryRoot, ownerText: '{}' });
 ```
 */
async function publishSettlementLock({
  repositoryRoot,
  ownerText,
}: Readonly<{
  repositoryRoot: string;
  ownerText: string;
}>,): Promise<string> {
  /** Common Git directory. */
  const commonDir = await resolveFixtureCommonDir(repositoryRoot,);
  /** Lock directory. */
  const lockDirectory = join(commonDir, 'cli-git-worktree-copy', 'v1', 'settlement.lock',);
  await mkdir(lockDirectory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE, },);
  await Promise.all([
    chmod(join(commonDir, 'cli-git-worktree-copy',), PRIVATE_DIRECTORY_MODE,),
    chmod(join(commonDir, 'cli-git-worktree-copy', 'v1',), PRIVATE_DIRECTORY_MODE,),
    chmod(lockDirectory, PRIVATE_DIRECTORY_MODE,),
  ],);
  await writeFile(join(lockDirectory, 'owner.json',), ownerText, { mode: 0o600, },);
  return lockDirectory;
}

await describe({
  name: 'worktree-copy settlement wait by owner evidence',
  concurrency: 1,
  children: [
    it({
      name: 'a second worktree creation waits for a live holder without a time limit, names it, and then succeeds',
      fn: async function testLiveHolder(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Process groups killed before the directory is removed. */
        await using groups = createProcessGroups();
        /** Linked source. */
        const repositoryRoot = await sourceWithIgnoredState(fixture.path,);
        /** Barrier files. */
        const ready = join(fixture.path, 'holder.ready',);
        /** Barrier release. */
        const release = join(fixture.path, 'holder.release',);
        /** Shared hooks directory. */
        const hooks = join(await resolveFixtureCommonDir(repositoryRoot,), 'hooks',);
        await mkdir(hooks, { recursive: true, },);
        await writeNodeProgram({ path: join(hooks, 'post-checkout',), source: barrierSource({ ready, release, },), },);
        /** First creation, holding settlement while its hook waits. */
        const holder = groups.spawn({
          command: process.execPath,
          args: [WRAPPER_PATH, 'worktree', 'add', '-b', 'held-topic', join(fixture.path, 'held-topic',),],
          options: { cwd: repositoryRoot, stdio: 'ignore', },
        },);
        /** First creation exit. */
        const holderExit = once(holder, 'exit',);
        await waitForFile({ path: ready, },);
        /** Second creation, which must wait for the holder. */
        const waiter = groups.spawn({
          command: process.execPath,
          args: [WRAPPER_PATH, 'worktree', 'add', '-b', 'waiting-topic', join(fixture.path, 'waiting-topic',),],
          options: { cwd: repositoryRoot, stdio: ['ignore', 'ignore', 'pipe',], },
        },);
        /** Second creation stderr. */
        const waiterStderr: string[] = [];
        waiter.stderr?.on('data', function collect(chunk: Buffer,): void {
          waiterStderr.push(chunk.toString('utf8',),);
        },);
        /** Second creation exit. */
        const waiterExit = once(waiter, 'exit',);

        await wait(LIVE_WAIT_OBSERVATION_MS,);

        expect(waiter.exitCode,).toBeNull();
        expect(holder.exitCode,).toBeNull();
        expect(waiterStderr.join('',),).toContain(`cli-git: waiting for PID ${String(holder.pid,)}`,);
        expect(waiterStderr.join('',),).not.toContain('timed out',);
        await writeFile(release, '',);
        /** Exit codes and signals. */
        const [holderResult, waiterResult,] = await Promise.all([holderExit, waiterExit,],);
        expect(holderResult[0],).toBe(0,);
        expect(waiterResult[0],).toBe(0,);
        expect(
          copySummaryLines(waiterStderr.join('',),),
        ).toHaveLength(1,);
        expect(await readFile(join(fixture.path, 'waiting-topic', 'state.txt',), 'utf8',),).toBe('ignored state\n',);
        expect(await readFile(join(fixture.path, 'held-topic', 'state.txt',), 'utf8',),).toBe('ignored state\n',);
      },
    },),

    it({
      name: 'a worktree creation retires a dead owner lock and succeeds',
      fn: async function testDeadHolder(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Linked source. */
        const repositoryRoot = await sourceWithIgnoredState(fixture.path,);
        /** Process that has exited, so its PID names no live owner birth. */
        const exited = await nanoSpawn(process.execPath, ['-e', 'process.stdout.write(String(process.pid))',],);
        /** Lock left by the dead owner. */
        const lockDirectory = await publishSettlementLock({
          repositoryRoot,
          ownerText: `${JSON.stringify({
            leaseToken: 'dead-owner-token',
            ownerBirthIdentity: 'linux:dead-owner-birth',
            ownerPid: Number(exited.stdout,),
            schemaVersion: 1,
          },)}\n`,
        },);

        /** Creation that must retire the dead lock. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['worktree', 'add', '-b', 'after-dead', join(fixture.path, 'after-dead',),], },),);

        expect(copySummaryLines(result.stderr,),).toHaveLength(1,);
        expect(result.stderr,).not.toContain('waiting for',);
        expect(
          await readdir(dirname(lockDirectory,),),
        ).not.toContain('settlement.lock',);
      },
    },),

    it({
      name: 'an owner record without evidence gets a bounded wait and a diagnostic naming the evidence',
      fn: async function testUnprovenHolder(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Linked source. */
        const repositoryRoot = await sourceWithIgnoredState(fixture.path,);
        /** Lock whose owner record proves nothing. */
        const lockDirectory = await publishSettlementLock({ repositoryRoot, ownerText: 'not json\n', },);
        /** Start of the bounded wait. */
        const started = Date.now();

        /** Creation that cannot prove the owner alive or dead. */
        const failure = requireFailure(await captureWrapper({ cwd: repositoryRoot, args: ['worktree', 'add', '-b', 'unproven', join(fixture.path, 'unproven',),], },),);

        expect(Date.now() - started,).toBeLessThan(UNPROVEN_WAIT_LIMIT_MS,);
        expect(failure.exitCode,).toBe(2,);
        expect(failure.stderr,).toContain('could not prove whether its owner is alive',);
        expect(failure.stderr,).toContain(
          JSON.stringify(join(lockDirectory, 'owner.json',),),
        );
        expect(await readFile(join(lockDirectory, 'owner.json',), 'utf8',),).toBe('not json\n',);
      },
    },),
  ],
},);
