/**
 * Wire protocol types shared between editord server and client.
 *
 * Defines all message shapes for the WebSocket protocol and
 * common data types used by both sides of the connection.
 */

import type { ServerMessage, } from './protocol-server.ts';

//region Directory types

/**
 * Single entry in a directory listing.
 */
export type DirEntry = {
  /**
   * File or directory name (no path separator).
   */
  readonly name: string;
  /**
   * Whether entry is a directory.
   */
  readonly isDirectory: boolean;
};

//endregion Directory types

//region Search types

/**
 * Single result from a search operation.
 * File-path matches have no `line` or `text`; content matches include both.
 */
export type SearchResult =
  | {
    readonly kind: 'file';
    readonly path: string;
  }
  | {
    readonly kind: 'content';
    readonly path: string;
    readonly line: number;
    readonly text: string;
  };

//endregion Search types

//region LSP types

/**
 * 0-based position in a text document.
 */
export type Position = {
  /**
   * 0-based line number.
   */
  readonly line: number;
  /**
   * 0-based character offset.
   */
  readonly character: number;
};

/**
 * Position within a specific file, combining a file path with a text position.
 */
export type FilePosition = Position & {
  /**
   * Absolute file path.
   */
  readonly path: string;
};

/**
 * Range in a text document (start-inclusive, end-exclusive).
 */
export type Range = {
  /**
   * Start position (inclusive).
   */
  readonly start: Position;
  /**
   * End position (exclusive).
   */
  readonly end: Position;
};

/**
 * Diagnostic from a language server, ready for wire transport.
 */
export type Diagnostic = {
  /**
   * Text range where the diagnostic applies.
   */
  readonly range: Range;
  /**
   * Severity level.
   */
  readonly severity: 'error' | 'warning' | 'info' | 'hint';
  /**
   * Human-readable diagnostic message.
   */
  readonly message: string;
  /**
   * Source tool name (e.g. "oxlint", "typescript").
   */
  readonly source: string;
};

/**
 * Completion item from a language server.
 */
export type CompletionItem = {
  /**
   * Display label.
   */
  readonly label: string;
  /**
   * Additional detail string.
   */
  readonly detail: string;
  /**
   * Text to insert when accepted.
   */
  readonly insertText: string;
};

/**
 * Text edit from a formatting operation.
 */
export type TextEdit = {
  /**
   * Range to replace.
   */
  readonly range: Range;
  /**
   * Replacement text.
   */
  readonly newText: string;
};

/**
 * Inlay hint kind: 1 = Type, 2 = Parameter.
 */
export type InlayHintKind = 1 | 2;

/**
 * Inlay hint from a language server, ready for wire transport.
 */
export type InlayHint = {
  /**
   * Position where the hint is displayed.
   */
  readonly position: Position;
  /**
   * Display label text.
   */
  readonly label: string;
  /**
   * Kind of inlay hint (1=Type, 2=Parameter).
   */
  readonly kind?: InlayHintKind;
  /**
   * Whether to insert padding space before the hint.
   */
  readonly paddingLeft?: boolean;
  /**
   * Whether to insert padding space after the hint.
   */
  readonly paddingRight?: boolean;
};

/**
 * Nested selection range for expand/shrink selection.
 * Each level has a `range` and an optional `parent` pointing to
 * the next larger enclosing syntactic scope.
 */
export type SelectionRange = {
  /**
   * Range of this selection level.
   */
  readonly range: Range;
  /**
   * Next larger enclosing range, or undefined at the outermost scope.
   */
  readonly parent?: SelectionRange;
};

/**
 * Edits for a single file within a workspace edit (e.g. from rename).
 * Groups text edits by file path for the client to apply.
 */
export type WorkspaceFileEdit = {
  /**
   * Absolute file path.
   */
  readonly path: string;
  /**
   * Text edits to apply to this file.
   */
  readonly edits: readonly TextEdit[];
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

/**
 * Category of a filesystem change event from the directory watcher.
 */
export type FsChangeType = 'created' | 'modified' | 'deleted';

//endregion Filesystem change types

//region Request/response mapping

/**
 * Maps each ClientRequest discriminant to matching success-side ServerMessage variant.
 *
 * Server `error` responses reject through pending-request path in EditorWsClient
 * `#handleMessage`, so map covers only success responses. Push notifications
 * (`connected`, `fileChanged`, `diagnostics`) carry no `id` and lie outside
 * the request/response cycle.
 *
 * Hand-maintained: when a new request/response pair is added to the protocol,
 * update discriminated unions in protocol-client.ts / protocol-server.ts AND
 * add corresponding entry here. TypeScript catches missing entries on first
 * use through `EditorWsClient.request()`.
 *
 * @example
 * ```ts
 * type OpenResponse = RequestResponseMap['open']; // fileContent variant
 * ```
 */
export type RequestResponseMap = {
  readonly open: Extract<ServerMessage, { readonly type: 'fileContent'; }>;
  readonly save: Extract<ServerMessage, { readonly type: 'saved'; }>;
  readonly listDir: Extract<ServerMessage, { readonly type: 'dirListing'; }>;
  readonly search: Extract<ServerMessage, { readonly type: 'searchResults'; }>;
  readonly hover: Extract<ServerMessage, { readonly type: 'hoverResult'; }>;
  readonly completion: Extract<ServerMessage, { readonly type: 'completionResult'; }>;
  readonly format: Extract<ServerMessage, { readonly type: 'formatResult'; }>;
  readonly gotoDefinition: Extract<ServerMessage, { readonly type: 'definitionResult'; }>;
  readonly findReferences: Extract<ServerMessage, { readonly type: 'referencesResult'; }>;
  readonly inlayHint: Extract<ServerMessage, { readonly type: 'inlayHintResult'; }>;
  readonly selectionRange: Extract<ServerMessage, { readonly type: 'selectionRangeResult'; }>;
  readonly prepareRename: Extract<ServerMessage, { readonly type: 'prepareRenameResult'; }>;
  readonly rename: Extract<ServerMessage, { readonly type: 'renameResult'; }>;
  readonly deleteEntry: Extract<ServerMessage, { readonly type: 'fsActionDone'; }>;
  readonly copyEntry: Extract<ServerMessage, { readonly type: 'fsActionDone'; }>;
  readonly moveEntry: Extract<ServerMessage, { readonly type: 'fsActionDone'; }>;
  readonly newEntry: Extract<ServerMessage, { readonly type: 'fsActionDone'; }>;
  readonly openInTerminal: Extract<ServerMessage, { readonly type: 'fsActionDone'; }>;
  readonly openInDefaultApp: Extract<ServerMessage, { readonly type: 'fsActionDone'; }>;
};

//endregion Request/response mapping

//region Re-exports: message types split to stay under max-lines

export type {
  ClientMessage,
  ClientNotification,
  ClientRequest,
} from './protocol-client.ts';
export type { ServerMessage, } from './protocol-server.ts';

//endregion Re-exports
