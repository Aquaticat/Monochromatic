/**
 Wall-clock start time of a process, for comparing a PID-file owner with the lock's change time.

 Linux derives it from `/proc/<pid>/stat` field 22 (start ticks since boot),
 `/proc/uptime`,
 and the current time;
 macOS reads `ps -o lstart=`;
 Windows reads `Get-Process` `StartTime`.
 Each result carries its resolution,
 so a comparison with a change time allows for clock granularity.

 @module
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn from 'nano-spawn';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Clock ticks per second in `/proc/<pid>/stat`: the kernel's fixed `USER_HZ`,
 which `getconf CLK_TCK` reported as 100 on the development host.
 */
export const LINUX_USER_HZ = 100;

/**
 Milliseconds per second.
 */
const MS_PER_SECOND = 1_000;

/**
 Resolution of a Linux start time: one clock tick plus the centisecond resolution of `/proc/uptime`.
 */
const LINUX_RESOLUTION_MS = 2 * (MS_PER_SECOND / LINUX_USER_HZ);

/**
 Resolution of `ps -o lstart=`, which prints whole seconds.
 */
const DARWIN_RESOLUTION_MS = MS_PER_SECOND;

/**
 Resolution granted to Windows start times.
 */
const WIN32_RESOLUTION_MS = 1;

/**
 Zero-based index of the start-tick field among the fields after the command name (field 22 overall).
 */
const START_TICKS_FIELD_INDEX = 19;

/**
 .NET ticks between 0001-01-01 and the Unix epoch.
 */
const DOTNET_EPOCH_TICKS = 621_355_968_000_000_000n;

/**
 .NET ticks per millisecond.
 */
const DOTNET_TICKS_PER_MS = 10_000n;

/**
 Start time of a running process.
 */
export type ProcessStart =
  | Readonly<{
    /**
     The process runs.
     */
    kind: 'running';
    /**
     Start time in milliseconds since the epoch.
     */
    startedAtMs: number;
    /**
     Clock granularity to allow for when comparing.
     */
    resolutionMs: number;
  }>
  | Readonly<{
    /**
     No such process runs, or it is a zombie.
     */
    kind: 'missing';
  }>
  | Readonly<{
    /**
     The process may run but its start time is unreadable.
     */
    kind: 'unknown';
    /**
     Why.
     */
    reason: string;
  }>;

/**
 Parses the state and start ticks from `/proc/<pid>/stat`.

 @param stat - stat file text

 @returns process state letter and start ticks

 @throws {@link TypeError} when the text is malformed

 @example
 ```ts
 parseLinuxStat('42 (git) S 1 42 42 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 12345 0 0'); // { state: 'S', startTicks: 12345 }
 ```
 */
export function parseLinuxStat(stat: string,): Readonly<{
  state: string;
  startTicks: number;
}> {
  /**
   Final command delimiter; the command may itself contain parentheses.
   */
  const commandEnd = stat.lastIndexOf(')',);
  if (commandEnd === (-1))
    throw new TypeError('Malformed Linux process stat.',);
  /**
   Fields three onward.
   */
  const fields = stat.slice(commandEnd + 2,)
    .trim()
    .split(' ',);
  /**
   Start ticks.
   */
  const startTicks = Number(fields[START_TICKS_FIELD_INDEX],);
  /**
   State letter.
   */
  const state = fields[0] ?? '';
  if ((state === '') || (!Number.isSafeInteger(startTicks,)))
    throw new TypeError('Malformed Linux process stat.',);
  return {
    state,
    startTicks,
  };
}

/**
 The process's stat file vanished because it exited.
 */
const STAT_ABSENT: unique symbol = Symbol('/proc/<pid>/stat vanished because the process exited',);

/**
 Reads a stat file.

 @param path - `/proc/<pid>/stat`

 @returns text, or absence after exit
 */
async function readStatText(path: string,): Promise<string | typeof STAT_ABSENT> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && ((error.code === 'ENOENT') || (error.code === 'ESRCH')))
      return STAT_ABSENT;
    throw error;
  }
}

/**
 Resolves a Linux process start time.

 @param pid - process ID

 @param procRoot - proc mount

 @param now - current time in milliseconds since the epoch

 @returns start time or absence
 */
async function linuxStart({
  pid,
  procRoot,
  now,
}: Readonly<{
  pid: number;
  procRoot: string;
  now: () => number;
}>,): Promise<ProcessStart> {
  /**
   Stat text, absent after exit.
   */
  const statText = await readStatText(join(
    procRoot,
    String(pid,),
    'stat',
  ),);
  if (statText === STAT_ABSENT)
    return { kind: 'missing', };
  /**
   Parsed state and ticks.
   */
  const parsed = parseLinuxStat(statText,);
  if ((parsed.state === 'Z') || (parsed.state === 'X'))
    return { kind: 'missing', };
  /**
   Seconds since boot, first field of `/proc/uptime`.
   */
  const uptimeSeconds = Number((await readFile(
    join(
      procRoot,
      'uptime',
    ),
    'utf8',
  )).split(' ',)[0],);
  if (!Number.isFinite(uptimeSeconds,))
    throw new TypeError('Malformed /proc/uptime.',);
  return {
    kind: 'running',
    startedAtMs: (now() - (uptimeSeconds * MS_PER_SECOND)) + ((parsed.startTicks * MS_PER_SECOND) / LINUX_USER_HZ),
    resolutionMs: LINUX_RESOLUTION_MS,
  };
}

/**
 Resolves a macOS process start time through `ps`.

 @param pid - process ID

 @returns start time, or unknown when `ps` fails
 */
async function darwinStart(pid: number,): Promise<ProcessStart> {
  /**
   `ps` output such as `Fri Sep 26 10:00:00 2026`.
   */
  const { stdout, } = await nanoSpawn(
    'ps',
    [
      '-o',
      'lstart=',
      '-p',
      String(pid,),
    ],
    { env: { LC_ALL: 'C', }, },
  );
  /**
   Parsed local time.
   */
  const startedAtMs = Date.parse(stdout.trim(),);
  if (Number.isNaN(startedAtMs,))
    return {
      kind: 'unknown',
      reason: `unparsable ps start time ${JSON.stringify(stdout.trim(),)}`,
    };
  return {
    kind: 'running',
    startedAtMs,
    resolutionMs: DARWIN_RESOLUTION_MS,
  };
}

/**
 Resolves a Windows process start time through PowerShell.

 @param pid - process ID

 @returns start time
 */
async function win32Start(pid: number,): Promise<ProcessStart> {
  /**
   UTC start time in .NET ticks.
   */
  const { stdout, } = await nanoSpawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Process -Id ${String(pid,)}).StartTime.ToUniversalTime().Ticks`,
    ],
    { windowsHide: true, },
  );
  return {
    kind: 'running',
    startedAtMs: Number((BigInt(stdout.trim(),) - DOTNET_EPOCH_TICKS) / DOTNET_TICKS_PER_MS,),
    resolutionMs: WIN32_RESOLUTION_MS,
  };
}

/**
 Reports whether a PID names a process, treating a permission denial as a live process.

 @param pid - process ID

 @returns whether it exists
 */
function processExists(pid: number,): boolean {
  try {
    process.kill(
      pid,
      0,
    );
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'EPERM'))
      return true;
    l.debug(`PID ${String(pid,)} does not exist: ${caughtValueText(error,)}`,);
    return false;
  }
}

/**
 Resolves whether a PID names a running process and when it started.

 @param pid - process ID

 @param platform - host platform, injectable for tests

 @param procRoot - Linux proc mount, injectable for tests

 @param now - clock, injectable for tests

 @param exists - PID existence probe, injectable for tests

 @returns start time, absence, or unknown

 @example
 ```ts
 await resolveProcessStart({ pid: process.pid });
 ```
 */
export async function resolveProcessStart({
  pid,
  platform = process.platform,
  procRoot = '/proc',
  now = Date.now,
  exists = processExists,
}: Readonly<{
  pid: number;
  platform?: NodeJS.Platform;
  procRoot?: string;
  now?: () => number;
  exists?: (pid: number) => boolean;
}>,): Promise<ProcessStart> {
  if (!exists(pid,))
    return { kind: 'missing', };
  try {
    if (platform === 'linux')
      return await linuxStart({
        pid,
        procRoot,
        now,
      },);
    if (platform === 'darwin')
      return await darwinStart(pid,);
    if (platform === 'win32')
      return await win32Start(pid,);
    return {
      kind: 'unknown',
      reason: `no start-time source on ${platform}`,
    };
  }
  catch (error: unknown) {
    return {
      kind: 'unknown',
      reason: caughtValueText(error,),
    };
  }
}
