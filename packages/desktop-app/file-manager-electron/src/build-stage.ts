/**
 * Stages static files and package metadata for the Electron app directory.
 *
 * @example
 * ```ts
 * await stageFileManagerApp();
 * ```
 */

import { stageElectronApp, } from '@monochromatic-dev/desktop-app-electron-infra/ts/stage';

/**
 * Stages this package's no-Vite Electron app output.
 *
 * @example
 * ```ts
 * await stageFileManagerApp();
 * ```
 */
async function stageFileManagerApp(): Promise<void> {
  await stageElectronApp({
    packageRoot: process.cwd(),
    staticAssets: [
      'index.html',
      'styles.css',
    ],
  },);
}

await stageFileManagerApp();
