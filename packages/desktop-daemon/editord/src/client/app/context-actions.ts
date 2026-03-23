/**
 * Context menu action dispatcher for the file tree.
 *
 * Maps {@link ContextAction} variants (with already-resolved user input)
 * to WebSocket requests. No UI prompts — input collection happens
 * in the inline prompt bar before actions reach this function.
 */

import type { ContextAction, } from '../file-tree/file-tree.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/**
 * Sends the WebSocket request for a filesystem context action.
 * All user input (names, paths) is already present in the action payload.
 *
 * @param action - fully resolved context menu action
 *
 * @param ws - WebSocket client for sending requests
 *
 * @throws when the server rejects the operation
 */
export async function dispatchFsAction({ action, ws, }: {
  action: ContextAction;
  ws: EditorWsClient;
}): Promise<void> {
  if (action.kind === 'delete') {
    await ws.request({ type: 'deleteEntry', path: action.path, },);
  }
  else if (action.kind === 'copy') {
    await ws.request({ type: 'copyEntry', path: action.path, destPath: action.destPath, },);
  }
  else if (action.kind === 'move') {
    await ws.request({ type: 'moveEntry', path: action.path, destPath: action.destPath, },);
  }
  else if (action.kind === 'new') {
    const isDirectory = action.name.endsWith('/');
    const name = isDirectory ? action.name.slice(0, -1,) : action.name;
    await ws.request({ type: 'newEntry', parentPath: action.parentPath, name, isDirectory, },);
  }
  else if (action.kind === 'openInTerminal') {
    await ws.request({ type: 'openInTerminal', path: action.path, },);
  }
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: exhaustive check against ContextAction union
  else if (action.kind === 'openInDefaultApp') {
    await ws.request({ type: 'openInDefaultApp', path: action.path, },);
  }
}
