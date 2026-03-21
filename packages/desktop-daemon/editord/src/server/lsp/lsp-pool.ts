/**
 * Pool of LSP server processes keyed by `(type, projectRoot)`.
 *
 * Servers are created lazily on first request and never terminated.
 * Each server type discovers its own project root by walking up
 * from the file being operated on to find its config file.
 */

import { dirname, join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import type { Logger, } from '../log.ts';
import type { ServerSlots, } from './document-sync.ts';
import { findProjectRoot, } from './find-project-root.ts';
import { LspClient, } from './lsp-client.ts';

/** LSP server type identifier. */
type ServerType = 'oxlint' | 'tsgo' | 'dprint';

/** Config files that define a project root for each server type. */
const CONFIG_FILES: Record<ServerType, readonly string[]> = {
  oxlint: ['package.json',],
  tsgo: ['tsconfig.json',],
  dprint: ['dprint.json', 'dprint.jsonc',],
};

/** Spawn command and arguments for each server type. */
const COMMANDS: Record<ServerType, {
  command: string;
  args: readonly string[];
  initializationOptions: Record<string, unknown>;
}> = {
  oxlint: { command: 'oxlint', args: ['--lsp',], initializationOptions: {}, },
  tsgo: {
    command: 'tsgo', args: ['--lsp', '--stdio',],
    initializationOptions: {
      userPreferences: {
        inlayHints: {
          parameterNames: { enabled: 'all', },
          parameterTypes: { enabled: true, },
          variableTypes: { enabled: true, },
          propertyDeclarationTypes: { enabled: true, },
          functionLikeReturnTypes: { enabled: true, },
          enumMemberValues: { enabled: true, },
        },
      },
    },
  },
  dprint: { command: 'dprint', args: ['lsp',], initializationOptions: {}, },
};

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
  #onNotification: (source: string, method: string, params: unknown,) => void;

  /**
   * @param ceiling - highest directory for config-file search (file tree root)
   *
   * @param l - parent logger
   *
   * @param onNotification - callback for server-initiated notifications
   */
  constructor({ ceiling, l, onNotification, }: {
    ceiling: string; l: Logger;
    onNotification: (source: string, method: string, params: unknown,) => void;
  }) {
    this.#l = l;
    this.#ceiling = ceiling;
    this.#onNotification = onNotification;
  }

  /**
   * Finds or creates the LSP client for a server type given a file path.
   *
   * @returns promise resolving to the client, or null if no project root is found
   */
  resolve({ type, filePath, }: { type: ServerType; filePath: string }): Promise<LspClient | null> {
    const root = findProjectRoot({ startDir: dirname(filePath,), configFiles: CONFIG_FILES[type], ceiling: this.#ceiling, },);
    if (root === null) return Promise.resolve(null,);
    const key = `${type}:${root}`;
    const existing = this.#pool.get(key,);
    if (existing !== undefined) return existing;
    const promise = this.#spawn({ type, root, },);
    this.#pool.set(key, promise,);
    return promise;
  }

  /**
   * Resolves all three server types for a given file path.
   *
   * @returns server slots with oxlint, tsgo, and dprint clients
   */
  async resolveAll({ path, }: { path: string }): Promise<ServerSlots> {
    const [oxlint, tsgo, dprint,] = await Promise.all([
      this.resolve({ type: 'oxlint', filePath: path, },),
      this.resolve({ type: 'tsgo', filePath: path, },),
      this.resolve({ type: 'dprint', filePath: path, },),
    ],);
    return { oxlint, tsgo, dprint, };
  }

  /**
   * Spawns and initializes one LSP client for a given type and project root.
   *
   * @returns initialized client, or null if spawn/init fails
   */
  async #spawn({ type, root, }: { type: ServerType; root: string }): Promise<LspClient | null> {
    const def = COMMANDS[type];
    const binPath = join(root, 'node_modules/.bin',);
    const env = { ...process.env, PATH: `${binPath}:${process.env.PATH ?? ''}`, };
    const rootUri = pathToFileURL(root,).href;
    try {
      const pool = this;
      const c = new LspClient({
        command: def.command, args: [...def.args,], name: type, cwd: root, env, l: this.#l,
        onNotification: function onNotif(method: string, params: unknown,): void {
          pool.#onNotification(type, method, params,);
        },
      },);
      await c.initialize({ rootUri, initializationOptions: def.initializationOptions, },);
      this.#l.info(`${type}: ready at ${root}`,);
      return c;
    }
    catch (error) { this.#l.error(`${type} init failed at ${root}: ${String(error,)}`,); return null; }
  }

  /** Gracefully shuts down all pooled LSP servers. */
  shutdown(): void {
    for (const promise of this.#pool.values()) {
      void (async function shutdownClient(): Promise<void> {
        try {
          const c = await promise;
          if (c !== null) await c.shutdown();
        }
        catch (error) { console.error('LSP shutdown failed:', error,); }
      })();
    }
  }
}
