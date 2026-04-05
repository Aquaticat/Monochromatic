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

/** Crash tracking state for a single pool key. */
type CrashState = {
  /** Number of consecutive unexpected exits without a successful request in between. */
  count: number;
  /** Timestamp of last crash (milliseconds since epoch). */
  lastCrashAt: number;
};

/** Lazily creates and caches LSP clients per `(type, projectRoot)`. */
export class LspPool {
  /** Pool: `"type:root"` → client creation promise. */
  #pool = new Map<string, Promise<LspClient | null>>();
  /** Crash tracking per pool key for exponential backoff. */
  #crashes = new Map<string, CrashState>();
  /** Tagged logger. */
  #l: Logger;
  /** Highest directory to search for config files (file tree root). */
  #ceiling: string;
  /** Callback for server-initiated notifications. */
  #onNotification: (event: {
    source: string;
    method: string;
    params: unknown;
  },) => void;

  /**
   * @param ceiling - highest directory for config-file search (file tree root)
   *
   * @param l - parent logger
   *
   * @param onNotification - callback for server-initiated notifications
   */
  constructor({
    ceiling,
    l,
    onNotification,
  }: {
    ceiling: string;
    l: Logger;
    onNotification: (
      event: {
        source: string;
        method: string;
        params: unknown;
      },
    ) => void;
  },) {
    this.#l = l;
    this.#ceiling = ceiling;
    this.#onNotification = onNotification;
  }

  /**
   * Finds or creates the LSP client for a server type given a file path.
   * Returns null when the server is in crash-backoff cooldown.
   *
   * @returns promise resolving to the client, or null if no project root is found or server is in backoff
   */
  resolve(
    {
      type,
      filePath,
    }: {
      type: ServerType;
      filePath: string;
    },
  ): Promise<LspClient | null> {
    const root = findProjectRoot({
      startDir: dirname(filePath,),
      configFiles: CONFIG_FILES[type],
      ceiling: this.#ceiling,
    },);
    if (root === null)
      return Promise.resolve(null,);
    const key = buildPoolKey({
      type,
      root,
    },);
    const existing = this.#pool.get(key,);
    if (existing !== undefined)
      return existing;
    if (this.#isInBackoff({ key, },))
      return Promise.resolve(null,);
    const promise = this.#spawnWithCrashRecovery({ type, root, key, },);
    this.#pool.set(
      key,
      promise,
    );
    return promise;
  }

  /**
   * Spawns a client and wires up the exit handler for crash recovery.
   * On unexpected exit, removes the dead entry from the pool so the
   * next {@link resolve} call creates a fresh client (subject to backoff).
   *
   * @param type - server type to spawn
   *
   * @param root - project root directory
   *
   * @param key - pool map key for this type+root combination
   *
   * @returns initialized client, or null on failure
   */
  #spawnWithCrashRecovery({
    type,
    root,
    key,
  }: {
    type: ServerType;
    root: string;
    key: string;
  },): Promise<LspClient | null> {
    const pool = this.#pool;
    const crashes = this.#crashes;
    const l = this.#l;

    return spawnLspClient({
      type,
      root,
      l,
      onNotification: this.#onNotification,
      onExit: function handleCrashRecovery({ unexpected, },) {
        if (!unexpected)
          return;
        pool.delete(key,);
        const prev = crashes.get(key,);
        const count = (prev?.count ?? 0) + 1;
        crashes.set(
          key,
          {
            count,
            lastCrashAt: Date.now(),
          },
        );
        const delay = Math.min(
          BASE_RESTART_DELAY_MS * Math.pow(2, count - 1,),
          MAX_RESTART_DELAY_MS,
        );
        l.error(
          `${type} at ${root} crashed (attempt ${String(count,)}), next restart in ${String(delay,)}ms`,
        );
      },
    },);
  }

  /**
   * Checks whether a pool key is in crash-backoff cooldown.
   * Returns true when the time since the last crash is less than
   * the exponential backoff delay for that key's crash count.
   *
   * @param key - pool map key to check
   *
   * @returns true when the server should not be restarted yet
   */
  #isInBackoff({ key, }: { key: string; },): boolean {
    const state = this.#crashes.get(key,);
    if (state === undefined)
      return false;
    const delay = Math.min(
      BASE_RESTART_DELAY_MS * Math.pow(2, state.count - 1,),
      MAX_RESTART_DELAY_MS,
    );
    const elapsed = Date.now() - state.lastCrashAt;
    if (elapsed >= delay) {
      /** Backoff period has elapsed; allow restart but keep count for next escalation. */
      return false;
    }
    return true;
  }

  /**
   * Resolves all three server types for a given file path.
   * For tsgo, also checks that the file matches the resolved
   * tsconfig `include` patterns — returns null for tsgo when
   * the file falls outside the project's declared scope.
   *
   * @returns server slots with oxlint, tsgo, and dprint clients
   */
  async resolveAll({ path, }: { path: string; },): Promise<ServerSlots> {
    const [oxlint, tsgoRaw, dprint,] = await Promise.all([
      this.resolve({
        type: 'oxlint',
        filePath: path,
      },),
      this.resolve({
        type: 'tsgo',
        filePath: path,
      },),
      this.resolve({
        type: 'dprint',
        filePath: path,
      },),
    ],);

    /** Filter tsgo through resolved tsconfig includes. */
    let tsgo = tsgoRaw;
    if (tsgo !== null) {
      const root = findProjectRoot({
        startDir: dirname(path,),
        configFiles: CONFIG_FILES.tsgo,
        ceiling: this.#ceiling,
      },);
      if (root !== null) {
        const patterns = await resolveTsconfigIncludes({
          root,
          l: this.#l,
        },);
        if (!matchesTsconfigIncludes({
          path,
          patterns,
        },)) {
          this.#l.info(`${path} excluded by tsconfig includes, skipping tsgo`,);
          tsgo = null;
        }
      }
    }

    return {
      oxlint,
      tsgo,
      dprint,
    };
  }

  /**
   * Shuts down and removes all pooled LSP servers whose project root
   * contains the given path.
   *
   * @param path - absolute file or directory path
   */
  async shutdownForPath({ path, }: { path: string; },): Promise<void> {
    await shutdownPoolForPath({
      pool: this.#pool,
      path,
      l: this.#l,
    },);
  }

  /** Gracefully shuts down all pooled LSP servers. */
  shutdown(): void {
    shutdownAllPooled({
      pool: this.#pool,
      l: this.#l,
    },);
  }
}
