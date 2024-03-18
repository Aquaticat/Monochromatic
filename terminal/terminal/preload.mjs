// biome-ignore : otherwise swallows whole file
import { contextBridge, ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {});

contextBridge.exposeInMainWorld('electronAPI', {
  onExecute: (callback) => ipcRenderer.on('onExecute', (_event, value) => callback(value)),
  execute: (value) => ipcRenderer.send('execute', value),
});
