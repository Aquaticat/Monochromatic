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
    readonly kind: 'delete';
    readonly path: string;
  }
  | {
    readonly kind: 'copy';
    readonly path: string;
    readonly destPath: string;
  }
  | {
    readonly kind: 'move';
    readonly path: string;
    readonly destPath: string;
  }
  | {
    readonly kind: 'new';
    readonly parentPath: string;
    readonly name: string;
  }
  | {
    readonly kind: 'openInTerminal';
    readonly path: string;
  }
  | {
    readonly kind: 'openInDefaultApp';
    readonly path: string;
  };
