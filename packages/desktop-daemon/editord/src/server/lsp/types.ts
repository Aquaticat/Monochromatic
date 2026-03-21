/**
 * LSP type definitions used by the editord LSP bridge.
 *
 * Minimal subset of the Language Server Protocol types
 * sufficient for diagnostics, hover, completion, formatting,
 * and go-to-definition.
 */

//region Geometry

/** 0-based position in a text document. */
export type LspPosition = {
  /** 0-based line number. */
  line: number;
  /** 0-based character offset within the line. */
  character: number;
};

/** Range of text in a document, start-inclusive and end-exclusive. */
export type LspRange = {
  /** Start position (inclusive). */
  start: LspPosition;
  /** End position (exclusive). */
  end: LspPosition;
};

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
};

//endregion Capabilities
