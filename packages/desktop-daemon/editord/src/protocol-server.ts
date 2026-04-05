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
    type: 'connected';
    rootDir: string;
    fsId: string;
  }
  | {
    type: 'fileContent';
    id: string;
    path: string;
    content: string;
    kind: FileKind;
    mediaInfo?: string;
  }
  | {
    type: 'saved';
    id: string;
    path: string;
  }
  | {
    type: 'dirListing';
    id: string;
    path: string;
    entries: DirEntry[];
  }
  | {
    type: 'searchResults';
    id: string;
    results: SearchResult[];
  }
  | {
    type: 'fileChanged';
    path: string;
    changeType: FsChangeType;
    isDirectory: boolean;
  }
  | {
    type: 'diagnostics';
    path: string;
    diagnostics: Diagnostic[];
  }
  | {
    type: 'hoverResult';
    id: string;
    contents: string;
    range?: Range;
  }
  | {
    type: 'completionResult';
    id: string;
    items: CompletionItem[];
  }
  | {
    type: 'formatResult';
    id: string;
    edits: TextEdit[];
  }
  | ({
    type: 'definitionResult';
    id: string;
  } & FilePosition)
  | {
    type: 'referencesResult';
    id: string;
    locations: FilePosition[];
  }
  | {
    type: 'inlayHintResult';
    id: string;
    hints: InlayHint[];
  }
  | {
    type: 'selectionRangeResult';
    id: string;
    ranges: SelectionRange[];
  }
  | {
    type: 'prepareRenameResult';
    id: string;
    canRename: boolean;
    range?: Range;
    placeholder?: string;
  }
  | {
    type: 'renameResult';
    id: string;
    edits: WorkspaceFileEdit[];
  }
  | {
    type: 'fsActionDone';
    id: string;
  }
  | {
    type: 'error';
    id?: string;
    message: string;
  };

//endregion Server messages
