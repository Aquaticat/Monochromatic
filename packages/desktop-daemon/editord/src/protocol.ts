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
  | { kind: 'file'; path: string }
  | { kind: 'content'; path: string; line: number; text: string };

//endregion Search types

//region LSP types

/** 0-based position in a text document. */
export type Position = {
  /** 0-based line number. */
  line: number;
  /** 0-based character offset. */
  character: number;
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

//endregion LSP types

//region Client messages

/**
 * Messages sent from the client to the server.
 * Requests have a `type` discriminant and a client-generated `id` for response correlation.
 * Notifications (e.g. `didChange`) have no `id` and expect no response.
 */
export type ClientMessage =
  | { type: 'open'; id: string; path: string }
  | { type: 'save'; id: string; path: string; content: string }
  | { type: 'listDir'; id: string; path: string }
  | { type: 'search'; id: string; query: string; scope: string }
  | { type: 'hover'; id: string; path: string; line: number; character: number }
  | { type: 'completion'; id: string; path: string; line: number; character: number }
  | { type: 'format'; id: string; path: string }
  | { type: 'gotoDefinition'; id: string; path: string; line: number; character: number }
  | { type: 'inlayHint'; id: string; path: string; range: Range }
  | { type: 'didChange'; path: string; content: string }
  | { type: 'didClose'; path: string };

/**
 * Client request payload without the auto-generated `id` field.
 * Distributive over the union so variant-specific fields like `content` are preserved.
 * Filters to only variants that have an `id` (excludes notifications).
 */
export type ClientRequest = ClientMessage extends infer TVariant
  ? TVariant extends { id: string }
    ? Omit<TVariant, 'id'>
    : never
  : never;

/**
 * Client notification payload (messages without an `id` that expect no response).
 */
export type ClientNotification = Extract<ClientMessage, { type: 'didChange' } | { type: 'didClose' }>;

//endregion Client messages

//region Server messages

/**
 * Messages sent from the server to the client.
 * Responses carry the `id` from the originating client message.
 * Push notifications (e.g. `fileChanged`, `diagnostics`) have no `id`.
 */
export type ServerMessage =
  | { type: 'connected'; rootDir: string; fsId: string }
  | { type: 'fileContent'; id: string; path: string; content: string }
  | { type: 'saved'; id: string; path: string }
  | { type: 'dirListing'; id: string; path: string; entries: DirEntry[] }
  | { type: 'searchResults'; id: string; results: SearchResult[] }
  | { type: 'fileChanged'; path: string }
  | { type: 'diagnostics'; path: string; diagnostics: Diagnostic[] }
  | { type: 'hoverResult'; id: string; contents: string; range?: Range }
  | { type: 'completionResult'; id: string; items: CompletionItem[] }
  | { type: 'formatResult'; id: string; edits: TextEdit[] }
  | { type: 'definitionResult'; id: string; path: string; line: number; character: number }
  | { type: 'inlayHintResult'; id: string; hints: InlayHint[] }
  | { type: 'error'; id?: string; message: string };

//endregion Server messages
