import {
  initPromise,
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Root tagged logger for all git-clone-size subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * Every diagnostic in this package logs at `debug`, which the module logger
 * silences unless verbose mode is active (`DEBUG=true` env or `--verbose`
 * argv). So a normal run emits nothing but the JSONL stream, while a verbose
 * run surfaces the full probe trace.
 *
 * @example
 * ```ts
 * import { l, tagged } from './log.ts';
 * const rl = tagged({ tag: myFn.name, l });
 * rl.debug('measured shallow object store');
 * ```
 */
export const l: Logger = tagged({
  tag: 'cli-git-clone-size',
  l: logger,
},);

export type { Logger, };
export { tagged, };
