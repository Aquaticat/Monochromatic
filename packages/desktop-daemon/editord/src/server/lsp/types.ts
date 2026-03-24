/**
 * LSP type definitions used by the editord LSP bridge.
 *
 * Minimal subset of the Language Server Protocol types
 * sufficient for diagnostics, hover, completion, formatting,
 * and go-to-definition.
 */

import type { LspPosition, LspRange, } from './lsp-types-core.ts';

export type {
  DiagnosticSeverity,
  LspCompletionItem,
  LspDiagnostic,
  LspHover,
  LspMarkupContent,
  LspPosition,
  LspRange,
  LspTextEdit,
} from './lsp-types-core.ts';

//region Inlay hints

/**
 * Inlay hint kind matching the LSP specification.
 * Type = 1, Parameter = 2.
 */
export type InlayHintKind = 1 | 2;

/** Inlay hint from an LSP server. */
export type LspInlayHint = {
  /** Position in the document where the hint is displayed. */
  position: LspPosition;
  /** Display label (string or structured label parts). */
  label: string | LspInlayHintLabelPart[];
  /** Kind of inlay hint (1=Type, 2=Parameter). */
  kind?: InlayHintKind;
  /** Whether to insert padding space before the hint. */
  paddingLeft?: boolean;
  /** Whether to insert padding space after the hint. */
  paddingRight?: boolean;
};

/** Structured label part for an inlay hint. */
export type LspInlayHintLabelPart = {
  /** Text value of this label part. */
  value: string;
};

//endregion Inlay hints

//region Selection ranges

/**
 * Nested selection range from `textDocument/selectionRange`.
 * Each range has an optional `parent` pointing to the next larger enclosing range,
 * forming a chain from the innermost to the outermost syntactic scope.
 */
export type LspSelectionRange = {
  /** Range of this selection level. */
  range: LspRange;
  /** Next larger enclosing selection range, or undefined at the outermost scope. */
  parent?: LspSelectionRange;
};

//endregion Selection ranges

//region Capabilities

/** Server capabilities returned during LSP initialization. */
export type LspServerCapabilities = {
  /** Document sync mode (0=None, 1=Full, 2=Incremental) or detailed options. */
  textDocumentSync?: number | {
    openClose?: boolean;
    change?: number;
    save?: boolean | { includeText?: boolean };
  };
  /** Whether hover is supported. */
  hoverProvider?: boolean;
  /** Completion provider configuration. */
  completionProvider?: { triggerCharacters?: string[] };
  /** Whether document formatting is supported. */
  documentFormattingProvider?: boolean;
  /** Whether go-to-definition is supported. */
  definitionProvider?: boolean;
  /** Whether inlay hints are supported. */
  inlayHintProvider?: boolean | { resolveProvider?: boolean };
  /** Whether selection range is supported. */
  selectionRangeProvider?: boolean;
};

//endregion Capabilities
