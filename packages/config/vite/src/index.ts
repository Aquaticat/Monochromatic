/* eslint-disable @typescript-eslint/no-duplicate-type-constituents -- vitest and vite right now has the exact same types, but may not be sometimes */
import {
  join,
  resolve,
} from 'node:path';
import {
  mergeConfig,
  type PluginOption,
  type UserConfig,
  type UserConfigFnObject,
} from 'vite';
import { viteSingleFile, } from 'vite-plugin-singlefile';

// Import from internal modules
import { createBaseConfig, } from './base-configs.ts';
import { createModeConfig, } from './config-modifiers.ts';

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

//endregion Public API

// Re-export everything that was publicly exported before
export {
  rolldownExternal,
  rollupExternal,
  // From utils.ts
  viteNoopPlugin,
} from './utilities.ts';

export {
  createVitestBaseBrowserConfigWorkspace,
  createVitestBaseUnitConfigWorkspace,
  getVitestBrowserWorkspace,
  getVitestUnitWorkspace,
  vitestOnlyBrowserConfigWorkspace,
  // From vitest-configs.ts
  vitestOnlyConfigWorkspace,
  vitestOnlyUnitConfigWorkspace,
  type VitestUserConfigFnObject,
} from './vitest-configs.js';

// Type re-exports from vite and vitest
export { type UserConfigFnObject, } from 'vite';
