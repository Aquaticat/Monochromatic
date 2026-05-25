/**
 * Server-to-client message types for the editord WebSocket protocol.
 *
 * Split from protocol.ts to stay under max-lines.
 */

import type {
  CompletionItem,
  Diagnostic,
  DirEntry,
  FileKind,
  FilePosition,
  FsChangeType,
  InlayHint,
  Range,
  SearchResult,
  SelectionRange,
  TextEdit,
  WorkspaceFileEdit,
} from './protocol.ts';

//region Server messages

/**
 * Messages sent from the server to the client.
 * Responses carry the `id` from the originating client message.
 * Push notifications (e.g. `fileChanged`, `diagnostics`) have no `id`.
 */
export type ServerMessage =
  | {
    readonly type: 'connected';
    readonly rootDir: string;
    readonly fsId: string;
  }
  | {
    readonly type: 'fileContent';
    readonly id: string;
    readonly path: string;
    readonly content: string;
    readonly kind: FileKind;
    readonly mediaInfo?: string;
  }
  | {
    readonly type: 'saved';
    readonly id: string;
    readonly path: string;
  }
  | {
    readonly type: 'dirListing';
    readonly id: string;
    readonly path: string;
    readonly entries: readonly DirEntry[];
  }
  | {
    readonly type: 'searchResults';
    readonly id: string;
    readonly results: readonly SearchResult[];
  }
  | {
    readonly type: 'fileChanged';
    readonly path: string;
    readonly changeType: FsChangeType;
    readonly isDirectory: boolean;
  }
  | {
    readonly type: 'diagnostics';
    readonly path: string;
    readonly diagnostics: readonly Diagnostic[];
  }
  | {
    readonly type: 'hoverResult';
    readonly id: string;
    readonly contents: string;
    readonly range?: Range;
  }
  | {
    readonly type: 'completionResult';
    readonly id: string;
    readonly items: readonly CompletionItem[];
  }
  | {
    readonly type: 'formatResult';
    readonly id: string;
    readonly edits: readonly TextEdit[];
  }
  | ({
    readonly type: 'definitionResult';
    readonly id: string;
  } & FilePosition)
  | {
    readonly type: 'referencesResult';
    readonly id: string;
    readonly locations: readonly FilePosition[];
  }
  | {
    readonly type: 'inlayHintResult';
    readonly id: string;
    readonly hints: readonly InlayHint[];
  }
  | {
    readonly type: 'selectionRangeResult';
    readonly id: string;
    readonly ranges: readonly SelectionRange[];
  }
  | {
    readonly type: 'prepareRenameResult';
    readonly id: string;
    readonly canRename: boolean;
    readonly range?: Range;
    readonly placeholder?: string;
  }
  | {
    readonly type: 'renameResult';
    readonly id: string;
    readonly edits: readonly WorkspaceFileEdit[];
  }
  | {
    readonly type: 'fsActionDone';
    readonly id: string;
  }
  | {
    readonly type: 'error';
    readonly id?: string;
    readonly message: string;
  };

//endregion Server messages
