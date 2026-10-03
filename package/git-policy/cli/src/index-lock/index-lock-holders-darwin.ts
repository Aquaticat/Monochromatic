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
 One listed file's identity.
 */
type LsofFile = Readonly<{
  /**
   Device number.
   */
  device?: bigint;
  /**
   Inode number.
   */
  inode?: bigint;
}>;

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
  files: readonly LsofFile[];
}>;

/**
 An `lsof` numeric field could not be parsed.
 */
const FIELD_UNPARSABLE: unique symbol = Symbol('lsof D or i field is not a BigInt literal',);

/**
 Parses a numeric field; `BigInt` reads both `lsof`'s `0x`-prefixed device numbers and decimal inodes.

 @param text - field value

 @returns number, or the unparsable sentinel
 */
function parseNumberField(text: string,): bigint | typeof FIELD_UNPARSABLE {
  try {
    return BigInt(text,);
  }
  catch (error: unknown) {
    l.debug(`unparsable lsof number ${text}: ${caughtValueText(error,)}`,);
    return FIELD_UNPARSABLE;
  }
}

/**
 Field lines grouped under their starting line.
 */
type FieldGroup = Readonly<{
  /**
   Group-starting line.
   */
  head: string;
  /**
   Every line of the group, head included.
   */
  lines: readonly string[];
}>;

/**
 Splits field lines into groups that each start at a line with the given field identifier,
 dropping lines before the first such line.

 @param lines - field lines

 @param identifier - group-starting field identifier

 @returns groups in order
 */
function groupsStartingAt({
  lines,
  identifier,
}: Readonly<{
  lines: readonly string[];
  identifier: string;
}>,): readonly FieldGroup[] {
  /**
   Group starts with their lines.
   */
  const starts = lines.flatMap(function startOf(
    line,
    index,
  ): readonly Readonly<{
    head: string;
    index: number;
  }>[] {
    return line.startsWith(identifier,)
      ? [{
        head: line,
        index,
      },]
      : [];
  },);
  return starts.map(function group(
    start,
    position,
  ): FieldGroup {
    return {
      head: start.head,
      lines: lines.slice(
        start.index,
        starts[position + 1]
          ?.index
          ?? lines.length,
      ),
    };
  },);
}

/**
 Reads one field of a group.

 @param lines - group lines

 @param identifier - field identifier

 @returns field value, or the unparsable sentinel when absent or not numeric
 */
function numberField({
  lines,
  identifier,
}: Readonly<{
  lines: readonly string[];
  identifier: string;
}>,): bigint | typeof FIELD_UNPARSABLE {
  /**
   Field line.
   */
  const line = lines.find(function hasIdentifier(candidate,): boolean {
    return candidate.startsWith(identifier,);
  },);
  return line === undefined ? FIELD_UNPARSABLE : parseNumberField(line.slice(1,),);
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
  return groupsStartingAt({
    lines: output.split('\n',),
    identifier: 'p',
  },)
    .map(function processRecord({
      head,
      lines,
    },): LsofProcess {
      /**
       Command line.
       */
      const commandLine = lines.find(function isCommand(line,): boolean {
        return line.startsWith('c');
      },);
      /**
       Listed files.
       */
      const files = groupsStartingAt({
        lines,
        identifier: 'f',
      },)
        .map(function fileRecord({ lines: fileLines, },): LsofFile {
          /**
           Device field.
           */
          const device = numberField({
            lines: fileLines,
            identifier: 'D',
          },);
          /**
           Inode field.
           */
          const inode = numberField({
            lines: fileLines,
            identifier: 'i',
          },);
          return {
            ...(device === FIELD_UNPARSABLE ? {} : { device, }),
            ...(inode === FIELD_UNPARSABLE ? {} : { inode, }),
          };
        },);
      return {
        pid: Number(head.slice(1,),),
        ...(commandLine === undefined ? {} : { command: commandLine.slice(1,), }),
        files,
      };
    },);
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
    return candidate.files
      .some(function sameFile(file,): boolean {
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
