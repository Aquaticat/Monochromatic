import {
  initPromise,
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Root tagged logger for terminal-exec subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('starting resolution');
 * ```
 */
export const l: Logger = tagged({
  tag: 'terminal-exec',
  l: logger,
},);

export type { Logger, };
export { tagged, };
