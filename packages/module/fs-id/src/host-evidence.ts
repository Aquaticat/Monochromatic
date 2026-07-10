#!/usr/bin/env node
/**
 * Real-host preferred filesystem identity evidence for cross-platform CI.
 *
 * @module
 */

import { execFile, } from 'node:child_process';
import { platform, } from 'node:os';
import { resolve, } from 'node:path';
import { promisify, } from 'node:util';

import {
  createFsId,
  parseDiskutilVolumeUuid,
  parseFindmntUuid,
  parseVolumeSerial,
} from './parsers.ts';
import { windowsDriveRoot, } from './platform-resolvers.ts';
import type { FsIdResolution, } from './types.ts';

/**
 * Promise adapter for Node executable invocation.
 *
 * @example
 * ```ts
 * await execFileAsync('findmnt', ['--help']);
 * ```
 */
// oxlint-disable-next-line typescript/strict-void-return -- promisify deliberately ignores Node execFile's ChildProcess return while adapting its callback
const execFileAsync = promisify(execFile,);

/**
 * Runs command and returns stdout text.
 *
 * @param command - Native executable
 *
 * @param args - Exact argument vector
 *
 * @returns Captured stdout
 *
 * @example
 * ```ts
 * await commandOutput({ command: 'findmnt', args: ['--help'] });
 * ```
 */
async function commandOutput({
  command,
  args,
}: {
  readonly command: string;
  readonly args: readonly string[];
},): Promise<string> {
  /**
   * Native command result.
   */
  const { stdout, } = await execFileAsync(
    command,
    [...args,],
    { encoding: 'utf8', },
  );
  return stdout;
}

/**
 * Resolves preferred identity on current real host without fallback.
 *
 * @returns Stable host resolution
 *
 * @throws when preferred native output is unavailable or malformed
 *
 * @example
 * ```ts
 * await preferredHostResolution();
 * ```
 */
async function preferredHostResolution(): Promise<FsIdResolution> {
  /**
   * Existing checkout path on runner volume.
   */
  const target = resolve(process.cwd(),);
  /**
   * Current Node platform.
   */
  const host = platform();
  if (host === 'linux') {
    /**
     * Linux preferred UUID output.
     */
    const output = await commandOutput({
      command: 'findmnt',
      args: [
        '--target',
        target,
        '--output=UUID',
        '--noheadings',
      ],
    },);
    return {
      value: createFsId({
        source: 'fs-uuid',
        payload: parseFindmntUuid(output,),
      },),
      stable: true,
      source: 'fs-uuid',
    };
  }
  if (host === 'darwin') {
    /**
     * macOS preferred Volume UUID output.
     */
    const output = await commandOutput({
      command: 'diskutil',
      args: [
        'info',
        target,
      ],
    },);
    return {
      value: createFsId({
        source: 'volume-uuid',
        payload: parseDiskutilVolumeUuid(output,),
      },),
      stable: true,
      source: 'volume-uuid',
    };
  }
  if (host === 'win32') {
    /**
     * Validated Windows drive root.
     */
    const driveRoot = windowsDriveRoot(target,);
    /**
     * Windows preferred volume output.
     */
    const output = await commandOutput({
      command: 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        `vol ${driveRoot}`,
      ],
    },);
    return {
      value: createFsId({
        source: 'volume-serial',
        payload: parseVolumeSerial(output,),
      },),
      stable: true,
      source: 'volume-serial',
    };
  }
  throw new Error(`unsupported host evidence platform: ${host}`,);
}

/**
 * Real-host preferred result.
 */
const result = await preferredHostResolution();
if (result.value
  .includes(':',))
  throw new Error('real-host identity contains forbidden colon',);
console.log(JSON.stringify({
  platform: platform(),
  source: result.source,
  stable: result.stable,
  colonFree: true,
},),);
