/**
 * Platform-specific preferred and degraded filesystem identity strategies.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { FsIdResolutionError, } from './errors.ts';
import {
  createFsId,
  normalizeIdentityPayload,
  parseDiskutilVolumeUuid,
  parseFindmntUuid,
  windowsDriveRoot,
} from './parsers.ts';
import type {
  FsIdResolution,
  FsIdResolverAdapters,
} from './types.ts';

/**
 * Package logger root.
 *
 * @example
 * ```ts
 * l.debug('resolving');
 * ```
 */
const l = tagged({ tag: 'module-fs-id', },);

/**
 * Formats unknown caught value without discarding it.
 *
 * @param error - Caught failure value
 *
 * @returns Diagnostic text
 *
 * @example
 * ```ts
 * caughtMessage(new Error('failed')); // 'failed'
 * ```
 */
function caughtMessage(error: unknown,): string {
  if (Error.isError(error,))
    return error.message;
  return String(error,);
}

/**
 * Converts validated stable payload to resolution.
 *
 * @param source - Stable identity mechanism
 *
 * @param payload - Validated platform payload
 *
 * @returns Stable result
 *
 * @example
 * ```ts
 * stableResolution({ source: 'fs-uuid', payload: 'abcd' });
 * ```
 */
function stableResolution({
  source,
  payload,
}: {
  readonly source: 'fs-uuid' | 'volume-uuid' | 'volume-serial';
  readonly payload: string;
},): FsIdResolution {
  return {
    value: createFsId({
      source,
      payload,
    },),
    stable: true,
    source,
  };
}

/**
 * Converts degraded payload to warning-bearing resolution.
 *
 * @param source - Runtime identity mechanism
 *
 * @param payload - Validated platform payload
 *
 * @param reason - Why stable mechanism failed
 *
 * @returns Degraded result
 *
 * @example
 * ```ts
 * degradedResolution({ source: 'f-fsid', payload: '1', reason: 'UUID absent' });
 * ```
 */
function degradedResolution({
  source,
  payload,
  reason,
}: {
  readonly source: 'f-fsid' | 'device-number';
  readonly payload: string;
  readonly reason: string;
},): FsIdResolution {
  return {
    value: createFsId({
      source,
      payload,
    },),
    stable: false,
    source,
    reason,
  };
}

/**
 * Requires safe payload from one fallback command.
 *
 * @param output - Captured output
 *
 * @param source - Mechanism named in error
 *
 * @returns Safe payload
 *
 * @throws when output has no safe identity
 *
 * @example
 * ```ts
 * requiredPayload({ output: '123', source: 'f_fsid' });
 * ```
 */
function requiredPayload({
  output,
  source,
}: {
  readonly output: string;
  readonly source: string;
},): string {
  /**
   * Normalized command output.
   */
  try {
    return normalizeIdentityPayload(output,);
  }
  catch (error) {
    l.error(`${source} returned unsafe filesystem identity: ${caughtMessage(error,)}`,);
    throw new FsIdResolutionError(
      `${source} returned no valid filesystem identity`,
      { cause: error, },
    );
  }
}

/**
 * Resolves Linux filesystem UUID or degraded `f_fsid`.
 *
 * @param path - Canonical target path
 *
 * @param adapters - Subprocess and warning effects
 *
 * @returns Stable or degraded identity
 *
 * @throws when both commands fail
 *
 * @example
 * ```ts
 * await resolveLinuxFsId({ path: '/repo', adapters });
 * ```
 */
export async function resolveLinuxFsId({
  path,
  adapters,
}: {
  readonly path: string;
  readonly adapters: FsIdResolverAdapters;
},): Promise<FsIdResolution> {
  /**
   * Function-scoped logger.
   */
  const rl = tagged({
    tag: resolveLinuxFsId.name,
    l,
  },);
  try {
    /**
     * Preferred UUID command output.
     */
    const output = await adapters.run({
      command: 'findmnt',
      args: [
        '--target',
        path,
        '--output=UUID',
        '--noheadings',
      ],
    },);
    /**
     * Parsed UUID or absent sentinel.
     */
    const uuid = parseFindmntUuid(output,);
    rl.debug(`resolved stable filesystem UUID for ${path}`,);
    return stableResolution({
      source: 'fs-uuid',
      payload: uuid,
    },);
  }
  catch (preferredError) {
    rl.debug(`findmnt UUID unavailable for ${path}: ${caughtMessage(preferredError,)}`,);
    try {
      /**
       * Degraded GNU stat output.
       */
      const output = await adapters.run({
        command: 'stat',
        args: [
          '--file-system',
          '--format=%i',
          path,
        ],
      },);
      return degradedResolution({
        source: 'f-fsid',
        payload: requiredPayload({
          output,
          source: 'stat f_fsid',
        },),
        reason: `filesystem UUID unavailable: ${caughtMessage(preferredError,)}`,
      },);
    }
    catch (fallbackError) {
      rl.error(`stat f_fsid failed for ${path}: ${caughtMessage(fallbackError,)}`,);
      throw new FsIdResolutionError(
        `unable to resolve Linux filesystem identity for ${path}`,
        { cause: fallbackError, },
      );
    }
  }
}

/**
 * Resolves macOS Volume UUID or degraded device number.
 *
 * @param path - Canonical target path
 *
 * @param adapters - Subprocess and warning effects
 *
 * @returns Stable or degraded identity
 *
 * @throws when both commands fail
 *
 * @example
 * ```ts
 * await resolveDarwinFsId({ path: '/repo', adapters });
 * ```
 */
export async function resolveDarwinFsId({
  path,
  adapters,
}: {
  readonly path: string;
  readonly adapters: FsIdResolverAdapters;
},): Promise<FsIdResolution> {
  /**
   * Function-scoped logger.
   */
  const rl = tagged({
    tag: resolveDarwinFsId.name,
    l,
  },);
  try {
    /**
     * Preferred diskutil output.
     */
    const output = await adapters.run({
      command: 'diskutil',
      args: [
        'info',
        '-plist',
        path,
      ],
    },);
    /**
     * Parsed UUID or absent sentinel.
     */
    const uuid = parseDiskutilVolumeUuid(output,);
    rl.debug(`resolved stable Volume UUID for ${path}`,);
    return stableResolution({
      source: 'volume-uuid',
      payload: uuid,
    },);
  }
  catch (preferredError) {
    rl.debug(`diskutil UUID unavailable for ${path}: ${caughtMessage(preferredError,)}`,);
    try {
      /**
       * Degraded BSD stat device output.
       */
      const output = await adapters.run({
        command: 'stat',
        args: [
          '-f',
          '%d',
          path,
        ],
      },);
      return degradedResolution({
        source: 'device-number',
        payload: requiredPayload({
          output,
          source: 'stat device number',
        },),
        reason: `Volume UUID unavailable: ${caughtMessage(preferredError,)}`,
      },);
    }
    catch (fallbackError) {
      rl.error(`stat device number failed for ${path}: ${caughtMessage(fallbackError,)}`,);
      throw new FsIdResolutionError(
        `unable to resolve macOS filesystem identity for ${path}`,
        { cause: fallbackError, },
      );
    }
  }
}

/**
 * Resolves Windows volume serial or degraded runtime device number.
 *
 * @param path - Canonical target path
 *
 * @param adapters - Subprocess and device effects
 *
 * @returns Stable or degraded identity
 *
 * @throws when both mechanisms fail
 *
 * @example
 * ```ts
 * await resolveWindowsFsId({ path: 'C:\\repo', adapters });
 * ```
 */
export async function resolveWindowsFsId({
  path,
  adapters,
}: {
  readonly path: string;
  readonly adapters: FsIdResolverAdapters;
},): Promise<FsIdResolution> {
  /**
   * Function-scoped logger.
   */
  const rl = tagged({
    tag: resolveWindowsFsId.name,
    l,
  },);
  try {
    /**
     * Validated drive root safe for fixed PowerShell query text.
     */
    const driveRoot = windowsDriveRoot(path,);
    /**
     * Drive identifier without trailing separator.
     */
    const driveId = driveRoot.slice(
      0,
      2,
    );
    /**
     * Preferred locale-invariant CIM property output.
     */
    const output = await adapters.run({
      command: 'powershell.exe',
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${driveId}'").VolumeSerialNumber`,
      ],
    },);
    /**
     * Safe normalized volume serial.
     */
    const payload = normalizeIdentityPayload(output,);
    rl.debug(`resolved stable volume serial for ${path}`,);
    return stableResolution({
      source: 'volume-serial',
      payload,
    },);
  }
  catch (preferredError) {
    rl.debug(`volume serial unavailable for ${path}: ${caughtMessage(preferredError,)}`,);
    try {
      /**
       * Runtime device identity from Node stat.
       */
      const deviceNumber = await adapters.deviceNumber({ path, },);
      /**
       * Validated nonzero runtime device identity.
       */
      const payload = requiredPayload({
        output: deviceNumber,
        source: 'runtime device number',
      },);
      if (payload === '0')
        throw new FsIdResolutionError('runtime device number is zero and cannot distinguish volumes',);
      return degradedResolution({
        source: 'device-number',
        payload,
        reason: `volume serial unavailable: ${caughtMessage(preferredError,)}`,
      },);
    }
    catch (fallbackError) {
      rl.error(`runtime device number failed for ${path}: ${caughtMessage(fallbackError,)}`,);
      throw new FsIdResolutionError(
        `unable to resolve Windows filesystem identity for ${path}`,
        { cause: fallbackError, },
      );
    }
  }
}
