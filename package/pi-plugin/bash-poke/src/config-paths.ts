/**
 Bash-poke settings path helpers.

 @module
 */

import { join, } from 'node:path';

import {
  CONFIG_FILE_NAME,
  PI_EXTENSION_CONFIG_DIR,
} from './constants.ts';

//region Path helpers

/**
 Resolves global bash-poke settings path for a home directory.
 
 @param home - home directory the `.pi` tree lives below
 
 @returns absolute settings path
 
 @example
 ```ts
 configPathForHome({ home: '/home/user', },);
 ```
 */
function configPathForHome({ home, }: { readonly home: string; },): string {
  return join(
    home,
    PI_EXTENSION_CONFIG_DIR,
    CONFIG_FILE_NAME,
  );
}

//endregion Path helpers

export { configPathForHome, };
