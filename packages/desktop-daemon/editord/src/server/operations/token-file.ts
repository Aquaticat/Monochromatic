/**
 * Stable auth token persistence across dev-mode restarts.
 *
 * During `mise watch` auto-restarts, the old server process dies and
 * a new one spawns within milliseconds. This module writes the auth
 * token to a file in `$TMPDIR` and keeps its mtime fresh (every 1s).
 * On startup, if the token file exists and its mtime is within
 * {@link FRESHNESS_THRESHOLD_MS} of now, the token is reused --
 * meaning the client's existing WebSocket URL stays valid across
 * the restart. Cold starts (stale or missing file) generate a fresh token.
 *
 * @example
 * ```ts
 * const { token, cleanup } = await resolveAuthToken({ port: 4400 });
 * // ... on shutdown:
 * cleanup();
 * ```
 */

import {
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  type Logger,
  tagged,
} from '../log.ts';

//region Constants

/**
 * Maximum age of the token file's mtime (in milliseconds) for it
 * to be considered "fresh" -- i.e. left by a process that was alive
 * very recently (auto-restart). Anything older is treated as stale.
 */
const FRESHNESS_THRESHOLD_MS = 3_000;

/** Interval at which the running server touches the token file's mtime. */
const TOUCH_INTERVAL_MS = 1_000;

//endregion Constants

/**
 * Builds the token file path for a given port.
 *
 * @param port - HTTP listen port
 *
 * @returns absolute path to the token file
 */
function tokenFilePath({ port, }: { port: number; },): string {
  return join(
    tmpdir(),
    `editord-${String(port,)}.token`,
  );
}

/**
 * Checks whether the token file is fresh (mtime within threshold).
 *
 * @param path - absolute path to the token file
 *
 * @returns the token string if fresh, or null if stale/missing
 */
async function readFreshToken({ path, }: { path: string; },): Promise<string | null> {
  try {
    const fileStat = await stat(path,);
    const ageMs = Date.now() - fileStat.mtimeMs;
    if (ageMs > FRESHNESS_THRESHOLD_MS)
      return null;
    const content = await readFile(
      path,
      'utf8',
    );
    const token = content.trim();
    if (token.length === 0)
      return null;
    return token;
  }
  catch {
    return null;
  }
}

/**
 * Re-writes the token file to keep its mtime fresh.
 * Errors are silently ignored -- worst case, the next restart generates a fresh token.
 *
 * @param path - token file path
 *
 * @param token - auth token string
 */
async function touchFile({
  path,
  token,
}: {
  path: string;
  token: string;
},): Promise<void> {
  try {
    await writeFile(
      path,
      token,
      'utf8',
    );
  }
  catch {
    // Touch failures are harmless.
  }
}

/**
 * Removes the token file on shutdown. Logs if already gone.
 *
 * @param path - token file path
 *
 * @param l - logger
 */
async function cleanupFile({
  path,
  l,
}: {
  path: string;
  l: Logger;
},): Promise<void> {
  try {
    await unlink(path,);
  }
  catch {
    l.info('token file already removed',);
  }
}

/**
 * Writes the token to disk and starts a periodic mtime touch.
 *
 * @param path - absolute path to write the token file
 *
 * @param token - auth token string to persist
 *
 * @returns `stopTouching` to stop the interval, and `deleteFile` to remove the token file
 */
async function writeAndTouch({
  path,
  token,
  l,
}: {
  path: string;
  token: string;
  l: Logger;
},): Promise<{
  stopTouching: () => void;
  deleteFile: () => void;
}> {
  await writeFile(
    path,
    token,
    'utf8',
  );

  const interval = setInterval(
    function touchTokenFile() {
      void touchFile({
        path,
        token,
      },);
    },
    TOUCH_INTERVAL_MS,
  );

  return {
    stopTouching: function stopTouching(): void {
      clearInterval(interval,);
    },
    deleteFile: function deleteFile(): void {
      clearInterval(interval,);
      void cleanupFile({
        path,
        l,
      },);
    },
  };
}

/**
 * Resolves the auth token for this server instance.
 *
 * If a fresh token file exists (mtime within {@link FRESHNESS_THRESHOLD_MS}),
 * reuses it so that clients from a previous dev-mode instance can reconnect.
 * Otherwise generates a new random UUID token.
 *
 * In both cases, starts a periodic mtime touch so the next restart
 * can detect that this process was recently alive.
 *
 * @param port - HTTP listen port (used to namespace the token file)
 *
 * @param l - parent logger
 *
 * @returns the auth token, `stopTouching` for SIGTERM, and `deleteFile` for SIGINT
 */
export async function resolveAuthToken({
  port,
  l,
}: {
  port: number;
  l: Logger;
},): Promise<{
  token: string;
  stopTouching: () => void;
  deleteFile: () => void;
}> {
  const tokenLog = tagged({
    tag: 'token',
    l,
  },);
  const path = tokenFilePath({ port, },);
  const existing = await readFreshToken({ path, },);

  if (existing !== null) {
    tokenLog.info('reusing token from previous instance (auto-restart detected)',);
    const handles = await writeAndTouch({
      path,
      token: existing,
      l: tokenLog,
    },);
    return {
      token: existing,
      ...handles,
    };
  }

  const token = crypto.randomUUID();
  tokenLog.info('generated fresh token',);
  const handles = await writeAndTouch({
    path,
    token,
    l: tokenLog,
  },);
  return {
    token,
    ...handles,
  };
}
