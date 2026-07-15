/**
 * Lua snippets and raw diagnostic mapping for Neovim RPC.
 *
 * Contains the Lua code executed via `nvim_exec_lua` and the
 * function that converts raw msgpack records into typed Diagnostics.
 *
 * @module
 */

import {
  type Diagnostic,
  normalizeMessage,
  SEVERITY_MAP,
} from './nvim-types.ts';

//region Raw diagnostic mapping: converts Lua msgpack output to typed Diagnostics

/**
 * Maps a raw msgpack diagnostic record to a typed Diagnostic.
 *
 * @param d - Raw record from nvim_exec_lua.
 *
 * @returns Typed Diagnostic with 1-indexed line/column.
 *
 * @example
 * ```ts
 * const diag = mapRawDiagnostic({ severity: 1, lnum: 0, col: 5, end_lnum: 0, end_col: 10, message: 'err', source: 'ts' });
 * // diag.line === 1, diag.col === 6 (1-indexed)
 * ```
 */
export function mapRawDiagnostic(d: Record<string, unknown>,): Diagnostic {
  // Fields come from Neovim's Lua msgpack bridge; types are guaranteed by the Lua code above.
  /**
   * Raw severity index from Neovim; falls back to 0 so {@link SEVERITY_MAP} produces an `UNKNOWN` label.
   */
  const severity = ((typeof d.severity) === 'number') ? d.severity : 0;
  /**
   * Raw 0-indexed line; bumped by 1 below to match the 1-indexed coordinate scheme.
   */
  const lnum = ((typeof d.lnum) === 'number') ? d.lnum : 0;
  /**
   * Raw 0-indexed column; bumped by 1 below to match the 1-indexed coordinate scheme.
   */
  const col = ((typeof d.col) === 'number') ? d.col : 0;
  /**
   * Raw 0-indexed end line; bumped by 1 below to match the 1-indexed coordinate scheme.
   */
  const endLnum = ((typeof d.end_lnum) === 'number') ? d.end_lnum : 0;
  /**
   * Raw 0-indexed end column; bumped by 1 below to match the 1-indexed coordinate scheme.
   */
  const endCol = ((typeof d.end_col) === 'number') ? d.end_col : 0;
  /**
   * Raw diagnostic text; coerced to empty string when Lua returns a non-string.
   */
  const message = ((typeof d.message) === 'string') ? d.message : '';
  /**
   * Diagnostic source identifier (e.g. `'typescript'`); `null` when absent so downstream formatters can drop the suffix.
   */
  const source = ((typeof d.source) === 'string') ? d.source : null;
  /**
   * Diagnostic code (rule id or numeric error code); `null` when absent so downstream formatters can drop the suffix.
   */
  const code = (((typeof d.code) === 'string') || ((typeof d.code) === 'number'))
    ? d.code
    : null;

  return {
    severity: SEVERITY_MAP[severity]
      ?? `UNKNOWN(${String(severity,)})`,
    lnum: lnum + 1,
    col: col + 1,
    end_lnum: endLnum + 1,
    end_col: endCol + 1,
    message: normalizeMessage(message,),
    source,
    code,
  };
}

//endregion Raw diagnostic mapping

//region Lua snippets: shared Lua code executed via nvim_exec_lua

/**
 * Lua code that returns diagnostics for the current buffer.
 */
export const LUA_GET_CURRENT_BUF_DIAGNOSTICS = `
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

/**
 * Lua code that returns diagnostics across all buffers, grouped by buffer.
 */
export const LUA_GET_ALL_DIAGNOSTICS = `
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

/**
 * Lua code that returns metadata about the current buffer.
 */
export const LUA_GET_CURRENT_FILE = `
local buf = vim.api.nvim_get_current_buf()
return {
  path = vim.api.nvim_buf_get_name(buf),
  filetype = vim.bo[buf].filetype,
  modified = vim.bo[buf].modified,
}
`;

//endregion Lua snippets
