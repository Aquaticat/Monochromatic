/**
 * Shutdown helpers for the LSP pool.
 *
 * Extracted from lsp-pool.ts to stay under max-lines.
 */

import type { Logger, } from '../log.ts';
import type { LspClient, } from './lsp-client.ts';

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
 */
export async function shutdownPoolForPath({
  pool,
  path,
  l,
}: {
  pool: Map<string, Promise<LspClient | null>>;
  path: string;
  l: Logger;
},): Promise<void> {
  /** Collect matching entries for concurrent shutdown. */
  const toRemove: string[] = [];
  const matching: {
    key: string;
    promise: Promise<LspClient | null>
  }[] = [];

  for (const [key, promise,] of pool.entries()) {
    /** Key format is `"type:root"` — extract the root portion. */
    const colonIndex = key.indexOf(':',);
    const root = key.slice(colonIndex + 1,);
    const rootPrefix = root.endsWith('/',) ? root : `${root}/`;
    if (path === root || path.startsWith(rootPrefix,)) {
      toRemove.push(key,);
      matching.push({
        key,
        promise,
      },);
    }
  }

  /** Without parallel awaits: independent LSP servers would shut down sequentially, delaying the file operation. */
  await Promise.all(
    matching.map(async function shutdownEntry({
      key,
      promise,
    },): Promise<void> {
      try {
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
 * Gracefully shuts down all pooled LSP servers (fire-and-forget).
 *
 * @param pool - the pool map to shut down
 */
export function shutdownAllPooled({
  pool,
  l,
}: {
  pool: Map<string, Promise<LspClient | null>>;
  l: Logger;
},): void {
  for (const promise of pool.values()) {
    void (async function shutdownClient(): Promise<void> {
      try {
        const c = await promise;
        if (c !== null)
          await c.shutdown();
      }
      catch (error) {
        l.error(`LSP shutdown failed: ${String(error,)}`,);
      }
    })();
  }
}
