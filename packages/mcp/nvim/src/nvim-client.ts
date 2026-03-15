/**
 * Public API for querying Neovim diagnostics and file metadata.
 *
 * Connects to all discoverable Neovim instances and exposes
 * functions to retrieve diagnostics and current file info.
 *
 * @module
 */

import { uniqueDiagnostics } from "./dedup.ts";
import { getAllClients } from "./nvim-connection.ts";
import { LUA_GET_ALL_DIAGNOSTICS, LUA_GET_CURRENT_BUF_DIAGNOSTICS, LUA_GET_CURRENT_FILE, mapRawDiagnostic } from "./nvim-lua.ts";
import { SEVERITY_MAP, normalizeMessage, type CurrentFile, type Diagnostic, type FileDiagnostics } from "./nvim-types.ts";

export {
  SEVERITY_MAP,
  normalizeMessage,
};

export type {
  CurrentFile,
  Diagnostic,
  FileDiagnostics,
};

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
    nvimClients.map(async function queryInstance(nvim) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim executeLua returns msgpack data matching our Lua query
        const raw = (await nvim.executeLua(LUA_GET_CURRENT_BUF_DIAGNOSTICS, [])) as Record<string, unknown>[];
        return raw.map(function mapDiag(d) { return mapRawDiagnostic(d); });
      } catch (err: unknown) {
        console.error("[mcp-nvim] Failed to query instance for current buffer diagnostics:", err);
        return [];
      }
    }),
  );

  return results.flat();
}

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
    nvimClients.map(async function queryInstance(nvim) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim executeLua returns msgpack data matching our Lua query
        const raw = (await nvim.executeLua(LUA_GET_ALL_DIAGNOSTICS, [])) as Record<string, unknown>[];
        return raw.map(function mapFileEntry(file) {
          const filePath = typeof file.path === 'string' ? file.path : '';
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim msgpack array narrowed via Array.isArray
          const fileDiags = Array.isArray(file.diagnostics) ? file.diagnostics as Record<string, unknown>[] : [];
          return {
            path: filePath,
            diagnostics: fileDiags.map(function mapDiag(d) { return mapRawDiagnostic(d); }),
          };
        });
      } catch (err: unknown) {
        console.error("[mcp-nvim] Failed to query instance for all diagnostics:", err);
        return [];
      }
    }),
  );

  //region Merge diagnostics from all instances by file path
  const byPath = new Map<string, Diagnostic[]>();

  for (const instanceFiles of instanceResults) {
    for (const fileEntry of instanceFiles) {
      const existing = byPath.get(fileEntry.path);
      if (existing !== undefined) {
        existing.push(...fileEntry.diagnostics);
      } else {
        byPath.set(fileEntry.path, [...fileEntry.diagnostics]);
      }
    }
  }
  //endregion Merge diagnostics from all instances by file path

  return [...byPath.entries()].map(function toFileDiagnostics([path, diagnostics]) {
    return { path, diagnostics: uniqueDiagnostics(diagnostics) };
  });
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
    nvimClients.map(async function queryInstance(nvim) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Neovim executeLua returns msgpack data matching our Lua query
        const result = (await nvim.executeLua(LUA_GET_CURRENT_FILE, [])) as Record<string, unknown>;
        return {
          path: typeof result.path === 'string' ? result.path : '',
          filetype: typeof result.filetype === 'string' ? result.filetype : '',
          modified: typeof result.modified === 'boolean' ? result.modified : false,
        };
      } catch (err: unknown) {
        console.error("[mcp-nvim] Failed to query instance for current file:", err);
        return null;
      }
    }),
  );

  return results.filter(function isNotNull(result): result is CurrentFile {
    return result !== null;
  });
}

//endregion Public API
