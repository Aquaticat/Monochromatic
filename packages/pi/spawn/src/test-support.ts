/**
 * Unit-test helpers for spawn-pi.
 *
 * @module
 */

import {
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join, } from 'node:path';
import { tmpdir, } from 'node:os';

//region Disposable helpers

/**
 * Sentinel value requesting environment variable removal.
 *
 * @example
 * ```typescript
 * envVar({ name: 'X', value: CLEAR_ENV });
 * ```
 */
const CLEAR_ENV: unique symbol = Symbol('spawn pi test environment variable cleared',);

/**
 * Disposable temporary directory handle.
 */
type TempDirHandle = Disposable & {
  /**
   * Temporary directory path.
   */
  readonly path: string;
};

/**
 * Creates temporary directory removed on disposal.
 *
 * @param prefix - filename prefix under OS temp directory.
 *
 * @returns disposable temp directory handle.
 *
 * @example
 * ```typescript
 * using dir = tempDir({ prefix: 'spawn-pi-' });
 * ```
 */
function tempDir(
  {
    prefix,
  }: {
    readonly prefix: string;
  },
): TempDirHandle {
  /**
   * Temporary directory path created for test.
   */
  const dirPath = mkdtempSync(join(
    tmpdir(),
    prefix,
  ),);

  return {
    path: dirPath,
    [Symbol.dispose]() {
      rmSync(
        dirPath,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Temporarily sets or clears an environment variable.
 *
 * @param name - environment variable name.
 *
 * @param value - replacement value, or `CLEAR_ENV` to delete.
 *
 * @returns disposable environment override.
 *
 * @example
 * ```typescript
 * using env = envVar({ name: 'PI_CODING_AGENT_DIR', value: '/tmp/pi' });
 * ```
 */
function envVar(
  {
    name,
    value,
  }: {
    readonly name: string;
    readonly value: string | typeof CLEAR_ENV;
  },
): Disposable {
  /**
   * Previous value restored on disposal.
   */
  const previous = process.env[name];

  if (value === CLEAR_ENV)
    Reflect.deleteProperty(
      process.env,
      name,
    );
  else
    process.env[name] = value;

  return {
    [Symbol.dispose]() {
      if (previous === undefined) {
        Reflect.deleteProperty(
          process.env,
          name,
        );
      }
      else
        process.env[name] = previous;
    },
  };
}

//endregion Disposable helpers

export {
  CLEAR_ENV,
  envVar,
  tempDir,
};
export type { TempDirHandle, };
