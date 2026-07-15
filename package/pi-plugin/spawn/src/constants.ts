/**
 * Constants shared by spawn-pi CLI and extension modules.
 *
 * @module
 */

//region Environment variables

/**
 * Environment variable carrying spawn identifier into child Pi process.
 *
 * @example
 * ```typescript
 * process.env[SPAWN_ID_ENV] = 'uuid';
 * ```
 */
const SPAWN_ID_ENV = 'PI_SPAWN_ID';

/**
 * Environment variable carrying current extension entry path from parent Pi process.
 *
 * @example
 * ```typescript
 * process.env[SPAWN_EXTENSION_PATH_ENV] = '/pkg/dist/final/node/index.mjs';
 * ```
 */
const SPAWN_EXTENSION_PATH_ENV = 'PI_SPAWN_EXTENSION_PATH';

//endregion Environment variables

//region Custom message identifiers

/**
 * Custom message type used for parent-visible spawn result injections.
 *
 * @example
 * ```typescript
 * pi.sendMessage({ customType: SPAWN_PI_CUSTOM_TYPE, content: 'done', display: true });
 * ```
 */
const SPAWN_PI_CUSTOM_TYPE = 'spawn-pi';

//endregion Custom message identifiers

export {
  SPAWN_EXTENSION_PATH_ENV,
  SPAWN_ID_ENV,
  SPAWN_PI_CUSTOM_TYPE,
};
