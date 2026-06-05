import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

/**
 * Writes one diagnostic line to stderr.
 *
 * The module console sink routes `info`/`debug`/`trace` to STDOUT under both
 * Node and Bun, but this CLI reserves STDOUT for the JSONL stream. So the base
 * logger writes every level to STDERR instead, keeping stdout pure for
 * `jq`/parsers while diagnostics stay visible.
 *
 * @param level - severity label
 *
 * @param message - already tag-prefixed message
 *
 * @example
 * ```ts
 * writeStderr({ level: 'info', message: '[tag] hello' });
 * ```
 */
function writeStderr({
  level,
  message,
}: {
  readonly level: string;
  readonly message: string
},): void {
  process.stderr
    .write(`[${level}] ${message}\n`,);
}

/**
 * Base logger that sends every level to stderr, so the JSONL stdout stays pure.
 */
const stderrLogger: Logger = {
  debug: function debug(message: string,): void {
    writeStderr({
      level: 'debug',
      message,
    },);
  },
  error: function error(message: string,): void {
    writeStderr({
      level: 'error',
      message,
    },);
  },
  fatal: function fatal(message: string,): void {
    writeStderr({
      level: 'fatal',
      message,
    },);
  },
  flush: function flush(): Promise<void> {
    return Promise.resolve();
  },
  info: function info(message: string,): void {
    writeStderr({
      level: 'info',
      message,
    },);
  },
  trace: function trace(message: string,): void {
    writeStderr({
      level: 'trace',
      message,
    },);
  },
  warn: function warn(message: string,): void {
    writeStderr({
      level: 'warn',
      message,
    },);
  },
};

/**
 * Root tagged logger for all git-clone-size subsystems, routed to stderr.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * import { l, tagged } from './log.ts';
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('measured shallow object store');
 * ```
 */
export const l: Logger = tagged({
  tag: 'cli-git-clone-size',
  l: stderrLogger,
},);

export type { Logger, };
export { tagged, };
