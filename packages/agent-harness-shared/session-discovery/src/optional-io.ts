/**
 * Optional IO option construction for exact optional property types.
 *
 * @module
 */

import type { SessionDiscoveryIo, } from './types.ts';

/**
 * Object carrying optional IO only when a caller supplied concrete IO.
 */
type OptionalSessionDiscoveryIoOption = {
  /**
   * Optional test IO seam.
   */
  readonly io?: SessionDiscoveryIo;
};

/**
 * Builds an object safe to spread into exact optional parameter objects.
 *
 * @param io - optional test IO seam
 *
 * @returns object with `io` present only when concrete IO was supplied
 *
 * @example
 * ```ts
 * readTextFile({ path: '/tmp/file', ...optionalSessionDiscoveryIo(io) });
 * ```
 */
function optionalSessionDiscoveryIo(io?: SessionDiscoveryIo,): OptionalSessionDiscoveryIoOption {
  if (io === undefined)
    return {};

  return { io, };
}

export { optionalSessionDiscoveryIo, };
