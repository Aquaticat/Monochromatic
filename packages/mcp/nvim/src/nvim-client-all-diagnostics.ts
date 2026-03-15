/**
 * Retrieves and merges diagnostics across all buffers from all Neovim instances.
 *
 * Groups diagnostics by file path, deduplicating when multiple instances
 * have the same file open.
 *
 * @module
 */

import { uniqueDiagnostics, } from './dedup.ts';
import { getAllClients, } from './nvim-connection.ts';
import {
  LUA_GET_ALL_DIAGNOSTICS,
  mapRawDiagnostic,
} from './nvim-lua.ts';
import type {
  Diagnostic,
  FileDiagnostics,
} from './nvim-types.ts';

/**
 * Returns diagnostics across all buffers from all Neovim instances, grouped by file path.
 * When multiple instances have the same file open, their diagnostics are merged under one entry.
 *
 * @returns Array of file-grouped diagnostics from all instances.
 *
 * @example
 * ```ts
 * const files = await getAllDiagnostics();
 * ```
 */
export async function getAllDiagnostics(): Promise<FileDiagnostics[]> {
  const nvimClients = getAllClients();

  const instanceResults = await Promise.all(
    nvimClients.map(async function queryInstance(nvim,) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim executeLua returns msgpack data matching our Lua query
        const raw = (await nvim.executeLua(LUA_GET_ALL_DIAGNOSTICS, [],)) as Record<
          string,
          unknown
        >[];
        return raw.map(function mapFileEntry(file,) {
          const filePath = typeof file.path === 'string' ? file.path : '';
          const fileDiags = Array.isArray(file.diagnostics,)
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim msgpack array narrowed via Array.isArray
            ? file.diagnostics as Record<string, unknown>[]
            : [];
          return {
            path: filePath,
            diagnostics: fileDiags.map(function mapDiag(d,) {
              return mapRawDiagnostic(d,);
            },),
          };
        },);
      }
      catch (err: unknown) {
        console.error('[mcp-nvim] Failed to query instance for all diagnostics:', err,);
        return [];
      }
    },),
  );

  //region Merge diagnostics from all instances by file path
  const byPath = new Map<string, Diagnostic[]>();

  for (const instanceFiles of instanceResults) {
    for (const fileEntry of instanceFiles) {
      const existing = byPath.get(fileEntry.path,);
      if (existing !== undefined)
        existing.push(...fileEntry.diagnostics,);
      else
        byPath.set(fileEntry.path, [...fileEntry.diagnostics,],);
    }
  }
  //endregion Merge diagnostics from all instances by file path

  return [...byPath.entries(),].map(function toFileDiagnostics([path, diagnostics,],) {
    return { path, diagnostics: uniqueDiagnostics(diagnostics,), };
  },);
}
