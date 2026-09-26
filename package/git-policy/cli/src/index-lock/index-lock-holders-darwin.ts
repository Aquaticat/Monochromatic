/**
 macOS open-holder scan for a lock file through `lsof`,
 spawned only while a foreign lock exists.
 `lsof` resolves the named file to its device and inode;
 cli-git additionally compares the reported device and inode fields with its own `lstat`,
 so a replaced path never counts as a holder.
 macOS hides other users' descriptors without an error,
 so a scan run by an ordinary user always records that limit as partial evidence.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import type {
  LockHolderEvidence,
  LockHolderProcess,
} from './index-lock-types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Partial-evidence note every unprivileged macOS scan carries.
 */
const SILENT_DENIAL_NOTE = 'lsof omits other users\' processes on macOS without reporting it';

/**
 One process record assembled from `lsof -F` field lines.
 */
type LsofProcess = Readonly<{
  /**
   Process ID.
   */
  pid: number;
  /**
   Command name.
   */
  command?: string;
  /**
   Device and inode pairs of the listed files.
   */
  files: readonly Readonly<{
    device?: bigint;
    inode?: bigint;
  }>[];
}>;

/**
 Parses a numeric field; `BigInt` reads both `lsof`'s `0x`-prefixed device numbers and decimal inodes.

 @param text - field value

 @returns number, or `undefined` when unparsable
 */
function parseNumberField(text: string,): bigint | undefined {
  try {
    return BigInt(text,);
  }
  catch (error: unknown) {
    l.debug(`unparsable lsof number ${text}: ${caughtValueText(error,)}`,);
    return undefined;
  }
}

/**
 Parses `lsof -F pcDi` output into process records.

 @param output - `lsof` standard output

 @returns processes with their listed files

 @example
 ```ts
 parseLsofFields('p42\ncgit\nf3\nD0x1000011\ni77\n'); // [{ pid: 42, command: 'git', files: [{ device: 16777233n, inode: 77n }] }]
 ```
 */
export function parseLsofFields(output: string,): readonly LsofProcess[] {
  return output.split('\n',)
    .reduce<readonly LsofProcess[]>(
    function addField(processes, line,): readonly LsofProcess[] {
      /**
       Field identifier.
       */
      const field = line.charAt(0,);
      /**
       Field value.
       */
      const value = line.slice(1,);
      if (field === 'p')
        return [...processes, {
          pid: Number(value,),
          files: [],
        },];
      /**
       Process the field belongs to.
       */
      const current = processes.at(-1,);
      if (current === undefined)
        return processes;
      /**
       Processes before the current one.
       */
      const earlier = processes.slice(0, -1,);
      if (field === 'c')
        return [...earlier, {
          ...current,
          command: value,
        },];
      if (field === 'f')
        return [...earlier, {
          ...current,
          files: [...current.files, {},],
        },];
      /**
       File the field belongs to.
       */
      const file = current.files.at(-1,);
      if ((file === undefined) || ((field !== 'D') && (field !== 'i')))
        return processes;
      /**
       Parsed number.
       */
      const number = parseNumberField(value,);
      return [...earlier, {
        ...current,
        files: [...current.files.slice(0, -1,), {
          ...file,
          ...(number === undefined ? {} : (field === 'D' ? { device: number, } : { inode: number, })),
        },],
      },];
    },
    [],
  );
}

/**
 Selects processes whose listed file matches the lock's device and inode.

 @param processes - parsed `lsof` records

 @param device - lock device

 @param inode - lock inode

 @returns matching holders

 @example
 ```ts
 matchingHolders({ processes, device: 16777233n, inode: 77n });
 ```
 */
export function matchingHolders({
  processes,
  device,
  inode,
}: Readonly<{
  processes: readonly LsofProcess[];
  device: bigint;
  inode: bigint;
}>,): readonly LockHolderProcess[] {
  return processes.filter(function holds(candidate,): boolean {
    return candidate.files.some(function sameFile(file,): boolean {
      return (file.device === device) && (file.inode === inode);
    },);
  },)
    .map(function holder(candidate,): LockHolderProcess {
      return candidate.command === undefined ? { pid: candidate.pid, } : {
        pid: candidate.pid,
        command: candidate.command,
      };
    },);
}

/**
 Runs `lsof` for one path.

 @param lockPath - path handed to `lsof`

 @returns field output, where exit 1 means nothing matched, or the failure
 */
async function runLsof(lockPath: string,): Promise<Readonly<{
  kind: 'listed';
  stdout: string;
}> | Readonly<{
  kind: 'failed';
  reason: string;
}>> {
  try {
    return {
      kind: 'listed',
      stdout: (await nanoSpawn(
        'lsof',
        [
          '-n',
          '-P',
          '-w',
          '-F',
          'pcDi',
          '--',
          lockPath,
        ],
        { env: { LC_ALL: 'C', }, },
      )).stdout,
    };
  }
  catch (error: unknown) {
    if ((error instanceof SubprocessError) && (error.exitCode === 1))
      return {
        kind: 'listed',
        stdout: error.stdout,
      };
    return {
      kind: 'failed',
      reason: `lsof failed: ${caughtValueText(error,)}`,
    };
  }
}

/**
 Finds processes holding a file open through `lsof`.

 @param lockPath - lock path handed to `lsof`

 @param device - lock device

 @param inode - lock inode

 @returns holders and partial-evidence reasons

 @example
 ```ts
 await scanLsofHolders({ lockPath: '/repo/.git/index.lock', device: 16777233n, inode: 77n });
 ```
 */
export async function scanLsofHolders({
  lockPath,
  device,
  inode,
}: Readonly<{
  lockPath: string;
  device: bigint;
  inode: bigint;
}>,): Promise<LockHolderEvidence> {
  /**
   Tagged scan logger.
   */
  const rl = tagged({
    tag: scanLsofHolders.name,
    l,
  },);
  /**
   `lsof` field output or failure.
   */
  const output = await runLsof(lockPath,);
  if (output.kind === 'failed') {
    rl.debug(output.reason,);
    return {
      method: 'lsof',
      holders: [],
      partial: [output.reason,],
    };
  }
  return {
    method: 'lsof',
    holders: matchingHolders({
      processes: parseLsofFields(output.stdout,),
      device,
      inode,
    },),
    partial: process.getuid?.() === 0 ? [] : [SILENT_DENIAL_NOTE,],
  };
}
