/**
 Single-flight auto-push driven through the built wrapper against disposable repositories and local bare remotes.

 Pre-push hooks are Node programs that log each invocation,
 and the first invocation can wait at a barrier,
 so a push stays in flight while later commits land.
 Commits land one after another,
 so no case depends on replay.

 @module
 */
import type { ChildProcess, } from 'node:child_process';
import { access, readdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import {
  barrierSource,
  createLandingRepository,
  finish,
  git,
  type LandingRepository,
  leftovers,
  type ProcessOutcome,
  REAL_GIT,
  readText,
  runWrapper,
  startWrapper,
  waitForFile,
  writeHook,
  writeWorktreeFile,
} from './policy-engine/commit-landing-fixture.unit.test.ts';
import { waitUntil, } from './index-lock/index-lock-fixture.unit.test.ts';

/**
 Note every failed push prints, owned or joined.
 */
const PUSH_FAILED_NOTE = 'auto-push to origin failed';

/**
 Time a commit whose push has not finished is given to exit early, which it must not.
 */
const EARLY_EXIT_WINDOW_MS = 1_000;

/**
 Debug line a commit prints, under `MONOCHROMATIC_VERBOSE=true`, once it waits for another invocation's push lock.
 */
const WAITING_FOR_PUSH_LOG = 'waiting for the in-flight push of refs/heads/main';

/**
 Environment that makes the wrapper print its debug log, including the push-lock wait, on stderr.
 */
const VERBOSE_ENV: Readonly<Record<string, string>> = { MONOCHROMATIC_VERBOSE: 'true', };

/**
 Repository with a local bare remote and a logging pre-push hook.
 */
type PushFixture = Readonly<{
  /**
   Fixture repository.
   */
  repository: LandingRepository;
  /**
   Bare remote.
   */
  remote: string;
  /**
   Pre-push invocation log.
   */
  prePushLog: string;
  /**
   Marker the first pre-push invocation writes, holding its PID, when it waits.
   */
  ready: string;
  /**
   File releasing the first pre-push invocation.
   */
  release: string;
}>;

/**
 Creates a repository whose `main` tracks a fresh bare `origin`, with a pre-push hook.

 @param holdFirstPush - whether the first pre-push invocation waits at the barrier

 @param prePushExitCode - exit code of every pre-push invocation

 @param upstream - whether `main` already tracks `origin/main`

 @returns fixture
 */
async function createPushFixture({
  holdFirstPush = false,
  prePushExitCode = 0,
  upstream = true,
}: Readonly<{
  holdFirstPush?: boolean;
  prePushExitCode?: number;
  upstream?: boolean;
}> = {},): Promise<PushFixture & AsyncDisposable> {
  /**
   Fixture repository.
   */
  const repository = await createLandingRepository();
  /**
   Bare remote.
   */
  const remote = join(repository.scratch, 'remote.git',);
  await nanoSpawn(REAL_GIT, ['init', '--quiet', '--bare', remote,], { env: repository.env, },);
  await git({ repository, args: ['remote', 'add', 'origin', remote,], },);
  if (upstream)
    await git({ repository, args: ['push', '--quiet', '--set-upstream', 'origin', 'main',], },);
  /**
   Barrier and log paths.
   */
  const prePushLog = join(repository.scratch, 'pre-push.log',);
  /**
   Barrier readiness marker.
   */
  const ready = join(repository.scratch, 'pre-push.ready',);
  /**
   Barrier release file.
   */
  const release = join(repository.scratch, 'pre-push.release',);
  await writeHook({
    repository,
    event: 'pre-push',
    source: [
      'const prePushFs = require("node:fs");',
      `prePushFs.appendFileSync(${JSON.stringify(prePushLog,)}, "pre-push\\n");`,
      `const prePushCount = prePushFs.readFileSync(${JSON.stringify(prePushLog,)}, "utf8").split("\\n").filter(Boolean).length;`,
      holdFirstPush ? `if (prePushCount === 1) {\nprePushFs.writeFileSync(${JSON.stringify(`${ready}.parent`,)}, String(process.ppid));\n${barrierSource({ ready, release, },)}\n}` : '',
      `process.exit(${String(prePushExitCode,)});`,
    ].join('\n',),
  },);
  return {
    repository,
    remote,
    prePushLog,
    ready,
    release,
    async [Symbol.asyncDispose](): Promise<void> {
      await repository[Symbol.asyncDispose]();
    },
  };
}

/**
 Counts pre-push invocations, one per push that reached the hook.

 @param fixture - push fixture

 @returns invocation count
 */
async function pushCount(fixture: PushFixture,): Promise<number> {
  return (await readText(fixture.prePushLog,))
    .split('\n',)
    .filter(Boolean,)
    .length;
}

/**
 Reports whether the bare remote's `main` contains a commit.

 @param fixture - push fixture

 @param oid - commit

 @returns containment
 */
async function remoteContains({
  fixture,
  oid,
}: Readonly<{
  fixture: PushFixture;
  oid: string;
}>,): Promise<boolean> {
  try {
    await nanoSpawn(REAL_GIT, ['merge-base', '--is-ancestor', oid, 'refs/heads/main',], { cwd: fixture.remote, env: fixture.repository.env, },);
    return true;
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError)
      return false;
    throw error;
  }
}

/**
 Commit OIDs on local `main` keyed by subject.

 @param repository - fixture repository

 @returns OID per subject
 */
async function oidsBySubject(repository: LandingRepository,): Promise<ReadonlyMap<string, string>> {
  return new Map((await git({ repository, args: ['log', '--format=%s %H', 'main',], },))
    .split('\n',)
    .map(function subjectAndOid(line,): readonly [string, string] {
      /**
       Subject and OID.
       */
      const [subject = '', oid = '',] = line.split(' ',);
      return [subject, oid,];
    },),);
}

/**
 Waits until local `main` holds a number of commits.

 @param repository - fixture repository

 @param count - expected commit count
 */
async function waitForCommitCount({
  repository,
  count,
}: Readonly<{
  repository: LandingRepository;
  count: number;
}>,): Promise<void> {
  /**
   Deadline.
   */
  const deadline = Date.now() + 20_000;
  // oxlint-disable-next-line no-await-in-loop -- Each poll observes the landings that happened since the last one.
  while (await git({ repository, args: ['rev-list', '--count', 'main',], },) !== String(count,)) {
    if (Date.now() > deadline)
      throw new Error(`main never reached ${String(count,)} commits`,);
    // oxlint-disable-next-line no-await-in-loop -- Polling delay.
    await wait(20,);
  }
}

/**
 Wrapper commit started in the background, with an exit flag.
 */
type StartedCommit = Readonly<{
  /**
   Child process.
   */
  child: ChildProcess;
  /**
   Outcome once it exits.
   */
  outcome: Promise<ProcessOutcome>;
  /**
   Whether it has exited.
   */
  exited: () => boolean;
  /**
   Standard error so far.
   */
  stderr: () => string;
}>;

/**
 Starts a wrapper commit of one new file.

 @param repository - fixture repository

 @param name - file stem and commit subject

 @returns started commit
 */
async function startCommit({
  repository,
  name,
  env = {},
}: Readonly<{
  repository: LandingRepository;
  name: string;
  env?: Readonly<Record<string, string>>;
}>,): Promise<StartedCommit> {
  await writeWorktreeFile({ repository, name: `${name}.txt`, content: `${name}\n`, },);
  /**
   Child process.
   */
  const child = startWrapper({ repository, args: ['commit', '-m', name, `${name}.txt`,], env, },);
  /**
   Exit flag and standard error so far.
   */
  const state = { exited: false, stderr: '', };
  child.once('exit', function markExited(): void {
    state.exited = true;
  },);
  /**
   Outcome, whose collector sets the stream encoding before the observer below attaches.
   */
  const outcome = finish(child,);
  child.stderr?.on('data', function observeStderr(chunk: string,): void {
    state.stderr += chunk;
  },);
  return {
    child,
    outcome,
    exited: function exited(): boolean {
      return state.exited;
    },
    stderr: function stderr(): string {
      return state.stderr;
    },
  };
}

/**
 Lands commits one after another while the first push waits at the pre-push barrier.

 @param fixture - push fixture holding its first push

 @param names - commit subjects in landing order

 @returns started commits
 */
async function landBehindHeldPush({
  fixture,
  names,
  env = {},
}: Readonly<{
  fixture: PushFixture;
  names: readonly string[];
  env?: Readonly<Record<string, string>>;
}>,): Promise<readonly StartedCommit[]> {
  /**
   Commits on `main` before any of these.
   */
  const base = Number(await git({ repository: fixture.repository, args: ['rev-list', '--count', 'main',], },),);
  /**
   Started commits.
   */
  const started: StartedCommit[] = [];
  for (const [index, name,] of names.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- Commits land one after another so none needs replay.
    started.push(await startCommit({ repository: fixture.repository, name, env, },),);
    // oxlint-disable-next-line no-await-in-loop -- Waits for this landing before starting the next commit.
    await waitForCommitCount({ repository: fixture.repository, count: base + index + 1, },);
    if (index === 0)
      // oxlint-disable-next-line no-await-in-loop -- The first commit's push must be in flight before the rest land.
      await waitForFile({ path: fixture.ready, },);
  }
  return started;
}

/**
 Waits until a process no longer exists.

 @param pid - process ID
 */
async function waitForProcessExit(pid: number,): Promise<void> {
  /**
   Deadline.
   */
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      process.kill(pid, 0,);
    }
    catch (error: unknown) {
      if (Error.isError(error,) && ('code' in error) && (error.code === 'ESRCH'))
        return;
      throw error;
    }
    if (Date.now() > deadline)
      throw new Error(`process ${String(pid,)} did not exit`,);
    // oxlint-disable-next-line no-await-in-loop -- Polling delay.
    await wait(20,);
  }
}

/**
 Push coordination entries left under the common Git directory.

 @param repository - fixture repository

 @returns entry names, empty when the directory is absent
 */
async function pushEntries(repository: LandingRepository,): Promise<readonly string[]> {
  /**
   Coordination directory.
   */
  const directory = join(repository.gitDir, 'cli-git', 'push',);
  try {
    await access(directory,);
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
  return readdir(directory,);
}

await describe({
  name: 'single-flight auto-push through the wrapper',
  children: [
    it({
      name: 'coalesces pushes of commits landing behind an in-flight push, and each commit exits only once the remote contains it',
      fn: async function testCoalesces(): Promise<void> {
        await using fixture = await createPushFixture({ holdFirstPush: true, },);
        /** Subjects in landing order. */
        const names = ['c1', 'c2', 'c3', 'c4',];
        /** Started commits, all landed, the first holding its push. */
        const started = await landBehindHeldPush({ fixture, names, },);
        await wait(EARLY_EXIT_WINDOW_MS,);
        expect(started.map(function exited(commit,): boolean {
          return commit.exited();
        },),).toEqual([false, false, false, false,],);
        await writeFile(fixture.release, '',);
        /** Outcomes. */
        const outcomes = await Promise.all(started.map(async function outcomeOf(commit,): Promise<ProcessOutcome> {
          return commit.outcome;
        },),);
        expect(outcomes.map(function exitCode(outcome,): number {
          return outcome.exitCode;
        },),).toEqual([0, 0, 0, 0,],);
        expect(outcomes.some(function failed(outcome,): boolean {
          return outcome.stderr.includes(PUSH_FAILED_NOTE,);
        },),).toBe(false,);
        expect(await pushCount(fixture,),).toBe(2,);
        /** Landed OIDs. */
        const oids = await oidsBySubject(fixture.repository,);
        for (const name of names) {
          // oxlint-disable-next-line no-await-in-loop -- Remote reads are independent and few.
          expect(await remoteContains({ fixture, oid: oids.get(name,) ?? name, },),).toBe(true,);
        }
        expect(await pushEntries(fixture.repository,),).toEqual(['refs%2Fheads%2Fmain.last-pushed.json',],);
        expect(await leftovers(fixture.repository,),).toEqual([],);
      },
    },),
    it({
      name: 'reports a joined push failure from every commit it covered, each exiting 0 and keeping its commit',
      fn: async function testJoinedFailure(): Promise<void> {
        await using fixture = await createPushFixture({ holdFirstPush: true, prePushExitCode: 1, },);
        /** Remote tip before any commit. */
        const remoteBefore = await nanoSpawn(REAL_GIT, ['rev-parse', 'refs/heads/main',], { cwd: fixture.remote, },);
        /** Subjects in landing order. */
        const names = ['c1', 'c2', 'c3',];
        /** Started commits. */
        const started = await landBehindHeldPush({ fixture, names, env: VERBOSE_ENV, },);
        // A commit reaching auto-push only after the joined push already failed finds a failed record and pushes again,
        // so release only once every later commit waits for the held push lock.
        await waitUntil({ predicate: function laterCommitsWait(): boolean {
          return started.slice(1,).every(function waits(commit,): boolean {
            return commit.stderr().includes(WAITING_FOR_PUSH_LOG,);
          },);
        }, },);
        await writeFile(fixture.release, '',);
        /** Outcomes. */
        const outcomes = await Promise.all(started.map(async function outcomeOf(commit,): Promise<ProcessOutcome> {
          return commit.outcome;
        },),);
        expect(outcomes.map(function exitCode(outcome,): number {
          return outcome.exitCode;
        },),).toEqual([0, 0, 0,],);
        expect(outcomes.every(function reportsFailure(outcome,): boolean {
          return outcome.stderr.includes(PUSH_FAILED_NOTE,) && outcome.stderr.includes('failed to push',);
        },),).toBe(true,);
        expect(await pushCount(fixture,),).toBe(2,);
        expect(await git({ repository: fixture.repository, args: ['log', '--format=%s', '-3', 'main',], },),).toBe('c3\nc2\nc1',);
        expect((await nanoSpawn(REAL_GIT, ['rev-parse', 'refs/heads/main',], { cwd: fixture.remote, },)).stdout,).toBe(remoteBefore.stdout,);
      },
    },),
    it({
      name: 'takes over from a pusher killed mid-push, and the remote receives both commits',
      fn: async function testKilledPusher(): Promise<void> {
        await using fixture = await createPushFixture({ holdFirstPush: true, },);
        /** Both commits landed, the first holding its push. */
        const [first, second,] = await landBehindHeldPush({ fixture, names: ['c1', 'c2',], },);
        if ((first === undefined) || (second === undefined))
          throw new Error('Both commits must start.',);
        first.child.kill('SIGKILL',);
        expect((await first.outcome).exitCode,).toBe(-1,);
        /** Surviving commit's outcome. */
        const outcome = await second.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(outcome.stderr,).not.toContain(PUSH_FAILED_NOTE,);
        /** Landed OIDs. */
        const oids = await oidsBySubject(fixture.repository,);
        expect(await remoteContains({ fixture, oid: oids.get('c1',) ?? 'c1', },),).toBe(true,);
        expect(await remoteContains({ fixture, oid: oids.get('c2',) ?? 'c2', },),).toBe(true,);
        expect(await pushCount(fixture,),).toBe(2,);
        expect(await pushEntries(fixture.repository,),).toEqual(['refs%2Fheads%2Fmain.last-pushed.json',],);
        // The killed pusher's orphaned `git push` still waits in its hook; release it, let it finish, and check it left the takeover tip.
        /** Orphaned hook process. */
        const orphanHook = Number(await readText(fixture.ready,),);
        /** Orphaned `git push` running the hook. */
        const orphanPush = Number(await readText(`${fixture.ready}.parent`,),);
        await writeFile(fixture.release, '',);
        await waitForProcessExit(orphanHook,);
        await waitForProcessExit(orphanPush,);
        expect((await nanoSpawn(REAL_GIT, ['rev-parse', 'refs/heads/main',], { cwd: fixture.remote, },)).stdout,).toBe(oids.get('c2',),);
      },
    },),
    it({
      name: 'surfaces a rejected push with its full output, exits 0, and keeps the commit local',
      fn: async function testRejected(): Promise<void> {
        await using fixture = await createPushFixture({ prePushExitCode: 1, },);
        await writeWorktreeFile({ repository: fixture.repository, name: 'a.txt', content: 'a\n', },);
        /** Commit whose push the hook rejects. */
        const outcome = await runWrapper({ repository: fixture.repository, args: ['commit', '-m', 'a', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(outcome.stderr,).toContain('failed to push',);
        expect(outcome.stderr,).toContain(PUSH_FAILED_NOTE,);
        expect(await git({ repository: fixture.repository, args: ['log', '-1', '--format=%s', 'main',], },),).toBe('a',);
        expect(await remoteContains({ fixture, oid: await git({ repository: fixture.repository, args: ['rev-parse', 'main',], },), },),).toBe(false,);
        expect(await pushCount(fixture,),).toBe(1,);
      },
    },),
    it({
      name: 'pushes a branch without an upstream with --set-upstream origin HEAD',
      fn: async function testNoUpstream(): Promise<void> {
        await using fixture = await createPushFixture({ upstream: false, },);
        await writeWorktreeFile({ repository: fixture.repository, name: 'a.txt', content: 'a\n', },);
        expect((await runWrapper({ repository: fixture.repository, args: ['commit', '-m', 'a', 'a.txt',], },)).exitCode,).toBe(0,);
        expect(await git({ repository: fixture.repository, args: ['config', 'branch.main.remote',], },),).toBe('origin',);
        expect(await remoteContains({ fixture, oid: await git({ repository: fixture.repository, args: ['rev-parse', 'main',], },), },),).toBe(true,);
        expect(await pushCount(fixture,),).toBe(1,);
      },
    },),
    it({
      name: 'pushes plainly to an upstream on another remote without re-pointing it to origin',
      fn: async function testOtherUpstream(): Promise<void> {
        await using fixture = await createPushFixture({ upstream: false, },);
        await git({ repository: fixture.repository, args: ['remote', 'rename', 'origin', 'alt',], },);
        await git({ repository: fixture.repository, args: ['push', '--quiet', '--no-verify', '--set-upstream', 'alt', 'main',], },);
        await writeWorktreeFile({ repository: fixture.repository, name: 'a.txt', content: 'a\n', },);
        expect((await runWrapper({ repository: fixture.repository, args: ['commit', '-m', 'a', 'a.txt',], },)).exitCode,).toBe(0,);
        expect(await git({ repository: fixture.repository, args: ['config', 'branch.main.remote',], },),).toBe('alt',);
        expect(await remoteContains({ fixture, oid: await git({ repository: fixture.repository, args: ['rev-parse', 'main',], },), },),).toBe(true,);
        expect(await pushCount(fixture,),).toBe(1,);
      },
    },),
    it({
      name: 'skips with a note on a detached HEAD and leaves the remote untouched',
      fn: async function testDetached(): Promise<void> {
        await using fixture = await createPushFixture();
        await git({ repository: fixture.repository, args: ['checkout', '--quiet', '--detach', 'main',], },);
        await writeWorktreeFile({ repository: fixture.repository, name: 'a.txt', content: 'a\n', },);
        /** Detached commit. */
        const outcome = await runWrapper({ repository: fixture.repository, args: ['commit', '-m', 'a', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(outcome.stderr,).toContain('HEAD is detached',);
        expect(await remoteContains({ fixture, oid: await git({ repository: fixture.repository, args: ['rev-parse', 'HEAD',], },), },),).toBe(false,);
        expect(await pushCount(fixture,),).toBe(0,);
        expect(await pushEntries(fixture.repository,),).toEqual([],);
      },
    },),
    it({
      name: 'skips silently without an upstream or an origin remote',
      fn: async function testNoRemote(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Commit with nowhere to push. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'a', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(outcome.stderr,).not.toContain('auto-push',);
        expect(outcome.stderr,).not.toContain('HEAD is detached',);
        expect(await pushEntries(repository,),).toEqual([],);
      },
    },),
  ],
},);
