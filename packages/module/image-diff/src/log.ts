import {
  initPromise,
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Root tagged logger for the image-diff library.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('comparing images');
 * ```
 */
export const l: Logger = tagged({
  tag: 'image-diff',
  l: logger,
},);

export type { Logger, };
export { tagged, };
