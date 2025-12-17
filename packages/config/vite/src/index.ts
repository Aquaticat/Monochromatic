/* eslint-disable @typescript-eslint/no-duplicate-type-constituents -- vitest and vite right now has the exact same types, but may not be sometimes */
import {
  mergeConfig,
  type PluginOption,
  type UserConfig,
  type UserConfigFnObject,
} from 'vite';
import {
  join,
  resolve,
} from 'node:path';
import { viteSingleFile, } from 'vite-plugin-singlefile';

// Import from internal modules
import {
  createModeConfig,
} from './config-modifiers.ts';
import {
  createBaseConfig,
  createBaseLibConfig,
} from './base-configs.ts';
import {
  createFigmaBackendConfig,
  createPrefixedFrontendLikeConfig,
  createUnprefixedFrontendLikeConfig,
} from './figma.ts';
import {
  readFileWithRetry,
} from './utils.ts';
import {
  vitestOnlyConfigWorkspace,
  vitestOnlyUnitConfigWorkspace,
  vitestOnlyBrowserConfigWorkspace,
  createVitestBaseUnitConfigWorkspace,
  createVitestBaseBrowserConfigWorkspace,
  getVitestUnitWorkspace,
  getVitestBrowserWorkspace,
  type VitestUserConfigFnObject,
} from './vitest-configs.ts';

//region Public API -- Exported configuration factories

/**
 @remarks
 Use it like this:

```ts
 import { getShared, UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

 export default getShared(import.meta.dirname) satisfies UserConfigFnObject;
```
 */
export const getShared = (configDir: string,): UserConfigFnObject =>
  createModeConfig(configDir, createBaseConfig,);

export const getLib = (configDir: string,): UserConfigFnObject =>
  createModeConfig(configDir, createBaseLibConfig,);

export const getFigmaBackend = (configDir: string,): UserConfigFnObject =>
  createModeConfig(configDir, createFigmaBackendConfig,);

export const getFrontend = (
  configDir: string,
  options: { singleFile: boolean; } = {
    singleFile: true,
  },
): UserConfigFnObject =>
  createModeConfig(configDir, function withOptions(configDir: string,) {
    return createUnprefixedFrontendLikeConfig(configDir, options,);
  },);

export const getFigmaFrontend = (configDir: string,): UserConfigFnObject =>
  createModeConfig(configDir, function createFigmaFrontendConfig(configDir,) {
    return mergeConfig(createPrefixedFrontendLikeConfig(configDir, 'frontend',), {
      plugins: [
        (function inlineIframePlugin(): PluginOption {
          const iframePath = join(configDir, 'dist/final/iframe/src/iframe/index.html',);
          return {
            name: 'vite-plugin-inline-iframe',
            enforce: 'post',
            buildStart(): void {
              this.addWatchFile(iframePath,);
            },
            async transformIndexHtml(html,): Promise<string> {
              if (html.includes('REPLACE_WITH_IFRAME_INDEX_HTML',)) {
                console.log('replacing iframe',);
                const iframeFileContent = await readFileWithRetry(iframePath, 'utf8',);
                return html.replace(
                  'REPLACE_WITH_IFRAME_INDEX_HTML',
                  iframeFileContent.replaceAll("'", '&apos;',),
                );
              }
              return html;
            },
          };
        })(),
      ],
    },);
  },);

/** */
export const getFigmaIframe = (configDir: string,): UserConfigFnObject =>
  createModeConfig(configDir, function createFigmaIframeConfig(configDir,) {
    return createPrefixedFrontendLikeConfig(configDir, 'iframe',);
  },);

//endregion Public API

// Re-export everything that was publicly exported before
export {
  // From utils.ts
  viteNoopPlugin,
  rollupExternal,
  rolldownExternal,
} from './utils.js';

export {
  // From vitest-configs.ts
  vitestOnlyConfigWorkspace,
  vitestOnlyUnitConfigWorkspace,
  vitestOnlyBrowserConfigWorkspace,
  createVitestBaseUnitConfigWorkspace,
  createVitestBaseBrowserConfigWorkspace,
  getVitestUnitWorkspace,
  getVitestBrowserWorkspace,
  type VitestUserConfigFnObject,
} from './vitest-configs.js';

// Type re-exports from vite and vitest
export {
  type UserConfigFnObject,
} from 'vite';
