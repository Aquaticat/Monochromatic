import type { Parser, } from '@lezer/common';

import type {
  ClientNotification,
  ClientRequest,
} from '../../protocol-client.ts';
import type {
  CompletionItem,
  Diagnostic,
  DirEntry,
  FileKind,
  FsChangeType,
  InlayHint,
  Range,
  RequestResponseMap,
  SearchResult,
  TextEdit,
} from '../../protocol.ts';
import type { SelectionCoords, } from '../editor/indent.ts';
import type { ContextAction, } from '../file-tree/types.ts';
import type { EditorPosition, } from '../position.ts';
import type {
  ReferenceLocation,
  ReferenceSelectDetail,
} from '../references/types.ts';

/**
 * Shared callback and capability types used across editord client app modules.
 *
 * Extracted to avoid repeating the same multi-line callback signatures in every
 * `wire*` and event-handler function parameter block.
 */

/**
 * File-change push handler installed on the WebSocket client.
 */
export type FileChangedHandler = (event: {
  /**
   * Absolute path reported by the server.
   */
  readonly path: string;
  /**
   * Kind of filesystem change.
   */
  readonly changeType: FsChangeType;
  /**
   * Whether changed path is a directory.
   */
  readonly isDirectory: boolean;
},) => void;

/**
 * Diagnostics push handler installed on the WebSocket client.
 */
export type ClientDiagnosticsHandler = (event: {
  /**
   * Absolute path reported by the server.
   */
  readonly path: string;
  /**
   * Diagnostics for path.
   */
  readonly diagnostics: readonly Diagnostic[];
},) => void;

/**
 * WebSocket client surface consumed by app modules.
 */
export type EditorWsClientHandle = {
  /**
   * Resolves when connection is ready.
   */
  readonly ready: Promise<void>;
  /**
   * Root directory path reported by server handshake.
   */
  readonly rootDir: string;
  /**
   * Stable filesystem identifier reported by server handshake.
   */
  readonly fsId: string;
  /**
   * Sends request and resolves matching success response.
   */
  readonly request: <const TReq extends ClientRequest,>(
    message: TReq,
  ) => Promise<RequestResponseMap[TReq['type']]>;
  /**
   * Sends notification without expecting response.
   */
  readonly notify: (message: ClientNotification,) => Promise<void>;
  /**
   * Installs file-change push handler.
   */
  readonly setFileChangedHandler: (handler: FileChangedHandler | null,) => void;
  /**
   * Installs diagnostics push handler.
   */
  readonly setDiagnosticsHandler: (handler: ClientDiagnosticsHandler | null,) => void;
};

/**
 * Editor pane surface consumed by app modules.
 */
export type EditorPaneHandle = {
  /**
   * Style declaration for showing and hiding the pane.
   */
  readonly style: CSSStyleDeclaration;
  /**
   * Registers DOM event listeners on the custom element.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Registers scroll listeners on the contenteditable editor child.
   */
  readonly addScrollListener: (listener: EventListener,) => void;
  /**
   * Updates syntax parser.
   */
  readonly setParser: (parser: Parser | null,) => void;
  /**
   * Replaces editor text.
   */
  readonly setText: (text: string,) => void;
  /**
   * Reads editor text.
   */
  readonly getText: () => string;
  /**
   * Scrolls line into view.
   */
  readonly scrollToLine: (opts: { readonly line: number; },) => void;
  /**
   * Restores cursor position.
   */
  readonly restoreCursor: (pos: EditorPosition,) => void;
  /**
   * Reads current cursor position.
   */
  readonly getCursorPosition: () => EditorPosition | null;
  /**
   * Reads current cursor rectangle.
   */
  readonly getCursorRect: () => DOMRect | null;
  /**
   * Resolves viewport coordinates to editor position.
   */
  readonly getPositionFromPoint: (opts: {
    readonly x: number;
    readonly y: number;
  },) => EditorPosition | null;
  /**
   * Reads current selection.
   */
  readonly getSelection: () => SelectionCoords | null;
  /**
   * Applies editor selection.
   */
  readonly setSelection: (coords: SelectionCoords,) => void;
  /**
   * Reads document range.
   */
  readonly getDocumentRange: () => Range | null;
  /**
   * Applies LSP text edits.
   */
  readonly applyTextEdits: (edits: readonly TextEdit[],) => void;
  /**
   * Updates diagnostics.
   */
  readonly setDiagnostics: (diagnostics: readonly Diagnostic[],) => void;
  /**
   * Updates inlay hints.
   */
  readonly setInlayHints: (hints: readonly InlayHint[],) => void;
  /**
   * Returns contenteditable child element.
   */
  readonly getEditorElement: () => HTMLDivElement | null;
  /**
   * Current editor scroll offset, read by persistence.
   */
  readonly editorScrollTop: number;
  /**
   * Sets current editor scroll offset.
   */
  readonly setEditorScrollTop: (value: number,) => void;
};

/**
 * Binary viewer surface consumed by file loader.
 */
export type BinaryViewerHandle = {
  /**
   * Shows image preview.
   */
  readonly showImage: (opts: {
    readonly url: string;
    readonly mediaInfo?: string;
  },) => void;
  /**
   * Shows audio preview.
   */
  readonly showAudio: (opts: {
    readonly url: string;
    readonly mediaInfo?: string;
  },) => void;
  /**
   * Shows video preview.
   */
  readonly showVideo: (opts: {
    readonly url: string;
    readonly mediaInfo?: string;
  },) => void;
  /**
   * Shows binary hex dump.
   */
  readonly showHexDump: (opts: { readonly content: string; },) => void;
  /**
   * Hides viewer.
   */
  readonly hide: () => void;
};

/**
 * Completion popup surface consumed by LSP app modules.
 */
export type CompletionPopupHandle = {
  /**
   * Whether popup is visible.
   */
  readonly visible: boolean;
  /**
   * Cursor position captured when popup was shown.
   */
  readonly shownAt: {
    readonly line: number;
    readonly character: number;
  } | null;
  /**
   * Registers DOM event listeners on popup.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Shows completion items.
   */
  readonly show: (opts: {
    readonly items: readonly CompletionItem[];
    readonly x: number;
    readonly y: number;
    readonly cursor: {
      readonly line: number;
      readonly character: number;
    };
  },) => void;
  /**
   * Hides popup.
   */
  readonly hide: () => void;
  /**
   * Accepts selected item.
   */
  readonly accept: () => string | null;
  /**
   * Moves selection.
   */
  readonly navigate: (opts: { readonly direction: 'up' | 'down'; },) => void;
};

/**
 * Hover popup surface consumed by LSP app modules.
 */
export type HoverPopupHandle = {
  /**
   * Shows hover text.
   */
  readonly show: (opts: {
    readonly x: number;
    readonly y: number;
    readonly text: string;
  },) => void;
  /**
   * Hides popup.
   */
  readonly hide: () => void;
  /**
   * Registers DOM event listeners on popup.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Checks whether popup contains node.
   */
  readonly contains: (other: Node | null,) => boolean;
};

/**
 * References popup surface consumed by LSP app modules.
 */
export type ReferencesPopupHandle = {
  /**
   * Registers DOM event listeners on popup.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Whether popup is visible.
   */
  readonly visible: boolean;
  /**
   * Shows reference list.
   */
  readonly show: (opts: {
    readonly locations: readonly {
      readonly path: string;
      readonly line: number;
      readonly character: number;
      readonly label: string;
    }[];
    readonly x: number;
    readonly y: number;
    readonly cursorHeight: number;
  },) => void;
  /**
   * Hides popup.
   */
  readonly hide: () => void;
  /**
   * Accepts selected reference.
   */
  readonly accept: () => ReferenceSelectDetail | null;
  /**
   * Selects reference without exposing raw DOM event dispatch.
   */
  readonly selectReference: (location: ReferenceLocation,) => ReferenceSelectDetail;
  /**
   * Moves selection.
   */
  readonly navigate: (opts: { readonly direction: 'up' | 'down'; },) => void;
};

/**
 * Rename input surface consumed by LSP app modules.
 */
export type RenameInputHandle = {
  /**
   * Registers DOM event listeners on rename input.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Shows input near cursor.
   */
  readonly show: (opts: {
    readonly placeholder: string;
    readonly x: number;
    readonly y: number;
  },) => void;
};

/**
 * File tree surface consumed by app modules.
 */
export type FileTreeHandle = {
  /**
   * Registers DOM event listeners on tree.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Selected directory path, or empty string.
   */
  readonly selectedDir: string;
  /**
   * Current expanded directories.
   */
  readonly expandedDirs: readonly string[];
  /**
   * Installs directory fetcher.
   */
  fetchDir: ((path: string,) => Promise<readonly DirEntry[]>) | null;
  /**
   * Installs context-action handler.
   */
  onContextAction: ((action: ContextAction,) => void) | null;
  /**
   * Installs directory-expanded handler.
   */
  onDirExpanded: ((path: string,) => void) | null;
  /**
   * Renders root directory.
   */
  readonly expandRoot: (rootPath: string,) => Promise<void>;
  /**
   * Restores expanded directories.
   */
  readonly restoreExpansion: (opts: { readonly dirs: readonly string[]; },) => Promise<void>;
  /**
   * Updates recent file markers.
   */
  readonly updateRecency: (opts: { readonly paths: readonly string[]; },) => void;
  /**
   * Reveals files in tree.
   */
  readonly revealFiles: (opts: { readonly paths: readonly string[]; },) => Promise<void>;
  /**
   * Scrolls file into view.
   */
  readonly scrollToFile: (opts: { readonly path: string; },) => void;
  /**
   * Refreshes directory entries.
   */
  readonly refreshDir: (opts: { readonly path: string; },) => Promise<void>;
};

/**
 * Search overlay surface consumed by app modules.
 */
export type SearchOverlayHandle = {
  /**
   * Registers DOM event listeners on overlay.
   */
  readonly addEventListener: HTMLElement['addEventListener'];
  /**
   * Installs root-dir resolver.
   */
  getRootDir: (() => string) | null;
  /**
   * Installs search callback.
   */
  onSearch: ((query: string,) => Promise<readonly SearchResult[]>) | null;
};

/**
 * Loads a file from the server into the appropriate viewer.
 * Optionally scrolls to a specific line and character position.
 */
export type LoadFileFn = (
  opts: {
    readonly path: string;
    readonly line?: number | undefined;
    readonly character?: number | undefined;
  },
) => Promise<void>;

/**
 * Returns the absolute path of the currently open file, or null
 * when no file is open.
 */
export type GetCurrentFilePathFn = () => string | null;

/**
 * Boot result from session restore.
 */
export type RestoreSessionResult = {
  /**
   * File opened during boot, or null.
   */
  readonly filePath: string | null;
  /**
   * Saved recent files.
   */
  readonly recentFiles: readonly string[];
  /**
   * File kind restored by loader, if any.
   */
  readonly currentFileKind?: FileKind;
};
