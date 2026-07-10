/**
 * Memoized filesystem identity orchestration and production effect adapters.
 *
 * @module
 */

import {
  realpath,
  stat,
} from 'node:fs/promises';
import { platform, } from 'node:os';
import { resolve, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn from 'nano-spawn';

import { UnsupportedFsIdPlatformError, } from './errors.ts';
import {
  resolveDarwinFsId,
  resolveLinuxFsId,
  resolveWindowsFsId,
} from './platform-resolvers.ts';
import type {
  FsIdResolution,
  FsIdResolver,
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
 * Canonicalizes one target through native realpath resolution.
 *
 * @param path - Caller-supplied target
 *
 * @returns Canonical absolute path
 *
 * @example
 * ```ts
 * await canonicalizePath({ path: '.' });
 * ```
 */
function canonicalizePath({ path, }: { readonly path: string; },): Promise<string> {
  return realpath(resolve(path,),);
}

/**
 * Runs one platform command and returns captured stdout.
 *
 * @param command - Executable name
 *
 * @param args - Exact argument vector
 *
 * @returns Captured stdout
 *
 * @example
 * ```ts
 * await runCommand({ command: 'findmnt', args: ['--help'] });
 * ```
 */
async function runCommand({
  command,
  args,
}: {
  readonly command: string;
  readonly args: readonly string[];
},): Promise<string> {
  /**
   * Function-scoped logger.
   */
  const rl = tagged({
    tag: runCommand.name,
    l,
  },);
  rl.debug(`running ${command} ${args.join(' ',)}`,);
  /**
   * Successful command result.
   */
  const { stdout, } = await nanoSpawn(
    command,
    [...args,],
  );
  return stdout;
}

/**
 * Reads runtime device number through Node stat.
 *
 * @param path - Canonical target path
 *
 * @returns Decimal device number
 *
 * @example
 * ```ts
 * await readDeviceNumber({ path: '.' });
 * ```
 */
async function readDeviceNumber({ path, }: { readonly path: string; },): Promise<string> {
  /**
   * Bigint stat result avoids precision loss for device identifiers.
   */
  const metadata = await stat(
    path,
    { bigint: true, },
  );
  return metadata.dev
    .toString();
}

/**
 * Emits mandatory degraded-stability warning.
 *
 * @param path - Canonical target path
 *
 * @param reason - Why reboot stability is unavailable
 *
 * @example
 * ```ts
 * warnDegraded({ path: '/repo', reason: 'UUID unavailable' });
 * ```
 */
function warnDegraded({
  path,
  reason,
}: {
  readonly path: string;
  readonly reason: string;
},): void {
  l.warn(`filesystem identity for ${path} is runtime-only and may change after reboot: ${reason}`,);
}

/**
 * Production adapters using current host operating-system facilities.
 *
 * @example
 * ```ts
 * productionAdapters.platform();
 * ```
 */
const productionAdapters: FsIdResolverAdapters = {
  platform,
  canonicalizePath,
  run: runCommand,
  deviceNumber: readDeviceNumber,
  warn: warnDegraded,
};

/**
 * Resolves one canonical path on selected platform.
 *
 * @param path - Canonical target path
 *
 * @param adapters - Selected effect adapters
 *
 * @returns Stable or degraded identity
 *
 * @throws when platform has no strategy
 *
 * @example
 * ```ts
 * await resolveCanonicalPath({ path: '/repo', adapters });
 * ```
 */
function resolveCanonicalPath({
  path,
  adapters,
}: {
  readonly path: string;
  readonly adapters: FsIdResolverAdapters;
},): Promise<FsIdResolution> {
  /**
   * Platform selected once for this resolution.
   */
  const hostPlatform = adapters.platform();
  if (hostPlatform === 'linux')
    return resolveLinuxFsId({
      path,
      adapters,
    },);
  if (hostPlatform === 'darwin')
    return resolveDarwinFsId({
      path,
      adapters,
    },);
  if (hostPlatform === 'win32')
    return resolveWindowsFsId({
      path,
      adapters,
    },);
  throw new UnsupportedFsIdPlatformError(hostPlatform,);
}

/**
 * Creates resolver around supplied effect adapters.
 *
 * Each call resolves platform identity afresh after canonicalization.
 * Avoiding cross-call memoization prevents a volume replaced at the same path from inheriting stale identity.
 *
 * @param adapters - Production or test effects
 *
 * @returns Fresh canonicalizing resolver
 *
 * @example
 * ```ts
 * const resolver = createFsIdResolver({ adapters });
 * await resolver({ path: '/repo' });
 * ```
 */
export function createFsIdResolver({
  adapters,
}: {
  readonly adapters: FsIdResolverAdapters;
},): FsIdResolver {
  return async function freshResolver({
    path,
  }: {
    readonly path: string;
  }): Promise<FsIdResolution> {
    /**
     * Canonical path resolved on every call so symlink and mount changes are observed.
     */
    const canonicalPath = await adapters.canonicalizePath({ path, },);
    try {
      /**
       * Fresh platform resolution before mandatory degraded warning.
       */
      const resolution = await resolveCanonicalPath({
        path: canonicalPath,
        adapters,
      },);
      if (!resolution.stable) {
        adapters.warn({
          path: canonicalPath,
          reason: resolution.reason ?? 'stable identity mechanism unavailable',
        },);
      }
      return resolution;
    }
    catch (error) {
      l.error(`filesystem identity resolution failed for ${canonicalPath}: ${String(error,)}`,);
      throw error;
    }
  };
}

/**
 * Default production resolver with fresh identity observation per call.
 *
 * @example
 * ```ts
 * await defaultResolver({ path: '.' });
 * ```
 */
const defaultResolver = createFsIdResolver({ adapters: productionAdapters, },);

/**
 * Resolves filesystem identity for existing path on current host.
 *
 * @param path - Existing path whose containing filesystem is identified
 *
 * @returns Stable preferred or warned degraded identity
 *
 * @throws when host has no strategy or no identity mechanism succeeds
 *
 * @example
 * ```ts
 * const result = await resolveFsId({ path: process.cwd() });
 * ```
 */
export function resolveFsId({
  path,
}: {
  readonly path: string;
}): Promise<FsIdResolution> {
  return defaultResolver({ path, },);
}
