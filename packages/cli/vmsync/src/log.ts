import {
  initPromise,
  logger,
  tagged,
  type Logger as ModuleLogger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Readonly logger handle passed through vmsync subsystems.
 * Wraps the upstream mutable {@link ModuleLogger} so loggers travel as
 * call-only handles: `prefer-readonly-parameter-types` accepts them
 * without recursing into the upstream method properties.
 */
export type Logger = Readonly<ModuleLogger>;

/**
 * Root tagged logger for all vmsync subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('starting operation');
 * ```
 */
export const l: Logger = tagged({
  tag: 'vmsync',
  l: logger,
},);

export { tagged, };
