import { attach, type NeovimClient } from "neovim";
import { readdirSync } from "node:fs";
import { connect } from "node:net";

import { uniqueDiagnostics } from "./dedup.ts";

//region Severity mapping -- vim.diagnostic.severity codes to human-readable labels

/** Maps vim.diagnostic.severity integer codes to uppercase labels. */
export const SEVERITY_MAP: Record<number, string> = {
  1: "ERROR",
  2: "WARN",
  3: "INFO",
  4: "HINT",
};

//endregion Severity mapping

//region Types -- diagnostic and file metadata shapes

/**
 * Single diagnostic from a Neovim buffer.
 *
 * @example
 * ```ts
 * const diag: Diagnostic = {
 *   severity: "ERROR", lnum: 10, col: 5,
 *   end_lnum: 10, end_col: 15,
 *   message: "Type mismatch", source: "typescript", code: 2345,
 * };
 * ```
 */
export type Diagnostic = {
  severity: string;
  lnum: number;
  col: number;
  end_lnum: number;
  end_col: number;
  message: string;
  source: string | null;
  code: string | number | null;
};

/**
 * Metadata about the current buffer in a Neovim instance.
 *
 * @example
 * ```ts
 * const file: CurrentFile = { path: "/home/user/src/index.ts", filetype: "typescript", modified: false };
 * ```
 */
export type CurrentFile = {
  path: string;
  filetype: string;
  modified: boolean;
};

/**
 * Diagnostics grouped under a single file path.
 *
 * @example
 * ```ts
 * const entry: FileDiagnostics = { path: "/home/user/src/index.ts", diagnostics: [] };
 * ```
 */
export type FileDiagnostics = {
  path: string;
  diagnostics: Diagnostic[];
};

//endregion Types

//region Connection management -- discover and cache connections to all Neovim instances

/** Cached clients keyed by socket path. */
const clients = new Map<string, NeovimClient>();

/**
 * Discovers all Neovim RPC socket paths on this system.
 * Includes `$NVIM` (if set) plus all `nvim.*` entries under `/run/user/<uid>/`.
 * Deduplicates in case `$NVIM` points to a socket that also appears in the scan directory.
 *
 * @returns Array of unique socket paths. May be empty if no Neovim instances are running.
 *
 * @example
 * ```ts
 * const paths = findAllSocketPaths();
 * // => ["/run/user/1000/nvim.12345.0", "/run/user/1000/nvim.67890.0"]
 * ```
 */
export function findAllSocketPaths(): string[] {
  const found = new Set<string>();

  if (process.env.NVIM) {
    found.add(process.env.NVIM);
  }

  const uid = process.getuid?.();
  if (uid !== undefined) {
    const dir = `/run/user/${uid}`;
    try {
      const entries = readdirSync(dir).filter(function isNvimSocket(entry) {
        return entry.startsWith("nvim.");
      });
      for (const name of entries) {
        found.add(`${dir}/${name}`);
      }
    } catch {
      // Directory may not exist or be unreadable; not an error
    }
  }

  return [...found];
}

/**
 * Connects to a single Neovim instance by socket path.
 * Returns a cached client if already connected.
 *
 * @param socketPath - Absolute path to the Neovim RPC socket.
 *
 * @returns Connected Neovim client.
 *
 * @example
 * ```ts
 * const client = connectToSocket("/run/user/1000/nvim.12345.0");
 * ```
 */
function connectToSocket(socketPath: string): NeovimClient {
  const cached = clients.get(socketPath);
  if (cached !== undefined) {
    return cached;
  }

  const socket = connect(socketPath);
  const nvim = attach({ reader: socket, writer: socket });
  clients.set(socketPath, nvim);
  return nvim;
}

/**
 * Connects to all discoverable Neovim instances.
 *
 * @returns Array of connected clients. May be empty.
 *
 * @throws When no Neovim sockets are found at all.
 *
 * @example
 * ```ts
 * const clients = getAllClients();
 * ```
 */
export function getAllClients(): NeovimClient[] {
  const paths = findAllSocketPaths();
  if (paths.length === 0) {
    throw new Error(
      "No Neovim sockets found. Set $NVIM or run from Neovim's :terminal.",
    );
  }

  return paths.map(connectToSocket);
}

//endregion Connection management

//region Raw diagnostic mapping -- converts Lua msgpack output to typed Diagnostics

/**
 * Maps a raw msgpack diagnostic record to a typed Diagnostic.
 *
 * @param d - Raw record from nvim_exec_lua.
 *
 * @returns Typed Diagnostic with 1-indexed line/column.
 */
function mapRawDiagnostic(d: Record<string, unknown>): Diagnostic {
  return {
    severity: SEVERITY_MAP[d.severity as number] ?? `UNKNOWN(${d.severity})`,
    lnum: (d.lnum as number) + 1,
    col: (d.col as number) + 1,
    end_lnum: (d.end_lnum as number) + 1,
    end_col: (d.end_col as number) + 1,
    message: normalizeMessage(d.message as string),
    source: (d.source as string) ?? null,
    code: (d.code as string | number) ?? null,
  };
}

/**
 * Normalizes a diagnostic message from LSP.
 * Some LSP servers (e.g. oxlint) embed help text as `\nhelp: ...` at the end
 * of the message string. This extracts the help text and reformats it inline
 * so the diagnostic stays on a single line.
 *
 * @param message - Raw message string from LSP diagnostic.
 *
 * @returns Normalized single-line message.
 *
 * @example
 * ```ts
 * normalizeMessage("Empty exports do nothing\nhelp: Remove this.");
 * // => "Empty exports do nothing (help: Remove this.)"
 * ```
 */
export function normalizeMessage(message: string): string {
  const helpIndex = message.indexOf("\nhelp: ");
  if (helpIndex === -1) {
    return message;
  }
  const mainMessage = message.slice(0, helpIndex);
  const helpText = message.slice(helpIndex + "\nhelp: ".length);
  return `${mainMessage} (help: ${helpText})`;
}

//endregion Raw diagnostic mapping

//region Lua snippets -- shared Lua code executed via nvim_exec_lua

/** Lua code that returns diagnostics for the current buffer. */
const LUA_GET_CURRENT_BUF_DIAGNOSTICS = `
local buf = vim.api.nvim_get_current_buf()
local diags = vim.diagnostic.get(buf)
local result = {}
for _, d in ipairs(diags) do
  table.insert(result, {
    severity = d.severity,
    lnum = d.lnum,
    col = d.col,
    end_lnum = d.end_lnum,
    end_col = d.end_col,
    message = d.message,
    source = d.source,
    code = d.code,
  })
end
return result
`;

/** Lua code that returns diagnostics across all buffers, grouped by buffer. */
const LUA_GET_ALL_DIAGNOSTICS = `
local diags = vim.diagnostic.get()
local by_buf = {}
for _, d in ipairs(diags) do
  local bufnr = d.bufnr
  if not by_buf[bufnr] then by_buf[bufnr] = {} end
  table.insert(by_buf[bufnr], {
    severity = d.severity,
    lnum = d.lnum,
    col = d.col,
    end_lnum = d.end_lnum,
    end_col = d.end_col,
    message = d.message,
    source = d.source,
    code = d.code,
  })
end
local result = {}
for bufnr, buf_diags in pairs(by_buf) do
  table.insert(result, {
    path = vim.api.nvim_buf_get_name(bufnr),
    diagnostics = buf_diags,
  })
end
return result
`;

/** Lua code that returns metadata about the current buffer. */
const LUA_GET_CURRENT_FILE = `
local buf = vim.api.nvim_get_current_buf()
return {
  path = vim.api.nvim_buf_get_name(buf),
  filetype = vim.bo[buf].filetype,
  modified = vim.bo[buf].modified,
}
`;

//endregion Lua snippets

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
        const raw = (await nvim.executeLua(LUA_GET_CURRENT_BUF_DIAGNOSTICS, [])) as Record<string, unknown>[];
        return raw.map(mapRawDiagnostic);
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
        const raw = (await nvim.executeLua(LUA_GET_ALL_DIAGNOSTICS, [])) as Record<string, unknown>[];
        return raw.map(function mapFileEntry(file) {
          return {
            path: file.path as string,
            diagnostics: (file.diagnostics as Record<string, unknown>[]).map(mapRawDiagnostic),
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
        const result = (await nvim.executeLua(LUA_GET_CURRENT_FILE, [])) as Record<string, unknown>;
        return {
          path: result.path as string,
          filetype: result.filetype as string,
          modified: result.modified as boolean,
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
