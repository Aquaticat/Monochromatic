/**
 * Sandboxed preload script installing the typed file-manager bridge.
 *
 * Bundled to CommonJS because Electron's sandboxed preload runtime does not
 * load ESM; the renderer itself stays a browser ES module and only sees the
 * `contextBridge`-exposed surface.
 *
 * @example
 * ```ts
 * // Electron loads this file from dist/app/preload.cjs.
 * ```
 */

import {
  contextBridge,
  ipcRenderer,
} from 'electron';

import type {
  BridgeFileEntry,
  FileManagerBridge,
  ObservedStripState,
} from './bridge-types.js';
import {
  INITIAL_ROOT_CHANNEL,
  LIST_DIRECTORY_CHANNEL,
  REPORT_STATE_CHANNEL,
} from './ipc-channels.js';

/**
 * Bridge implementation forwarded over IPC to the main process.
 */
const bridge: FileManagerBridge = {
  initialRoot: async function initialRoot(): Promise<string> {
    return await (ipcRenderer.invoke(INITIAL_ROOT_CHANNEL,) as Promise<string>);
  },
  listDirectory: async function listDirectory(path: string,): Promise<readonly BridgeFileEntry[]> {
    return await (ipcRenderer.invoke(
      LIST_DIRECTORY_CHANNEL,
      path,
    ) as Promise<readonly BridgeFileEntry[]>);
  },
  reportState: function reportState(state: ObservedStripState,): void {
    ipcRenderer.send(
      REPORT_STATE_CHANNEL,
      state,
    );
  },
};

contextBridge.exposeInMainWorld(
  'fileManagerBridge',
  bridge,
);
