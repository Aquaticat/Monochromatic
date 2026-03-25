/**
 * Shared types for the file tree component.
 *
 * Extracted to avoid circular imports between `file-tree.ts`
 * and its context menu module.
 */

/**
 * Action dispatched from the file tree context menu.
 * Each variant carries the full payload for the server to execute.
 */
export type ContextAction =
  | {
    kind: 'delete';
    path: string
  }
  | {
    kind: 'copy';
    path: string;
    destPath: string
  }
  | {
    kind: 'move';
    path: string;
    destPath: string
  }
  | {
    kind: 'new';
    parentPath: string;
    name: string
  }
  | {
    kind: 'openInTerminal';
    path: string
  }
  | {
    kind: 'openInDefaultApp';
    path: string
  };
