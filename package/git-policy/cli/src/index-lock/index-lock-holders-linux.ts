/**
 Linux open-holder scan for a lock file:
 every `/proc/<pid>/fd/<n>` is resolved with `stat` and compared by device and inode,
 never by the link's path text,
 so bind mounts,
 other mount namespaces,
 and renamed paths cannot produce a false match or hide a true one.
 Processes the scan cannot read
 (other users,
 `hidepid`,
 exited mid-scan with an unexpected error)
 are recorded as partial evidence.

 @module
 */
import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { mapBounded, } from '../policy-engine/map-bounded.ts';
import type {
  LockHolderEvidence,
  LockHolderProcess,
} from './index-lock-types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Processes inspected at once.
 */
const SCAN_CONCURRENCY = 16;

/**
 Per-process scan outcome.
 */
type ProcessScan = Readonly<{
  /**
   Whether the process holds the lock.
   */
  holds: boolean;
  /**
   Unreadable-evidence reason, when any.
   */
  partial?: string;
}>;

/**
 Reports whether an error carries one of the given codes.

 @param error - caught value

 @param codes - accepted codes

 @returns whether it matches
 */
function hasCode({
  error,
  codes,
}: Readonly<{
  error: unknown;
  codes: readonly string[];
}>,): boolean {
  return Error.isError(error,) && ('code' in error)
    && ((typeof error.code) === 'string')
    && codes.includes(String(error.code,),);
}

/**
 Reports whether a directory name is a decimal PID.

 @param name - `/proc` entry

 @returns whether it names a process
 */
function isPidName(name: string,): boolean {
  return (name.length > 0) && [...name,].every(function isDigit(character,): boolean {
    return (character >= '0') && (character <= '9');
  },);
}

/**
 Reads a process's command name.

 @param procRoot - proc mount

 @param pid - process ID

 @returns command, or `undefined` when unreadable
 */
async function readCommand({
  procRoot,
  pid,
}: Readonly<{
  procRoot: string;
  pid: number;
}>,): Promise<string | undefined> {
  try {
    return (await readFile(
      join(
        procRoot,
        String(pid,),
        'comm',
      ),
      'utf8',
    )).trim();
  }
  catch (error: unknown) {
    l.debug(`command of PID ${String(pid,)} unreadable: ${caughtValueText(error,)}`,);
    return undefined;
  }
}

/**
 Descriptor listing of one process.
 */
type DescriptorListing =
  | Readonly<{
    /**
     Listed descriptors.
     */
    kind: 'listed';
    /**
     Descriptor numbers.
     */
    descriptors: readonly string[];
  }>
  | Readonly<{
    /**
     The process exited before it was read.
     */
    kind: 'exited';
  }>
  | Readonly<{
    /**
     The descriptors are not visible to this user.
     */
    kind: 'unreadable';
    /**
     Read failure.
     */
    reason: string;
  }>;

/**
 Lists a process's descriptor directory.

 @param fdDirectory - `/proc/<pid>/fd`

 @returns listing, exit, or unreadable reason
 */
async function readDescriptors(fdDirectory: string,): Promise<DescriptorListing> {
  try {
    return {
      kind: 'listed',
      descriptors: await readdir(fdDirectory,),
    };
  }
  catch (error: unknown) {
    if (hasCode({
      error,
      codes: ['ENOENT', 'ESRCH',],
    },))
      return { kind: 'exited', };
    return {
      kind: 'unreadable',
      reason: caughtValueText(error,),
    };
  }
}

/**
 Scans one process's descriptors.

 @param procRoot - proc mount

 @param pid - process ID

 @param device - lock device

 @param inode - lock inode

 @returns whether it holds the lock, with partial-evidence reasons
 */
async function scanProcess({
  procRoot,
  pid,
  device,
  inode,
}: Readonly<{
  procRoot: string;
  pid: string;
  device: bigint;
  inode: bigint;
}>,): Promise<ProcessScan> {
  /**
   Descriptor directory.
   */
  const fdDirectory = join(
    procRoot,
    pid,
    'fd',
  );
  /**
   Open descriptor numbers, or why they are not visible.
   */
  const listing = await readDescriptors(fdDirectory,);
  if (listing.kind === 'exited')
    return { holds: false, };
  if (listing.kind === 'unreadable')
    return {
      holds: false,
      partial: `PID ${pid}: ${listing.reason}`,
    };
  /**
   Per-descriptor matches.
   */
  const matches = await Promise.all(listing.descriptors.map(async function matchDescriptor(descriptor,): Promise<boolean | string> {
    try {
      /**
       Metadata of the open file itself, reached through the descriptor link.
       */
      const metadata = await stat(
        join(
          fdDirectory,
          descriptor,
        ),
        { bigint: true, },
      );
      return (metadata.dev === device) && (metadata.ino === inode);
    }
    catch (error: unknown) {
      if (hasCode({
        error,
        codes: ['ENOENT', 'ESRCH',],
      },))
        return false;
      return `PID ${pid} fd ${descriptor}: ${caughtValueText(error,)}`;
    }
  },),);
  /**
   First unreadable descriptor reason.
   */
  const partial = matches.find(function isReason(match,): match is string {
    return (typeof match) === 'string';
  },);
  return {
    holds: matches.includes(true,),
    ...(partial === undefined ? {} : { partial, }),
  };
}

/**
 Finds every process holding a file open, by device and inode.

 @param device - lock device

 @param inode - lock inode

 @param procRoot - proc mount, injectable for tests

 @param selfPid - this process, which never counts as a holder

 @returns holders and partial-evidence reasons

 @example
 ```ts
 await scanProcFdHolders({ device: 64768n, inode: 1234n });
 ```
 */
export async function scanProcFdHolders({
  device,
  inode,
  procRoot = '/proc',
  selfPid = process.pid,
}: Readonly<{
  device: bigint;
  inode: bigint;
  procRoot?: string;
  selfPid?: number;
}>,): Promise<LockHolderEvidence> {
  /**
   Tagged scan logger.
   */
  const rl = tagged({
    tag: scanProcFdHolders.name,
    l,
  },);
  /**
   Visible process IDs other than this one.
   */
  const pids = (await readdir(procRoot,))
    .filter(function isOtherPid(name,): boolean {
      return isPidName(name,) && (name !== String(selfPid,));
    },);
  /**
   Per-process results in PID-listing order.
   */
  const scans = await mapBounded({
    values: pids,
    concurrency: SCAN_CONCURRENCY,
    map: async function scanOne({ value, },): Promise<ProcessScan> {
      return await scanProcess({
        procRoot,
        pid: value,
        device,
        inode,
      },);
    },
  },);
  /**
   Holder PIDs.
   */
  const holderPids = pids.filter(function holds(_pid, index,): boolean {
    return scans[index]?.holds === true;
  },)
    .map(Number,);
  /**
   Holders with command names.
   */
  const holders = await Promise.all(holderPids.map(async function describeHolder(pid,): Promise<LockHolderProcess> {
    /**
     Command name.
     */
    const command = await readCommand({
      procRoot,
      pid,
    },);
    return command === undefined ? { pid, } : {
      pid,
      command,
    };
  },),);
  /**
   Partial-evidence reasons.
   */
  const partial = scans.flatMap(function reasonOf(scan,): readonly string[] {
    return scan.partial === undefined ? [] : [scan.partial,];
  },);
  rl.debug(`scanned ${String(pids.length,)} processes: ${String(holders.length,)} holders, ${String(partial.length,)} unreadable`,);
  return {
    method: 'proc-fd',
    holders,
    partial,
  };
}
