/**
 * Core LSP type definitions: geometry, diagnostics, hover, completion, and text edits.
 *
 * Minimal subset of the Language Server Protocol types
 * split from types.ts to stay under max-lines.
 */

import type {
  Position,
  Range,
} from '../../protocol.ts';

//region Geometry

/** LSP position, aliased from the shared wire protocol type. */
export type LspPosition = Position;

/** LSP range, aliased from the shared wire protocol type. */
export type LspRange = Range;

//endregion Geometry

//region Diagnostics

/**
 * Diagnostic severity levels matching the LSP specification.
 * Error = 1, Warning = 2, Information = 3, Hint = 4.
 */
export type DiagnosticSeverity = 1 | 2 | 3 | 4;

/** Diagnostic message from an LSP server. */
export type LspDiagnostic = {
  /** Text range where the diagnostic applies. */
  range: LspRange;
  /** Severity level (1=Error, 2=Warning, 3=Info, 4=Hint). */
  severity?: DiagnosticSeverity;
  /** Source tool name (e.g. "oxlint", "typescript"). */
  source?: string;
  /** Human-readable diagnostic message. */
  message: string;
  /** Diagnostic code from the source tool. */
  code?: number | string;
};

//endregion Diagnostics

//region Hover

/** Markup content with explicit kind indicator. */
export type LspMarkupContent = {
  /** Content format: "plaintext" or "markdown". */
  kind: 'plaintext' | 'markdown';
  /** Content value. */
  value: string;
};

/** Hover result from an LSP server. */
export type LspHover = {
  /** Hover content as structured markup or plain string. */
  contents: LspMarkupContent | string;
  /** Range of text the hover applies to. */
  range?: LspRange;
};

//endregion Hover

//region Completion

/** Completion item from an LSP server. */
export type LspCompletionItem = {
  /** Display label for the completion. */
  label: string;
  /** Kind of completion item (1=Text, 2=Method, 3=Function, etc.). */
  kind?: number;
  /** Additional detail string shown alongside the label. */
  detail?: string;
  /** Text to insert when the completion is accepted (defaults to label). */
  insertText?: string;
};

//endregion Completion

//region Text edits

/** Text edit returned by formatting or other operations. */
export type LspTextEdit = {
  /** Range to replace. */
  range: LspRange;
  /** New text to insert at the range. */
  newText: string;
};

//endregion Text edits
