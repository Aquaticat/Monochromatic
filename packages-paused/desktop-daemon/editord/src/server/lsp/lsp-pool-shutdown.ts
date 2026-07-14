/**
 * Shutdown helpers for the LSP pool.
 *
 * Extracted from lsp-pool.ts to stay under max-lines.
 */

import type { Logger, } from '../log.ts';
import { isWithinRoot, } from '../operations/assert-within-root.ts';
import type { LspClient, } from './lsp-client.ts';
import { rootFromPoolKey, } from './lsp-pool-config.ts';

/**
 * Shuts down and removes all pooled LSP servers whose project root
 * contains the given path. Used to release file locks on Windows
 * before move/delete operations.
 *
 * @param pool - the pool map to operate on
 *
 * @param path - absolute file or directory path
 *
 * @param l - logger for error reporting
 *
 * @example
 * ```ts
 * await shutdownPoolForPath({ pool, path: '/home/user/project/src/utils.ts', l: logger, });
 * ```
 */
export async function shutdownPoolForPath({
  pool,
  path,
  l,
}: {
  readonly pool: Map<string, Promise<LspClient | null>>;
  readonly path: string;
  readonly l: Logger;
},): Promise<void> {
  /**
   * Collect matching entries for concurrent shutdown.
   */
  const toRemove: string[] = [];
  /**
   * Pool entries whose root contains `path`; each gets its own concurrent shutdown.
   */
  const matching: {
    readonly key: string;
    readonly promise: Promise<LspClient | null>;
  }[] = [];

  for (const [key, promise,] of pool.entries()) {
    /**
     * Project root extracted from the composite pool key.
     */
    const root = rootFromPoolKey({ key, },);
    if (isWithinRoot({
      root,
      path,
    },)) {
      toRemove.push(key,);
      matching.push({
        key,
        promise,
      },);
    }
  }

  /**
   * Without parallel awaits: independent LSP servers would shut down sequentially, delaying the file operation.
   */
  await Promise.all(
    matching.map(async function shutdownEntry({
      key,
      promise,
    },): Promise<void> {
      try {
        /**
         * Resolved client; null when the spawn never succeeded.
         */
        const client = await promise;
        if (client !== null)
          await client.shutdown();
      }
      catch (error) {
        l.error(`shutdown for ${key} failed: ${String(error,)}`,);
      }
    },),
  );

  for (const key of toRemove)
    pool.delete(key,);
}

/**
 * Gracefully shuts down all pooled LSP servers concurrently and resolves
 * once every client has finished its shutdown handshake.
 *
 * @param pool - the pool map to shut down
 *
 * @example
 * ```ts
 * await shutdownAllPooled({ pool: new Map(), });
 * ```
 */
export async function shutdownAllPooled({
  pool,
  l,
}: {
  readonly pool: ReadonlyMap<string, Promise<LspClient | null>>;
  readonly l: Logger;
},): Promise<void> {
  /**
   * Without parallel awaits: independent LSP servers would shut down sequentially, delaying signal-handler completion.
   */
  await Promise.all(
    [...pool.values(),].map(async function shutdownClient(promise,): Promise<void> {
      try {
        /**
         * Resolved client; null when the spawn never succeeded.
         */
        const c = await promise;
        if (c !== null)
          await c.shutdown();
      }
      catch (error) {
        l.error(`LSP shutdown failed: ${String(error,)}`,);
      }
    },),
  );
}
