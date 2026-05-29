import {
  initPromise,
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Root tagged logger for the token-count library.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('counting tokens');
 * ```
 */
export const l: Logger = tagged({
  tag: 'token-count',
  l: logger,
},);

export type { Logger, };
export { tagged, };
