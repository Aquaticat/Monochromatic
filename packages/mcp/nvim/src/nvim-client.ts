/**
 * Public API for querying Neovim diagnostics and file metadata.
 *
 * Connects to all discoverable Neovim instances and exposes
 * functions to retrieve diagnostics and current file info.
 *
 * @module
 */

import { getAllClients, } from './nvim-connection.ts';
import {
  LUA_GET_CURRENT_BUF_DIAGNOSTICS,
  LUA_GET_CURRENT_FILE,
  mapRawDiagnostic,
} from './nvim-lua.ts';
import {
  type CurrentFile,
  type Diagnostic,
  normalizeMessage,
  SEVERITY_MAP,
} from './nvim-types.ts';

export { getAllDiagnostics, } from './nvim-client-all-diagnostics.ts';

export {
  normalizeMessage,
  SEVERITY_MAP,
};

export type {
  CurrentFile,
  Diagnostic,
  FileDiagnostics,
} from './nvim-types.ts';

//region Public API -- query diagnostics and file info across all Neovim instances

/**
 * Returns diagnostics for the current buffer from each Neovim instance.
 * Each instance contributes its own current buffer's diagnostics independently.
 *
 * @returns Array of diagnostics from all instances' current buffers, flattened.
 *
 * @example
 * ```ts
 * const diags = await getDiagnostics();
 * ```
 */
export async function getDiagnostics(): Promise<Diagnostic[]> {
  const nvimClients = getAllClients();

  const results = await Promise.all(
    nvimClients.map(async function queryInstance(nvim,) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim executeLua returns msgpack data matching our Lua query
        const raw = (await nvim
          .executeLua(LUA_GET_CURRENT_BUF_DIAGNOSTICS, [],)) as Record<string, unknown>[];
        return raw
          .map(function mapDiag(d,) {
            return mapRawDiagnostic(d,);
          },);
      }
      catch (err: unknown) {
        console.error(
          '[mcp-nvim] Failed to query instance for current buffer diagnostics:',
          err,
        );
        return [];
      }
    },),
  );

  return results.flat();
}

/**
 * Returns current file metadata from each Neovim instance.
 * Each instance has its own current buffer, so this returns one entry per instance.
 *
 * @returns Array of current file metadata, one per connected Neovim instance.
 *
 * @example
 * ```ts
 * const files = await getCurrentFiles();
 * // => [{ path: "/src/a.ts", ... }, { path: "/src/b.ts", ... }]
 * ```
 */
export async function getCurrentFiles(): Promise<CurrentFile[]> {
  const nvimClients = getAllClients();

  const results = await Promise.all(
    nvimClients.map(async function queryInstance(nvim,) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim executeLua returns msgpack data matching our Lua query
        const result = (await nvim.executeLua(LUA_GET_CURRENT_FILE, [],)) as Record<
          string,
          unknown
        >;
        return {
          path: typeof result.path === 'string' ? result.path : '',
          filetype: typeof result.filetype === 'string' ? result.filetype : '',
          modified: typeof result.modified === 'boolean' ? result.modified : false,
        };
      }
      catch (err: unknown) {
        console.error('[mcp-nvim] Failed to query instance for current file:', err,);
        return null;
      }
    },),
  );

  return results.filter(function isNotNull(result,): result is CurrentFile {
    return result !== null;
  },);
}

//endregion Public API
