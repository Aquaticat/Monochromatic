/**
 Single-flight push coordination against real disposable repositories, with an injected push so each case controls timing and counts pushes.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../dist/final/node/index.mjs';
import {
  createLandingRepository,
  git,
  type LandingRepository,
  REAL_GIT,
} from './policy-engine/commit-landing-fixture.unit.test.ts';

const {
  acquireOwnerLock,
  readLastPushedRecord,
  resolvePushCoordinationPaths,
  resolveProcessBirthIdentity,
  runSingleFlightPush,
  tipContains,
  writeLastPushedRecord,
} = internalTestExports;

/**
 Branch every case pushes.
 */
const BRANCH_REF = 'refs/heads/main';

/**
 Injected push that counts invocations and records the branch tip each one saw.
 */
type CountingPush = Readonly<{
  /**
   Push callback handed to the coordinator.
   */
  push: () => Promise<Readonly<{ exitCode: number; output: string; }>>;
  /**
   Branch tips observed by each invocation, in order.
   */
  tips: string[];
}>;

/**
 Creates an injected push.

 @param repository - fixture repository

 @param exitCode - exit code every invocation reports

 @param delayMs - time each invocation takes

 @returns counting push
 */
function countingPush({
  repository,
  exitCode = 0,
  delayMs = 0,
}: Readonly<{
  repository: LandingRepository;
  exitCode?: number;
  delayMs?: number;
}>,): CountingPush {
  /**
   Observed tips.
   */
  const tips: string[] = [];
  return {
    tips,
    push: async function injectedPush(): Promise<Readonly<{ exitCode: number; output: string; }>> {
      tips.push(await git({ repository, args: ['rev-parse', BRANCH_REF,], },),);
      await wait(delayMs,);
      return { exitCode, output: exitCode === 0 ? 'remote: ok\n' : 'error: failed to push some refs\n', };
    },
  };
}

/**
 Lands an empty commit with real Git.

 @param repository - fixture repository

 @param message - commit message

 @returns landed OID
 */
async function commit({
  repository,
  message,
}: Readonly<{
  repository: LandingRepository;
  message: string;
}>,): Promise<string> {
  await git({ repository, args: ['commit', '--quiet', '--allow-empty', `--message=${message}`,], },);
  return git({ repository, args: ['rev-parse', 'HEAD',], },);
}

/**
 Coordination files of the fixture branch.

 @param repository - fixture repository

 @returns lock and record paths
 */
async function coordinationPaths(repository: LandingRepository,): Promise<Readonly<{ lockDirectory: string; recordPath: string; }>> {
  return resolvePushCoordinationPaths({ gitPath: REAL_GIT, cwd: repository.path, branchRef: BRANCH_REF, },);
}

/**
 Runs the coordinator for one landed commit.

 @param repository - fixture repository

 @param landedOid - landed commit

 @param injected - injected push

 @param onWait - wait observer

 @returns outcome
 */
async function coordinate({
  repository,
  landedOid,
  injected,
  onWait,
}: Readonly<{
  repository: LandingRepository;
  landedOid: string;
  injected: CountingPush;
  onWait?: () => void;
}>,): ReturnType<typeof runSingleFlightPush> {
  return runSingleFlightPush({
    gitPath: REAL_GIT,
    cwd: repository.path,
    branchRef: BRANCH_REF,
    landedOid,
    push: injected.push,
    ...(onWait === undefined ? {} : { onWait, }),
  },);
}

/**
 Starts the coordinator while the test holds the push lock, resolving once it waits for the lock.

 @param repository - fixture repository

 @param landedOid - landed commit

 @param injected - injected push

 @returns pending outcome, available after the coordinator read the record and began waiting
 */
async function coordinateBehindHeldLock({
  repository,
  landedOid,
  injected,
}: Readonly<{
  repository: LandingRepository;
  landedOid: string;
  injected: CountingPush;
}>,): Promise<Readonly<{ outcome: ReturnType<typeof runSingleFlightPush>; }>> {
  /**
   Resolves once the coordinator reports waiting.
   */
  const waiting = Promise.withResolvers<void>();
  /**
   Pending outcome.
   */
  const outcome = coordinate({ repository, landedOid, injected, onWait: waiting.resolve, },);
  await waiting.promise;
  return { outcome, };
}

/**
 Writes a published push lock owned by a process that has exited.

 @param lockDirectory - lock directory
 */
async function writeDeadLock(lockDirectory: string,): Promise<void> {
  /**
   Short-lived owner stand-in.
   */
  const child = spawn(process.execPath, ['--eval', 'setInterval(() => {}, 1000);',], { stdio: 'ignore', },);
  if (child.pid === undefined)
    throw new Error('Owner stand-in did not start.',);
  /**
   Birth identity while it runs.
   */
  const identity = await resolveProcessBirthIdentity(child.pid,);
  if ((typeof identity) === 'symbol')
    throw new Error('Owner stand-in identity is unavailable.',);
  /**
   Exit notification.
   */
  const exited = once(child, 'exit',);
  child.kill('SIGKILL',);
  await exited;
  await mkdir(lockDirectory,);
  await writeFile(join(lockDirectory, 'owner.json',), `${JSON.stringify({ schemaVersion: 1, token: 'dead', ownerPid: child.pid, ownerBirthIdentity: identity, },)}\n`,);
}

await describe({
  name: runSingleFlightPush.name,
  children: [
    it({
      name: 'pushes the branch tip itself when no push was recorded, and records it',
      fn: async function testFirstPush(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        /** Outcome. */
        const outcome = await coordinate({ repository, landedOid, injected, },);
        expect(outcome,).toEqual({ kind: 'pushed', tip: landedOid, exitCode: 0, output: 'remote: ok\n', covered: true, },);
        expect(injected.tips,).toEqual([landedOid,],);
        /** Record written. */
        const record = await readLastPushedRecord((await coordinationPaths(repository,)).recordPath,);
        expect((typeof record) === 'symbol' ? undefined : { tip: record.tip, outcome: record.outcome, output: record.output, ownerPid: record.ownerPid, },)
          .toEqual({ tip: landedOid, outcome: 'pushed', output: '', ownerPid: process.pid, },);
        /** Coordination directory entries: the record only, no lock or candidate. */
        const entries = await readdir(dirname((await coordinationPaths(repository,)).recordPath,),);
        expect(entries,).toEqual(['refs%2Fheads%2Fmain.last-pushed.json',],);
      },
    },),
    it({
      name: 'joins a recorded successful push covering the commit without taking the lock',
      fn: async function testFastJoin(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Older landed commit. */
        const older = await commit({ repository, message: 'older', },);
        /** Tip that was pushed. */
        const tip = await commit({ repository, message: 'tip', },);
        /** Paths. */
        const { lockDirectory, recordPath, } = await coordinationPaths(repository,);
        await writeLastPushedRecord({ recordPath, record: { schemaVersion: 1, tip, outcome: 'pushed', ownerToken: 'earlier', ownerPid: 1, exitCode: 0, output: '', }, },);
        /** Lock held by this test; a coordinator that waited for it would never finish. */
        await using held = await acquireOwnerLock({ lockDirectory, },);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        expect(await coordinate({ repository, landedOid: older, injected, },),)
          .toEqual({ kind: 'joined-pushed', tip, exitCode: 0, output: '', covered: true, },);
        expect(injected.tips,).toEqual([],);
        expect(held.token,).not.toBe('',);
      },
    },),
    it({
      name: 'pushes itself when the recorded successful push does not cover the commit',
      fn: async function testRecordNotCovering(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Tip that was pushed. */
        const pushed = await commit({ repository, message: 'pushed', },);
        /** Newer landed commit. */
        const landedOid = await commit({ repository, message: 'newer', },);
        await writeLastPushedRecord({ recordPath: (await coordinationPaths(repository,)).recordPath, record: { schemaVersion: 1, tip: pushed, outcome: 'pushed', ownerToken: 'earlier', ownerPid: 1, exitCode: 0, output: '', }, },);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        expect((await coordinate({ repository, landedOid, injected, },)).kind,).toBe('pushed',);
        expect(injected.tips,).toEqual([landedOid,],);
      },
    },),
    it({
      name: 'retries a failed push recorded before it waited instead of reporting that old failure',
      fn: async function testStaleFailure(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        await writeLastPushedRecord({ recordPath: (await coordinationPaths(repository,)).recordPath, record: { schemaVersion: 1, tip: landedOid, outcome: 'failed', ownerToken: 'earlier', ownerPid: 1, exitCode: 1, output: 'old failure', }, },);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        expect((await coordinate({ repository, landedOid, injected, },)).kind,).toBe('pushed',);
        expect(injected.tips,).toEqual([landedOid,],);
      },
    },),
    it({
      name: 'waits for a live pusher and joins its successful push when it covers the commit',
      fn: async function testJoinSuccess(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        /** Paths. */
        const { lockDirectory, recordPath, } = await coordinationPaths(repository,);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        /** Coordinator behind the lock. */
        const pending = await (async function holdAndRecord(): Promise<Readonly<{ outcome: ReturnType<typeof runSingleFlightPush>; }>> {
          /** Live pusher's lock. */
          await using live = await acquireOwnerLock({ lockDirectory, },);
          /** Waiting coordinator. */
          const started = await coordinateBehindHeldLock({ repository, landedOid, injected, },);
          await writeLastPushedRecord({ recordPath, record: { schemaVersion: 1, tip: landedOid, outcome: 'pushed', ownerToken: live.token, ownerPid: process.pid, exitCode: 0, output: '', }, },);
          return started;
        })();
        expect(await pending.outcome,).toEqual({ kind: 'joined-pushed', tip: landedOid, exitCode: 0, output: '', covered: true, },);
        expect(injected.tips,).toEqual([],);
      },
    },),
    it({
      name: 'waits for a live pusher and reports its failed push, with its output, when it covered the commit',
      fn: async function testJoinFailure(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        /** Paths. */
        const { lockDirectory, recordPath, } = await coordinationPaths(repository,);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        /** Coordinator behind the lock. */
        const pending = await (async function holdAndRecord(): Promise<Readonly<{ outcome: ReturnType<typeof runSingleFlightPush>; }>> {
          /** Live pusher's lock. */
          await using live = await acquireOwnerLock({ lockDirectory, },);
          /** Waiting coordinator. */
          const started = await coordinateBehindHeldLock({ repository, landedOid, injected, },);
          await writeLastPushedRecord({ recordPath, record: { schemaVersion: 1, tip: landedOid, outcome: 'failed', ownerToken: live.token, ownerPid: process.pid, exitCode: 1, output: 'pre-push hook declined\n', }, },);
          return started;
        })();
        expect(await pending.outcome,).toEqual({ kind: 'joined-failed', tip: landedOid, exitCode: 1, output: 'pre-push hook declined\n', covered: true, },);
        expect(injected.tips,).toEqual([],);
      },
    },),
    it({
      name: 'pushes itself after a live pusher failed a push that did not cover the commit',
      fn: async function testFailureNotCovering(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Commit the failed push resolved. */
        const failedTip = await commit({ repository, message: 'failed', },);
        /** Newer landed commit. */
        const landedOid = await commit({ repository, message: 'newer', },);
        /** Paths. */
        const { lockDirectory, recordPath, } = await coordinationPaths(repository,);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        /** Coordinator behind the lock. */
        const pending = await (async function holdAndRecord(): Promise<Readonly<{ outcome: ReturnType<typeof runSingleFlightPush>; }>> {
          /** Live pusher's lock. */
          await using live = await acquireOwnerLock({ lockDirectory, },);
          /** Waiting coordinator. */
          const started = await coordinateBehindHeldLock({ repository, landedOid, injected, },);
          await writeLastPushedRecord({ recordPath, record: { schemaVersion: 1, tip: failedTip, outcome: 'failed', ownerToken: live.token, ownerPid: process.pid, exitCode: 1, output: 'declined\n', }, },);
          return started;
        })();
        expect((await pending.outcome).kind,).toBe('pushed',);
        expect(injected.tips,).toEqual([landedOid,],);
      },
    },),
    it({
      name: 'pushes itself when the lock holder released without recording a push',
      fn: async function testHolderRecordedNothing(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        /** Coordinator behind the lock. */
        const pending = await (async function holdOnly(): Promise<Readonly<{ outcome: ReturnType<typeof runSingleFlightPush>; }>> {
          /** Live holder's lock. */
          await using live = await acquireOwnerLock({ lockDirectory: (await coordinationPaths(repository,)).lockDirectory, },);
          expect(live.token,).not.toBe('',);
          /** Waiting coordinator, awaited so the lock is released only after it waits. */
          const started = await coordinateBehindHeldLock({ repository, landedOid, injected, },);
          return started;
        })();
        expect((await pending.outcome).kind,).toBe('pushed',);
        expect(injected.tips,).toEqual([landedOid,],);
      },
    },),
    it({
      name: 'takes over the push lock of a dead pusher and pushes itself',
      fn: async function testDeadPusher(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        /** Paths. */
        const { lockDirectory, } = await coordinationPaths(repository,);
        await writeDeadLock(lockDirectory,);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        expect((await coordinate({ repository, landedOid, injected, },)).kind,).toBe('pushed',);
        expect(injected.tips,).toEqual([landedOid,],);
        /** Coordination directory. */
        const directory = dirname(lockDirectory,);
        expect(await readdir(directory,),).toEqual(['refs%2Fheads%2Fmain.last-pushed.json',],);
      },
    },),
    it({
      name: 'records and reports its own failed push with the complete output',
      fn: async function testOwnFailure(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Landed commit. */
        const landedOid = await commit({ repository, message: 'one', },);
        /** Injected failing push. */
        const injected = countingPush({ repository, exitCode: 1, },);
        expect(await coordinate({ repository, landedOid, injected, },),)
          .toEqual({ kind: 'failed', tip: landedOid, exitCode: 1, output: 'error: failed to push some refs\n', covered: true, },);
        /** Record written. */
        const record = await readLastPushedRecord((await coordinationPaths(repository,)).recordPath,);
        expect((typeof record) === 'symbol' ? undefined : { outcome: record.outcome, output: record.output, exitCode: record.exitCode, },)
          .toEqual({ outcome: 'failed', output: 'error: failed to push some refs\n', exitCode: 1, },);
      },
    },),
    it({
      name: 'reports a pushed tip that no longer contains the landed commit as uncovered',
      fn: async function testUncovered(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Commit that the branch later drops. */
        const landedOid = await commit({ repository, message: 'dropped', },);
        await git({ repository, args: ['reset', '--quiet', '--hard', 'HEAD~1',], },);
        /** Injected push. */
        const injected = countingPush({ repository, },);
        /** Outcome. */
        const outcome = await coordinate({ repository, landedOid, injected, },);
        expect({ kind: outcome.kind, covered: outcome.covered, },).toEqual({ kind: 'pushed', covered: false, },);
      },
    },),
    it({
      name: 'coalesces concurrent landings into fewer pushes than commits, each finishing covered',
      fn: async function testCoalesces(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Commits landed before any push, in order. */
        const landed = [
          await commit({ repository, message: 'c1', },),
          await commit({ repository, message: 'c2', },),
          await commit({ repository, message: 'c3', },),
          await commit({ repository, message: 'c4', },),
          await commit({ repository, message: 'c5', },),
        ];
        /** Injected slow push. */
        // 200 ms is long enough that every other coordinator waits for this push.
        const injected = countingPush({ repository, delayMs: 200, },);
        /** Every outcome. */
        const outcomes = await Promise.all(landed.map(function coordinateOne(landedOid,): ReturnType<typeof runSingleFlightPush> {
          return coordinate({ repository, landedOid, injected, },);
        },),);
        expect(injected.tips.length,).toBe(1,);
        expect(outcomes.every(function isCoveredSuccess(outcome,): boolean {
          return outcome.covered && ((outcome.kind === 'pushed') || (outcome.kind === 'joined-pushed'));
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: tipContains.name,
  children: [
    it({
      name: 'reports ancestry and rethrows Git failures other than not-an-ancestor',
      fn: async function testTipContains(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Older commit. */
        const older = await commit({ repository, message: 'older', },);
        /** Newer commit. */
        const newer = await commit({ repository, message: 'newer', },);
        expect(await tipContains({ gitPath: REAL_GIT, cwd: repository.path, oid: older, tip: newer, },),).toBe(true,);
        expect(await tipContains({ gitPath: REAL_GIT, cwd: repository.path, oid: newer, tip: newer, },),).toBe(true,);
        expect(await tipContains({ gitPath: REAL_GIT, cwd: repository.path, oid: newer, tip: older, },),).toBe(false,);
        await expect(tipContains({ gitPath: REAL_GIT, cwd: repository.path, oid: 'f'.repeat(40,), tip: newer, },),).rejects.toThrow();
      },
    },),
  ],
},);

await describe({
  name: resolvePushCoordinationPaths.name,
  children: [
    it({
      name: 'places coordination files under the common Git directory, shared by linked worktrees',
      fn: async function testLinkedWorktree(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Linked worktree. */
        const linked = join(repository.scratch, 'linked',);
        await git({ repository, args: ['worktree', 'add', '--quiet', '-b', 'side', linked,], },);
        /** Paths resolved from the linked worktree. */
        const paths = await resolvePushCoordinationPaths({ gitPath: REAL_GIT, cwd: linked, branchRef: 'refs/heads/side', },);
        expect(paths,).toEqual({
          lockDirectory: join(repository.gitDir, 'cli-git', 'push', 'refs%2Fheads%2Fside.lock',),
          recordPath: join(repository.gitDir, 'cli-git', 'push', 'refs%2Fheads%2Fside.last-pushed.json',),
        },);
      },
    },),
  ],
},);
