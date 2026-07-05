/**
 * Pi guardrail config path helpers.
 *
 * @module
 */

import { join, } from 'node:path';

import {
  GUARDRAIL_CONFIG_FILE_NAME,
  PI_EXTENSION_CONFIG_DIR,
} from './constants.ts';

//region Path helpers

/**
 * Resolves global guardrail config path for a home directory.
 *
 * @param home - home directory
 *
 * @returns absolute config path
 *
 * @example
 * ```typescript
 * configPathForHome({ home: '/home/user' });
 * ```
 */
function configPathForHome({ home, }: { readonly home: string; }): string {
  return join(
    home,
    PI_EXTENSION_CONFIG_DIR,
    GUARDRAIL_CONFIG_FILE_NAME,
  );
}

//endregion Path helpers

export { configPathForHome, };
