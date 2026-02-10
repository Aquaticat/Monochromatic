import {
  type UserConfigFnObject,
} from 'vite';

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
  createBaseConfig,
} from './base-configs.ts';

export {
  rolldownExternal,
  rollupExternal,
  // From utils.ts
  viteNoopPlugin,
} from './utilities.ts';

// Type re-exports from vite
export { type UserConfigFnObject, } from 'vite';
