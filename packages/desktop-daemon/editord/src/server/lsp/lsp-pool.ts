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
 * tsgo's ScriptKind panic is triggered when a non-source file is open
 * in editord and tsgo spawns for that project root. The crash resolves
 * as soon as the user navigates away from the problematic file,
 * so a short flat retry keeps recovery fast without backoff escalation.
 */
const DETERMINISTIC_PANIC_RETRY_MS = 1_000;

/**
 * Pattern matching tsgo's ScriptKind panic in stderr.
 * When detected, the pool uses flat retry instead of exponential backoff
 * because the crash resolves as soon as the user navigates away
 * from the non-source file that triggered the tsgo spawn.
 */
const SCRIPT_KIND_PANIC_PATTERN = 'ScriptKind must be specified';

/** Crash tracking state for a single pool key. */
type CrashState = {
  /** Number of consecutive unexpected exits without a successful request in between. */
  count: number;
  /** Timestamp of last crash (milliseconds since epoch). */
  lastCrashAt: number;
  /** Whether the crash was a known deterministic panic (flat retry, no backoff). */
  deterministic: boolean;
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
   * For tsgo, checks the resolved tsconfig `include` patterns before
   * spawning a new server — files outside the project's declared scope
   * are rejected so tsgo never receives an unsupported extension as its
   * initial trigger, which would cause a ScriptKind panic.
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

    /**
     * For tsgo, ALWAYS check tsconfig includes — both for reuse
     * and new spawns. Returning an existing tsgo client for a
     * non-matching file (e.g. `.svg`) is just as dangerous as
     * spawning a new one: the feature request handler sends the
     * file URI to tsgo, which creates an inferred project for it
     * and panics on the unsupported ScriptKind.
     */
    if (type === 'tsgo') {
      return this.#resolveTsgoWithIncludeCheck({
        filePath,
        root,
      },);
    }

    const key = buildPoolKey({
      type,
      root,
    },);
    const existing = this.#pool.get(key,);
    if (existing !== undefined) {
      this.#l.info(`${type} resolve: reusing existing client for ${root} (trigger: ${filePath})`,);
      return existing;
    }
    if (this.#isInBackoff({ key, },))
      return Promise.resolve(null,);

    this.#l.info(`${type} resolve: spawning NEW client for ${root} (trigger: ${filePath})`,);
    const promise = this.#spawnWithCrashRecovery({
      type,
      root,
      key,
    },);
    this.#pool.set(
      key,
      promise,
    );
    return promise;
  }

  /**
   * Resolves tsgo with a tsconfig include check gating ALL access.
   *
   * Files outside the project's declared include scope get `null`
   * even when an existing tsgo client is running for that root.
   * This prevents feature request handlers from sending non-source
   * file URIs to tsgo, which would trigger inferred-project creation
   * and a ScriptKind panic on unsupported extensions.
   *
   * @param filePath - absolute file path that triggered the resolve
   *
   * @param root - project root directory containing tsconfig.json
   *
   * @returns existing or new client for matching files, null otherwise
   */
  async #resolveTsgoWithIncludeCheck({
    filePath,
    root,
  }: {
    filePath: string;
    root: string;
  },): Promise<LspClient | null> {
    const patterns = await resolveTsconfigIncludes({
      root,
      l: this.#l,
    },);
    if (!matchesTsconfigIncludes({
      path: filePath,
      patterns,
    },)) {
      this.#l.info(`${filePath} excluded by tsconfig includes, skipping tsgo`,);
      return null;
    }

    const key = buildPoolKey({
      type: 'tsgo',
      root,
    },);
    const existing = this.#pool.get(key,);
    if (existing !== undefined) {
      this.#l.info(`tsgo resolve: reusing existing client for ${root} (trigger: ${filePath})`,);
      return existing;
    }
    if (this.#isInBackoff({ key, },))
      return null;

    this.#l.info(`tsgo resolve: spawning NEW client for ${root} (trigger: ${filePath})`,);
    const promise = this.#spawnWithCrashRecovery({
      type: 'tsgo',
      root,
      key,
    },);
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
      onExit: function handleCrashRecovery({
        unexpected,
        recentStderr,
      },) {
        if (!unexpected)
          return;
        pool.delete(key,);
        const deterministic = recentStderr.includes(SCRIPT_KIND_PANIC_PATTERN,);
        const prev = crashes.get(key,);
        const count = (prev?.count ?? 0) + 1;
        crashes.set(
          key,
          {
            count,
            lastCrashAt: Date.now(),
            deterministic,
          },
        );
        const delay = deterministic
          ? DETERMINISTIC_PANIC_RETRY_MS
          : Math.min(
            BASE_RESTART_DELAY_MS * 2 ** (count - 1),
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
    const delay = state.deterministic
      ? DETERMINISTIC_PANIC_RETRY_MS
      : Math.min(
        BASE_RESTART_DELAY_MS * 2 ** (state.count - 1),
        MAX_RESTART_DELAY_MS,
      );
    const elapsed = Date.now() - state.lastCrashAt;
    if (elapsed >= delay) {
      /** Backoff/retry period has elapsed; allow restart. */
      return false;
    }
    return true;
  }

  /**
   * Resolves all three server types for a given file path.
   *
   * The tsconfig include filter for tsgo lives inside {@link resolve}
   * itself, so both this method and direct `resolve()` callers
   * (like feature request handlers) are equally protected.
   *
   * @returns server slots with oxlint, tsgo, and dprint clients
   */
  async resolveAll({ path, }: { path: string; },): Promise<ServerSlots> {
    const [oxlint, tsgo, dprint,] = await Promise.all([
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
