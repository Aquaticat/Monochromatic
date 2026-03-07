import type { $ as Logger } from '../../../../../../t/index.ts';
import { $ as defaultLogger } from '../../../../../../f/t never/r s/p p/index.ts';

/**
 * Wraps a logger so every message is prefixed with `[tag] `.
 * Callers typically pass `myFn.name` as tag to keep prefixes
 * in sync with refactors.
 *
 * @param tag - Prefix string inserted before each message
 * @param l - Base logger to wrap; defaults to the module-level singleton
 * @returns Logger whose methods prepend `[tag] ` to every message
 *
 * @example
 * ```ts
 * import { $ as tagged } from './index.ts';
 *
 * function handleRequest({ l }: { l: Logger }): void {
 *   l.info('received');
 * }
 *
 * handleRequest({ l: tagged({ tag: handleRequest.name }) });
 * // logs: [handleRequest] received
 * ```
 *
 * @example
 * ```ts
 * // Composing tags
 * const l1 = tagged({ tag: 'http' });
 * const l2 = tagged({ tag: 'retry', l: l1 });
 * l2.info('attempt 3');
 * // logs: [retry] [http] attempt 3
 * ```
 */
export function $({ tag, l = defaultLogger }: { l?: Logger; tag: string }): Logger {
  const prefix = `[${tag}] `;
  return {
    debug: (message: string): void => l.debug(`${prefix}${message}`),
    error: (message: string): void => l.error(`${prefix}${message}`),
    fatal: (message: string): void => l.fatal(`${prefix}${message}`),
    info: (message: string): void => l.info(`${prefix}${message}`),
    trace: (message: string): void => l.trace(`${prefix}${message}`),
    warn: (message: string): void => l.warn(`${prefix}${message}`),
  };
}
