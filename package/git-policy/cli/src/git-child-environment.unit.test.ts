/**
 Lock PID injection: numbered Git configuration is appended without disturbing existing entries,
 and a real `git add` blocked while it holds `index.lock` leaves Git's owner PID file only under the injection.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  lstat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../dist/final/node/index.mjs';
import {
  barrierSource,
  createLandingRepository,
  git,
  type LandingRepository,
  readText,
  REAL_GIT,
  waitForFile,
  writeNodeProgram,
} from './policy-engine/commit-landing-fixture.unit.test.ts';

const {
  CONFIG_COUNT_MALFORMED,
  gitChildEnvironment,
  lockfilePidOverlay,
  parseConfigCount,
  scanProcFdHolders,
} = internalTestExports;

/**
 Observations made while a real `git add` is blocked inside its clean filter.
 */
type BlockedAddObservation = Readonly<{
  /**
   PID file text, empty when absent.
   */
  pidFile: string;
  /**
   Git's PID.
   */
  gitPid: number;
  /**
   PIDs holding `index.lock` open, matched by device and inode.
   */
  holderPids: readonly number[];
  /**
   Exit code after release.
   */
  exitCode: unknown;
}>;

/**
 Runs a real `git add` whose clean filter blocks at a barrier, and observes the lock files while it blocks.

 @param repository - fixture repository

 @param name - barrier name

 @param env - Git child environment

 @returns observations
 */
async function observeBlockedAdd({
  repository,
  name,
  env,
}: Readonly<{
  repository: LandingRepository;
  name: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<BlockedAddObservation> {
  /**
   Barrier marker.
   */
  const ready = join(repository.scratch, `${name}.ready`,);
  /**
   Barrier release.
   */
  const release = join(repository.scratch, `${name}.release`,);
  /**
   Clean filter program: waits at the barrier, then copies standard input.
   */
  const filter = join(repository.scratch, `${name}-filter.cjs`,);
  await writeNodeProgram({
    path: filter,
    source: `${barrierSource({ ready, release, },)}\nprocess.stdin.pipe(process.stdout);`,
  },);
  await git({ repository, args: ['config', 'filter.blocking.clean', filter,], },);
  await writeFile(join(repository.path, '.gitattributes',), '*.blocked filter=blocking\n',);
  await writeFile(join(repository.path, `${name}.blocked`,), 'content\n',);
  /**
   Blocked `git add`.
   */
  const child = spawn(REAL_GIT, ['add', '--', `${name}.blocked`,], { cwd: repository.path, env, stdio: 'ignore', },);
  /**
   Exit promise registered before waiting.
   */
  const exited = once(child, 'exit',);
  await waitForFile({ path: ready, },);
  /**
   Lock metadata while held.
   */
  const lock = await lstat(join(repository.gitDir, 'index.lock',), { bigint: true, },);
  /**
   PID file text.
   */
  const pidFile = await readText(join(repository.gitDir, 'index~pid.lock',),);
  /**
   Open holders.
   */
  const holders = await scanProcFdHolders({ device: lock.dev, inode: lock.ino, },);
  await writeFile(release, '',);
  /**
   Exit code and signal.
   */
  const exitResult: readonly unknown[] = await exited;
  return {
    pidFile,
    gitPid: child.pid ?? (-1),
    holderPids: holders.holders.map(function pidOf(holder,): number {
      return holder.pid;
    },),
    exitCode: exitResult[0],
  };
}

await describe({
  name: 'core.lockfilePid injection',
  children: [
    it({
      name: 'appends at index 0 to an environment without numbered configuration',
      fn: async function testEmpty(): Promise<void> {
        await Promise.resolve();
        expect(lockfilePidOverlay({},),).toEqual({
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'core.lockfilePid',
          GIT_CONFIG_VALUE_0: 'true',
        },);
      },
    },),
    it({
      name: 'preserves existing numbered entries and appends after them',
      fn: async function testPreserve(): Promise<void> {
        await Promise.resolve();
        /** Caller environment with two entries. */
        const environment = {
          GIT_CONFIG_COUNT: '2',
          GIT_CONFIG_KEY_0: 'user.name',
          GIT_CONFIG_VALUE_0: 'kept',
          GIT_CONFIG_KEY_1: 'core.lockfilePid',
          GIT_CONFIG_VALUE_1: 'false',
          PATH: '/bin',
        };
        expect(gitChildEnvironment(environment,),).toEqual({
          ...environment,
          GIT_CONFIG_COUNT: '3',
          GIT_CONFIG_KEY_2: 'core.lockfilePid',
          GIT_CONFIG_VALUE_2: 'true',
        },);
      },
    },),
    it({
      name: 'adds nothing when the last numbered entry already enables it in any spelling',
      fn: async function testIdempotent(): Promise<void> {
        await Promise.resolve();
        expect(lockfilePidOverlay({
          GIT_CONFIG_COUNT: '2',
          GIT_CONFIG_KEY_0: 'core.lockfilePid',
          GIT_CONFIG_VALUE_0: 'false',
          GIT_CONFIG_KEY_1: 'CORE.LockFilePID',
          GIT_CONFIG_VALUE_1: 'Yes',
        },),).toEqual({},);
        expect(
          lockfilePidOverlay(gitChildEnvironment({},),),
        ).toEqual({},);
      },
    },),
    it({
      name: 'leaves a malformed count for Git to report',
      fn: async function testMalformed(): Promise<void> {
        await Promise.resolve();
        expect(lockfilePidOverlay({ GIT_CONFIG_COUNT: '2x', },),).toEqual({},);
        expect(parseConfigCount('2x',),).toBe(CONFIG_COUNT_MALFORMED,);
        expect(parseConfigCount('-1',),).toBe(CONFIG_COUNT_MALFORMED,);
        expect(parseConfigCount('',),).toBe(0,);
        expect(parseConfigCount('12',),).toBe(12,);
      },
    },),
    it({
      name: 'a real git add blocked while holding index.lock leaves its PID file only under the injection',
      fn: async function testRealAdd(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Without the injection. */
        const plain = await observeBlockedAdd({ repository, name: 'plain', env: { ...repository.env, GIT_CONFIG_COUNT: '0', }, },);
        expect(plain.exitCode,).toBe(0,);
        expect(plain.pidFile,).toBe('',);
        expect(plain.holderPids,).toEqual([plain.gitPid,],);
        /** With the injection. */
        const injected = await observeBlockedAdd({ repository, name: 'injected', env: gitChildEnvironment({ ...repository.env, GIT_CONFIG_COUNT: '0', },), },);
        expect(injected.exitCode,).toBe(0,);
        expect(injected.pidFile,).toBe(`pid ${String(injected.gitPid,)}\n`,);
        expect(injected.holderPids,).toEqual([injected.gitPid,],);
      },
    },),
  ],
},);
