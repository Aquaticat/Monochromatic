/**
 * LSP pool configuration and client spawning.
 *
 * Defines the server types, their config files, spawn commands,
 * and the function that creates an initialized LSP client.
 */

import {
  delimiter,
  join,
} from 'node:path';

import type { Logger, } from '../log.ts';
import {
  createLspClient,
  type LspClient,
} from './lsp-client.ts';
import { pathToUri, } from './uri.ts';

/**
 * LSP server type identifier.
 */
export type ServerType = 'oxlint' | 'tsc' | 'dprint';

/**
 * Separator between server type and root in pool map keys.
 */
export const POOL_KEY_SEPARATOR = ':';

/**
 * Builds a pool map key from server type and project root.
 *
 * @param type - LSP server type
 *
 * @param root - project root directory
 *
 * @returns composite key for the pool Map
 *
 * @example
 * ```ts
 * const key = buildPoolKey({ type: 'tsc', root: '/home/user/project', });
 * // key === 'tsc:/home/user/project'
 * ```
 */
export function buildPoolKey({
  type,
  root,
}: {
  readonly type: ServerType;
  readonly root: string;
},): string {
  return `${type}${POOL_KEY_SEPARATOR}${root}`;
}

/**
 * Extracts the project root from a pool map key.
 *
 * @param key - pool key in `"type:root"` format
 *
 * @returns root portion of the key
 *
 * @example
 * ```ts
 * const root = rootFromPoolKey({ key: 'tsc:/home/user/project', });
 * // root === '/home/user/project'
 * ```
 */
export function rootFromPoolKey({ key, }: { readonly key: string; },): string {
  /**
   * Negative one collapses to slice(0), returning the whole key when no separator exists.
   */
  const colonIndex = key.indexOf(POOL_KEY_SEPARATOR,);
  return key.slice(colonIndex + 1,);
}

/**
 * Config files that define a project root for each server type.
 */
export const CONFIG_FILES: Record<ServerType, readonly string[]> = {
  oxlint: ['package.json',],
  tsc: ['tsconfig.json',],
  dprint: [
    'dprint.json',
    'dprint.jsonc',
  ],
};

/**
 * Spawn command and arguments for each server type.
 */
const COMMANDS: Record<ServerType, {
  readonly command: string;
  readonly args: readonly string[];
  readonly initializationOptions: Record<string, unknown>;
}> = {
  oxlint: {
    command: 'oxlint',
    args: ['--lsp',],
    initializationOptions: {},
  },
  tsc: {
    command: 'tsc',
    args: [
      '--lsp',
      '--stdio',
    ],
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
  dprint: {
    command: 'dprint',
    args: ['lsp',],
    initializationOptions: {},
  },
};

/**
 * Spawns and initializes one LSP client for a given type and project root.
 *
 * @param type - server type to spawn
 *
 * @param root - project root directory
 *
 * @param l - logger for status and error messages
 *
 * @param onNotification - callback for server-initiated notifications (source pre-tagged)
 *
 * @param onExit - callback when the child process exits (unexpected crashes or graceful shutdown)
 *
 * @returns initialized client, or null if spawn/init fails
 *
 * @example
 * ```ts
 * const client = await spawnLspClient({
 *   type: 'tsc',
 *   root: '/home/user/project',
 *   l: logger,
 *   onNotification: function handleNotification({ source, method, params }) { l.info(method); },
 *   onExit: function handleExit({ unexpected, code }) { l.warn(`exited: ${code}`); },
 * });
 * ```
 */
export async function spawnLspClient({
  type,
  root,
  l,
  onNotification,
  onExit,
}: {
  readonly type: ServerType;
  readonly root: string;
  readonly l: Logger;
  readonly onNotification: (event: {
    readonly source: string;
    readonly method: string;
    readonly params: unknown;
  },) => void;
  readonly onExit: (event: {
    readonly unexpected: boolean;
    readonly code: number | null;
    readonly recentStderr: string;
  },) => void;
},): Promise<LspClient | null> {
  /**
   * Per-server-type spawn definition: command, args, init opts.
   */
  const def = COMMANDS[type];
  /**
   * Project-local bin dir prepended to PATH so workspace tooling resolves first.
   */
  const binPath = join(
    root,
    'node_modules/.bin',
  );
  /**
   * Environment passed to the child; PATH gets the project bin dir prepended.
   */
  const env = {
    ...process.env,
    PATH: `${binPath}${delimiter}${process.env
      .PATH
      ?? ''}`,
  };

  /**
   * LSP wire format expects a URI for the workspace root.
   */
  const rootUri = pathToUri({ path: root, },);

  try {
    /**
     * Client wrapper around the spawned LSP child process.
     */
    const c = createLspClient({
      command: def.command,
      args: [...def.args,],
      name: type,
      cwd: root,
      env,
      l,
      onNotification: function onNotif(
        {
          method,
          params,
        }: {
          readonly method: string;
          readonly params: unknown;
        },
      ): void {
        onNotification({
          source: type,
          method,
          params,
        },);
      },
      onExit,
    },);
    await c.initialize({
      rootUri,
      initializationOptions: def.initializationOptions,
    },);
    l.info(`${type}: ready at ${root}`,);
    return c;
  }
  catch (error) {
    l.error(`${type} init failed at ${root}: ${String(error,)}`,);
    return null;
  }
}
