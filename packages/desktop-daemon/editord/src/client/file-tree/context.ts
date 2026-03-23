/**
 * Context menu item builders for the file tree.
 *
 * Creates arrays of `ContextMenuItem` for directory and file
 * entries in the tree sidebar.
 */

import type { ContextMenu, } from '../context-menu/context-menu.ts';
import type { ContextMenuItem, } from '../context-menu/items.ts';
import type { ContextAction, } from './types.ts';

/**
 * Shows a directory context menu at the given coordinates.
 *
 * @param contextMenu - context menu instance
 *
 * @param x - horizontal click position in pixels
 *
 * @param y - vertical click position in pixels
 *
 * @param path - absolute directory path
 *
 * @param onAction - callback for the selected action
 */
export function showDirContextMenu({ contextMenu, x, y, path, onAction, }: {
  contextMenu: ContextMenu;
  x: number;
  y: number;
  path: string;
  onAction: (action: ContextAction,) => void;
}): void {
  contextMenu.show({ x, y, items: buildDirContextItems({ path, onAction, },), },);
}

/**
 * Shows a file context menu at the given coordinates.
 *
 * @param contextMenu - context menu instance
 *
 * @param x - horizontal click position in pixels
 *
 * @param y - vertical click position in pixels
 *
 * @param path - absolute file path
 *
 * @param onAction - callback for the selected action
 */
export function showFileContextMenu({ contextMenu, x, y, path, onAction, }: {
  contextMenu: ContextMenu;
  x: number;
  y: number;
  path: string;
  onAction: (action: ContextAction,) => void;
}): void {
  contextMenu.show({ x, y, items: buildFileContextItems({ path, onAction, },), },);
}

/**
 * Builds context menu items for a directory entry.
 *
 * @param path - absolute directory path
 *
 * @param onAction - callback invoked with the selected action
 *
 * @returns array of menu items for the directory context menu
 */
export function buildDirContextItems({ path, onAction, }: {
  path: string;
  onAction: (action: ContextAction,) => void;
}): ContextMenuItem[] {
  return [
    { label: 'New', defaultValue: '', action: function newEntry(name,): void { if (name !== undefined) onAction({ kind: 'new', parentPath: path, name, },); }, },
    { label: 'Copy to', defaultValue: path, action: function copy(destPath,): void { if (destPath !== undefined) onAction({ kind: 'copy', path, destPath, },); }, },
    { label: 'Move to', defaultValue: path, action: function move(destPath,): void { if (destPath !== undefined) onAction({ kind: 'move', path, destPath, },); }, },
    { label: 'Delete', action: function del(): void { onAction({ kind: 'delete', path, },); }, },
    { label: 'Open in terminal', action: function openTerm(): void { onAction({ kind: 'openInTerminal', path, },); }, },
  ];
}

/**
 * Builds context menu items for a file entry.
 *
 * @param path - absolute file path
 *
 * @param onAction - callback invoked with the selected action
 *
 * @returns array of menu items for the file context menu
 */
export function buildFileContextItems({ path, onAction, }: {
  path: string;
  onAction: (action: ContextAction,) => void;
}): ContextMenuItem[] {
  return [
    { label: 'Copy to', defaultValue: path, action: function copy(destPath,): void { if (destPath !== undefined) onAction({ kind: 'copy', path, destPath, },); }, },
    { label: 'Move to', defaultValue: path, action: function move(destPath,): void { if (destPath !== undefined) onAction({ kind: 'move', path, destPath, },); }, },
    { label: 'Delete', action: function del(): void { onAction({ kind: 'delete', path, },); }, },
    { label: 'Open in default app', action: function openApp(): void { onAction({ kind: 'openInDefaultApp', path, },); }, },
  ];
}
