/**
 * Pool of LSP server processes keyed by `(type, projectRoot)`.
 *
 * Servers are created lazily on first request and never terminated.
 * Each server type discovers its own project root by walking up
 * from the file being operated on to find its config file.
 */

import { dirname, } from 'node:path';

import type { Logger, } from '../log.ts';
import type { ServerSlots, } from './document-sync.ts';
import { findProjectRoot, } from './find-project-root.ts';
import type { LspClient, } from './lsp-client.ts';
import {
  buildPoolKey,
  CONFIG_FILES,
  type ServerType,
  spawnLspClient,
} from './lsp-pool-config.ts';
import {
  shutdownAllPooled,
  shutdownPoolForPath,
} from './lsp-pool-shutdown.ts';
import {
  matchesTsconfigIncludes,
  resolveTsconfigIncludes,
} from './tsconfig-includes.ts';

export { type ServerType, };

/**
 * Minimum delay before restarting a crashed server (milliseconds).
 * Doubles on each consecutive crash up to {@link MAX_RESTART_DELAY_MS}.
 */
const BASE_RESTART_DELAY_MS = 2_000;

/**
 * Maximum delay between crash-restart attempts (milliseconds).
 * Caps exponential backoff so a repeatedly crashing server
 * still gets retried periodically.
 */
const MAX_RESTART_DELAY_MS = 60_000;

/**
 * Fixed retry interval for known deterministic panics (milliseconds).
 * tsc's ScriptKind panic is triggered when a non-source file is open
 * in editord and tsc spawns for that project root. The crash resolves
 * as soon as the user navigates away from the problematic file,
 * so a short flat retry keeps recovery fast without backoff escalation.
 */
const DETERMINISTIC_PANIC_RETRY_MS = 1_000;

/**
 * Pattern matching tsc's ScriptKind panic in stderr.
 * When detected, the pool uses flat retry instead of exponential backoff
 * because the crash resolves as soon as the user navigates away
 * from the non-source file that triggered the tsc spawn.
 */
const SCRIPT_KIND_PANIC_PATTERN = 'ScriptKind must be specified';

/**
 * Crash tracking state for a single pool key.
 */
type CrashState = {
  /**
   * Number of consecutive unexpected exits without a successful request in between.
   */
  readonly count: number;
  /**
   * Timestamp of last crash (milliseconds since epoch).
   */
  readonly lastCrashAt: number;
  /**
   * Whether the crash was a known deterministic panic (flat retry, no backoff).
   */
  readonly deterministic: boolean;
};

/**
 * Server-initiated notification payload with source already attached.
 */
type PoolNotification = {
  /**
   * LSP server source name.
   */
  readonly source: string;
  /**
   * LSP method name.
   */
  readonly method: string;
  /**
   * LSP params.
   */
  readonly params: unknown;
};

/**
 * Options for {@link createLspPool}.
 */
export type LspPoolOptions = {
  /**
   * Highest directory for config-file search (file tree root).
   */
  readonly ceiling: string;
  /**
   * Parent logger.
   */
  readonly l: Logger;
  /**
   * Callback for server-initiated notifications.
   */
  readonly onNotification: (event: PoolNotification,) => void;
};

/**
 * LSP client pool handle returned by {@link createLspPool}.
 */
export type LspPool = Readonly<{
  /**
   * Finds or creates the LSP client for a server type given a file path.
   */
  readonly resolve: (opts: {
    readonly type: ServerType;
    readonly filePath: string;
  },) => Promise<LspClient | null>;
  /**
   * Resolves all three server types for a given file path.
   */
  readonly resolveAll: (opts: { readonly path: string; },) => Promise<ServerSlots>;
  /**
   * Shuts down pooled LSP servers whose project root contains the path.
   */
  readonly shutdownForPath: (opts: { readonly path: string; },) => Promise<void>;
  /**
   * Gracefully shuts down all pooled LSP servers.
   */
  readonly shutdown: () => Promise<void>;
}>;

/**
 * Creates an LSP client pool.
 *
 * @param ceiling - highest directory for config-file search (file tree root)
 *
 * @param l - parent logger
 *
 * @param onNotification - callback for server-initiated notifications
 *
 * @returns frozen LSP pool handle
 *
 * @example
 * ```ts
 * const pool = createLspPool({
 *   ceiling: '/home/user/project',
 *   l: logger,
 *   onNotification: function handleNotification(event) { console.info(event.source); },
 * });
 * ```
 */
export function createLspPool({
  ceiling,
  l,
  onNotification,
}: LspPoolOptions,): LspPool {
  /**
   * Pool: `"type:root"` to client creation promise.
   */
  const pool = new Map<string, Promise<LspClient | null>>();
  /**
   * Crash tracking per pool key for exponential backoff.
   */
  const crashes = new Map<string, CrashState>();

  /**
   * Checks whether a pool key is in crash-backoff cooldown.
   * Returns true when the time since the last crash is less than
   * the exponential backoff delay for that key's crash count.
   *
   * @param key - pool map key to check
   *
   * @returns true when the server should not be restarted yet
   */
  function isInBackoff({ key, }: { readonly key: string; },): boolean {
    /**
     * Crash record for this key, or undefined when the server has never crashed.
     */
    const state = crashes.get(key,);
    if (state === undefined)
      return false;
    /**
     * Required cooldown for this key's crash history; mirrors the delay computed in `spawnWithCrashRecovery`.
     */
    const delay = state.deterministic
      ? DETERMINISTIC_PANIC_RETRY_MS
      : Math.min(
        BASE_RESTART_DELAY_MS * (2 ** (state.count
          - 1)),
        MAX_RESTART_DELAY_MS,
      );
    /**
     * Time since the last crash; compared against `delay` to decide if the cooldown has elapsed.
     */
    const elapsed = Date.now()
      - state
      .lastCrashAt;
    if (elapsed >= delay) {
      /**
       * Backoff/retry period has elapsed; allow restart.
       */
      return false;
    }
    return true;
  }

  /**
   * Spawns a client and wires up the exit handler for crash recovery.
   * On unexpected exit, removes the dead entry from the pool so the
   * next {@link LspPool.resolve} call creates a fresh client (subject to backoff).
   *
   * @param type - server type to spawn
   *
   * @param root - project root directory
   *
   * @param key - pool map key for this type+root combination
   *
   * @returns initialized client, or null on failure
   */
  function spawnWithCrashRecovery({
    type,
    root,
    key,
  }: {
    readonly type: ServerType;
    readonly root: string;
    readonly key: string;
  },): Promise<LspClient | null> {
    return spawnLspClient({
      type,
      root,
      l,
      onNotification,
      onExit: function handleCrashRecovery({
        unexpected,
        recentStderr,
      },) {
        if (!unexpected)
          return;
        pool.delete(key,);
        /**
         * True when stderr contains the known tsc ScriptKind panic; selects flat-retry over exponential backoff.
         */
        const deterministic = recentStderr.includes(SCRIPT_KIND_PANIC_PATTERN,);
        /**
         * Prior crash record for this key, or undefined on the first crash.
         */
        const prev = crashes.get(key,);
        /**
         * Crash counter incremented for this exit; drives exponential backoff in the non-deterministic branch.
         */
        const count = (prev?.count
          ?? 0) + 1;
        crashes.set(
          key,
          {
            count,
            lastCrashAt: Date.now(),
            deterministic,
          },
        );
        /**
         * Delay before the next spawn attempt; flat for known panics, exponential-with-cap otherwise.
         */
        const delay = deterministic
          ? DETERMINISTIC_PANIC_RETRY_MS
          : Math.min(
            BASE_RESTART_DELAY_MS * (2 ** (count - 1)),
            MAX_RESTART_DELAY_MS,
          );
        l.error(
          `${type} at ${root} crashed (attempt ${String(count,)})${
            deterministic ? ' [ScriptKind panic]' : ''
          }, next restart in ${String(delay,)}ms`,
        );
      },
    },);
  }

  /**
   * Resolves tsc with a tsconfig include check gating ALL access.
   *
   * Files outside the project's declared include scope get `null`
   * even when an existing tsc client is running for that root.
   * This prevents feature request handlers from sending non-source
   * file URIs to tsc, which would trigger inferred-project creation
   * and a ScriptKind panic on unsupported extensions.
   *
   * @param filePath - absolute file path that triggered the resolve
   *
   * @param root - project root directory containing tsconfig.json
   *
   * @returns existing or new client for matching files, null otherwise
   */
  async function resolveTsgoWithIncludeCheck({
    filePath,
    root,
  }: {
    readonly filePath: string;
    readonly root: string;
  },): Promise<LspClient | null> {
    /**
     * tsconfig `include` glob patterns; gate access so non-source files never reach tsc.
     */
    const patterns = await resolveTsconfigIncludes({
      root,
      l,
    },);
    if (!matchesTsconfigIncludes({
      path: filePath,
      patterns,
    },)) {
      l.info(`${filePath} excluded by tsconfig includes, skipping tsc`,);
      return null;
    }

    /**
     * Pool map key for the tsc client at this root; distinct from oxlint/dprint keys at the same root.
     */
    const key = buildPoolKey({
      type: 'tsc',
      root,
    },);
    /**
     * Cached tsc creation promise; reused on subsequent matching-file resolves.
     */
    const existing = pool.get(key,);
    if (existing !== undefined) {
      l.info(
        `tsc resolve: reusing existing client for ${root} (trigger: ${filePath})`,
      );
      return existing;
    }
    if (isInBackoff({ key, },))
      return null;

    l.info(`tsc resolve: spawning NEW client for ${root} (trigger: ${filePath})`,);
    /**
     * New tsc client promise; stored in the pool before await so concurrent callers share it.
     */
    const promise = spawnWithCrashRecovery({
      type: 'tsc',
      root,
      key,
    },);
    pool.set(
      key,
      promise,
    );
    return promise;
  }

  /**
   * Finds or creates the LSP client for a server type given a file path.
   * Returns null when the server is in crash-backoff cooldown.
   *
   * For tsc, checks the resolved tsconfig `include` patterns before
   * spawning a new server; files outside the project's declared scope
   * are rejected so tsc never receives an unsupported extension as its
   * initial trigger, which would cause a ScriptKind panic.
   *
   * @returns promise resolving to the client, or null if no project root is found or server is in backoff
   */
  function resolve(
    {
      type,
      filePath,
    }: {
      readonly type: ServerType;
      readonly filePath: string;
    },
  ): Promise<LspClient | null> {
    /**
     * Project root for this server type; null when no config file found up to the ceiling.
     */
    const root = findProjectRoot({
      startDir: dirname(filePath,),
      configFiles: CONFIG_FILES[type],
      ceiling,
    },);
    if (root === null)
      return Promise.resolve(null,);

    /**
     * For tsc, ALWAYS check tsconfig includes: both for reuse
     * and new spawns. Returning an existing tsc client for a
     * non-matching file (e.g. `.svg`) is just as dangerous as
     * spawning a new one: the feature request handler sends the
     * file URI to tsc, which creates an inferred project for it
     * and panics on the unsupported ScriptKind.
     */
    if (type === 'tsc') {
      return resolveTsgoWithIncludeCheck({
        filePath,
        root,
      },);
    }

    /**
     * Pool map key encoding `(type, root)` so each pair gets exactly one cached client.
     */
    const key = buildPoolKey({
      type,
      root,
    },);
    /**
     * Cached creation promise for this key, or undefined when no client has been spawned yet.
     */
    const existing = pool.get(key,);
    if (existing !== undefined) {
      l.info(
        `${type} resolve: reusing existing client for ${root} (trigger: ${filePath})`,
      );
      return existing;
    }
    if (isInBackoff({ key, },))
      return Promise.resolve(null,);

    l.info(
      `${type} resolve: spawning NEW client for ${root} (trigger: ${filePath})`,
    );
    /**
     * Newly spawned client promise; stored in the pool before awaiting so concurrent callers share it.
     */
    const promise = spawnWithCrashRecovery({
      type,
      root,
      key,
    },);
    pool.set(
      key,
      promise,
    );
    return promise;
  }

  /**
   * Resolves all three server types for a given file path.
   *
   * The tsconfig include filter for tsc lives inside {@link resolve}
   * itself, so both this method and direct `resolve()` callers
   * (like feature request handlers) are equally protected.
   *
   * @returns server slots with oxlint, tsc, and dprint clients
   */
  async function resolveAll({ path, }: { readonly path: string; },): Promise<ServerSlots> {
    /**
     * Resolved clients for all three server types in parallel; each slot may be null.
     */
    const [oxlint, tsc, dprint,] = await Promise.all([
      resolve({
        type: 'oxlint',
        filePath: path,
      },),
      resolve({
        type: 'tsc',
        filePath: path,
      },),
      resolve({
        type: 'dprint',
        filePath: path,
      },),
    ],);

    return {
      oxlint,
      tsc,
      dprint,
    };
  }

  /**
   * Shuts down and removes all pooled LSP servers whose project root
   * contains the given path.
   *
   * @param path - absolute file or directory path
   */
  async function shutdownForPath({ path, }: { readonly path: string; },): Promise<void> {
    await shutdownPoolForPath({
      pool,
      path,
      l,
    },);
  }

  /**
   * Gracefully shuts down all pooled LSP servers and waits for completion.
   */
  async function shutdown(): Promise<void> {
    await shutdownAllPooled({
      pool,
      l,
    },);
  }

  return Object.freeze({
    resolve,
    resolveAll,
    shutdownForPath,
    shutdown,
  },);
}
