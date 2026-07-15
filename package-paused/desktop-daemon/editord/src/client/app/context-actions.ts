/**
 * Context menu action dispatcher for the file tree.
 *
 * Maps {@link ContextAction} variants (with already-resolved user input)
 * to WebSocket requests. No UI prompts: input collection happens
 * in the inline prompt bar before actions reach this function.
 */

import type { ContextAction, } from '../file-tree/file-tree.ts';
import {
  l,
  tagged,
} from '../log.ts';
import { showFixedToast, } from '../toast/toast.ts';

import type { EditorWsClientHandle, } from './types.ts';

/**
 * Tagged logger for the context-actions dispatcher.
 */
const contextLog = tagged({
  tag: 'context-actions',
  l,
},);

/**
 * Sends the WebSocket request for a filesystem context action.
 * All user input (names, paths) is already present in the action payload.
 *
 * @param action - fully resolved context menu action
 *
 * @param ws - WebSocket client for sending requests
 *
 * @throws when the server rejects the operation
 *
 * @example
 * ```ts
 * await dispatchFsAction({ action: 'newFile', ws: ws, });
 * ```
 */
export async function dispatchFsAction({
  action,
  ws,
}: {
  readonly action: ContextAction;
  readonly ws: EditorWsClientHandle;
},): Promise<void> {
  if (action.kind
    === 'delete') {
    await ws.request({
      type: 'deleteEntry',
      path: action.path,
    },);
  }
  else if (action.kind
    === 'copy') {
    await ws.request({
      type: 'copyEntry',
      path: action.path,
      destPath: action
        .destPath,
    },);
  }
  else if (action.kind
    === 'move') {
    await ws.request({
      type: 'moveEntry',
      path: action.path,
      destPath: action
        .destPath,
    },);
  }
  else if (action.kind
    === 'new') {
    /**
     * Trailing slash in the user-entered name signals a directory creation.
     */
    const isDirectory = action.name
      .endsWith('/',);
    /**
     * Entry name without the trailing slash; the protocol carries the directory bit separately.
     */
    const name = isDirectory
      ? action.name
        .slice(
        0,
        -1,
      )
      : action.name;
    await ws.request({
      type: 'newEntry',
      parentPath: action.parentPath,
      name,
      isDirectory,
    },);
  }
  else if (action.kind
    === 'openInTerminal') {
    await ws.request({
      type: 'openInTerminal',
      path: action.path,
    },);
  }
  else if (action.kind
    === 'openInDefaultApp') {
    await ws.request({
      type: 'openInDefaultApp',
      path: action.path,
    },);
  }
}

/**
 * Dispatches a filesystem context action with error handling.
 * Wraps {@link dispatchFsAction} and shows a toast on failure.
 *
 * @param action - context menu action to dispatch
 *
 * @param ws - WebSocket client
 *
 * @example
 * ```ts
 * await dispatchContextAction({ action: { kind: 'delete', path: '/tmp/old' }, ws, });
 * ```
 */
export async function dispatchContextAction({
  action,
  ws,
}: {
  readonly action: ContextAction;
  readonly ws: EditorWsClientHandle;
},): Promise<void> {
  try {
    await dispatchFsAction({
      action,
      ws,
    },);
  }
  catch (error) {
    contextLog.error(`context action failed: ${String(error,)}`,);
    showFixedToast({ message: `Action failed: ${String(error,)}`, },);
  }
}
