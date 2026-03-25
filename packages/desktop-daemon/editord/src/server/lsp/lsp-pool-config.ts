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
import { pathToFileURL, } from 'node:url';

import type { Logger, } from '../log.ts';
import { LspClient, } from './lsp-client.ts';

/** LSP server type identifier. */
export type ServerType = 'oxlint' | 'tsgo' | 'dprint';

/** Config files that define a project root for each server type. */
export const CONFIG_FILES: Record<ServerType, readonly string[]> = {
  oxlint: ['package.json',],
  tsgo: ['tsconfig.json',],
  dprint: [
    'dprint.json',
    'dprint.jsonc',
  ],
};

/** Spawn command and arguments for each server type. */
const COMMANDS: Record<ServerType, {
  command: string;
  args: readonly string[];
  initializationOptions: Record<string, unknown>;
}> = {
  oxlint: {
    command: 'oxlint',
    args: ['--lsp',],
    initializationOptions: {},
  },
  tsgo: {
    command: 'tsgo',
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
 * @returns initialized client, or null if spawn/init fails
 */
export async function spawnLspClient({
  type,
  root,
  l,
  onNotification,
}: {
  type: ServerType;
  root: string;
  l: Logger;
  onNotification: (event: {
    source: string;
    method: string;
    params: unknown
  },) => void;
},): Promise<LspClient | null> {
  const def = COMMANDS[type];
  const binPath = join(
    root,
    'node_modules/.bin',
  );
  const env = {
    ...process.env,
    PATH: `${binPath}${delimiter}${process.env.PATH ?? ''}`,
  };
  const rootUri = pathToFileURL(root,).href;
  try {
    const c = new LspClient({
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
          method: string;
          params: unknown
        },
      ): void {
        onNotification({
          source: type,
          method,
          params,
        },);
      },
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
