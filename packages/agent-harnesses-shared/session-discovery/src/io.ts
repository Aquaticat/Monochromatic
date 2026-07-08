/**
 * Default filesystem IO for shared session discovery.
 *
 * @module
 */

import {
  readFile as nodeReadFile,
  readdir,
  stat,
} from 'node:fs/promises';

import type {
  SessionDiscoveryFileStat,
  SessionDiscoveryIo,
} from './types.ts';

//region Default readers

/**
 * Reads a UTF-8 file through test override when supplied.
 *
 * @param path - file path to read
 *
 * @param io - optional test IO seam
 *
 * @returns UTF-8 file text
 *
 * @example
 * ```ts
 * await readTextFile({ path: '/tmp/session', io: {} });
 * ```
 */
async function readTextFile(
  {
    path,
    io,
  }: {
    readonly path: string;
    readonly io?: SessionDiscoveryIo;
  },
): Promise<string> {
  if (io?.readFile !== undefined)
    return await io.readFile(path,);

  return await nodeReadFile(
    path,
    'utf8',
  );
}

/**
 * Reads directory entries through test override when supplied.
 *
 * @param path - directory path to read
 *
 * @param io - optional test IO seam
 *
 * @returns directory entry names
 *
 * @example
 * ```ts
 * await readDirectoryEntries({ path: '/tmp/.by-pid', io: {} });
 * ```
 */
async function readDirectoryEntries(
  {
    path,
    io,
  }: {
    readonly path: string;
    readonly io?: SessionDiscoveryIo;
  },
): Promise<readonly string[]> {
  if (io?.readDir !== undefined)
    return await io.readDir(path,);

  return await readdir(path,);
}

/**
 * Reads file modification time through test override when supplied.
 *
 * @param path - file path to stat
 *
 * @param io - optional test IO seam
 *
 * @returns stat fields used by session discovery
 *
 * @example
 * ```ts
 * await readFileStat({ path: '/tmp/.by-pid/123', io: {} });
 * ```
 */
async function readFileStat(
  {
    path,
    io,
  }: {
    readonly path: string;
    readonly io?: SessionDiscoveryIo;
  },
): Promise<SessionDiscoveryFileStat> {
  if (io?.statFile !== undefined)
    return await io.statFile(path,);

  /**
   * Node stat object carrying `mtimeMs`.
   */
  const stats = await stat(path,);
  return { mtimeMs: stats.mtimeMs, };
}

//endregion Default readers

export {
  readDirectoryEntries,
  readFileStat,
  readTextFile,
};
