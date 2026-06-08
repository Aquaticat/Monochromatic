import {
  initPromise,
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Root tagged logger for the markdown-lint CLI. Sub-modules compose deeper tags
 * via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * import { l, tagged } from './log.ts';
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('linted file');
 * ```
 */
export const l: Logger = tagged({
  tag: 'cli-markdown-lint',
  l: logger,
},);

export type { Logger, };
export { tagged, };
