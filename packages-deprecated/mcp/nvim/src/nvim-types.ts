/**
 * Neovim diagnostic type definitions and severity mapping.
 *
 * Shared types used by the nvim MCP server for diagnostics,
 * file metadata, and severity label resolution.
 *
 * @module
 */

//region Severity mapping: vim.diagnostic.severity codes to human-readable labels

/**
 * Maps vim.diagnostic.severity integer codes to uppercase labels.
 */
export const SEVERITY_MAP: Record<number, string> = {
  1: 'ERROR',
  2: 'WARN',
  3: 'INFO',
  4: 'HINT',
};

//endregion Severity mapping

//region Types: diagnostic and file metadata shapes

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
export function normalizeMessage(message: string,): string {
  /**
   * Offset of the literal `\nhelp: ` separator that splits primary text from help text; -1 means no help section.
   */
  const helpIndex = message.indexOf('\nhelp: ',);
  if (helpIndex === (-1))
    return message;
  /**
   * Primary diagnostic text before the help separator.
   */
  const mainMessage = message.slice(
    0,
    helpIndex,
  );
  /**
   * Help text following the separator, ready to be re-emitted as a parenthesised suffix.
   */
  const helpText = message.slice(helpIndex + '\nhelp: '
    .length,);
  return `${mainMessage} (help: ${helpText})`;
}
