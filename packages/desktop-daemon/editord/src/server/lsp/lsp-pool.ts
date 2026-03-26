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

export { type ServerType, };

/** Lazily creates and caches LSP clients per `(type, projectRoot)`. */
export class LspPool {
  /** Pool: `"type:root"` → client creation promise. */
  #pool = new Map<string, Promise<LspClient | null>>();
  /** Tagged logger. */
  #l: Logger;
  /** Highest directory to search for config files (file tree root). */
  #ceiling: string;
  /** Callback for server-initiated notifications. */
  #onNotification: (event: {
    source: string;
    method: string;
    params: unknown
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
        params: unknown
      },
    ) => void;
  },) {
    this.#l = l;
    this.#ceiling = ceiling;
    this.#onNotification = onNotification;
  }

  /**
   * Finds or creates the LSP client for a server type given a file path.
   *
   * @returns promise resolving to the client, or null if no project root is found
   */
  resolve(
    {
      type,
      filePath,
    }: {
      type: ServerType;
      filePath: string
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
    const promise = spawnLspClient({
      type,
      root,
      l: this.#l,
      onNotification: this.#onNotification,
    },);
    this.#pool.set(
      key,
      promise,
    );
    return promise;
  }

  /**
   * Resolves all three server types for a given file path.
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
