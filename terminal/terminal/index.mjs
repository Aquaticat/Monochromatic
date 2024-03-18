import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { $ } from 'execa';

const $$ = $({ detached: true, shell: true });

let win;

const createWindow = () => {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(path.resolve(), 'preload.mjs'), nodeIntegration: true },
  });

  win.loadFile('index.html');
  win.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();
  ipcMain.on('execute', async (_event, value) => {
    const { stdout } = await $$`${value}`;
    win.webContents.send('onExecute', stdout);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
