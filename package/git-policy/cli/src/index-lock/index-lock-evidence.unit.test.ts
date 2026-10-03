/**
 Foreign `index.lock` evidence and verdicts:
 every classification branch,
 PID files naming live,
 exited,
 and reused processes against real processes,
 open holders matched by device and inode,
 and the platform output parsers.

 @module
 */
import {
  type ChildProcess,
  spawn,
} from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import { waitForFile, } from '../policy-engine/commit-landing-fixture.unit.test.ts';

const {
  classifyIndexLock,
  describeIndexLockEvidence,
  gatherIndexLockEvidence,
  LOCK_ABSENT,
  matchingHolders,
  parseLinuxStat,
  parseLsofFields,
  parsePidFileText,
  parseRestartManagerOutput,
  PID_TEXT_MALFORMED,
  readLockMetadata,
  readPidFileEvidence,
  resolveProcessStart,
} = internalTestExports;

/**
 Evidence shape.
 */
type Evidence = Parameters<typeof classifyIndexLock>[0];

/**
 Lock metadata shared by pure fixtures.
 */
const LOCK = {
  device: 2_049n,
  inode: 77n,
  ctimeMs: 1_700_000_000_000,
} as const;

/**
 Pure evidence with the given PID file and holders.

 @param pidFile - PID file evidence

 @param holderPids - open holders

 @returns evidence
 */
function evidenceWith({
  pidFile,
  holderPids = [],
}: Readonly<{
  pidFile: Evidence['pidFile'];
  holderPids?: readonly number[];
}>,): Evidence {
  return {
    lockPath: '/repo/.git/index.lock',
    lock: LOCK,
    pidFile,
    holders: {
      method: 'proc-fd',
      holders: holderPids.map(function holder(pid,) {
        return { pid, };
      },),
      partial: [],
    },
  };
}

/**
 Disposable scratch directory holding a fake `index` path.
 */
type Scratch = AsyncDisposable & Readonly<{
  /**
   Directory.
   */
  path: string;
  /**
   Real index path whose lock is `<index>.lock`.
   */
  indexPath: string;
}>;

/**
 Creates a scratch directory.

 @returns scratch
 */
async function scratch(): Promise<Scratch> {
  /** Directory. */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-index-lock-',),);
  return {
    path,
    indexPath: join(path, 'index',),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Running Node child killed on disposal.
 */
type Sleeper = AsyncDisposable & Readonly<{
  /**
   Child PID.
   */
  pid: number;
}>;

/**
 Starts a Node child that stays alive, optionally holding a file open.

 @param holdOpen - file the child opens before signalling readiness

 @param ready - readiness marker when holding a file

 @returns running child
 */
async function startSleeper({
  holdOpen,
  ready,
}: Readonly<{
  holdOpen?: string;
  ready?: string;
}> = {},): Promise<Sleeper> {
  /** Child program. */
  const source = (holdOpen === undefined) || (ready === undefined)
    ? 'setInterval(() => {}, 1000);'
    : `const fs = require('node:fs'); globalThis.held = fs.openSync(${JSON.stringify(holdOpen,)}, 'r'); fs.writeFileSync(${JSON.stringify(ready,)}, ''); setInterval(() => {}, 1000);`;
  /** Child. */
  const child: ChildProcess = spawn(process.execPath, ['-e', source,], { stdio: 'ignore', },);
  if (ready !== undefined)
    await waitForFile({ path: ready, },);
  return {
    pid: child.pid ?? (-1),
    async [Symbol.asyncDispose](): Promise<void> {
      /** Exit promise. */
      const exited = once(child, 'exit',);
      child.kill('SIGKILL',);
      await exited;
    },
  };
}

/**
 PID of a Node child that already exited.

 @returns exited PID
 */
async function exitedPid(): Promise<number> {
  /** Short-lived child. */
  const child = spawn(process.execPath, ['-e', '',], { stdio: 'ignore', },);
  await once(child, 'exit',);
  return child.pid ?? (-1);
}

/**
 Writes a lock and, when given, Git's PID file naming a PID.

 @param indexPath - fake index path

 @param pid - PID the PID file names

 @returns lock metadata
 */
async function writeLock({
  indexPath,
  pid,
}: Readonly<{
  indexPath: string;
  pid?: number;
}>,): Promise<Exclude<Awaited<ReturnType<typeof readLockMetadata>>, typeof LOCK_ABSENT>> {
  await writeFile(`${indexPath}.lock`, 'lock',);
  if (pid !== undefined)
    await writeFile(`${indexPath}~pid.lock`, `pid ${String(pid,)}\n`,);
  /** Metadata. */
  const lock = await readLockMetadata(`${indexPath}.lock`,);
  if ((typeof lock) === 'symbol')
    throw new Error('lock vanished',);
  return lock;
}

/**
 Host start-time source.

 @param pid - process ID

 @returns start
 */
async function hostStart(pid: number,): ReturnType<typeof resolveProcessStart> {
  return await resolveProcessStart({ pid, },);
}

await describe({
  name: 'foreign index.lock evidence',
  children: [
    it({
      name: 'classifies every evidence combination',
      fn: async function testClassify(): Promise<void> {
        await Promise.resolve();
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'absent', }, holderPids: [7,], },),),
        ).toEqual({ kind: 'proven-alive', pid: 7, source: 'open-descriptor', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'owner', pid: 8, owner: { state: 'missing', }, }, holderPids: [7,], },),),
        ).toEqual({ kind: 'proven-alive', pid: 7, source: 'open-descriptor', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'owner', pid: 8, owner: { state: 'started-before-lock', startedAtMs: 1, }, }, },),),
        ).toEqual({ kind: 'proven-alive', pid: 8, source: 'pid-file', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'owner', pid: 8, owner: { state: 'missing', }, }, },),),
        ).toEqual({ kind: 'dead', pid: 8, },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'owner', pid: 8, owner: { state: 'started-after-lock', startedAtMs: 1, }, }, },),),
        ).toEqual({ kind: 'evidence-free', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'owner', pid: 8, owner: { state: 'start-unknown', reason: 'x', }, }, },),),
        ).toEqual({ kind: 'evidence-free', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'absent', }, },),),
        ).toEqual({ kind: 'evidence-free', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'malformed', text: 'x', }, },),),
        ).toEqual({ kind: 'evidence-free', },);
        expect(
          classifyIndexLock(evidenceWith({ pidFile: { kind: 'unreadable', reason: 'EACCES', }, },),),
        ).toEqual({ kind: 'evidence-free', },);
      },
    },),
    it({
      name: 'proves a live PID-file owner started before the lock and skips the holder scan',
      fn: async function testLiveOwner(): Promise<void> {
        await using directory = await scratch();
        await using owner = await startSleeper();
        await wait(50,);
        await writeLock({ indexPath: directory.indexPath, pid: owner.pid, },);
        /** Evidence. */
        const evidence = await gatherIndexLockEvidence({ realIndexPath: directory.indexPath, },);
        if ((typeof evidence) === 'symbol')
          throw new Error('lock absent',);
        expect(evidence.holders,).toBeUndefined();
        expect(classifyIndexLock(evidence,),).toEqual({ kind: 'proven-alive', pid: owner.pid, source: 'pid-file', },);
      },
    },),
    it({
      name: 'calls a PID file naming an exited process dead',
      fn: async function testExited(): Promise<void> {
        await using directory = await scratch();
        /** Exited PID. */
        const pid = await exitedPid();
        /** Lock. */
        const lock = await writeLock({ indexPath: directory.indexPath, pid, },);
        /** PID file evidence. */
        const pidFile = await readPidFileEvidence({ pidPath: `${directory.indexPath}~pid.lock`, lock, resolveStart: hostStart, },);
        expect(pidFile,).toEqual({ kind: 'owner', pid, owner: { state: 'missing', }, },);
        /** Full evidence. */
        const evidence = await gatherIndexLockEvidence({ realIndexPath: directory.indexPath, },);
        if ((typeof evidence) === 'symbol')
          throw new Error('lock absent',);
        expect(classifyIndexLock(evidence,),).toEqual({ kind: 'dead', pid, },);
        expect(describeIndexLockEvidence(evidence,),).toContain(`PID file names PID ${String(pid,)}, which no longer runs`,);
      },
    },),
    it({
      name: 'treats a PID file naming a process started after the lock changed as a reused PID without evidence',
      fn: async function testReused(): Promise<void> {
        await using directory = await scratch();
        /** Lock written first. */
        const lock = await writeLock({ indexPath: directory.indexPath, },);
        await wait(200,);
        await using later = await startSleeper();
        await writeFile(`${directory.indexPath}~pid.lock`, `pid ${String(later.pid,)}\n`,);
        /** PID file evidence. */
        const pidFile = await readPidFileEvidence({ pidPath: `${directory.indexPath}~pid.lock`, lock, resolveStart: hostStart, },);
        expect(pidFile.kind === 'owner' ? pidFile.owner.state : pidFile.kind,).toBe('started-after-lock',);
        /** Full evidence. */
        const evidence = await gatherIndexLockEvidence({ realIndexPath: directory.indexPath, },);
        if ((typeof evidence) === 'symbol')
          throw new Error('lock absent',);
        expect(classifyIndexLock(evidence,),).toEqual({ kind: 'evidence-free', },);
        expect(describeIndexLockEvidence(evidence,),).toContain('so the PID was reused',);
      },
    },),
    it({
      name: 'reads a missing or malformed PID file as no evidence',
      fn: async function testNoPidFile(): Promise<void> {
        await using directory = await scratch();
        /** Lock without a PID file. */
        const lock = await writeLock({ indexPath: directory.indexPath, },);
        expect(await readPidFileEvidence({ pidPath: `${directory.indexPath}~pid.lock`, lock, resolveStart: hostStart, },),).toEqual({ kind: 'absent', },);
        await writeFile(`${directory.indexPath}~pid.lock`, 'owner 12\n',);
        expect(await readPidFileEvidence({ pidPath: `${directory.indexPath}~pid.lock`, lock, resolveStart: hostStart, },),).toEqual({ kind: 'malformed', text: 'owner 12\n', },);
        expect(await gatherIndexLockEvidence({ realIndexPath: join(directory.path, 'other',), },),).toBe(LOCK_ABSENT,);
      },
    },),
    it({
      name: 'proves a live owner from a child process holding the lock open, matched by device and inode',
      fn: async function testOpenHolder(): Promise<void> {
        await using directory = await scratch();
        await writeLock({ indexPath: directory.indexPath, },);
        await using holder = await startSleeper({ holdOpen: `${directory.indexPath}.lock`, ready: join(directory.path, 'ready',), },);
        /** Evidence. */
        const evidence = await gatherIndexLockEvidence({ realIndexPath: directory.indexPath, },);
        if ((typeof evidence) === 'symbol')
          throw new Error('lock absent',);
        expect(evidence.holders?.holders.map(function pidOf(entry,): number {
          return entry.pid;
        },),).toEqual([holder.pid,],);
        /** Verdict; the command is whatever `/proc/<pid>/comm` reports for this Node build. */
        const verdict = classifyIndexLock(evidence,);
        expect(verdict.kind === 'proven-alive' ? [verdict.pid, verdict.source, verdict.command?.startsWith('node',),] : verdict,).toEqual([holder.pid, 'open-descriptor', true,],);
      },
    },),
    it({
      name: 'parses PID files, Linux stat lines, and host start times',
      fn: async function testParsers(): Promise<void> {
        expect(parsePidFileText('pid 42\n',),).toBe(42,);
        expect(parsePidFileText('pid 42 \n',),).toBe(42,);
        expect(parsePidFileText('pid 4x',),).toBe(PID_TEXT_MALFORMED,);
        expect(parsePidFileText('pid 0',),).toBe(PID_TEXT_MALFORMED,);
        expect(parsePidFileText('42',),).toBe(PID_TEXT_MALFORMED,);
        expect(parseLinuxStat('42 (a) b) c) S 1 42 42 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 12345 0 0',),).toEqual({ state: 'S', startTicks: 12_345, },);
        /** This process's start. */
        const self = await resolveProcessStart({ pid: process.pid, },);
        expect(self.kind,).toBe('running',);
        expect((self.kind === 'running') && (self.startedAtMs <= Date.now()) && (self.startedAtMs >= (Date.now() - (process.uptime() * 1_000) - 1_000)),).toBe(true,);
        expect(await resolveProcessStart({ pid: await exitedPid(), },),).toEqual({ kind: 'missing', },);
      },
    },),
    it({
      name: 'reads a zombie as missing and derives start time from ticks and uptime',
      fn: async function testFakeProc(): Promise<void> {
        await using directory = await scratch();
        await mkdir(join(directory.path, '9',),);
        await writeFile(join(directory.path, 'uptime',), '100.00 50.00\n',);
        await writeFile(join(directory.path, '9', 'stat',), '9 (git) S 1 9 9 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 2500 0 0',);
        expect(await resolveProcessStart({ pid: 9, platform: 'linux', procRoot: directory.path, now: function now(): number {
          return 1_000_000;
        }, exists: function exists(): boolean {
          return true;
        }, },),).toEqual({ kind: 'running', startedAtMs: 925_000, resolutionMs: 20, },);
        await writeFile(join(directory.path, '9', 'stat',), '9 (git) Z 1 9 9 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 2500 0 0',);
        expect(await resolveProcessStart({ pid: 9, platform: 'linux', procRoot: directory.path, exists: function exists(): boolean {
          return true;
        }, },),).toEqual({ kind: 'missing', },);
      },
    },),
    it({
      name: 'parses lsof field output and matches holders by device and inode only',
      fn: async function testLsof(): Promise<void> {
        await Promise.resolve();
        /** Two processes; the second lists a same-path file with another inode. */
        const processes = parseLsofFields('p42\ncgit\nf3\nD0x1000011\ni77\np43\ncvim\nf5\nD0x1000011\ni78\n',);
        expect(processes,).toEqual([
          { pid: 42, command: 'git', files: [{ device: 16_777_233n, inode: 77n, },], },
          { pid: 43, command: 'vim', files: [{ device: 16_777_233n, inode: 78n, },], },
        ],);
        expect(matchingHolders({ processes, device: 16_777_233n, inode: 77n, },),).toEqual([{ pid: 42, command: 'git', },],);
        expect(parseLsofFields('',),).toEqual([],);
      },
    },),
    it({
      name: 'parses Restart Manager output',
      fn: async function testRestartManager(): Promise<void> {
        await Promise.resolve();
        expect(parseRestartManagerOutput('4242\tgit.exe\r\n17\t\n\nbad\tx\n',),).toEqual([{ pid: 4_242, command: 'git.exe', }, { pid: 17, },],);
      },
    },),
  ],
},);
