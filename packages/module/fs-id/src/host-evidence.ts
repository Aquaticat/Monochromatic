#!/usr/bin/env node
/**
 * Real-host preferred filesystem identity evidence for cross-platform CI.
 *
 * @module
 */

import { execFile, } from 'node:child_process';
import { stat, } from 'node:fs/promises';
import { platform, } from 'node:os';
import { resolve, } from 'node:path';
import { promisify, } from 'node:util';

import {
  createFsId,
  normalizeIdentityPayload,
  parseDiskutilVolumeUuid,
  parseFindmntUuid,
  windowsDriveRoot,
} from './parsers.ts';
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
        '-plist',
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
     * Drive identifier without trailing separator.
     */
    const driveId = driveRoot.slice(
      0,
      2,
    );
    /**
     * Windows locale-invariant CIM property output.
     */
    const output = await commandOutput({
      command: 'powershell.exe',
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${driveId}'").VolumeSerialNumber`,
      ],
    },);
    return {
      value: createFsId({
        source: 'volume-serial',
        payload: normalizeIdentityPayload(output,),
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
/**
 * Real host runtime device number recorded as degraded-path evidence.
 */
const runtimeDeviceNumber = (await stat(
  process.cwd(),
  { bigint: true, },
)).dev
  .toString();
console.log(JSON.stringify({
  platform: platform(),
  source: result.source,
  stable: result.stable,
  colonFree: true,
  runtimeDeviceNumber,
  runtimeDeviceUsable: runtimeDeviceNumber !== '0',
},),);
