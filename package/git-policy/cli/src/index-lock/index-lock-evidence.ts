/**
 Evidence about a foreign `index.lock` and the verdict it supports:
 proven alive,
 dead,
 or evidence-free.

 A live owner is proven by a process holding the lock open,
 matched by device and inode,
 or by Git's `core.lockfilePid` file naming a running process that started no later than the lock's change time.
 A PID file naming a process that no longer runs proves a dead owner.
 Everything else is evidence-free:
 no PID file,
 a malformed one,
 a reused PID,
 or an unreadable start time.
 An absent open holder never proves abandonment,
 because native `git commit` keeps `index.lock` on disk without an open descriptor through its hooks and editor.

 @module
 */
import {
  lstat,
  readFile,
} from 'node:fs/promises';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { isAsciiDigits, } from '../ascii-decimal.ts';
import { scanLsofHolders, } from './index-lock-holders-darwin.ts';
import { scanProcFdHolders, } from './index-lock-holders-linux.ts';
import { scanRestartManagerHolders, } from './index-lock-holders-win32.ts';
import type {
  IndexLockEvidence,
  IndexLockVerdict,
  LockFileMetadata,
  LockHolderEvidence,
  PidFileEvidence,
  PidOwnerEvidence,
} from './index-lock-types.ts';
import {
  type ProcessStart,
  resolveProcessStart,
} from './process-start-time.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 The lock does not exist.
 */
export const LOCK_ABSENT: unique symbol = Symbol('index.lock was not found on disk during evidence reading',);

/**
 Longest PID file text quoted in evidence.
 */
const QUOTED_TEXT_LIMIT = 64;

/**
 Partial-evidence reasons quoted before summarizing the rest.
 */
const QUOTED_REASON_LIMIT = 3;

/**
 The PID file does not hold `pid <n>`.
 */
export const PID_TEXT_MALFORMED: unique symbol = Symbol('Git lock owner file lacks the "pid <digits>" line format',);

/**
 Prefix of Git's PID file content.
 */
const PID_PREFIX = 'pid ';

/**
 Evidence sources a gather call uses, injectable for tests.
 */
export type IndexLockEvidenceSources = Readonly<{
  /**
   Resolves a PID's start time.
   */
  resolveStart: (pid: number) => Promise<ProcessStart>;
  /**
   Scans for processes holding the lock open.
   */
  scanHolders: (input: Readonly<{
    lockPath: string;
    lock: LockFileMetadata;
  }>) => Promise<LockHolderEvidence>;
}>;

/**
 Git's PID file path beside a lock (`index.lock` becomes `index~pid.lock`).

 @param realIndexPath - real index path

 @returns PID file path

 @example
 ```ts
 lockPidPath('/repo/.git/index'); // '/repo/.git/index~pid.lock'
 ```
 */
export function lockPidPath(realIndexPath: string,): string {
  return `${realIndexPath}~pid.lock`;
}

/**
 Reports whether an error is a missing-path error.

 @param error - caught value

 @returns whether the path is absent
 */
function isMissing(error: unknown,): boolean {
  return Error.isError(error,) && ('code' in error)
    && ((error.code === 'ENOENT') || (error.code === 'ENOTDIR'));
}

/**
 Reads a lock's identity and change time without following links.

 @param lockPath - lock path

 @returns metadata or absence

 @example
 ```ts
 await readLockMetadata('/repo/.git/index.lock');
 ```
 */
export async function readLockMetadata(lockPath: string,): Promise<LockFileMetadata | typeof LOCK_ABSENT> {
  try {
    /**
     Non-followed metadata with exact numbers.
     */
    const metadata = await lstat(
      lockPath,
      { bigint: true, },
    );
    return {
      device: metadata.dev,
      inode: metadata.ino,
      ctimeMs: Number(metadata.ctimeMs,),
    };
  }
  catch (error: unknown) {
    if (isMissing(error,))
      return LOCK_ABSENT;
    throw error;
  }
}

/**
 Parses Git's `pid <n>` PID file text as `read_lock_pid` does.

 @param text - file text

 @returns PID, or the malformed sentinel

 @example
 ```ts
 parsePidFileText('pid 42\n'); // 42
 ```
 */
export function parsePidFileText(text: string,): number | typeof PID_TEXT_MALFORMED {
  /**
   Text without trailing whitespace, as `strbuf_rtrim` leaves it.
   */
  const trimmed = text.trimEnd();
  if (!trimmed.startsWith(PID_PREFIX,))
    return PID_TEXT_MALFORMED;
  /**
   Decimal digits after the prefix.
   */
  const digits = trimmed.slice(PID_PREFIX.length,);
  if ((digits === '') || (!isAsciiDigits(digits,)))
    return PID_TEXT_MALFORMED;
  /**
   Parsed PID.
   */
  const pid = Number(digits,);
  return (Number.isSafeInteger(pid,) && (pid > 0)) ? pid : PID_TEXT_MALFORMED;
}

/**
 Classifies the process a PID file names against the lock's change time.

 @param start - that process's start

 @param lock - lock metadata

 @returns owner evidence
 */
function ownerEvidence({
  start,
  lock,
}: Readonly<{
  start: ProcessStart;
  lock: LockFileMetadata;
}>,): PidOwnerEvidence {
  if (start.kind === 'missing')
    return { state: 'missing', };
  if (start.kind === 'unknown')
    return {
      state: 'start-unknown',
      reason: start.reason,
    };
  return start.startedAtMs <= (lock.ctimeMs + start.resolutionMs)
    ? {
      state: 'started-before-lock',
      startedAtMs: start.startedAtMs,
    }
    : {
      state: 'started-after-lock',
      startedAtMs: start.startedAtMs,
    };
}

/**
 Reads a PID file's text.

 @param pidPath - PID file path

 @returns text, absence, or read failure
 */
async function readPidText(pidPath: string,): Promise<Readonly<{
  kind: 'text';
  text: string;
}> | Extract<PidFileEvidence, { kind: 'absent' | 'unreadable'; }>> {
  try {
    return {
      kind: 'text',
      text: await readFile(
        pidPath,
        'utf8',
      ),
    };
  }
  catch (error: unknown) {
    if (isMissing(error,))
      return { kind: 'absent', };
    return {
      kind: 'unreadable',
      reason: caughtValueText(error,),
    };
  }
}

/**
 Reads the PID file beside a lock and inspects the process it names.

 @param pidPath - PID file path

 @param lock - lock metadata

 @param resolveStart - start-time source

 @returns PID file evidence

 @example
 ```ts
 await readPidFileEvidence({ pidPath, lock, resolveStart: (pid) => resolveProcessStart({ pid }) });
 ```
 */
export async function readPidFileEvidence({
  pidPath,
  lock,
  resolveStart,
}: Readonly<{
  pidPath: string;
  lock: LockFileMetadata;
  resolveStart: IndexLockEvidenceSources['resolveStart'];
}>,): Promise<PidFileEvidence> {
  /**
   PID file text or its absence.
   */
  const read = await readPidText(pidPath,);
  if (read.kind !== 'text')
    return read;
  /**
   Named PID.
   */
  const pid = parsePidFileText(read.text,);
  if (pid === PID_TEXT_MALFORMED)
    return {
      kind: 'malformed',
      text: read.text
        .slice(
          0,
          QUOTED_TEXT_LIMIT,
        ),
    };
  return {
    kind: 'owner',
    pid,
    owner: ownerEvidence({
      start: await resolveStart(pid,),
      lock,
    },),
  };
}

/**
 Scans for open holders with the host platform's mechanism.

 @param lockPath - lock path

 @param lock - lock metadata

 @returns holder evidence

 @example
 ```ts
 await scanPlatformHolders({ lockPath, lock });
 ```
 */
export async function scanPlatformHolders({
  lockPath,
  lock,
}: Readonly<{
  lockPath: string;
  lock: LockFileMetadata;
}>,): Promise<LockHolderEvidence> {
  if (process.platform === 'linux')
    return await scanProcFdHolders({
      device: lock.device,
      inode: lock.inode,
    },);
  if (process.platform === 'darwin')
    return await scanLsofHolders({
      lockPath,
      device: lock.device,
      inode: lock.inode,
    },);
  if (process.platform === 'win32')
    return await scanRestartManagerHolders(lockPath,);
  return {
    method: 'unsupported',
    holders: [],
    partial: [`no open-holder scan on ${process.platform}`,],
  };
}

/**
 Default evidence sources for the host.
 */
export const HOST_EVIDENCE_SOURCES: IndexLockEvidenceSources = {
  resolveStart: async function resolveHostStart(pid,): Promise<ProcessStart> {
    return await resolveProcessStart({ pid, },);
  },
  scanHolders: scanPlatformHolders,
};

/**
 Classifies gathered evidence.

 @param evidence - one attempt's evidence

 @returns verdict

 @example
 ```ts
 classifyIndexLock(evidence); // { kind: 'evidence-free' }
 ```
 */
export function classifyIndexLock(evidence: IndexLockEvidence,): IndexLockVerdict {
  /**
   First open holder.
   */
  const holder = evidence.holders
    ?.holders[0];
  if (holder !== undefined)
    return {
      kind: 'proven-alive',
      pid: holder.pid,
      source: 'open-descriptor',
      ...(holder.command === undefined ? {} : { command: holder.command, }),
    };
  /**
   PID file evidence.
   */
  const { pidFile, } = evidence;
  if ((pidFile.kind === 'owner') && (pidFile.owner
    .state
    === 'started-before-lock'))
    return {
      kind: 'proven-alive',
      pid: pidFile.pid,
      source: 'pid-file',
    };
  if ((pidFile.kind === 'owner') && (pidFile.owner
    .state
    === 'missing'))
    return {
      kind: 'dead',
      pid: pidFile.pid,
    };
  return { kind: 'evidence-free', };
}

/**
 Gathers one attempt's evidence, skipping the holder scan once the PID file proves a live owner.

 @param realIndexPath - real index path

 @param sources - evidence sources

 @returns evidence, or absence when the lock is gone

 @example
 ```ts
 await gatherIndexLockEvidence({ realIndexPath: '/repo/.git/index' });
 ```
 */
export async function gatherIndexLockEvidence({
  realIndexPath,
  sources = HOST_EVIDENCE_SOURCES,
}: Readonly<{
  realIndexPath: string;
  sources?: IndexLockEvidenceSources;
}>,): Promise<IndexLockEvidence | typeof LOCK_ABSENT> {
  /**
   Tagged gather logger.
   */
  const rl = tagged({
    tag: gatherIndexLockEvidence.name,
    l,
  },);
  /**
   Lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  /**
   Lock metadata.
   */
  const lock = await readLockMetadata(lockPath,);
  if (lock === LOCK_ABSENT)
    return LOCK_ABSENT;
  /**
   PID file evidence.
   */
  const pidFile = await readPidFileEvidence({
    pidPath: lockPidPath(realIndexPath,),
    lock,
    resolveStart: sources.resolveStart,
  },);
  if ((pidFile.kind === 'owner') && (pidFile.owner
    .state
    === 'started-before-lock')) {
    rl.debug(`PID file proves live owner ${String(pidFile.pid,)}`,);
    return {
      lockPath,
      lock,
      pidFile,
    };
  }
  return {
    lockPath,
    lock,
    pidFile,
    holders: await sources.scanHolders({
      lockPath,
      lock,
    },),
  };
}

/**
 Describes PID file evidence.

 @param pidFile - PID file evidence

 @returns clause
 */
function describePidFile(pidFile: PidFileEvidence,): string {
  if (pidFile.kind === 'absent')
    return 'no PID file (the owner did not run with core.lockfilePid=true)';
  if (pidFile.kind === 'malformed')
    return `a malformed PID file ${JSON.stringify(pidFile.text,)}`;
  if (pidFile.kind === 'unreadable')
    return `an unreadable PID file (${pidFile.reason})`;
  /**
   Named PID text.
   */
  const pid = `PID file names PID ${String(pidFile.pid,)}`;
  if (pidFile.owner
    .state
    === 'missing')
    return `${pid}, which no longer runs`;
  if (pidFile.owner
    .state
    === 'started-after-lock')
    return `${pid}, now a process started at ${new Date(pidFile.owner
      .startedAtMs,).toISOString()}, after the lock changed, so the PID was reused`;
  if (pidFile.owner
    .state
    === 'start-unknown')
    return `${pid}, which runs but whose start time is unreadable (${pidFile.owner
      .reason})`;
  return `${pid}, which runs and started before the lock changed`;
}

/**
 Describes holder-scan evidence.

 @param evidence - attempt evidence, whose holder scan may be absent

 @returns clause
 */
function describeHolders(evidence: IndexLockEvidence,): string {
  /**
   Scan evidence.
   */
  const { holders, } = evidence;
  if (holders === undefined)
    return 'no open-holder scan';
  /**
   Found holders.
   */
  const found = holders.holders
    .length
    === 0
    ? 'no process holding it open'
    : holders.holders
      .map(function holderText(holder,): string {
      return `PID ${String(holder.pid,)}${holder.command === undefined ? '' : ` (${holder.command})`}`;
    },)
      .join(', ',);
  /**
   Quoted partial reasons.
   */
  const quoted = holders.partial
    .slice(
      0,
      QUOTED_REASON_LIMIT,
    );
  /**
   Partial-evidence clause.
   */
  const partial = holders.partial
    .length
    === 0
    ? ''
    : `; ${String(holders.partial
      .length,)} partial-evidence note(s): ${quoted.join('; ',)}${holders.partial
        .length
        > quoted.length ? '; ...' : ''}`;
  return `${holders.method} scan found ${found}${partial}`;
}

/**
 Renders the evidence for a diagnostic.

 @param evidence - last attempt's evidence

 @returns one line

 @example
 ```ts
 describeIndexLockEvidence(evidence);
 ```
 */
export function describeIndexLockEvidence(evidence: IndexLockEvidence,): string {
  return [
    `${evidence.lockPath} (device ${String(evidence.lock
      .device,)}, inode ${String(evidence.lock
        .inode,)}, changed ${new Date(evidence.lock
          .ctimeMs,).toISOString()})`,
    describePidFile(evidence.pidFile,),
    describeHolders(evidence,),
  ].join('; ',);
}

/**
 Renders the one stderr line naming a proven-alive holder.

 @param verdict - proven-alive verdict

 @param lockPath - lock path

 @returns line ending in LF

 @example
 ```ts
 provenHolderLine({ verdict, lockPath: '/repo/.git/index.lock' });
 ```
 */
export function provenHolderLine({
  verdict,
  lockPath,
}: Readonly<{
  verdict: Extract<IndexLockVerdict, { kind: 'proven-alive'; }>;
  lockPath: string;
}>,): string {
  /**
   Holder name.
   */
  const holder = `PID ${String(verdict.pid,)}${verdict.command === undefined ? '' : ` (${verdict.command})`}`;
  /**
   Proof clause.
   */
  const proof = verdict.source === 'pid-file' ? 'its Git lock PID file' : 'an open descriptor';
  return `cli-git: waiting for ${holder}, which holds ${lockPath} (proven by ${proof}); cli-git waits until it releases the lock.\n`;
}
