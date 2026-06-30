/**
 * Async timing primitives.
 *
 * - {@link wait}`(ms)`: resolves after a delay; thin wrapper over `setTimeout`.
 * - {@link withTimeout}`({ promise, ms, label })`: races a promise against a
 *   deadline and rejects with a labeled error if the deadline wins.
 *
 * @example
 * ```ts
 * import { wait, withTimeout, } from '\@monochromatic-dev/module-async-time';
 *
 * await wait(500,);
 *
 * const data = await withTimeout({
 *   promise: fetch('/api/data',),
 *   ms: 5000,
 *   label: 'fetch user data',
 * },);
 * ```
 *
 * @packageDocumentation
 */

export { wait, } from './wait.ts';

export { withTimeout, } from './with-timeout.ts';
