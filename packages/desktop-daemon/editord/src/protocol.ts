/**
 * Wire protocol types shared between editord server and client.
 *
 * Defines all message shapes for the WebSocket protocol and
 * common data types used by both sides of the connection.
 */

//region Directory types

/** Single entry in a directory listing. */
export type DirEntry = {
  /** File or directory name (no path separator). */
  name: string;
  /** Whether entry is a directory. */
  isDirectory: boolean;
};

//endregion Directory types

//region Search types

/**
 * Single result from a search operation.
 * File-path matches have no `line` or `text`; content matches include both.
 */
export type SearchResult =
  | {
    kind: 'file';
    path: string;
  }
  | {
    kind: 'content';
    path: string;
    line: number;
    text: string;
  };

//endregion Search types

//region LSP types

/** 0-based position in a text document. */
export type Position = {
  /** 0-based line number. */
  line: number;
  /** 0-based character offset. */
  character: number;
};

/** Position within a specific file, combining a file path with a text position. */
export type FilePosition = Position & {
  /** Absolute file path. */
  path: string;
};

/** Range in a text document (start-inclusive, end-exclusive). */
export type Range = {
  /** Start position (inclusive). */
  start: Position;
  /** End position (exclusive). */
  end: Position;
};

/** Diagnostic from a language server, ready for wire transport. */
export type Diagnostic = {
  /** Text range where the diagnostic applies. */
  range: Range;
  /** Severity level. */
  severity: 'error' | 'warning' | 'info' | 'hint';
  /** Human-readable diagnostic message. */
  message: string;
  /** Source tool name (e.g. "oxlint", "typescript"). */
  source: string;
};

/** Completion item from a language server. */
export type CompletionItem = {
  /** Display label. */
  label: string;
  /** Additional detail string. */
  detail: string;
  /** Text to insert when accepted. */
  insertText: string;
};

/** Text edit from a formatting operation. */
export type TextEdit = {
  /** Range to replace. */
  range: Range;
  /** Replacement text. */
  newText: string;
};

/** Inlay hint kind: 1 = Type, 2 = Parameter. */
export type InlayHintKind = 1 | 2;

/** Inlay hint from a language server, ready for wire transport. */
export type InlayHint = {
  /** Position where the hint is displayed. */
  position: Position;
  /** Display label text. */
  label: string;
  /** Kind of inlay hint (1=Type, 2=Parameter). */
  kind?: InlayHintKind;
  /** Whether to insert padding space before the hint. */
  paddingLeft?: boolean;
  /** Whether to insert padding space after the hint. */
  paddingRight?: boolean;
};

/**
 * Nested selection range for expand/shrink selection.
 * Each level has a `range` and an optional `parent` pointing to
 * the next larger enclosing syntactic scope.
 */
export type SelectionRange = {
  /** Range of this selection level. */
  range: Range;
  /** Next larger enclosing range, or undefined at the outermost scope. */
  parent?: SelectionRange;
};

/**
 * Edits for a single file within a workspace edit (e.g. from rename).
 * Groups text edits by file path for the client to apply.
 */
export type WorkspaceFileEdit = {
  /** Absolute file path. */
  path: string;
  /** Text edits to apply to this file. */
  edits: TextEdit[];
};

//endregion LSP types

//region File kind

/**
 * Content category of a file, determined by extension and content inspection.
 * Drives viewer selection: text files go to the editor, media files to native
 * elements, and unknown binaries to a hex dump display.
 */
export type FileKind = 'text' | 'image' | 'audio' | 'video' | 'binary';

//endregion File kind

//region Filesystem change types

/** Category of a filesystem change event from the directory watcher. */
export type FsChangeType = 'created' | 'modified' | 'deleted';

//endregion Filesystem change types

//region Re-exports: message types split to stay under max-lines

export type {
  ClientMessage,
  ClientNotification,
  ClientRequest,
} from './protocol-client.ts';
export type { ServerMessage, } from './protocol-server.ts';

//endregion Re-exports
