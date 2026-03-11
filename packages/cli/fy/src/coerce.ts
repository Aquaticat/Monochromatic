import { l, tagged } from './log.ts';

/**
 * Coerces a string argument to a JS value by attempting `JSON.parse`.
 * Falls back to the raw string if parsing fails.
 *
 * @param arg - Raw CLI argument string
 * @returns Parsed value (number, boolean, null, object, array) or original string
 *
 * @example
 * ```ts
 * coerceArg({ arg: '42' });    // => 42
 * coerceArg({ arg: 'true' });  // => true
 * coerceArg({ arg: 'hello' }); // => 'hello'
 * coerceArg({ arg: '[1,2]' }); // => [1, 2]
 * ```
 */
export function coerceArg({ arg }: { arg: string }): unknown {
  const rl = tagged({ tag: coerceArg.name, l });
  try {
    const parsed: unknown = JSON.parse(arg);
    rl.info(`"${arg}" => ${typeof parsed} ${String(parsed)}`);
    return parsed;
  } catch {
    rl.info(`"${arg}" => string (raw)`);
    return arg;
  }
}
